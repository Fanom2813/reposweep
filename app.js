/**
 * App — UI shell only. All business logic lives in store.js.
 */

import { Store, formatBytes } from "lib/store.js";
import { Sidebar } from "ui/sidebar.js";
import { Onboarding } from "pages/onboarding.js";
import { WorkspaceEmpty, WorkspaceView } from "pages/workspace.js";
import { SettingsPage } from "pages/settings.js";
import { HistoryPage } from "pages/history.js";
import { StatsPage } from "pages/stats.js";

export class Application extends Element {
  store = null;
  sidebarVisible = true;
  currentPage = "workspace";

  navItems = [
    { id: "stats",    label: "Statistics", icon: "icon-bar-chart-2" },
    { id: "history",  label: "History",    icon: "icon-clock" },
    { id: "settings", label: "Settings",   icon: "icon-settings" },
  ];

  async componentDidMount() {
    // Store notifies UI via post() with dedup
    this.store = new Store(() => {
      this.post(() => this.componentUpdate());
    });
    await this.store.init();

    if (this.store.selectedRoot && this.store.settings.autoScan) {
      this.store.scan();
    }
  }

  render() {
    const s = this.store;
    if (!s) return <div .app-shell />;

    const page = this.currentPage;
    const projects = s.getVisibleProjects();
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
        {this.sidebarVisible ? <Sidebar
          roots={s.roots}
          selectedRoot={s.selectedRoot}
          navItems={this.navItems}
          currentPage={page}
        /> : []}
        <div .app-content>
          {this.renderPage(page, s, projects, hasRoots)}
        </div>
      </div>
    </div>;
  }

  renderPage(page, s, projects, hasRoots) {
    if (page === "workspace") {
      if (!hasRoots) return <Onboarding />;
      if (projects.length === 0 && !s.scanning && !s.search) {
        const name = s.selectedRoot.split("/").pop() || s.selectedRoot;
        return <WorkspaceEmpty rootName={name} hasProjects={s.projects.length > 0} />;
      }
      return <WorkspaceView state={s} projects={projects} projectTypes={s.getProjectTypes()} />;
    }
    if (page === "stats")    return <StatsPage stats={s.getStats()} />;
    if (page === "history")  return <HistoryPage history={s.history} />;
    if (page === "settings") return <SettingsPage settings={s.settings} />;
    return <Onboarding />;
  }

  // ===== Event handlers — thin wiring between UI events and store =====

  // Sidebar
  ["on sidebar-navigate"](evt)    { this.componentUpdate({ currentPage: evt.data.page }); return true; }
  ["on sidebar-select-root"](evt) { this.store.selectRoot(evt.data.root); this.store.scan(); this.componentUpdate({ currentPage: "workspace" }); return true; }
  ["on sidebar-add-root"]()       { const p = this.store.selectFolder(); if (p) { this.store.addRoot(p); this.store.scan(); this.componentUpdate({ currentPage: "workspace" }); } return true; }
  ["on sidebar-remove-root"](evt) { this.store.removeRoot(evt.data.root); if (this.store.selectedRoot) this.store.scan(); return true; }

  // Titlebar
  ["on click at button#toggle-sidebar"]() { this.componentUpdate({ sidebarVisible: !this.sidebarVisible }); return true; }

  // Onboarding
  ["on click at button#auto-detect"]() { this.store.suggestRoots(); this.componentUpdate({ currentPage: "workspace" }); if (this.store.selectedRoot) this.store.scan(); return true; }
  ["on click at button#add-workspace"]() { const p = this.store.selectFolder(); if (p) { this.store.addRoot(p); this.store.scan(); this.componentUpdate({ currentPage: "workspace" }); } return true; }

  // Workspace
  ["on click at button#rescan"]() { this.store.scan(); return true; }
  ["on change at select(filterSelect)"](evt, el) { this.store.setFilter(el.value); return true; }
  ["on change at input(searchBox)"](evt, el) { this.store.setSearch(el.value); return true; }
  ["on click at button[data-open]"](evt, el) { this.store.openFolder(el.attributes["data-open"]); return true; }

  // Clean
  ["on click at button[data-id]"](evt, el) {
    const id = el.attributes["data-id"];
    const project = this.store.projects.find(p => p.id === id);
    if (!project || !project.cleanupTargets.length) return true;

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

    if (confirmed) this.store.clean(id);
    return true;
  }
}
