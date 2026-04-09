/**
 * Store — central state + all business logic.
 * No UI imports. Pure data layer.
 *
 * Module-level signals (the Sciter SDK pattern):
 *   reading signal.value in render() auto-triggers re-render.
 *   No manual componentUpdate() needed.
 */

import * as env from "@env";
import * as Settings from "./settings.js";
import * as Registry from "./registry.js";
import {
  scanRoot,
  scanLikelyRoots,
  findCleanupTargets,
  formatBytes,
  removeTree,
} from "./scanner.js";

const { signal } = Reactor;

export { formatBytes };

// ===== Reactive state (module-level signals) =====

// Persisted
export const roots = signal([]);
export const recentRoots = signal([]);
export const selectedRoot = signal("");
export const settings = signal({});
export const history = signal([]);

// Runtime
export const projects = signal([]);
export const scanning = signal(false);
export const search = signal("");
export const filter = signal("All");

// ===== Internal (non-reactive) =====

// Shared mutable ref — scanRoot reads epochRef.value to detect stale scans
const epochRef = { value: 0 };
const scanCache = new Map();

const DEFAULT_SETTINGS = {
  theme: "system",
  useTrash: true,
  dryRunDefault: false,
  confirmThreshold: 100,
  deepScan: false,
  scanDepth: 2,
  staleDays: 30,
  exclusions: [".env", ".env.local", "secrets"],
  autoScan: true,
};

// ===== Lifecycle =====

export function init() {
  // Load project type definitions
  Registry.loadFromFile(__DIR__ + "project-types.json");

  // Load user-defined types if they exist (extends/overrides built-in)
  const userTypesPath = env.path("appdata") + "/reposweep/reposweep-types.json";
  Registry.loadFromFile(userTypesPath);

  // Load persisted state (synchronous)
  const saved = Settings.loadState();
  if (saved) {
    roots.value = saved.roots || [];
    recentRoots.value = saved.recentRoots || [];
    selectedRoot.value = saved.selectedRoot || roots.value[0] || "";
    settings.value = { ...DEFAULT_SETTINGS, ...(saved.settings || {}) };
    history.value = saved.history || [];
  } else {
    settings.value = { ...DEFAULT_SETTINGS };
  }

  // Pre-set scanning so the first render shows scan state, not empty state
  if (selectedRoot.value && settings.value.autoScan) {
    scanning.value = true;
  }

  applyTheme();
}

export function getProjectTypes() {
  return Registry.getAll();
}

async function persist() {
  await Settings.saveState({
    roots: roots.value,
    recentRoots: recentRoots.value,
    selectedRoot: selectedRoot.value,
    settings: settings.value,
    history: history.value,
  });
}

// ===== Roots =====

export function addRoot(path) {
  if (!path) return;
  const r = roots.value;
  if (!r.includes(path)) {
    roots.value = [...r, path];
  }
  recentRoots.value = [path, ...recentRoots.value.filter(x => x !== path)].slice(0, 8);
  selectedRoot.value = path;
  persist();
}

export function removeRoot(path) {
  roots.value = roots.value.filter(r => r !== path);
  scanCache.delete(path);
  if (selectedRoot.value === path) {
    const remaining = roots.value;
    selectedRoot.value = remaining[0] || "";
    const cached = scanCache.get(selectedRoot.value);
    if (cached) {
      projects.value = cached.projects;
      search.value = cached.search;
      filter.value = cached.filter;
    } else {
      projects.value = [];
    }
  }
  persist();
}

export function selectRoot(path) {
  if (selectedRoot.value === path) return;

  // Cache current root's state before switching
  const currentRoot = selectedRoot.value;
  if (currentRoot) {
    scanCache.set(currentRoot, {
      projects: projects.value,
      search: search.value,
      filter: filter.value,
    });
  }

  // Restore from cache if available, otherwise clear
  const cached = scanCache.get(path);
  if (cached) {
    projects.value = cached.projects;
    search.value = cached.search;
    filter.value = cached.filter;
  } else {
    projects.value = [];
    search.value = "";
    filter.value = "All";
  }

  selectedRoot.value = path;
  persist();
}

export function hasCachedScan(path) {
  return scanCache.has(path);
}

export function suggestRoots() {
  const discovered = scanLikelyRoots();
  const r = roots.value;
  for (const root of discovered) {
    if (!r.includes(root)) {
      r.push(root);
    }
  }
  roots.value = [...r];
  selectedRoot.value = selectedRoot.value || roots.value[0] || "";
  persist();
}

// ===== Scanning =====

