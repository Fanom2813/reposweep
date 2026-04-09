/**
 * Scanner — file system operations for project discovery and cleanup.
 * Uses registry.js for project type detection — no hardcoded types here.
 */

import * as env from "@env";
import * as Sciter from "@sciter";
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

// ===== Size calculation =====

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

async function folderSizeAsync(path, counter) {
  if (!counter) counter = { ops: 0 };

  const info = stat(path);
  if (!info) return 0;
  if (info.isFile) return Number(info.st_size || 0);

  let total = 0;
  for (const entry of listDir(path)) {
    total += await folderSizeAsync(joinPath(path, entry.name), counter);
    counter.ops++;
    if (counter.ops % 200 === 0) await yieldUI();
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

async function findCleanupTargetsDeep(path, typeDef) {
  const entries = listDir(path);
  const targetNames = Registry.getTargets(typeDef, entries);
  const targets = [];

  for (const name of targetNames) {
    const fullPath = joinPath(path, name);
    const info = stat(fullPath);
    if (!info) continue;
    const size = await folderSizeAsync(fullPath);
    targets.push({ name, path: fullPath, bytes: size, prettyBytes: formatBytes(size) });
  }
  return targets;
}

// ===== Scanning =====

async function scanRoot(rootPath, onProgress) {
  const projects = [];
  const entries = listDir(rootPath);
  const skipDirs = Registry.getSkipDirs();

  // Pass 1: fast discovery
  for (const entry of entries) {
    if (entry.type !== fs.UV_DIRENT_DIR) continue;
    if (skipDirs.has(entry.name)) continue;

    const path = joinPath(rootPath, entry.name);
    const childEntries = listDir(path);

    if (!Registry.looksLikeProject(childEntries)) continue;

    const typeDef = Registry.detect(path, childEntries);
    const cleanupTargets = findCleanupTargets(path, typeDef);
    const reclaimableBytes = cleanupTargets.reduce((sum, t) => sum + t.bytes, 0);
    const info = stat(path);

    projects.push({
      id: Sciter.uuid(),
      name: entry.name,
      path,
      type: typeDef.name,
      typeId: typeDef.id,
      icon: typeDef.icon,
      modifiedAt: Number(info?.st_mtime || 0),
      cleanupTargets,
      reclaimableBytes,
      reclaimableLabel: formatBytes(reclaimableBytes),
      sizing: "shallow",
    });
  }

  projects.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes || a.name.localeCompare(b.name));
  if (onProgress) onProgress();

  // Pass 2: deep sizes
  for (const project of projects) {
    await yieldUI();

    const typeDef = Registry.getById(project.typeId);
    const deepTargets = await findCleanupTargetsDeep(project.path, typeDef);
    const reclaimableBytes = deepTargets.reduce((sum, t) => sum + t.bytes, 0);

    project.cleanupTargets = deepTargets;
    project.reclaimableBytes = reclaimableBytes;
    project.reclaimableLabel = formatBytes(reclaimableBytes);
    project.sizing = "deep";

    if (onProgress) onProgress();
  }

  projects.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes || a.name.localeCompare(b.name));
  return projects;
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
  findCleanupTargetsDeep,
  formatBytes,
  removeTree,
  scanLikelyRoots,
  scanRoot,
};
