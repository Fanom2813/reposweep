/**
 * Scanner — file system operations for project discovery and cleanup.
 *
 * Uses native OS commands for speed:
 *   macOS:   mdfind (Spotlight) for discovery, du -sk for sizing
 *   Linux:   find for discovery, du -sk for sizing
 *   Windows: dir /s /b for discovery, PowerShell for sizing
 *
 * Falls back to Sciter fs API if native commands fail.
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

function yieldUI() {
  return new Promise(resolve => requestAnimationFrame(resolve));
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

// ===== Native project discovery =====

/**
 * Get all marker file names from registry (for discovery queries).
 */
function getMarkerNames() {
  const names = new Set();
  for (const def of Registry.getAll()) {
    for (const marker of def.markers) {
      if (marker.startsWith("*.")) continue; // skip globs for mdfind
      names.add(marker);
    }
  }
  return Array.from(names);
}

/**
 * Discover projects under a root using Spotlight (macOS).
 * mdfind uses the Spotlight index — instant, no disk walking.
 * Returns Map<projectDirPath, Set<markerFiles>>
 */
async function discoverProjectsSpotlight(rootPath) {
  const markers = getMarkerNames();
  if (markers.length === 0) return new Map();

  // Build mdfind query: find any marker file under rootPath, max depth 2
  const query = markers.map(m => `kMDItemFSName == '${m}'`).join(" || ");
  const output = await runCommand(["mdfind", "-onlyin", rootPath, query]);

  if (!output) return null; // command failed, signal fallback

  const projectMap = new Map();
  for (const line of output.split("\n")) {
    const filePath = line.trim();
    if (!filePath) continue;

    // Only consider files directly under root (depth 1)
    // e.g. /root/project-dir/package.json → project-dir
    const relative = filePath.slice(rootPath.length + 1);
    const parts = relative.split("/");
    if (parts.length !== 2) continue; // skip nested or root-level files

    const dirPath = joinPath(rootPath, parts[0]);
    if (!projectMap.has(dirPath)) {
      projectMap.set(dirPath, new Set());
    }
    projectMap.get(dirPath).add(parts[1]);
  }

  return projectMap;
}

/**
 * Discover projects under a root using find (Linux).
 * Returns Map<projectDirPath, Set<markerFiles>>
 */
async function discoverProjectsFind(rootPath) {
  const markers = getMarkerNames();
  if (markers.length === 0) return new Map();

  // Build find command: -maxdepth 2, looking for marker files
  const nameArgs = [];
  for (const m of markers) {
    nameArgs.push("-name", m, "-o");
  }
  // Remove trailing -o
  if (nameArgs.length > 0) nameArgs.pop();

  const args = ["find", rootPath, "-maxdepth", "2", "-type", "f", "(", ...nameArgs, ")"];
  const output = await runCommand(args);

  if (!output) return null;

  const projectMap = new Map();
  for (const line of output.split("\n")) {
    const filePath = line.trim();
    if (!filePath) continue;

    const relative = filePath.slice(rootPath.length + 1);
    const parts = relative.split("/");
    if (parts.length !== 2) continue;

    const dirPath = joinPath(rootPath, parts[0]);
    if (!projectMap.has(dirPath)) {
      projectMap.set(dirPath, new Set());
    }
    projectMap.get(dirPath).add(parts[1]);
  }

  return projectMap;
}

/**
 * Discover projects under a root using Windows dir command.
 * Returns Map<projectDirPath, Set<markerFiles>>
 */
async function discoverProjectsWindows(rootPath) {
  const markers = getMarkerNames();
  if (markers.length === 0) return new Map();

  // Use PowerShell to find marker files
  const pattern = markers.map(m => `-${m}`).join(",");
  const cmd = `Get-ChildItem -LiteralPath '${rootPath}' -Depth 1 -File -Include ${markers.map(m => `'${m}'`).join(",")} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName`;
  const output = await runCommand(["powershell", "-NoProfile", "-Command", cmd]);

  if (!output) return null;

  const projectMap = new Map();
  const sep = rootPath.includes("\\") ? "\\" : "/";
  for (const line of output.split("\n")) {
    const filePath = line.trim();
    if (!filePath) continue;

    const relative = filePath.slice(rootPath.length + 1);
    const parts = relative.split(sep);
    if (parts.length !== 2) continue;

    const dirPath = joinPath(rootPath, parts[0]);
    if (!projectMap.has(dirPath)) {
      projectMap.set(dirPath, new Set());
    }
    projectMap.get(dirPath).add(parts[1]);
  }

  return projectMap;
}

/**
 * Discover projects using the best native method for the current OS.
 * Falls back to Sciter fs API if native commands fail.
 * Returns Map<projectDirPath, Set<markerFiles>>
 */
