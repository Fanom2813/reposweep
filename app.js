/**
 * Repo Sweep - Main Application
 *
 * Notion-inspired layout with sidebar navigation.
 * Based on samples.reactor/routing pattern - App handles routing directly.
 */

import * as env from "@env";
import * as Settings from "settings.js";
import { scanRoot, scanLikelyRoots, findCleanupTargets, formatBytes, removeTree } from "scanner.js";
import {
  HomePage,
  WorkspacePage,
  SettingsPage,
  HistoryPage,
  StatsPage,
  ProjectDetailPage,
} from "pages/index.js";

/**
 * Application State Manager
 */
class AppState {
  constructor(savedState = {}) {
    savedState = savedState || {};
    this.roots = savedState.roots || [];
    this.recentRoots = savedState.recentRoots || [];
    this.selectedRoot = savedState.selectedRoot || this.roots[0] || this.recentRoots[0] || "";
    this.projects = [];
    this.scanning = false;
    this.search = "";
    this.filter = "All";
    this.lastScanSummary = "";
    this.settings = savedState.settings || {
      theme: "system",
      useTrash: true,
      dryRunDefault: false,
      confirmThreshold: 100,
      deepScan: false,
      scanDepth: 2,
      staleDays: 30,
      exclusions: [".env", ".env.local", "secrets"],
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

  getRootChoices() {
    const merged = [...this.roots];
    for (const root of this.recentRoots) {
      if (!merged.includes(root)) merged.push(root);
    }
    return merged;
  }

  addRoot(path) {
    if (!path) return;
    const roots = this.roots.includes(path)
      ? this.roots
      : [...this.roots, path];
    const recentRoots = [path, ...this.recentRoots.filter(r => r !== path)].slice(0, 8);
    this.roots = roots;
    this.recentRoots = recentRoots;
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

  scan() {
    if (!this.selectedRoot) return;
    this.scanning = true;
    this.projects = scanRoot(this.selectedRoot);
    this.scanning = false;
    this.lastScanSummary = `${this.projects.length} project(s) found`;
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
    this.history.unshift({
      ...entry,
      timestamp: Date.now() / 1000,
    });
    this.history = this.history.slice(0, 100);
    this.persist();
  }
}

/**
 * Main Application Component
 *
 * Handles routing directly (no separate Router) following the Sciter Reactor pattern.
 */
export class Application extends Element {
  appState = null;
  routeName = "home";
  routeView = null;
  sidebarVisible = true;

  async componentDidMount() {
    const saved = await Settings.loadState();
    this.appState = new AppState(saved);
    this.routeView = this.buildRouteView("home");
    this.componentUpdate();
  }

  buildRouteView(name) {
    const s = this.appState || new AppState({});
    switch (name) {
      case "home":
        return <HomePage state={s} />;
      case "workspace":
        return <WorkspacePage state={s} projects={s.getVisibleProjects()} />;
      case "settings":
        return <SettingsPage state={s} />;
      case "history":
        return <HistoryPage state={s} history={s.history} />;
      case "stats":
        return <StatsPage state={s} stats={this.getStats()} />;
      case "project-detail":
        return <ProjectDetailPage />;
      default:
        return <HomePage state={s} />;
    }
  }

  navigateTo(name) {
    this.componentUpdate({
      routeName: name,
      routeView: this.buildRouteView(name),
    });
    return true;
  }

  getRouteLabel(name) {
    switch (name) {
      case "home": return "Home";
      case "workspace": return "Workspace";
      case "settings": return "Settings";
      case "history": return "History";
      case "stats": return "Statistics";
      case "project-detail": return "Project";
      default: return "";
    }
  }

  render() {
    if (!this.appState) {
      this.appState = new AppState({});
    }

    if (!this.routeView) {
      this.routeView = this.buildRouteView(this.routeName);
    }

    const totalReclaimable = this.appState.projects.reduce((s, p) => s + (p.reclaimableBytes || 0), 0);
    const projectCount = this.appState.projects.length;
    const rn = this.routeName;

    const sv = this.sidebarVisible;

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
          <div .titlebar-right>
            {totalReclaimable > 0 ? <span .titlebar-stat>{formatBytes(totalReclaimable)} reclaimable</span> : []}
          </div>
        </window-caption>
        <window-buttons>
          <window-button role="window-minimize" />
          <window-button role="window-maximize" />
          <window-button role="window-close" />
        </window-buttons>
      </window-header>
      <div .app-body>
        {sv ? <aside .sidebar>
          <nav .sidebar-nav>
            <div .nav-section>
              <a .nav-item href="route:home" state-current={rn === "home"}>
                <i .icon-home />
                <span .nav-label>Home</span>
              </a>
              <a .nav-item href="route:workspace" state-current={rn === "workspace"}>
                <i .icon-folder />
                <span .nav-label>Workspace</span>
                {projectCount > 0 ? <span .nav-count>{projectCount}</span> : []}
              </a>
            </div>
            <div .nav-section>
              <div .nav-section-label>Insights</div>
              <a .nav-item href="route:stats" state-current={rn === "stats"}>
                <i .icon-bar-chart-2 />
                <span .nav-label>Statistics</span>
              </a>
              <a .nav-item href="route:history" state-current={rn === "history"}>
                <i .icon-clock />
                <span .nav-label>History</span>
              </a>
            </div>
            <div .nav-section>
              <div .nav-section-label>Configuration</div>
              <a .nav-item href="route:settings" state-current={rn === "settings"}>
                <i .icon-settings />
                <span .nav-label>Settings</span>
              </a>
            </div>
          </nav>
          {totalReclaimable > 0 ? <div .sidebar-footer>
            <div .footer-label>Reclaimable</div>
            <div .footer-value>{formatBytes(totalReclaimable)}</div>
          </div> : []}
        </aside> : []}
        <div .app-content>
          {this.routeView}
        </div>
      </div>
    </div>;
  }

  // ===== Route link handler =====
  ["on click at [href^='route:']"](event, hyperlink) {
    const href = hyperlink.attributes["href"];
    const name = href.substring(6);
    return this.navigateTo(name);
  }

  // ===== Event Handlers =====

  ["on click at button#toggle-sidebar"]() {
    this.componentUpdate({ sidebarVisible: !this.sidebarVisible });
    return true;
  }

  ["on click at button#auto-detect"]() {
    this.appState.suggestRoots();
    if (this.appState.roots.length > 0) {
      this.appState.scan();
      this.navigateTo("workspace");
    }
    this.componentUpdate();
    return true;
  }

  ["on click at button#select-path"]() {
    const fn = Window.this.selectFolder();
    if (fn) {
      const path = URL.toPath(fn);
      this.appState.addRoot(path);
      this.appState.scan();
      this.navigateTo("workspace");
    }
    return true;
  }

  ["on click at button#start"]() {
    this.appState.scan();
    this.navigateTo("workspace");
    return true;
  }

  ["on change at input(rootChoice)"](evt, input) {
    this.appState.selectedRoot = input.value;
    this.componentUpdate();
    return true;
  }

  ["on click at button.inline-remove"](evt, button) {
    this.appState.removeRoot(button.attributes["data-path"]);
    this.componentUpdate();
    return true;
  }

  ["on click at button#change-root"]() {
    this.navigateTo("home");
    return true;
  }

  ["on click at button#rescan"]() {
    this.appState.scan();
    this.routeView = this.buildRouteView(this.routeName);
    this.componentUpdate();
    return true;
  }

  ["on change at select(filterSelect)"](evt, select) {
    this.appState.filter = select.value;
    this.routeView = this.buildRouteView(this.routeName);
    this.componentUpdate();
    return true;
  }

  ["on change at input(searchBox)"](evt, input) {
    this.appState.search = input.value;
    this.routeView = this.buildRouteView(this.routeName);
    this.componentUpdate();
    return true;
  }

  ["on click at button[data-id]"](evt, button) {
    const project = this.appState.projects.find(p => p.id === button.attributes["data-id"]);
    if (project) {
      this.cleanProject(project);
    }
    return true;
  }

  ["on click at button[data-open]"](evt, button) {
    env.launch(button.attributes["data-open"]);
    return true;
  }

  // ===== Actions =====

  cleanProject(project) {
    if (!project.cleanupTargets.length) return;

    const confirmed = Window.this.modal(
      <question caption="Confirm Cleanup">
        <content>
          Clean {project.cleanupTargets.length} target(s) in <b>{project.name}</b>?
          <br />
          This will remove {project.reclaimableLabel} of caches and build folders.
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
        ? {
            ...p,
            cleanupTargets: rescannedTargets,
            reclaimableBytes,
            reclaimableLabel: formatBytes(reclaimableBytes),
          }
        : p
    );

    this.appState.lastScanSummary = `Cleaned ${project.name}`;
    this.routeView = this.buildRouteView(this.routeName);
    this.componentUpdate();
  }

  getStats() {
    const totalReclaimed = this.appState.history.reduce((sum, e) => sum + e.bytesReclaimed, 0);

    const typeMap = new Map();
    for (const project of this.appState.projects) {
      const existing = typeMap.get(project.type) || { count: 0, reclaimable: 0 };
      existing.count++;
      existing.reclaimable += project.reclaimableBytes;
      typeMap.set(project.type, existing);
    }
    const totalReclaimable = Array.from(typeMap.values()).reduce((s, v) => s + v.reclaimable, 0);
    const typeBreakdown = Array.from(typeMap.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        percentage: totalReclaimable > 0 ? (data.reclaimable / totalReclaimable) * 100 : 0,
      }))
      .sort((a, b) => b.reclaimable - a.reclaimable);

    return {
      totalReclaimed,
      totalProjectsScanned: this.appState.projects.length,
      totalProjectsCleaned: this.appState.history.length,
      currentlyReclaimable: totalReclaimable,
      typeBreakdown,
      monthlyReclaim: this.getMonthlyReclaim(),
      largestProjects: this.appState.projects
        .slice()
        .sort((a, b) => b.reclaimableBytes - a.reclaimableBytes)
        .slice(0, 10)
        .map(p => ({
          name: p.name,
          path: p.path,
          type: p.type,
          size: p.reclaimableBytes,
        })),
      recommendations: this.getRecommendations(),
    };
  }

  getMonthlyReclaim() {
    const monthly = new Map();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
      monthly.set(key, { label: months[d.getMonth()], bytes: 0 });
    }
    for (const entry of this.appState.history) {
      const d = new Date(entry.timestamp * 1000);
      const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
      if (monthly.has(key)) {
        const existing = monthly.get(key);
        existing.bytes += entry.bytesReclaimed;
        monthly.set(key, existing);
      }
    }
    const values = Array.from(monthly.values());
    const maxBytes = Math.max(...values.map(v => v.bytes), 1);
    return values.map(v => ({
      ...v,
      percentage: (v.bytes / maxBytes) * 100,
    }));
  }

  getRecommendations() {
    const recs = [];
    const staleThreshold = Date.now() / 1000 - this.appState.settings.staleDays * 86400;
    const staleProjects = this.appState.projects.filter(p => p.modifiedAt < staleThreshold);
    const staleReclaimable = staleProjects.reduce((s, p) => s + p.reclaimableBytes, 0);
    if (staleProjects.length > 0) {
      recs.push({
        priority: "high",
        title: `${staleProjects.length} stale projects detected`,
        description: `Projects not modified in ${this.appState.settings.staleDays} days. ${formatBytes(staleReclaimable)} reclaimable.`,
      });
    }
    const largeProjects = this.appState.projects.filter(p => p.reclaimableBytes > 1024 * 1024 * 1024);
    if (largeProjects.length > 0) {
      recs.push({
        priority: "medium",
        title: `${largeProjects.length} projects with >1GB reclaimable`,
        description: "Focus on these for maximum space recovery.",
      });
    }
    return recs;
  }
}
