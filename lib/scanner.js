/**
 * Scanner — file system operations for project discovery and cleanup.
 *
 * Uses native OS commands for speed:
 *   macOS:   mdfind (Spotlight) for discovery, du -sk for sizing
 *   Linux:   find for combined discovery + target detection, du -sk for sizing
 *   Windows: PowerShell for discovery + sizing
 *
 * Falls back to Sciter fs API if native commands fail.
 * Respects user settings: scanDepth, exclusions, staleDays, deepScan.
 */

import * as env from "@env";
import * as Sciter from "@sciter";
import * as sys from "@sys";
import { fs } from "@sys";
import * as Registry from "./registry.js";

// ===== File system helpers =====

function joinPath(base, name) {
  return base.endsWith("/") ? base + name : base + "/" + name;
}

function stat(path) {
  return fs.$stat(path);
}

function listDir(path) {
  return fs.$readdir(path) || [];
}

function isDirectory(path) {
  return !!stat(path)?.isDirectory;
}

// ===== Native command helpers =====

/**
 * Read all data from a pipe and return as string.
 */
async function readPipe(pipe) {
  let output = "";
  try {
    while (pipe) {
      const buf = await pipe.read();
      if (!buf || buf.byteLength === 0) break;
      output += Sciter.decode(buf);
    }
  } catch (e) { /* pipe closed */ }
  return output;
}

/**
 * Run a native command and return stdout as string.
 * Returns null if the command fails.
 */
async function runCommand(args) {
  try {
    const proc = sys.spawn(args, { stdout: "pipe", stderr: "pipe" });
    if (!proc) return null;
    const output = await readPipe(proc.stdout);
    await proc.wait();
    return output;
  } catch (e) {
    return null;
  }
}

// ===== Discovery helpers =====

/**
 * Get all marker file names from registry (for discovery queries).
 */
function getMarkerNames() {
  const names = new Set();
  for (const def of Registry.getAll()) {
    for (const marker of def.markers) {
      if (marker.startsWith("*.")) continue; // skip globs for native commands
      names.add(marker);
    }
  }
  return Array.from(names);
}

/**
 * Build -name args for a `find` command: (-name "a" -o -name "b" ...)
 */
function buildNameArgs(names) {
  const args = [];
  for (const n of names) {
    if (args.length > 0) args.push("-o");
    args.push("-name", n);
  }
  return args;
}

/**
 * Parse a discovered file path into project dir + entry name.
 * Returns null if the path doesn't match expected depth constraints.
 */
function parseRelativePath(filePath, rootPath, scanDepth) {
  const relative = filePath.slice(rootPath.length + 1);
  const parts = relative.split("/");
  // Need at least 2 parts (projectDir/entry) and at most scanDepth+1
  if (parts.length < 2 || parts.length > scanDepth + 1) return null;

  const entryName = parts[parts.length - 1];
  const projectRel = parts.slice(0, -1).join("/");
  const projectPath = joinPath(rootPath, projectRel);
  return { projectPath, entryName };
}

// ===== Native project discovery =====

/**
 * Discover projects under a root using Spotlight (macOS).
 * mdfind uses the Spotlight index — instant, no disk walking.
 * Returns { projects: Map<dirPath, Set<markers>>, targets: null }
 */
async function discoverProjectsSpotlight(rootPath, scanDepth) {
  const markers = getMarkerNames();
  if (markers.length === 0) return { projects: new Map(), targets: null };

  const query = markers.map(m => `kMDItemFSName == '${m}'`).join(" || ");
  const output = await runCommand(["mdfind", "-onlyin", rootPath, query]);
  if (!output) return null;

  const projectMap = new Map();
  for (const line of output.split("\n")) {
    const filePath = line.trim();
    if (!filePath) continue;

    const parsed = parseRelativePath(filePath, rootPath, scanDepth);
    if (!parsed) continue;

    if (!projectMap.has(parsed.projectPath)) {
      projectMap.set(parsed.projectPath, new Set());
    }
    projectMap.get(parsed.projectPath).add(parsed.entryName);
  }

  return { projects: projectMap, targets: null };
}

/**
 * Discover projects under a root using find (Linux).
 * Combined approach: finds both marker files and target directories
 * in a single filesystem walk — eliminates per-project listDir calls.
 * Returns { projects: Map<dirPath, Set<markers>>, targets: Map<dirPath, Array<{name, path}>> }
 */
