/**
 * Store — central state + all business logic.
 * No UI imports. Pure data layer.
 *
 * Usage:
 *   const store = new Store(onChange);
 *   await store.init();
 *   store.addRoot("/path");
 *   await store.scan();
 *   store.clean(projectId);
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

export { formatBytes };

export class Store {

  // Callback fired whenever state changes — UI should re-render
  onChange = null;

  // Persisted state
  roots = [];
  recentRoots = [];
  selectedRoot = "";
  settings = {};
  history = [];

  // Runtime state
  projects = [];
  scanning = false;
  search = "";
  filter = "All";
  _scanEpoch = { value: 0 };

  constructor(onChange) {
    this.onChange = onChange;
    this.settings = this.defaultSettings();
  }

  defaultSettings() {
    return {
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
  }

  // ===== Lifecycle =====

  init() {
    // Load project type definitions
    Registry.loadFromFile(__DIR__ + "project-types.json");

    // Load user-defined types if they exist (extends/overrides built-in)
    const userTypesPath = env.path("appdata") + "/reposweep/reposweep-types.json";
    Registry.loadFromFile(userTypesPath);

    // Load persisted state (synchronous)
    const saved = Settings.loadState();
    if (saved) {
      this.roots = saved.roots || [];
      this.recentRoots = saved.recentRoots || [];
      this.selectedRoot = saved.selectedRoot || this.roots[0] || "";
      this.settings = { ...this.defaultSettings(), ...(saved.settings || {}) };
      this.history = saved.history || [];
    }

    // Apply persisted theme
    this.applyTheme();
  }

  /**
   * Get all registered project types (for UI filters, etc.)
   */
  getProjectTypes() {
    return Registry.getAll();
  }

  notify() {
    if (this.onChange) this.onChange();
  }

  async persist() {
    await Settings.saveState({
      roots: this.roots,
      recentRoots: this.recentRoots,
      selectedRoot: this.selectedRoot,
      settings: this.settings,
      history: this.history,
    });
  }

  // ===== Roots =====

  addRoot(path) {
    if (!path) return;
    if (!this.roots.includes(path)) {
      this.roots = [...this.roots, path];
    }
    this.recentRoots = [path, ...this.recentRoots.filter(r => r !== path)].slice(0, 8);
    this.selectedRoot = path;
    this.persist();
    this.notify();
  }

  removeRoot(path) {
    this.roots = this.roots.filter(r => r !== path);
    if (this.selectedRoot === path) {
      this.selectedRoot = this.roots[0] || "";
    }
    this.persist();
    this.notify();
  }

  selectRoot(path) {
    this.selectedRoot = path;
    // Clear stale projects immediately so old workspace data doesn't show
    this.projects = [];
    this.search = "";
    this.filter = "All";
    this.persist();
    this.notify();
  }

  suggestRoots() {
    const discovered = scanLikelyRoots();
    for (const root of discovered) {
      if (!this.roots.includes(root)) {
        this.roots.push(root);
      }
    }
    this.selectedRoot = this.selectedRoot || this.roots[0] || "";
    this.persist();
    this.notify();
  }

  // ===== Scanning =====

  async scan() {
    if (!this.selectedRoot) return;
    this.scanning = true;
    this.notify();

    const myEpoch = ++this._scanEpoch.value;
    const result = await scanRoot(this.selectedRoot, () => {
      this.notify();
    }, this._scanEpoch);

    // Discard results if a newer scan has started since
    if (result.projects === null || this._scanEpoch.value !== myEpoch) {
      // Newer scan is running — it will set scanning=false when done
      return;
    }

    this.projects = result.projects;
    this.scanning = false;
    this.notify();
  }

  // ===== Filtering =====

  setSearch(value) {
    this.search = value;
    this.notify();
  }

  setFilter(value) {
    this.filter = value;
    this.notify();
  }

  getVisibleProjects() {
    const query = this.search.trim().toLowerCase();
    return this.projects.filter(project => {
      if (this.filter !== "All" && project.type !== this.filter) return false;
      if (!query) return true;
      return (
        project.name.toLowerCase().includes(query) ||
        project.path.toLowerCase().includes(query) ||
        project.type.toLowerCase().includes(query)
      );
    });
  }

  // ===== Settings =====

  /**
   * Update a single setting. Persists and notifies immediately.
   */
  setSetting(key, value) {
    this.settings[key] = value;
    this.persist();
    this.notify();
  }

  /**
   * Update multiple settings at once.
   */
  updateSettings(patch) {
    Object.assign(this.settings, patch);
    this.persist();
    this.notify();
  }

  /**
   * Reset all settings to defaults.
   */
  resetSettings() {
    this.settings = this.defaultSettings();
    this.persist();
    this.notify();
  }

  /**
   * Apply theme to the document.
   * Sciter uses document.attributes.theme = "dark" | "light" | undefined
   */
  applyTheme() {
    const theme = this.settings.theme;
    if (theme === "dark" || theme === "light") {
      Window.this.document.attributes.theme = theme;
    } else {
      Window.this.document.attributes.theme = undefined;
    }
  }

  // ===== Cleanup =====

  clean(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project || !project.cleanupTargets.length) return false;

    for (const target of project.cleanupTargets) {
      removeTree(target.path);
    }

    this.history.unshift({
      projectName: project.name,
      projectPath: project.path,
      projectType: project.type,
      targetsCleaned: project.cleanupTargets.map(t => t.name),
      bytesReclaimed: project.reclaimableBytes,
      canRestore: this.settings.useTrash,
      timestamp: Date.now() / 1000,
    });
    this.history = this.history.slice(0, 100);

    // Rescan the cleaned project
    const rescannedTargets = findCleanupTargets(project.path, project.type);
    const reclaimableBytes = rescannedTargets.reduce((sum, t) => sum + t.bytes, 0);

    this.projects = this.projects.map(p =>
      p.id === projectId
        ? { ...p, cleanupTargets: rescannedTargets, reclaimableBytes, reclaimableLabel: formatBytes(reclaimableBytes) }
        : p
    );

    this.persist();
    this.notify();
    return true;
  }

  // ===== Stats (computed, no mutation) =====

  getStats() {
    const totalReclaimed = this.history.reduce((sum, e) => sum + e.bytesReclaimed, 0);

    const typeMap = new Map();
    for (const project of this.projects) {
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
      totalProjectsScanned: this.projects.length,
      totalProjectsCleaned: this.history.length,
      currentlyReclaimable: totalReclaimable,
      typeBreakdown,
      largestProjects: this.projects
        .slice()
        .sort((a, b) => b.reclaimableBytes - a.reclaimableBytes)
        .slice(0, 10)
        .map(p => ({ name: p.name, path: p.path, type: p.type, size: p.reclaimableBytes })),
    };
  }

  // ===== Utilities =====

  openFolder(path) {
    env.launch(path);
  }

  selectFolder() {
    const fn = Window.this.selectFolder();
    if (fn) return URL.toPath(fn);
    return null;
  }
}
