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
  ".git",
  ".svn",
  ".hg",
  "Library",
  "Applications",
  "System",
  "node_modules",
  "target",
  "build",
  ".dart_tool",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  "dist",
  "out",
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
  const markers = {
    packageJson: fileExists(joinPath(path, "package.json")),
    flutter: fileExists(joinPath(path, "pubspec.yaml")),
    rust: fileExists(joinPath(path, "Cargo.toml")),
    git: fileExists(joinPath(path, ".git")),
    python: fileExists(joinPath(path, "pyproject.toml")) || fileExists(joinPath(path, "requirements.txt")),
  };

  if (markers.flutter) return "Flutter";
  if (markers.rust) return "Rust";
  if (markers.packageJson) return "Node";
  if (markers.python) return "Python";
  if (markers.git) return "Git";
  return "Unknown";
}

function cleanupTargetsFor(type) {
  switch (type) {
    case "Node":
      return SAFE_TARGETS.node;
    case "Flutter":
      return SAFE_TARGETS.flutter;
    case "Rust":
      return SAFE_TARGETS.rust;
    default:
      return SAFE_TARGETS.generic;
  }
}

function folderSize(path) {
  const info = stat(path);
  if (!info) return 0;
  if (info.isFile) return info.st_size || 0;

  let total = 0;
  for (const entry of listDir(path)) {
    total += folderSize(joinPath(path, entry.name));
  }
  return total;
}

function formatBytes(value) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  const digits = unit < 2 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unit]}`;
}

function findCleanupTargets(path, type) {
  const targets = [];
  for (const name of cleanupTargetsFor(type)) {
    const fullPath = joinPath(path, name);
    const info = stat(fullPath);
    if (!info) continue;

    const size = folderSize(fullPath);
    targets.push({
      name,
      path: fullPath,
      bytes: size,
      prettyBytes: formatBytes(size),
    });
  }
  return targets;
}

function looksLikeProject(path) {
  const type = detectType(path);
  if (type !== "Unknown") return true;

  const entries = listDir(path).map(entry => entry.name);
  return entries.includes("src") || entries.includes("lib") || entries.includes("app");
}

function scanRoot(rootPath) {
  const projects = [];
  const entries = listDir(rootPath);

  for (const entry of entries) {
    if (entry.type !== fs.UV_DIRENT_DIR) continue;
    if (EXCLUDE_DIRS.has(entry.name)) continue;

    const path = joinPath(rootPath, entry.name);
    if (!looksLikeProject(path)) continue;

    const type = detectType(path);
    const cleanupTargets = findCleanupTargets(path, type);
    const reclaimableBytes = cleanupTargets.reduce((sum, target) => sum + target.bytes, 0);
    const info = stat(path);

    projects.push({
      id: Sciter.uuid(),
      name: entry.name,
      path,
      type,
      modifiedAt: info?.st_mtime || 0,
      cleanupTargets,
      reclaimableBytes,
      reclaimableLabel: formatBytes(reclaimableBytes),
    });
  }

  return projects.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes || a.name.localeCompare(b.name));
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
  formatBytes,
  removeTree,
  scanLikelyRoots,
  scanRoot,
};