async function discoverProjectsFind(rootPath, scanDepth) {
  const markers = getMarkerNames();
  const targetNames = Registry.getAllTargetNames();
  if (markers.length === 0 && targetNames.length === 0) {
    return { projects: new Map(), targets: null };
  }

  const maxDepth = String(scanDepth + 1);
  const markerNameArgs = buildNameArgs(markers);
  const targetNameArgs = buildNameArgs(targetNames);

  // Single find: marker files (-type f) OR target directories (-type d)
  let args;
  if (markerNameArgs.length > 0 && targetNameArgs.length > 0) {
    args = ["find", rootPath, "-maxdepth", maxDepth,
      "(",
        "(", "-type", "f", "(", ...markerNameArgs, ")", ")",
        "-o",
        "(", "-type", "d", "(", ...targetNameArgs, ")", ")",
      ")"];
  } else if (markerNameArgs.length > 0) {
    args = ["find", rootPath, "-maxdepth", maxDepth, "-type", "f",
      "(", ...markerNameArgs, ")"];
  } else {
    return { projects: new Map(), targets: null };
  }

  const output = await runCommand(args);
  if (!output) return null;

  const markerSet = new Set(markers);
  const projectMap = new Map();
  const targetMap = new Map();

  for (const line of output.split("\n")) {
    const filePath = line.trim();
    if (!filePath) continue;

    const parsed = parseRelativePath(filePath, rootPath, scanDepth);
    if (!parsed) continue;

    const { projectPath, entryName } = parsed;

    if (markerSet.has(entryName)) {
      // It's a marker file — register the project
      if (!projectMap.has(projectPath)) {
        projectMap.set(projectPath, new Set());
      }
      projectMap.get(projectPath).add(entryName);
    } else {
      // It's a target directory — store for later matching
      if (!targetMap.has(projectPath)) {
        targetMap.set(projectPath, []);
      }
      targetMap.get(projectPath).push({ name: entryName, path: filePath });
    }
  }

  // Only keep targets for directories that are confirmed projects
  for (const dirPath of targetMap.keys()) {
    if (!projectMap.has(dirPath)) {
      targetMap.delete(dirPath);
    }
  }

  return { projects: projectMap, targets: targetMap };
}

/**
 * Discover projects under a root using Windows PowerShell.
 * Returns { projects: Map<dirPath, Set<markers>>, targets: null }
 */
async function discoverProjectsWindows(rootPath, scanDepth) {
  const markers = getMarkerNames();
  if (markers.length === 0) return { projects: new Map(), targets: null };

  const cmd = `Get-ChildItem -LiteralPath '${rootPath}' -Depth ${scanDepth} -File -Include ${markers.map(m => `'${m}'`).join(",")} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName`;
  const output = await runCommand(["powershell", "-NoProfile", "-Command", cmd]);
  if (!output) return null;

  const projectMap = new Map();
  const sep = rootPath.includes("\\") ? "\\" : "/";
  for (const line of output.split("\n")) {
    const filePath = line.trim();
    if (!filePath) continue;

    const relative = filePath.slice(rootPath.length + 1);
    const parts = relative.split(sep);
    if (parts.length < 2 || parts.length > scanDepth + 1) continue;

    const entryName = parts[parts.length - 1];
    const projectRel = parts.slice(0, -1).join("/");
    const dirPath = joinPath(rootPath, projectRel);

    if (!projectMap.has(dirPath)) {
      projectMap.set(dirPath, new Set());
    }
    projectMap.get(dirPath).add(entryName);
  }

  return { projects: projectMap, targets: null };
}

/**
 * Discover projects using the best native method for the current OS.
 * Returns { projects, targets } or null on failure.
 */
async function discoverProjectsNative(rootPath, scanDepth) {
  if (env.PLATFORM === "OSX") {
    return await discoverProjectsSpotlight(rootPath, scanDepth);
  } else if (env.PLATFORM === "Linux") {
    return await discoverProjectsFind(rootPath, scanDepth);
  } else if (env.PLATFORM === "Windows") {
    return await discoverProjectsWindows(rootPath, scanDepth);
  }
  return null;
}