async function discoverProjectsNative(rootPath) {
  let result = null;

  if (env.PLATFORM === "OSX") {
    result = await discoverProjectsSpotlight(rootPath);
  } else if (env.PLATFORM === "Linux") {
    result = await discoverProjectsFind(rootPath);
  } else if (env.PLATFORM === "Windows") {
    result = await discoverProjectsWindows(rootPath);
  }

  return result;
}

/**
 * Fallback: discover projects using Sciter fs API (iterative readdir).
 * Returns Map<projectDirPath, Set<markerFiles>>
 */
function discoverProjectsSciter(rootPath) {
  const projectMap = new Map();
  const skipDirs = Registry.getSkipDirs();
  const entries = listDir(rootPath);

  for (const entry of entries) {
    if (entry.type !== fs.UV_DIRENT_DIR) continue;
    if (skipDirs.has(entry.name)) continue;

    const dirPath = joinPath(rootPath, entry.name);
    const childEntries = listDir(dirPath);

    const markerSet = new Set();
    const names = new Set(childEntries.map(e => e.name));

    // Check each type's markers
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

    // Also check for generic project dirs
    if (markerSet.size === 0 && (names.has("src") || names.has("lib") || names.has("app"))) {
      markerSet.add("src/lib/app");
    }

    if (markerSet.size > 0) {
      projectMap.set(dirPath, markerSet);
    }
  }

  return projectMap;
}

// ===== Size calculation =====

/**
 * Get folder size using native OS commands.
 * - macOS/Linux: `du -sk` (fast C implementation)
 * - Windows: PowerShell recursive file sum
 * Returns size in bytes, or 0 if the command fails.
 */
async function folderSizeNative(path) {
  try {
    let proc;
    if (env.PLATFORM === "Windows") {
      proc = sys.spawn(
        ["powershell", "-NoProfile", "-Command",
          `(Get-ChildItem -LiteralPath '${path}' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum`],
        { stdout: "pipe", stderr: "pipe" }
      );
    } else {
      proc = sys.spawn(["du", "-sk", path], { stdout: "pipe", stderr: "pipe" });
    }

    if (!proc) return 0;

    const output = await readPipe(proc.stdout);
    await proc.wait();

    if (env.PLATFORM === "Windows") {
      const val = parseInt(output.trim(), 10);
      return isNaN(val) ? 0 : val;
    } else {
      // du -sk output: "12345\t/path"
      const match = output.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) * 1024 : 0;
    }
  } catch (e) {
    return 0;
  }
}

/**
 * Get sizes for multiple folders in one native command (macOS/Linux).
 * `du -sk dir1 dir2 dir3` returns all sizes at once — much faster
 * than spawning separate processes.
 * Returns Map<path, bytes>
 */
async function folderSizesBatchNative(paths) {
  const result = new Map();
  if (paths.length === 0) return result;

  try {
    if (env.PLATFORM !== "Windows") {
      // du -sk for all paths at once
      const output = await runCommand(["du", "-sk", ...paths]);
      if (output) {
        for (const line of output.split("\n")) {
          const match = line.match(/^(\d+)\t(.+)/);
          if (match) {
            result.set(match[2], parseInt(match[1], 10) * 1024);
          }
        }
        // Fill in any paths that du didn't report (e.g. empty dirs)
        for (const p of paths) {
          if (!result.has(p)) result.set(p, 0);
        }
        return result;
      }
    }
  } catch (e) { /* fall through to individual calls */ }

  // Fallback: individual calls (also used for Windows)
  const sizes = await Promise.all(paths.map(p => folderSizeNative(p)));
  for (let i = 0; i < paths.length; i++) {
    result.set(paths[i], sizes[i]);
  }
  return result;
}

/**
 * Shallow folder size (only top-level files).
 * Used for quick Pass 1 estimates.
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
 * Find cleanup targets in a project directory with shallow sizes.
 * Used for initial display and as post-clean rescan.
 */
function findCleanupTargets(path, typeDef) {
  const entries = listDir(path);
  const targetNames = Registry.getTargets(typeDef, entries);
  const targets = [];

  for (const name of targetNames) {
    const fullPath = joinPath(path, name);
    const info = stat(fullPath);
    if (!info) continue;
    const size = folderSizeShallow(fullPath);
    targets.push({ name, path: fullPath, bytes: size, prettyBytes: formatBytes(size) });
  }
  return targets;
}

/**
 * Deep size calculation using native OS commands.
 * Gathers all target paths across all projects and sizes them in one batch call.
 */
async function findCleanupTargetsDeep(path, typeDef) {
  const entries = listDir(path);
  const targetNames = Registry.getTargets(typeDef, entries);
  const targets = [];

  if (targetNames.length === 0) return targets;

  // Collect paths to size
  const targetPaths = [];
  for (const name of targetNames) {
    const fullPath = joinPath(path, name);
    const info = stat(fullPath);
    if (!info) continue;
    targetPaths.push({ name, path: fullPath });
  }

  // Batch size all targets in one du call
  const sizeMap = await folderSizesBatchNative(targetPaths.map(t => t.path));

  for (const t of targetPaths) {
    const bytes = sizeMap.get(t.path) || 0;
    targets.push({ name: t.name, path: t.path, bytes, prettyBytes: formatBytes(bytes) });
  }
  return targets;
}

