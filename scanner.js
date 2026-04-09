import * as env from "@env";
import * as Sciter from "@sciter";
import { fs } from "@sys";

const SAFE_TARGETS = {
  node: ["node_modules", ".next", ".nuxt", ".turbo", ".cache", "dist", "build"],
  flutter: [".dart_tool", "build"],
  rust: ["target"],
  generic: [".cache", "dist", "build", "out", ".output"],
};

const EXCLUDE_DIRS = new Set([
  ".git", ".svn", ".hg",
  "Library", "Applications", "System",
  "node_modules", "target", "build",
  ".dart_tool", ".next", ".nuxt", ".turbo", ".cache", "dist", "out",
]);

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

function fileExists(path) {
  return !!stat(path);
}

function detectType(path) {
  if (fileExists(joinPath(path, "pubspec.yaml"))) return "Flutter";
  if (fileExists(joinPath(path, "Cargo.toml"))) return "Rust";
  if (fileExists(joinPath(path, "package.json"))) return "Node";
  if (fileExists(joinPath(path, "pyproject.toml")) || fileExists(joinPath(path, "requirements.txt"))) return "Python";
  if (fileExists(joinPath(path, ".git"))) return "Git";
  return "Unknown";
}

function cleanupTargetsFor(type) {
  switch (type) {
    case "Node": return SAFE_TARGETS.node;
    case "Flutter": return SAFE_TARGETS.flutter;
    case "Rust": return SAFE_TARGETS.rust;
    default: return SAFE_TARGETS.generic;
  }
}

/**
 * Shallow folder size — only counts immediate children, not recursive.
 * Fast enough to not block UI. Used during scan for quick estimates.
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

/**
 * Async deep folder size — yields to UI every N file ops across
 * the entire recursive walk so no single branch can block.
 */
async function folderSizeAsync(path, counter) {
  if (!counter) counter = { ops: 0 };

  const info = stat(path);
  if (!info) return 0;
  if (info.isFile) return Number(info.st_size || 0);

  let total = 0;
  const entries = listDir(path);
  for (const entry of entries) {
    total += await folderSizeAsync(joinPath(path, entry.name), counter);
    counter.ops++;
    if (counter.ops % 200 === 0) await yieldUI();
  }
  return total;
}

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

/**
 * Quick cleanup targets — uses shallow size for speed during scan.
 */
function findCleanupTargets(path, type) {
  const targets = [];
  for (const name of cleanupTargetsFor(type)) {
    const fullPath = joinPath(path, name);
    const info = stat(fullPath);
    if (!info) continue;
    const size = folderSizeShallow(fullPath);
    targets.push({ name, path: fullPath, bytes: size, prettyBytes: formatBytes(size) });
  }
  return targets;
}

/**
 * Accurate cleanup targets — async deep size calculation.
 */
async function findCleanupTargetsDeep(path, type) {
  const targets = [];
  for (const name of cleanupTargetsFor(type)) {
    const fullPath = joinPath(path, name);
    const info = stat(fullPath);
    if (!info) continue;
    const size = await folderSizeAsync(fullPath);
    targets.push({ name, path: fullPath, bytes: size, prettyBytes: formatBytes(size) });
  }
  return targets;
}

function looksLikeProject(path) {
  const type = detectType(path);
  if (type !== "Unknown") return true;
  const entries = listDir(path).map(entry => entry.name);
  return entries.includes("src") || entries.includes("lib") || entries.includes("app");
}

// Yield to UI — returns a promise that resolves on next animation frame
function yieldUI() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

/**
 * Async two-pass scan:
 * Pass 1 (fast): detect projects + shallow sizes → UI populates instantly
 * Pass 2 (background): deep size calc → sizes update as they resolve
 *
 * @param {string} rootPath
 * @param {function} onProgress - called after each project/size update
 * @returns {Promise<Array>} projects with accurate sizes
 */
async function scanRoot(rootPath, onProgress) {
  const projects = [];
  const entries = listDir(rootPath);

  // Pass 1: fast discovery with shallow sizes
  for (const entry of entries) {
    if (entry.type !== fs.UV_DIRENT_DIR) continue;
    if (EXCLUDE_DIRS.has(entry.name)) continue;

    const path = joinPath(rootPath, entry.name);
    if (!looksLikeProject(path)) continue;

    const type = detectType(path);
    const cleanupTargets = findCleanupTargets(path, type);
    const reclaimableBytes = cleanupTargets.reduce((sum, t) => sum + t.bytes, 0);
    const info = stat(path);

    projects.push({
      id: Sciter.uuid(),
      name: entry.name,
      path,
      type,
      modifiedAt: Number(info?.st_mtime || 0),
      cleanupTargets,
      reclaimableBytes,
      reclaimableLabel: formatBytes(reclaimableBytes),
      sizing: "shallow",
    });
  }

  // Sort and show immediately
  projects.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes || a.name.localeCompare(b.name));
  if (onProgress) onProgress();

  // Pass 2: deep sizes in background, yielding between each project
  for (const project of projects) {
    await yieldUI();

    const deepTargets = await findCleanupTargetsDeep(project.path, project.type);
    const reclaimableBytes = deepTargets.reduce((sum, t) => sum + t.bytes, 0);

    project.cleanupTargets = deepTargets;
    project.reclaimableBytes = reclaimableBytes;
    project.reclaimableLabel = formatBytes(reclaimableBytes);
    project.sizing = "deep";

    if (onProgress) onProgress();
  }

  // Re-sort with accurate sizes
  projects.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes || a.name.localeCompare(b.name));
  return projects;
}

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

function scanLikelyRoots() {
  const roots = [];
  const home = env.path("home");
  const common = ["Documents", "Developer", "Code", "Projects", "Sites", "Workspace", "Work"];
  for (const name of common) {
    const path = joinPath(home, name);
    if (isDirectory(path)) roots.push(path);
  }
  return roots;
}

export {
  cleanupTargetsFor,
  detectType,
  findCleanupTargets,
  findCleanupTargetsDeep,
  formatBytes,
  removeTree,
  scanLikelyRoots,
  scanRoot,
};