/**
 * Fallback: discover projects using Sciter fs API (iterative readdir).
 * Respects scanDepth for recursive scanning.
 * Returns { projects: Map<dirPath, Set<markers>>, targets: null }
 */
function discoverProjectsSciter(rootPath, scanDepth) {
  const projectMap = new Map();
  const skipDirs = Registry.getSkipDirs();

  function scanDir(dirPath, depth) {
    if (depth > scanDepth) return;
    const entries = listDir(dirPath);

    for (const entry of entries) {
      if (entry.type !== fs.UV_DIRENT_DIR) continue;
      if (skipDirs.has(entry.name)) continue;

      const childPath = joinPath(dirPath, entry.name);
      const childEntries = listDir(childPath);
      const names = new Set(childEntries.map(e => e.name));
      const markerSet = new Set();

      for (const def of Registry.getAll()) {
        for (const marker of def.markers) {
          if (marker.startsWith("*.")) {
            const ext = marker.substring(1);
            for (const name of names) {
              if (name.endsWith(ext)) markerSet.add(name);
            }
          } else {
            if (names.has(marker)) markerSet.add(marker);
          }
        }
      }

      if (markerSet.size === 0 && (names.has("src") || names.has("lib") || names.has("app"))) {
        markerSet.add("src/lib/app");
      }

      if (markerSet.size > 0) {
        projectMap.set(childPath, markerSet);
      } else if (depth < scanDepth) {
        scanDir(childPath, depth + 1);
      }
    }
  }

  scanDir(rootPath, 1);
  return { projects: projectMap, targets: null };
}

// ===== Size calculation =====

/**
 * Get sizes for multiple folders in one native command.
 * macOS/Linux: `du -sk dir1 dir2 ...` — single process for all paths.
 * Windows: parallel PowerShell calls.
 * Returns Map<path, bytes>
 */
async function folderSizesBatch(paths) {
  const result = new Map();
  if (paths.length === 0) return result;

  if (env.PLATFORM !== "Windows") {
    const output = await runCommand(["du", "-sk", ...paths]);
    if (output) {
      for (const line of output.split("\n")) {
        const match = line.match(/^(\d+)\t(.+)/);
        if (match) {
          result.set(match[2], parseInt(match[1], 10) * 1024);
        }
      }
      for (const p of paths) {
        if (!result.has(p)) result.set(p, 0);
      }
      return result;
    }
  }

  // Windows: individual PowerShell calls (parallel)
  const sizes = await Promise.all(paths.map(async (path) => {
    try {
      const output = await runCommand([
        "powershell", "-NoProfile", "-Command",
        `(Get-ChildItem -LiteralPath '${path}' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum`,
      ]);
      const val = parseInt((output || "").trim(), 10);
      return isNaN(val) ? 0 : val;
    } catch (e) { return 0; }
  }));
  for (let i = 0; i < paths.length; i++) {
    result.set(paths[i], sizes[i]);
  }
  return result;
}

/**
 * Shallow folder size (only top-level files).
 * Used for quick post-clean rescan.
 */
function folderSizeShallow(path) {
  const info = stat(path);
  if (!info) return 0;
  if (info.isFile) return Number(info.st_size || 0);

  let total = 0;
  for (const entry of listDir(path)) {
    const child = stat(joinPath(path, entry.name));
    if (child?.isFile) total += Number(child.st_size || 0);
  }
  return total;
}

// ===== Formatting =====

