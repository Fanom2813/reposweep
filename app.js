/**
 * App — UI shell only. All business logic lives in store.js.
 *
 * Optimization: sidebar and titlebar are marked non-reactive.
 * Page navigation patches only the content area.
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
    const t0 = Date.now();
    this.store = new Store(() => {
      this.post(() => this.updateContent());
    });
    this.store.init();
    console.log(`[app] Store constructed + init in ${Date.now() - t0}ms`);
  }

  componentDidMount() {
    // Mark static parts as non-reactive — they won't re-render on componentUpdate
    const header = this.$("window-header");
    if (header) header.state.reactive = false;

    if (this.store.selectedRoot && this.store.settings.autoScan) {
      requestAnimationFrame(() => this.store.scan());
    }
  }

  /**
   * Only patch the content area — not the entire tree.
   */
  updateContent() {
    const t0 = Date.now();
    const content = this.$("div.app-content");
    if (content) {
      const vdom = this.renderPage(this.currentPage, this.store);
      console.log(`[app] renderPage built in ${Date.now() - t0}ms`);
      content.patch(vdom);
      console.log(`[app] patch completed in ${Date.now() - t0}ms`);
      requestAnimationFrame(() => {
        console.log(`[app] frame painted after patch — total ${Date.now() - t0}ms`);
      });
    }
  }

  /**
   * Update sidebar separately when needed (root changes, page nav).
   */
  updateSidebar() {
    const sidebar = this.$("aside.sidebar");
    if (sidebar) {
      sidebar.componentUpdate({
        roots: this.store.roots,
        selectedRoot: this.store.selectedRoot,
        navItems: this.navItems,
        currentPage: this.currentPage,
      });
    }
  }

  /**
   * Navigate to page — updates sidebar highlight + content area.
   */
  navigateTo(page) {
    console.log(`[app] navigateTo('${page}')`);
    this.currentPage = page;
    this.updateSidebar();
    this.updateContent();
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
        <div .app-content>
          {this.renderPage(this.currentPage, s)}
        </div>
      </div>
    </div>;
  }

  renderPage(page, s) {
    if (page === "settings") return <SettingsPage settings={s.settings} />;
    if (page === "history")  return <HistoryPage history={s.history} />;
    if (page === "stats")    return <StatsPage stats={s.getStats()} />;

    if (s.roots.length === 0) return <Onboarding />;
    const projects = s.getVisibleProjects();
    if (projects.length === 0 && !s.scanning && !s.search) {
      const name = s.selectedRoot.split("/").pop() || s.selectedRoot;
      return <WorkspaceEmpty rootName={name} hasProjects={s.projects.length > 0} />;
    }
    return <WorkspaceView state={s} projects={projects} projectTypes={s.getProjectTypes()} />;
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
    this.updateSidebar();
    if (this.store.selectedRoot) this.store.scan();
    else this.updateContent();
    return true;
  }

  // ===== Titlebar =====

  ["on click at button#toggle-sidebar"]() {
    this.sidebarVisible = !this.sidebarVisible;
    this.componentUpdate(); // Full re-render needed for sidebar show/hide
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
