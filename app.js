/**
 * App — UI shell only. All business logic lives in store.js.
 *
 * Navigation uses componentUpdate() — the correct Sciter pattern.
 * Page components use key to ensure proper reconciliation.
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

  constructor() {
    super();
    this.store = new Store(() => {
      this.componentUpdate();
    });
    this.store.init();
  }

  componentDidMount() {
    const header = this.$("window-header");
    if (header) header.state.reactive = false;

    if (this.store.selectedRoot && this.store.settings.autoScan) {
      requestAnimationFrame(() => this.store.scan());
    }
  }

  navigateTo(page) {
    this.currentPage = page;
    this.componentUpdate();
  }

  render() {
    const s = this.store;

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
          currentPage={this.currentPage}
        /> : []}
        <div .app-content key={this.currentPage}>
          {this.renderPage(this.currentPage, s)}
        </div>
      </div>
    </div>;
  }

  renderPage(page, s) {
    if (page === "settings") return <SettingsPage key="settings" settings={s.settings} />;
    if (page === "history")  return <HistoryPage key="history" history={s.history} />;
    if (page === "stats")    return <StatsPage key="stats" stats={s.getStats()} />;

    if (s.roots.length === 0) return <Onboarding key="onboarding" />;
    const projects = s.getVisibleProjects();
    if (projects.length === 0 && !s.scanning && !s.search) {
      const name = s.selectedRoot.split("/").pop() || s.selectedRoot;
      return <WorkspaceEmpty key="empty" rootName={name} hasProjects={s.projects.length > 0} />;
    }
    return <WorkspaceView key="workspace" state={s} projects={projects} projectTypes={s.getProjectTypes()} />;
  }

  // ===== Sidebar events =====

  ["on sidebar-navigate"](evt) {
    this.navigateTo(evt.data.page);
    return true;
  }

  ["on sidebar-select-root"](evt) {
    this.store.selectRoot(evt.data.root);
    this.navigateTo("workspace");
    this.store.scan();
    return true;
  }

  ["on sidebar-add-root"]() {
    const p = this.store.selectFolder();
    if (p) {
      this.store.addRoot(p);
      this.navigateTo("workspace");
      this.store.scan();
    }
    return true;
  }

  ["on sidebar-remove-root"](evt) {
    this.store.removeRoot(evt.data.root);
    if (this.store.selectedRoot) this.store.scan();
    else this.componentUpdate();
    return true;
  }

  // ===== Titlebar =====

  ["on click at button#toggle-sidebar"]() {
    this.sidebarVisible = !this.sidebarVisible;
    this.componentUpdate();
    return true;
  }

  // ===== Onboarding =====

  ["on click at button#auto-detect"]() {
    this.store.suggestRoots();
    this.navigateTo("workspace");
    if (this.store.selectedRoot) this.store.scan();
    return true;
  }

  ["on click at button#add-workspace"]() {
    const p = this.store.selectFolder();
    if (p) {
      this.store.addRoot(p);
      this.navigateTo("workspace");
      this.store.scan();
    }
    return true;
  }

  // ===== Settings =====

  ["on change at select(themeSelect)"](evt, el) {
    this.store.setSetting("theme", el.value);
    this.store.applyTheme();
    return true;
  }

  ["on change at input(settingToggle)"](evt, el) {
    this.store.setSetting(el.attributes["data-key"], el.value);
    return true;
  }

  ["on change at input(settingNumber)"](evt, el) {
    this.store.setSetting(el.attributes["data-key"], el.value);
    return true;
  }

  ["on change at textarea(settingExclusions)"](evt, el) {
    const lines = (el.value || "").split("\n").map(s => s.trim()).filter(Boolean);
    this.store.setSetting("exclusions", lines);
    return true;
  }

  ["on click at button#reset-settings"]() {
    this.store.resetSettings();
    this.store.applyTheme();
    return true;
  }

  // ===== Workspace =====

  ["on click at button#rescan"]() { this.store.scan(); return true; }
  ["on change at select(filterSelect)"](evt, el) { this.store.setFilter(el.value); return true; }
  ["on change at input(searchBox)"](evt, el) { this.store.setSearch(el.value); return true; }
  ["on click at button[data-open]"](evt, el) { this.store.openFolder(el.attributes["data-open"]); return true; }

  // ===== Clean =====

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
