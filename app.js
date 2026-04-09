/**
 * Repo Sweep - Main Application
 *
 * Desktop utility for cleaning workspace caches.
 * Opens directly to workspace — no landing page.
 */

import * as env from "@env";
import * as Settings from "settings.js";
import { scanRoot, scanLikelyRoots, findCleanupTargets, formatBytes, removeTree } from "scanner.js";
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

  scan() {
    if (!this.selectedRoot) return;
    this.scanning = true;
    this.projects = scanRoot(this.selectedRoot);
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

// ===== Helpers =====

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function rootLabel(path) {
  if (!path) return "";
  const parts = path.split("/");
  return parts[parts.length - 1] || parts[parts.length - 2] || path;
}

// ===== Main Application =====

export class Application extends Element {
  appState = null;
  sidebarVisible = true;
  currentPage = "workspace"; // workspace | stats | history | settings

  async componentDidMount() {
    const saved = await Settings.loadState();
    this.appState = new AppState(saved);

    // Auto-scan on launch if we have a root
    if (this.appState.selectedRoot && this.appState.settings.autoScan) {
      this.appState.scan();
    }

    this.componentUpdate();
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
          <div .col .p-2 .gap-1>
            <div .fg-3 .text-xs .medium .px-2 .py-1 style="text-transform:uppercase; letter-spacing:0.04em;">Workspaces</div>
            {s.roots.map(root => <div .si
                key={root}
                state-active={root === s.selectedRoot && page === "workspace"}
                data-root={root}>
              <i .icon-folder />
              <span .w-full .truncate>{rootLabel(root)}</span>
              <button .si-remove data-path={root}><i .icon-x /></button>
            </div>)}
            <button .si .muted #add-workspace>
              <i .icon-plus />
              <span>Add workspace</span>
            </button>
          </div>
          <div .sidebar-divider />
          <div .col .p-2 .gap-1>
            <a .si href="page:stats" state-current={page === "stats"}>
              <i .icon-bar-chart-2 />
              <span .w-full>Statistics</span>
            </a>
            <a .si href="page:history" state-current={page === "history"}>
              <i .icon-clock />
              <span .w-full>History</span>
            </a>
            <a .si href="page:settings" state-current={page === "settings"}>
              <i .icon-settings />
              <span .w-full>Settings</span>
            </a>
          </div>
          {totalReclaimable > 0 ? <div .p-3 .border-t .col style="margin-top:auto;">
            <span .text-xs .fg-3>Reclaimable</span>
            <span .text-base .bold .fg-grn .font-mono>{formatBytes(totalReclaimable)}</span>
          </div> : []}
        </aside> : []}
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
    // First-launch: no roots configured
    if (!hasRoots) {
      return <div .onboarding>
        <div .col .gap-4 .m-auto .p-6 .text-center style="min-width:300dip; max-width:500dip;">
          <i .icon-folder .mx-auto style="font-size:40dip; size:40dip; line-height:40dip; color:color(fg-3);" />
          <div .col .gap-2>
            <h2 .text-2xl .semibold>Add a workspace</h2>
            <p .fg-2 .text-base>Pick a folder that contains your projects. RepoSweep will scan it and find cleanup targets.</p>
          </div>
          <div .row .gap-3 .mx-auto .mt-2>
            <button .primary .lg #auto-detect><i .icon-zap /> Auto-detect</button>
            <button .lg #add-workspace><i .icon-folder /> Browse...</button>
          </div>
        </div>
      </div>;
    }

    // Has roots but no projects yet
    if (projects.length === 0 && !s.scanning && !s.search) {
      return <div .workspace>
        <div .row .gap-3 .px-5 .py-3 .border-b>
          <h3 .text-lg .semibold .nowrap>{rootLabel(s.selectedRoot)}</h3>
          <div .spacer />
          <button .primary .sm #rescan><i .icon-refresh-cw /> Scan</button>
        </div>
        <div .h-full>
          <div .col .gap-2 .m-auto .text-center>
            <i .icon-search .mx-auto style="font-size:28dip; size:28dip; line-height:28dip; color:color(fg-3);" />
            <h3 .text-lg .medium>{s.projects.length === 0 ? "No projects scanned yet" : "No matches"}</h3>
            <p .fg-2 .text-sm>Click Scan to discover projects in this workspace.</p>
          </div>
        </div>
      </div>;
    }

    const totalReclaimable = projects.reduce((sum, p) => sum + (p.reclaimableBytes || 0), 0);

    return <div .workspace>
      <div .row .gap-3 .px-5 .py-3 .border-b>
        <h3 .text-lg .semibold .nowrap>{rootLabel(s.selectedRoot)}</h3>
        <span .text-xs .fg-3 .nowrap>{projects.length} projects · {formatBytes(totalReclaimable)} reclaimable</span>
        <div .spacer />
        <input|text .search .sm searchBox value={s.search} novalue="Search..." style="width:180dip;" />
        <select|list .sm filterSelect value={s.filter} style="width:100dip;">
          <option value="All">All</option>
          <option value="Node">Node</option>
          <option value="Flutter">Flutter</option>
          <option value="Rust">Rust</option>
          <option value="Python">Python</option>
          <option value="Git">Git</option>
          <option value="Unknown">Unknown</option>
        </select>
        <button .ghost .sm #rescan disabled={s.scanning} title="Rescan"><i .icon-refresh-cw /></button>
      </div>
      <div .project-list>
        {projects.map(project => <div .project-row .row .gap-3 .px-5 .py-2 .border-b key={project.id}>
          <div .col .gap-1 .w-full style="min-width:200dip;">
            <span .text-sm .medium>{project.name}</span>
            <span .font-mono .text-xs .fg-3 .truncate>{project.path}</span>
          </div>
          <div .row .gap-2>
            <span .badge class={project.type.toLowerCase()}>{project.type}</span>
            <span .fg-3 .text-xs>{timeAgo(project.modifiedAt)}</span>
          </div>
          <span .font-mono .text-sm .semibold .fg-grn .nowrap style="width:90dip; text-align:right;">{formatBytes(project.reclaimableBytes)}</span>
          <div .actions .row .gap-1>
            <button .primary .sm data-id={project.id} disabled={!project.cleanupTargets?.length}>Clean</button>
            <button .ghost .sm data-open={project.path} title="Open"><i .icon-external-link /></button>
          </div>
        </div>)}
      </div>
    </div>;
  }

  // ===== Navigation =====

  ["on click at [href^='page:']"](event, el) {
    const page = el.attributes["href"].substring(5);
    this.componentUpdate({ currentPage: page });
    return true;
  }

  ["on click at .root-entry"](event, el) {
    const root = el.attributes["data-root"];
    if (root) {
      this.appState.selectedRoot = root;
      this.appState.scan();
      this.componentUpdate({ currentPage: "workspace" });
    }
    return true;
  }

  ["on click at button#toggle-sidebar"]() {
    this.componentUpdate({ sidebarVisible: !this.sidebarVisible });
    return true;
  }

  // ===== Workspace Actions =====

  ["on click at button#add-workspace"]() {
    const fn = Window.this.selectFolder();
    if (fn) {
      const path = URL.toPath(fn);
      this.appState.addRoot(path);
      this.appState.scan();
      this.componentUpdate({ currentPage: "workspace" });
    }
    return true;
  }

  ["on click at button#auto-detect"]() {
    this.appState.suggestRoots();
    if (this.appState.selectedRoot) {
      this.appState.scan();
    }
    this.componentUpdate({ currentPage: "workspace" });
    return true;
  }

  ["on click at button#rescan"]() {
    this.appState.scan();
    this.componentUpdate();
    return true;
  }

  ["on click at button.root-entry-remove"](evt, button) {
    evt.stopPropagation();
    this.appState.removeRoot(button.attributes["data-path"]);
    if (this.appState.selectedRoot) {
      this.appState.scan();
    }
    this.componentUpdate();
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
