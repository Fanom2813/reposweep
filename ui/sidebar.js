/**
 * Sidebar Component
 *
 * Reactive class component that manages its own state.
 * Receives workspace roots and nav items as props — nothing hardcoded.
 *
 * Props:
 *   roots: Array<{ path, label }> — workspace entries
 *   selectedRoot: string — currently active root path
 *   navItems: Array<{ id, label, icon }> — page navigation entries
 *   currentPage: string — active page id
 *
 * Events (bubble up to parent):
 *   "sidebar-navigate" — { detail: { page } }
 *   "sidebar-select-root" — { detail: { root } }
 *   "sidebar-add-root" — {}
 *   "sidebar-remove-root" — { detail: { root } }
 */

export class Sidebar extends Element {

  render(props) {
    const roots = props?.roots || [];
    const selectedRoot = props?.selectedRoot || "";
    const navItems = props?.navItems || [];
    const currentPage = props?.currentPage || "";

    return <aside .sidebar>
      {/* Workspace roots */}
      <div .col .p-2 .gap-1>
        <div .fg-3 .text-xs .medium .px-2 .py-1
             style="text-transform:uppercase; letter-spacing:0.04em;">
          Workspaces
        </div>
        {roots.map(root => {
          const path = typeof root === "string" ? root : root.path;
          const label = typeof root === "string" ? this.pathLabel(root) : root.label;

          return <div .si
              key={path}
              state-current={path === selectedRoot && currentPage === "workspace"}
              data-root={path}>
            <i .icon-folder />
            <span .w-full .truncate>{label}</span>
            <button .si-remove data-remove-root={path}><i .icon-x /></button>
          </div>;
        })}
        <div .si .muted #sidebar-add>
          <i .icon-plus />
          <span>Add workspace</span>
        </div>
      </div>

      <div .sidebar-divider />

      {/* Navigation items */}
      <div .col .p-2 .gap-1>
        {navItems.map(item => <a .si
            key={item.id}
            href={"page:" + item.id}
            state-current={currentPage === item.id}>
          <i class={item.icon} />
          <span .w-full>{item.label}</span>
        </a>)}
      </div>
    </aside>;
  }

  pathLabel(path) {
    if (!path) return "";
    const parts = path.split("/");
    return parts[parts.length - 1] || parts[parts.length - 2] || path;
  }

  // ===== Events — fire custom events that bubble to parent =====

  ["on click at .si[data-root]"](evt, el) {
    const root = el.attributes["data-root"];
    if (root) {
      this.post(new Event("sidebar-select-root", { bubbles: true, data: { root } }));
    }
    return true;
  }

  ["on click at #sidebar-add"]() {
    this.post(new Event("sidebar-add-root", { bubbles: true }));
    return true;
  }

  ["on click at button[data-remove-root]"](evt, button) {
    evt.stopPropagation();
    const root = button.attributes["data-remove-root"];
    this.post(new Event("sidebar-remove-root", { bubbles: true, data: { root } }));
    return true;
  }

  ["on click at [href^='page:']"](evt, el) {
    const page = el.attributes["href"].substring(5);
    this.post(new Event("sidebar-navigate", { bubbles: true, data: { page } }));
    return true;
  }
}
