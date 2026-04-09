/**
 * Project Type Registry
 *
 * Data-driven detection system. Loads project types from JSON.
 * Supports runtime additions — add types without touching source.
 *
 * Each project type definition:
 *   {
 *     id: "node",                     — unique key
 *     name: "Node",                   — display name
 *     icon: "icon-package",           — lucide icon class
 *     markers: ["package.json"],      — files that identify this type (any match)
 *     targets: ["node_modules", ...], — safe-to-delete directories
 *     priority: 10                    — higher wins when multiple types match
 *   }
 *
 * Marker patterns:
 *   "package.json"  — exact filename
 *   "*.csproj"      — glob (any file with that extension)
 */

import { fs } from "@sys";
import { decode } from "@sciter";

// The registry — array of type definitions, sorted by priority desc
let types = [];

// Generic fallback for unknown projects
const GENERIC = {
  id: "unknown",
  name: "Unknown",
  icon: "icon-folder",
  markers: [],
  targets: [".cache", "dist", "build", "out", ".output"],
  priority: 0,
};

// Dirs to always skip during workspace scan
const SKIP_DIRS = new Set([
  ".git", ".svn", ".hg",
  "Library", "Applications", "System",
]);

/**
 * Load types from a JSON file. Merges with existing — later loads override by id.
 */
function loadFromFile(path) {
  if (!fs.$stat(path)) return; // file doesn't exist, skip silently
  try {
    const raw = fs.$readfile(path, "r");
    const parsed = JSON.parse(decode(raw, "utf-8"));
    if (Array.isArray(parsed)) {
      for (const def of parsed) {
        register(def);
      }
    }
  } catch (e) {
    console.error("registry: failed to parse", path, e);
  }
}

/**
 * Register a single project type. Replaces existing with same id.
 */
function register(def) {
  if (!def.id || !def.name) return;

  // Defaults
  def.markers = def.markers || [];
  def.targets = def.targets || [];
  def.priority = def.priority ?? 5;
  def.icon = def.icon || "icon-folder";

  // Replace or add
  const idx = types.findIndex(t => t.id === def.id);
  if (idx >= 0) {
    types[idx] = def;
  } else {
    types.push(def);
  }

  // Keep sorted by priority desc
  types.sort((a, b) => b.priority - a.priority);
}

/**
 * Get all registered types.
 */
function getAll() {
  return types;
}

/**
 * Get type definition by id.
 */
function getById(id) {
  return types.find(t => t.id === id) || GENERIC;
}

/**
 * Get the generic/fallback type.
 */
function getGeneric() {
  return GENERIC;
}

/**
 * Get the set of directory names to skip during scanning.
 * Combines built-in skips with all target dirs from all types.
 */
function getSkipDirs() {
  const skip = new Set(SKIP_DIRS);
  for (const t of types) {
    for (const target of t.targets) {
      if (!target.includes("*") && !target.includes("/")) {
        skip.add(target);
      }
    }
  }
  return skip;
}

/**
 * Detect project type by checking markers in a directory.
 * Returns the highest-priority matching type, or GENERIC.
 */
function detect(path, entries) {
  // entries: array of { name, type } from readdir
  const names = new Set(entries.map(e => e.name));

  for (const def of types) {
    for (const marker of def.markers) {
      if (marker.startsWith("*.")) {
        // Glob pattern — check extension
        const ext = marker.substring(1); // e.g. ".csproj"
        for (const name of names) {
          if (name.endsWith(ext)) return def;
        }
      } else {
        // Exact match
        if (names.has(marker)) return def;
      }
    }
  }

  return GENERIC;
}

/**
 * Check if a directory looks like a project (any type matches, or has src/lib/app).
 */
function looksLikeProject(entries) {
  const names = new Set(entries.map(e => e.name));

  for (const def of types) {
    for (const marker of def.markers) {
      if (marker.startsWith("*.")) {
        const ext = marker.substring(1);
        for (const name of names) {
          if (name.endsWith(ext)) return true;
        }
      } else {
        if (names.has(marker)) return true;
      }
    }
  }

  return names.has("src") || names.has("lib") || names.has("app");
}

/**
 * Get cleanup target names for a type definition.
 * Resolves glob patterns against actual directory contents.
 */
function getTargets(def, entries) {
  const names = new Set(entries.map(e => e.name));
  const result = [];

  for (const target of def.targets) {
    if (target.includes("*")) {
      // Glob — match against entries
      const pattern = target.replace("*", "");
      for (const name of names) {
        if (name.includes(pattern) || name.endsWith(pattern)) {
          result.push(name);
        }
      }
    } else if (target.includes("/")) {
      // Nested path like "vendor/bundle" — just use first segment
      const first = target.split("/")[0];
      if (names.has(first)) result.push(first);
    } else {
      if (names.has(target)) result.push(target);
    }
  }

  return result;
}

export {
  loadFromFile,
  register,
  getAll,
  getById,
  getGeneric,
  getSkipDirs,
  detect,
  looksLikeProject,
  getTargets,
};