// ===== Scanning =====

/**
 * Scan a workspace root for projects.
 * Returns { projects, epoch } so caller can detect stale results.
 *
 * 1. Discover projects using native OS commands (Spotlight/find/dir)
 * 2. Detect types and find cleanup targets
 * 3. Deep-size all targets in batch using du/PowerShell
 */
async function scanRoot(rootPath, onProgress, epochRef) {
  const t0 = Date.now();
  const epoch = epochRef ? epochRef.value : 0;
  console.log(`[scan] START root=${rootPath} epoch=${epoch}`);

  // --- Phase 1: Discover projects (native first, fallback to Sciter) ---
  const t1 = Date.now();
  let projectMap = await discoverProjectsNative(rootPath);
  let usedNative = projectMap !== null;

  if (!usedNative) {
    console.log(`[scan] Native discovery failed, falling back to Sciter`);
    projectMap = discoverProjectsSciter(rootPath);
  }
  console.log(`[scan] Discovery (${usedNative ? "native" : "sciter"}) took ${Date.now() - t1}ms, found ${projectMap.size} project dirs`);

  // --- Phase 2: Detect types, build project list with shallow targets ---
  const t2 = Date.now();
  const projects = [];
  const allTargetPaths = []; // collected for batch sizing

  for (const [dirPath, markerFiles] of projectMap) {
    // Abort check
    if (epochRef && epochRef.value !== epoch) {
      console.log(`[scan] ABORTED epoch=${epoch}`);
      return { projects: null, epoch };
    }

    // Detect type from marker files
    const fakeEntries = Array.from(markerFiles).map(m => ({ name: m, type: 0 }));
    let typeDef = Registry.detect(dirPath, fakeEntries);

    // If generic type, try full directory listing for better detection
    // (native discovery only gives marker files, not the full dir listing)
    if (typeDef.id === "unknown") {
      const fullEntries = listDir(dirPath);
      typeDef = Registry.detect(dirPath, fullEntries);
    }

    // Get cleanup targets (need full dir listing for target matching)
    const fullEntries = listDir(dirPath);
    const targetNames = Registry.getTargets(typeDef, fullEntries);
    const info = stat(dirPath);

    // Collect target paths for batch deep sizing
    const targetPaths = [];
    for (const name of targetNames) {
      const fullPath = joinPath(dirPath, name);
      if (stat(fullPath)) {
        targetPaths.push({ name, path: fullPath });
      }
    }

    const project = {
      id: Sciter.uuid(),
      name: dirPath.split("/").pop(),
      path: dirPath,
      type: typeDef.name,
      typeId: typeDef.id,
      icon: typeDef.icon,
      modifiedAt: Number(info?.st_mtime || 0),
      cleanupTargets: targetPaths.map(t => ({
        name: t.name,
        path: t.path,
        bytes: 0,
        prettyBytes: "...",
      })),
      reclaimableBytes: 0,
      reclaimableLabel: "...",
      sizing: "pending",
      _targetPaths: targetPaths, // temporary, removed before return
    };

    projects.push(project);
    for (const tp of targetPaths) {
      allTargetPaths.push({ projectIndex: projects.length - 1, ...tp });
    }
  }
  console.log(`[scan] Phase 2 (type detection) took ${Date.now() - t2}ms, ${projects.length} projects`);

  projects.sort((a, b) => a.name.localeCompare(b.name));
  if (onProgress) onProgress(); // show project list immediately with "..." sizes

  // --- Phase 3: Batch deep-size all targets at once ---
  const t3 = Date.now();

  if (allTargetPaths.length > 0) {
    // Deduplicate paths (same target shared by multiple projects is rare but possible)
    const uniquePaths = [...new Set(allTargetPaths.map(t => t.path))];
    const sizeMap = await folderSizesBatchNative(uniquePaths);

    // Assign sizes back to projects
    for (const project of projects) {
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

      // Abort check
      if (epochRef && epochRef.value !== epoch) {
        console.log(`[scan] ABORTED epoch=${epoch} during sizing`);
        return { projects: null, epoch };
      }
    }
  } else {
    // No targets to size
    for (const project of projects) {
      project.sizing = "deep";
    }
  }

  // Remove temporary field
  for (const project of projects) {
    delete project._targetPaths;
  }

  console.log(`[scan] Phase 3 (batch deep sizing) took ${Date.now() - t3}ms`);
  console.log(`[scan] TOTAL took ${Date.now() - t0}ms for ${projects.length} projects`);

  projects.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes || a.name.localeCompare(b.name));
  if (onProgress) onProgress();

  return { projects, epoch };
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
