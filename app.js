/**
 * Repo Sweep - Main Application
 *
 * Desktop utility for cleaning workspace caches.
 * Opens directly to workspace — no landing page.
 */

import * as env from "@env";
import * as Settings from "settings.js";
import { scanRoot, scanLikelyRoots, findCleanupTargets, formatBytes, removeTree } from "scanner.js";
import { Sidebar } from "ui/sidebar.js";
import { Onboarding } from "pages/onboarding.js";
import { WorkspaceEmpty, WorkspaceView } from "pages/workspace.js";
import { SettingsPage } from "pages/settings.js";
import { HistoryPage } from "pages/history.js";
import { StatsPage } from "pages/stats.js";

/**
 * Application State
 */
class AppState {
  constructor(savedState = {}) {
    savedState = savedState || {};
    this.roots = savedState.roots || [];
    this.recentRoots = savedState.recentRoots || [];
    this.selectedRoot = savedState.selectedRoot || this.roots[0] || "";
    this.projects = [];
    this.scanning = false;
    this.search = "";
    this.filter = "All";
    this.settings = savedState.settings || {
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
    this.history = savedState.history || [];
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

  addRoot(path) {
    if (!path) return;
    if (!this.roots.includes(path)) {
      this.roots = [...this.roots, path];
    }
    this.recentRoots = [path, ...this.recentRoots.filter(r => r !== path)].slice(0, 8);
    this.selectedRoot = path;
    this.persist();
  }

  removeRoot(path) {
    this.roots = this.roots.filter(r => r !== path);
    if (this.selectedRoot === path) {
      this.selectedRoot = this.roots[0] || "";
    }
    this.persist();
  }

  async scan(onProgress) {
    if (!this.selectedRoot) return;
    this.scanning = true;
    this.projects = await scanRoot(this.selectedRoot, onProgress);
    this.scanning = false;
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

  addToHistory(entry) {
    this.history.unshift({ ...entry, timestamp: Date.now() / 1000 });
    this.history = this.history.slice(0, 100);
    this.persist();
  }
}

// ===== Main Application =====

export class Application extends Element {
  appState = null;
  sidebarVisible = true;
  currentPage = "workspace";

  // Nav items — passed to Sidebar as data, not hardcoded there
  navItems = [
    { id: "stats",    label: "Statistics", icon: "icon-bar-chart-2" },
    { id: "history",  label: "History",    icon: "icon-clock" },
    { id: "settings", label: "Settings",   icon: "icon-settings" },
  ];

  async componentDidMount() {
    const saved = await Settings.loadState();
    this.appState = new AppState(saved);

    this.componentUpdate();

    // Auto-scan on launch if we have a root
    if (this.appState.selectedRoot && this.appState.settings.autoScan) {
      this.doScan();
    }
  }

  render() {
    if (!this.appState) {
      this.appState = new AppState({});
    }

    const s = this.appState;
    const sv = this.sidebarVisible;
    const page = this.currentPage;
    const projects = s.getVisibleProjects();
    const totalReclaimable = s.projects.reduce((sum, p) => sum + (p.reclaimableBytes || 0), 0);
    const hasRoots = s.roots.length > 0;

    return <div .app-shell>
      <window-header>
        <window-caption role="window-caption">
          <div .titlebar-left>
            <button .titlebar-btn #toggle-sidebar title="Toggle sidebar">
              <i .icon-panel-left />
            </button>
            <img .titlebar-icon src="icon.svg" />
            <span .titlebar-name>RepoSweep</span>
          </div>
          <div .titlebar-center />
          <div .titlebar-right />
        </window-caption>
        <window-buttons>
          <window-button role="window-minimize" />
          <window-button role="window-maximize" />
          <window-button role="window-close" />
        </window-buttons>
      </window-header>
      <div .app-body>
        {sv ? <Sidebar
          roots={s.roots}
          selectedRoot={s.selectedRoot}
          navItems={this.navItems}
          currentPage={page}
        /> : []}
        <div .app-content>
          {page === "workspace" ? this.renderWorkspace(s, projects, hasRoots)
            : page === "stats" ? <StatsPage state={s} stats={this.getStats()} />
            : page === "history" ? <HistoryPage state={s} history={s.history} />
            : page === "settings" ? <SettingsPage state={s} />
            : this.renderWorkspace(s, projects, hasRoots)}
        </div>
      </div>
    </div>;
  }

  // ===== Workspace View (inline, not a separate page) =====

  renderWorkspace(s, projects, hasRoots) {
    if (!hasRoots) {
      return <Onboarding />;
    }

    if (projects.length === 0 && !s.scanning && !s.search) {
      const rootName = s.selectedRoot ? s.selectedRoot.split("/").pop() || s.selectedRoot : "";
      return <WorkspaceEmpty rootName={rootName} hasProjects={s.projects.length > 0} />;
    }

    return <WorkspaceView state={s} projects={projects} />;
  }

  // ===== Scan (async, non-blocking) =====

  async doScan() {
    this.componentUpdate({ currentPage: "workspace" });

    // post() with avoidDuplicates — Sciter dedupes automatically
    await this.appState.scan(() => {
      this.post(() => this.componentUpdate());
    });

    this.componentUpdate();
  }

  // ===== Navigation =====

  // ===== Sidebar events (bubbled from Sidebar component) =====

  ["on sidebar-navigate"](evt) {
    this.componentUpdate({ currentPage: evt.data.page });
    return true;
  }

  ["on sidebar-select-root"](evt) {
    this.appState.selectedRoot = evt.data.root;
    this.doScan();
    return true;
  }

  ["on sidebar-add-root"]() {
    const fn = Window.this.selectFolder();
    if (fn) {
      const path = URL.toPath(fn);
      this.appState.addRoot(path);
      this.doScan();
    }
    return true;
  }

  ["on sidebar-remove-root"](evt) {
    this.appState.removeRoot(evt.data.root);
    if (this.appState.selectedRoot) {
      this.doScan();
    } else {
      this.componentUpdate();
    }
    return true;
  }

  ["on click at button#toggle-sidebar"]() {
    this.componentUpdate({ sidebarVisible: !this.sidebarVisible });
    return true;
  }

  // ===== Workspace Actions =====

  ["on click at button#auto-detect"]() {
    this.appState.suggestRoots();
    this.componentUpdate({ currentPage: "workspace" });
    if (this.appState.selectedRoot) {
      this.doScan();
    }
    return true;
  }

  ["on click at button#rescan"]() {
    this.doScan();
    return true;
  }

  ["on change at select(filterSelect)"](evt, select) {
    this.appState.filter = select.value;
    this.componentUpdate();
    return true;
  }

  ["on change at input(searchBox)"](evt, input) {
    this.appState.search = input.value;
    this.componentUpdate();
    return true;
  }

  ["on click at button[data-id]"](evt, button) {
    const project = this.appState.projects.find(p => p.id === button.attributes["data-id"]);
    if (project) this.cleanProject(project);
    return true;
  }

  ["on click at button[data-open]"](evt, button) {
    env.launch(button.attributes["data-open"]);
    return true;
  }

  // ===== Clean =====

  cleanProject(project) {
    if (!project.cleanupTargets.length) return;

    const confirmed = Window.this.modal(
      <question caption="Confirm Cleanup">
        <content>
          Clean {project.cleanupTargets.length} target(s) in <b>{project.name}</b>?
          <br/>This will remove {project.reclaimableLabel} of caches and build folders.
        </content>
        <buttons>
          <button id="clean" role="default-button">Clean</button>
          <button id="cancel" role="cancel-button">Cancel</button>
        </buttons>
      </question>
    ) === "clean";

    if (!confirmed) return;

    for (const target of project.cleanupTargets) {
      removeTree(target.path);
    }

    this.appState.addToHistory({
      projectName: project.name,
      projectPath: project.path,
      projectType: project.type,
      targetsCleaned: project.cleanupTargets.map(t => t.name),
      bytesReclaimed: project.reclaimableBytes,
      canRestore: this.appState.settings.useTrash,
    });

    const rescannedTargets = findCleanupTargets(project.path, project.type);
    const reclaimableBytes = rescannedTargets.reduce((sum, t) => sum + t.bytes, 0);

    this.appState.projects = this.appState.projects.map(p =>
      p.id === project.id
        ? { ...p, cleanupTargets: rescannedTargets, reclaimableBytes, reclaimableLabel: formatBytes(reclaimableBytes) }
        : p
    );

    this.componentUpdate();
  }

  // ===== Stats =====

  getStats() {
    const s = this.appState;
    const totalReclaimed = s.history.reduce((sum, e) => sum + e.bytesReclaimed, 0);

    const typeMap = new Map();
    for (const project of s.projects) {
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
      totalProjectsScanned: s.projects.length,
      totalProjectsCleaned: s.history.length,
      currentlyReclaimable: totalReclaimable,
      typeBreakdown,
      largestProjects: s.projects
        .slice().sort((a, b) => b.reclaimableBytes - a.reclaimableBytes).slice(0, 10)
        .map(p => ({ name: p.name, path: p.path, type: p.type, size: p.reclaimableBytes })),
    };
  }
}