export async function scan() {
  const root = selectedRoot.value;
  if (!root) return;
  scanning.value = true;

  const myEpoch = ++epochRef.value;

  const result = await scanRoot(root, settings.value, () => {
    // Only pulse progress if this scan is still current
    if (epochRef.value === myEpoch) {
      scanning.send(true);
    }
  }, epochRef);

  // Discard results if a newer scan has started since
  if (result.projects === null || epochRef.value !== myEpoch) {
    // Reset scanning only if no newer scan is running
    if (epochRef.value === myEpoch) {
      scanning.value = false;
    }
    return;
  }

  projects.value = result.projects;
  scanning.value = false;

  // Cache scan results for this root
  scanCache.set(root, {
    projects: projects.value,
    search: search.value,
    filter: filter.value,
  });
}

// ===== Filtering =====

export function setSearch(value) {
  search.value = value;
}

export function setFilter(value) {
  filter.value = value;
}

export function getVisibleProjects() {
  const query = search.value.trim().toLowerCase();
  const filterVal = filter.value;
  return projects.value.filter(project => {
    if (filterVal !== "All" && project.type !== filterVal) return false;
    if (!query) return true;
    return (
      project.name.toLowerCase().includes(query) ||
      project.path.toLowerCase().includes(query) ||
      project.type.toLowerCase().includes(query)
    );
  });
}

// ===== Settings =====

export function setSetting(key, value) {
  settings.value = { ...settings.value, [key]: value };
  persist();
}

export function updateSettings(patch) {
  settings.value = { ...settings.value, ...patch };
  persist();
}

export function resetSettings() {
  settings.value = { ...DEFAULT_SETTINGS };
  persist();
}

export function applyTheme() {
  const theme = settings.value.theme;
  if (theme === "dark" || theme === "light") {
    Window.this.document.attributes.theme = theme;
  } else {
    Window.this.document.attributes.theme = undefined;
  }
}

// ===== Cleanup =====

export function clean(projectId) {
  const p = projects.value;
  const project = p.find(x => x.id === projectId);
  if (!project || !project.cleanupTargets.length) return false;

  for (const target of project.cleanupTargets) {
    removeTree(target.path);
  }

  history.value = [{
    projectName: project.name,
    projectPath: project.path,
    projectType: project.type,
    targetsCleaned: project.cleanupTargets.map(t => t.name),
    bytesReclaimed: project.reclaimableBytes,
    canRestore: settings.value.useTrash,
    timestamp: Date.now() / 1000,
  }, ...history.value.slice(0, 99)];

  // Rescan the cleaned project
  const typeDef = Registry.getById(project.typeId);
  const exclusions = settings.value.exclusions;
  const rescannedTargets = findCleanupTargets(project.path, typeDef, exclusions);
  const reclaimableBytes = rescannedTargets.reduce((sum, t) => sum + t.bytes, 0);

  projects.value = p.map(x =>
    x.id === projectId
      ? { ...x, cleanupTargets: rescannedTargets, reclaimableBytes, reclaimableLabel: formatBytes(reclaimableBytes) }
      : x
  );

  // Update cache with post-clean state
  scanCache.set(selectedRoot.value, {
    projects: projects.value,
    search: search.value,
    filter: filter.value,
  });

  persist();
  return true;
}

// ===== Stats =====

export function getStats() {
  const h = history.value;
  const p = projects.value;

  const totalReclaimed = h.reduce((sum, e) => sum + e.bytesReclaimed, 0);

  const typeMap = new Map();
  for (const project of p) {
    const existing = typeMap.get(project.type) || { count: 0, reclaimable: 0 };
    existing.count++;
    existing.reclaimable += project.reclaimableBytes;
    typeMap.set(project.type, existing);
  }

  const totalReclaimable = Array.from(typeMap.values()).reduce((sum, v) => sum + v.reclaimable, 0);
  const typeBreakdown = Array.from(typeMap.entries())
    .map(([name, data]) => ({
      name, ...data,
      percentage: totalReclaimable > 0 ? (data.reclaimable / totalReclaimable) * 100 : 0,
    }))
    .sort((a, b) => b.reclaimable - a.reclaimable);

  return {
    totalReclaimed,
    totalProjectsScanned: p.length,
    totalProjectsCleaned: h.length,
    currentlyReclaimable: totalReclaimable,
    typeBreakdown,
    largestProjects: p
      .slice()
      .sort((a, b) => b.reclaimableBytes - a.reclaimableBytes)
      .slice(0, 10)
      .map(x => ({ name: x.name, path: x.path, type: x.type, size: x.reclaimableBytes })),
  };
}

// ===== Utilities =====

export function openFolder(path) {
  env.launch(path);
}

export function selectFolder() {
  const fn = Window.this.selectFolder();
  if (fn) return URL.toPath(fn);
  return null;
}
