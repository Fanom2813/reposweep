/**
 * App — UI shell. All business logic lives in store.js.
 *
 * Class components don't auto-subscribe to signals in render().
 * We bridge store signals → componentUpdate() via Reactor.effect()
 * set up in componentDidMount(), cleaned up in componentWillUnmount().
 *
 * Local UI state (currentPage, sidebarVisible) uses plain properties
 * with componentUpdate() — the standard class component pattern.
 *
 * All pages live in the DOM simultaneously as .page-panel elements.
 * Navigation toggles :expanded — Sciter's visibility:none/visible pattern —
 * so page state (scroll position, table data, inputs) is preserved across switches.
 */

import * as store from "lib/store.js";
import { Sidebar } from "ui/sidebar.js";
import { Onboarding } from "pages/onboarding.js";
import { WorkspaceEmpty, WorkspaceView } from "pages/workspace.js";
import { SettingsPage } from "pages/settings.js";
import { HistoryPage } from "pages/history.js";
import { StatsPage } from "pages/stats.js";

const navItems = [
  { id: "stats",    label: "Statistics", icon: "icon-bar-chart-2" },
  { id: "history",  label: "History",    icon: "icon-clock" },
  { id: "settings", label: "Settings",   icon: "icon-settings" },
];

export class Application extends Element {

  currentPage = "workspace";
  sidebarVisible = true;

  constructor() {
    super();
    store.init();
  }

  componentDidMount() {
    const header = this.$("window-header");
    if (header) header.state.reactive = false;

    // Bridge store signals → class component re-renders.
    // effect() subscribes to every signal read inside it;
    // when any of them change, it calls componentUpdate().
    this._dispose = Reactor.effect(() => {
      store.roots.value;
      store.selectedRoot.value;
      store.projects.value;
      store.scanning.value;
      store.search.value;
      store.filter.value;
      store.settings.value;
      store.history.value;
      this.componentUpdate();
    });

    if (store.selectedRoot.value && store.settings.value.autoScan) {
      store.scan();
    }
  }

  componentWillUnmount() {
    if (this._dispose) this._dispose();
  }

  navigateTo(page) {
    this.componentUpdate({ currentPage: page });
  }

  render() {
    const rootsList   = store.roots.value;
    const selected    = store.selectedRoot.value;
    const allProjects = store.projects.value;
    const isScanning  = store.scanning.value;
    const searchQuery = store.search.value;
    const filterValue = store.filter.value;
    const settingsVal = store.settings.value;
    const historyVal  = store.history.value;
    const page        = this.currentPage;
    const showSidebar = this.sidebarVisible;

    // Before any roots are added, show onboarding full-screen
    if (rootsList.length === 0) {
      return <div .app-shell>
        {this.renderHeader()}
        <div .app-body>
          <Onboarding key="onboarding" />
        </div>
      </div>;
    }

    // Filter projects
    const query = searchQuery.trim().toLowerCase();
    const visible = allProjects.filter(project => {
      if (filterValue !== "All" && project.type !== filterValue) return false;
      if (!query) return true;
      return (
        project.name.toLowerCase().includes(query) ||
        project.path.toLowerCase().includes(query) ||
        project.type.toLowerCase().includes(query)
      );
    });

    // Workspace content
    let workspace;
    if (visible.length === 0 && !isScanning && !searchQuery) {
      const name = selected.split("/").pop() || selected;
      workspace = <WorkspaceEmpty rootName={name} hasProjects={allProjects.length > 0} />;
    } else {
      workspace = <WorkspaceView
        projects={visible}
        projectTypes={store.getProjectTypes()}
        scanning={isScanning}
        searchValue={searchQuery}
        filterValue={filterValue}
        selectedRoot={selected}
      />;
    }

    return <div .app-shell>
      {this.renderHeader()}
      <div .app-body>
        {showSidebar ? <Sidebar
          roots={rootsList}
          selectedRoot={selected}
          navItems={navItems}
          currentPage={page}
        /> : []}
        <div .app-content>
          <div .page-panel :expanded={page === "workspace"}>
            {workspace}
          </div>
          <div .page-panel :expanded={page === "settings"}>
            <SettingsPage settings={settingsVal} />
          </div>
          <div .page-panel :expanded={page === "history"}>
            <HistoryPage history={historyVal} />
          </div>
          <div .page-panel :expanded={page === "stats"}>
            <StatsPage stats={store.getStats()} />
          </div>
        </div>
      </div>
    </div>;
  }

  renderHeader() {
    return <window-header>
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
    </window-header>;
  }

  // ===== Sidebar events =====

  ["on sidebar-navigate"](evt) {
    this.navigateTo(evt.data.page);
    return true;
  }

  ["on sidebar-select-root"](evt) {
    const root = evt.data.root;
    if (root === store.selectedRoot.value) {
      this.navigateTo("workspace");
    } else {
      store.selectRoot(root);
      this.navigateTo("workspace");
      if (!store.hasCachedScan(root)) {
        store.scan();
      }
    }
    return true;
  }

  ["on sidebar-add-root"]() {
    const p = store.selectFolder();
    if (p) {
      store.addRoot(p);
      this.navigateTo("workspace");
      store.scan();
    }
    return true;
  }

  ["on sidebar-remove-root"](evt) {
    store.removeRoot(evt.data.root);
    if (store.selectedRoot.value) store.scan();
    else this.navigateTo("workspace");
    return true;
  }

  // ===== Titlebar =====

  ["on click at button#toggle-sidebar"]() {
    this.componentUpdate({ sidebarVisible: !this.sidebarVisible });
    return true;
  }

  // ===== Onboarding =====

  ["on click at button#auto-detect"]() {
    store.suggestRoots();
    this.navigateTo("workspace");
    if (store.selectedRoot.value) store.scan();
    return true;
  }

  ["on click at button#add-workspace"]() {
    const p = store.selectFolder();
    if (p) {
      store.addRoot(p);
      this.navigateTo("workspace");
      store.scan();
    }
    return true;
  }

  // ===== Settings =====

  ["on change at select(themeSelect)"](evt, el) {
    store.setSetting("theme", el.value);
    store.applyTheme();
    return true;
  }

  ["on change at input(settingToggle)"](evt, el) {
    store.setSetting(el.attributes["data-key"], el.value);
    return true;
  }

  ["on change at input(settingNumber)"](evt, el) {
    store.setSetting(el.attributes["data-key"], el.value);
    return true;
  }

  ["on change at textarea(settingExclusions)"](evt, el) {
    const lines = (el.value || "").split("\n").map(s => s.trim()).filter(Boolean);
    store.setSetting("exclusions", lines);
    return true;
  }

  ["on click at button#reset-settings"]() {
    store.resetSettings();
    store.applyTheme();
    return true;
  }

  // ===== History =====

  ["on click at button#clear-history"]() {
    store.clearHistory();
    return true;
  }

  // ===== Workspace =====

  ["on click at button#rescan"]() { store.scan(); return true; }
  ["on change at select(filterSelect)"](evt, el) { store.setFilter(el.value); return true; }
  ["on change at input(searchBox)"](evt, el) { store.setSearch(el.value); return true; }
  ["on click at button[data-open]"](evt, el) { store.openFolder(el.attributes["data-open"]); return true; }

  // ===== Clean =====

  ["on click at button[data-id]"](evt, el) {
    const id = el.attributes["data-id"];
    const project = store.projects.value.find(p => p.id === id);
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

    if (confirmed) store.clean(id);
    return true;
  }
}