function formatBytes(value) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit < 2 ? 0 : 1)} ${units[unit]}`;
}

// ===== Target discovery =====

/**
 * Check if a target name matches any exclusion pattern.
 */
function isExcluded(name, exclusions) {
  if (!exclusions || exclusions.length === 0) return false;
  for (const pattern of exclusions) {
    if (!pattern) continue;
    if (name === pattern) return true;
    // Simple glob: pattern starts with * → suffix match
    if (pattern.startsWith("*") && name.endsWith(pattern.substring(1))) return true;
  }
  return false;
}

/**
 * Find cleanup targets in a project directory with shallow sizes.
 * Used for post-clean rescan. Respects exclusions.
 */
function findCleanupTargets(path, typeDef, exclusions) {
  const entries = listDir(path);
  const targetNames = Registry.getTargets(typeDef, entries);
  const targets = [];

  for (const name of targetNames) {
    if (isExcluded(name, exclusions)) continue;
    const fullPath = joinPath(path, name);
    const info = stat(fullPath);
    if (!info) continue;
    const size = folderSizeShallow(fullPath);
    targets.push({ name, path: fullPath, bytes: size, prettyBytes: formatBytes(size) });
  }
  return targets;
}

/**
 * Resolve cleanup targets for a project.
 * Uses pre-discovered targets from combined find when available,
 * falls back to listDir + registry matching.
 */
function resolveTargets(dirPath, typeDef, preDiscoveredTargets, exclusions) {
  const validTargets = new Set(typeDef.targets.map(t => {
    if (t.includes("/")) return t.split("/")[0];
    return t;
  }).filter(t => !t.includes("*")));

  // Also collect glob patterns for extension matching
  const globPatterns = typeDef.targets.filter(t => t.includes("*")).map(t => t.replace("*", ""));

  const targetPaths = [];

  if (preDiscoveredTargets) {
    // Use pre-discovered targets (from combined find), filtered by this project's type
    for (const t of preDiscoveredTargets) {
      if (isExcluded(t.name, exclusions)) continue;
      if (validTargets.has(t.name)) {
        targetPaths.push(t);
      }
    }
    // Glob targets can't be pre-discovered; fall back to listDir for those
    if (globPatterns.length > 0) {
      const entries = listDir(dirPath);
      for (const entry of entries) {
        if (isExcluded(entry.name, exclusions)) continue;
        for (const pattern of globPatterns) {
          if (entry.name.includes(pattern) || entry.name.endsWith(pattern)) {
            const fullPath = joinPath(dirPath, entry.name);
            if (stat(fullPath)) {
              targetPaths.push({ name: entry.name, path: fullPath });
            }
          }
        }
      }
    }
  } else {
    // No pre-discovered targets — use listDir + registry matching
    const entries = listDir(dirPath);
    const targetNames = Registry.getTargets(typeDef, entries);
    for (const name of targetNames) {
      if (isExcluded(name, exclusions)) continue;
      const fullPath = joinPath(dirPath, name);
      if (stat(fullPath)) {
        targetPaths.push({ name, path: fullPath });
      }
    }
  }

  return targetPaths;
}

// ===== Scanning =====

/**
 * Scan a workspace root for projects.
 * Returns { projects, epoch } so caller can detect stale results.
 *
 * Single-pass pipeline:
 *   1. Discover projects + targets using native OS commands
 *   2. Detect types, resolve targets, apply exclusions
 *   3. Batch deep-size all targets in one du/PowerShell call
 *
 * Settings applied:
 *   - scanDepth: how many levels deep to look for projects
 *   - exclusions: patterns to protect from cleanup
 *   - staleDays: threshold to flag stale projects
 */
async function scanRoot(rootPath, settings, onProgress, epochRef) {
  const t0 = Date.now();
  const epoch = epochRef ? epochRef.value : 0;

  const scanDepth = settings?.scanDepth || 2;
  const exclusions = settings?.exclusions || [];
  const staleDays = settings?.staleDays || 30;
  const staleThreshold = Date.now() / 1000 - staleDays * 86400;

  console.log(`[scan] START root=${rootPath} depth=${scanDepth} epoch=${epoch}`);

  // --- Phase 1: Discover projects (native first, fallback to Sciter) ---
  const t1 = Date.now();
  let discovery = await discoverProjectsNative(rootPath, scanDepth);
  let usedNative = discovery !== null;

  if (!usedNative) {
    console.log(`[scan] Native discovery failed, falling back to Sciter`);
    discovery = discoverProjectsSciter(rootPath, scanDepth);
  }

  const projectMap = discovery.projects;
  const preTargets = discovery.targets; // null unless Linux combined find
  console.log(`[scan] Discovery (${usedNative ? "native" : "sciter"}${preTargets ? "+targets" : ""}) took ${Date.now() - t1}ms, found ${projectMap.size} project dirs`);

  // --- Phase 2: Detect types, resolve targets, build project list ---
  const t2 = Date.now();
  const projects = [];
  const allTargetPaths = [];

  for (const [dirPath, markerFiles] of projectMap) {
    if (epochRef && epochRef.value !== epoch) {
      console.log(`[scan] ABORTED epoch=${epoch}`);
      return { projects: null, epoch };
    }

    // Detect type from marker files
    const fakeEntries = Array.from(markerFiles).map(m => ({ name: m, type: 0 }));
    let typeDef = Registry.detect(dirPath, fakeEntries);

    // If generic type, try full directory listing for better detection
    if (typeDef.id === "unknown") {
      const fullEntries = listDir(dirPath);
      typeDef = Registry.detect(dirPath, fullEntries);
    }

    // Resolve cleanup targets (pre-discovered or via listDir)
    const projectTargets = preTargets
      ? resolveTargets(dirPath, typeDef, preTargets.get(dirPath) || [], exclusions)
      : resolveTargets(dirPath, typeDef, null, exclusions);

    const info = stat(dirPath);
    const modifiedAt = Number(info?.st_mtime || 0);

    const project = {
      id: Sciter.uuid(),
      name: dirPath.split("/").pop(),
      path: dirPath,
      type: typeDef.name,
      typeId: typeDef.id,
      icon: typeDef.icon,
      devicon: typeDef.devicon || "",
      modifiedAt,
      isStale: modifiedAt > 0 && modifiedAt < staleThreshold,
      cleanupTargets: projectTargets.map(t => ({
        name: t.name,
        path: t.path,
        bytes: 0,
        prettyBytes: "...",
      })),
      reclaimableBytes: 0,
      reclaimableLabel: "...",
      sizing: "pending",
      _targetPaths: projectTargets,
    };

    projects.push(project);
    for (const tp of projectTargets) {
      allTargetPaths.push(tp.path);
    }
  }
  console.log(`[scan] Phase 2 (type + targets) took ${Date.now() - t2}ms, ${projects.length} projects, ${allTargetPaths.length} targets`);

  projects.sort((a, b) => a.name.localeCompare(b.name));
  if (onProgress) onProgress();

  // --- Phase 3: Batch deep-size all targets in one call ---
  const t3 = Date.now();

  if (allTargetPaths.length > 0) {
    const uniquePaths = [...new Set(allTargetPaths)];
    const sizeMap = await folderSizesBatch(uniquePaths);

    for (const project of projects) {
      if (epochRef && epochRef.value !== epoch) {
        console.log(`[scan] ABORTED epoch=${epoch} during sizing`);
        return { projects: null, epoch };
      }

      let reclaimableBytes = 0;
      const sizedTargets = [];

      for (const t of project._targetPaths) {
        const bytes = sizeMap.get(t.path) || 0;
        sizedTargets.push({ name: t.name, path: t.path, bytes, prettyBytes: formatBytes(bytes) });
        reclaimableBytes += bytes;
      }

      project.cleanupTargets = sizedTargets;
      project.reclaimableBytes = reclaimableBytes;
      project.reclaimableLabel = formatBytes(reclaimableBytes);
      project.sizing = "deep";
    }
  } else {
    for (const project of projects) {
      project.sizing = "deep";
    }
  }

  // Remove temporary field
  for (const project of projects) {
    delete project._targetPaths;
  }

  // Skip projects with nothing to clean up
  const before = projects.length;
  const filtered = projects.filter(p => p.reclaimableBytes > 0);

  console.log(`[scan] Phase 3 (batch sizing) took ${Date.now() - t3}ms`);
  console.log(`[scan] TOTAL took ${Date.now() - t0}ms for ${before} projects (${before - filtered.length} skipped, 0 bytes)`);

  filtered.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes || a.name.localeCompare(b.name));
  if (onProgress) onProgress();

  return { projects: filtered, epoch };
}

// ===== Cleanup =====

function removeTree(path) {
  const info = stat(path);
  if (!info) return;
  if (info.isFile || info.isSymbolicLink) {
    fs.$unlink(path);
    return;
  }
  for (const entry of listDir(path)) {
    removeTree(joinPath(path, entry.name));
  }
  fs.$rmdir(path);
}

// ===== Root discovery =====

function scanLikelyRoots() {
  const roots = [];
  const home = env.path("home");
  const common = ["Documents", "Developer", "Code", "Projects", "Sites", "Workspace", "Work", "repos", "src"];
  for (const name of common) {
    const path = joinPath(home, name);
    if (isDirectory(path)) roots.push(path);
  }
  return roots;
}

export {
  findCleanupTargets,
  formatBytes,
  removeTree,
  scanLikelyRoots,
  scanRoot,
};
