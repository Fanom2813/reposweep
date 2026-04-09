/**
 * Repo Sweep Router
 *
 * Central routing configuration using Sciter Reactor pattern.
 * Based on samples.reactor/routing/main.htm from Sciter SDK.
 */

// Route registry - populated by registerRoutes()
const routeRegistry = {};

// Current router instance (set by Router component)
let currentRouter = null;

/* ============================================
   THEME MANAGEMENT
   ============================================ */

const THEME_KEY = "reposweep-theme";

/**
 * Get the current theme
 * @returns {string} "light", "dark", or "system"
 */
export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "system";
  } catch {
    return "system";
  }
}

/**
 * Set the application theme
 * @param {string} theme - "light", "dark", or "system"
 */
export function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage errors
  }

  const html = document.documentElement;

  if (theme === "system") {
    html.removeAttribute("data-theme");
  } else {
    html.setAttribute("data-theme", theme);
  }
}

/**
 * Toggle between light and dark mode
 */
export function toggleTheme() {
  const current = getTheme();
  const prefersDark = window.matchMedia?.("(ui-ambience: dark)").matches;

  let next;
  if (current === "system") {
    next = prefersDark ? "light" : "dark";
  } else {
    next = current === "dark" ? "light" : "dark";
  }

  setTheme(next);
  return next;
}

/**
 * Initialize theme on app startup
 */
export function initTheme() {
  // Sciter doesn't have localStorage, skip theme init for now
  // Theme defaults to system preference via CSS media query
}

/**
 * Register routes from a route map object
 * @param {Object} routes - Map of routeName -> JSX component
 * @example
 *   registerRoutes({
 *     "landing": <LandingPage />,
 *     "workspace": <WorkspacePage />
 *   });
 */
export function registerRoutes(routes) {
  Object.assign(routeRegistry, routes);
}

/**
 * Navigate to a route programmatically from anywhere in the app
 * @param {string} routeName - Name of the route to navigate to
 * @param {Object} params - Optional parameters to pass to the route
 * @returns {boolean} - True if navigation succeeded
 * @example
 *   navigateTo("workspace", { root: "/home/user/projects" });
 */
export function navigateTo(routeName, params = null) {
  if (!currentRouter) {
    console.error("Router not initialized. Cannot navigate to:", routeName);
    return false;
  }
  return currentRouter.navigateTo(routeName, params);
}

/**
 * Get current route information
 * @returns {Object} - { routeName, routeParams }
 */
export function getCurrentRoute() {
  if (!currentRouter) {
    return { routeName: null, routeParams: null };
  }
  return {
    routeName: currentRouter.routeName,
    routeParams: currentRouter.routeParams,
  };
}

/**
 * Check if a route exists
 * @param {string} routeName
 * @returns {boolean}
 */
export function hasRoute(routeName) {
  return routeName in routeRegistry;
}

/**
 * Get list of all registered route names
 * @returns {string[]}
 */
export function getRouteNames() {
  return Object.keys(routeRegistry);
}

/**
 * Router Component
 *
 * Main routing component that manages route state and renders the current view.
 * Use this as the root component in your app.
 *
 * @example
 *   import { Router, registerRoutes } from "routes.js";
 *   import { LandingPage } from "pages/landing.js";
 *
 *   registerRoutes({
 *     "landing": <LandingPage />,
 *   });
 *
 *   document.body.patch(<Router initialRoute="landing" />);
 */
export class Router extends Element {
  routeName = "";
  routeView = null;
  routeParams = null;

  constructor(props = {}) {
    super();
    this.routeName = props.initialRoute || "landing";
    this.routeView = routeRegistry[this.routeName];
    this.routeParams = props.initialParams || null;

    if (!this.routeView) {
      console.error(`Route "${this.routeName}" not found in registry`);
      this.routeView = <div>Route not found: {this.routeName}</div>;
    }
  }

  componentDidMount() {
    // Register this router instance globally for navigateTo() calls
    currentRouter = this;
  }

  componentWillUnmount() {
    if (currentRouter === this) {
      currentRouter = null;
    }
  }

  /**
   * Navigate to a route
   * @param {string} routeName
   * @param {Object} params
   * @returns {boolean}
   */
  navigateTo(routeName, params = null) {
    const routeView = routeRegistry[routeName];
    if (!routeView) {
      console.error(`Route "${routeName}" not found`);
      return false;
    }

    this.componentUpdate({
      routeView: routeView,
      routeName: routeName,
      routeParams: params,
    });
    return true;
  }

  render() {
    return <section .router>{this.routeView}</section>;
  }

  // Handle <a href="route:name"> clicks
  ["on click at [href^='route:']"](event, hyperlink) {
    const href = hyperlink.attributes["href"];
    const routeName = href.substring(6); // Remove "route:" prefix

    // Parse optional params from href like "route:workspace?root=/path"
    const [name, paramString] = routeName.split("?");
    let params = null;
    if (paramString) {
      params = Object.fromEntries(new URLSearchParams(paramString));
    }

    return this.navigateTo(name, params);
  }

  // Handle custom navigateto events (for programmatic navigation from child components)
  ["on navigateto"](event) {
    const { route, params } = event.data;
    return this.navigateTo(route, params);
  }
}

/**
 * Link Component
 *
 * Convenience component for route links.
 *
 * @example
 *   <Link route="workspace" params={{ root: "/path" }}>Go to Workspace</Link>
 *   <Link route="settings" class="button">Settings</Link>
 */
export function Link(props, kids) {
  const { route, params, class: className, ...rest } = props;

  let href = `route:${route}`;
  if (params) {
    const paramString = new URLSearchParams(params).toString();
    href += `?${paramString}`;
  }

  return (
    <a href={href} class={className} {...rest}>
      {kids}
    </a>
  );
}

/**
 * Route Guard
 *
 * Wrapper component that can prevent navigation or show confirmation.
 *
 * @example
 *   <RouteGuard
 *     canLeave={() => !hasUnsavedChanges}
 *     onLeave={() => confirm("Leave without saving?")}
 *   >
 *     <WorkspacePage />
 *   </RouteGuard>
 */
export class RouteGuard extends Element {
  render() {
    return <section .route-guard>{this.children}</section>;
  }
}

/**
 * Navigation Menu Component
 *
 * Renders a navigation menu with active state highlighting.
 */
export function NavigationMenu(props) {
  const { items, class: className } = props;

  // Get current route for active state
  const currentRoute = getCurrentRoute().routeName;

  return (
    <nav .navigation-menu class={className}>
      {items.map((item) => (
        <a
          href={`route:${item.route}`}
          class={item.route === currentRoute ? "active" : ""}
          key={item.route}
        >
          {item.icon && <icon class={item.icon} />}
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

/**
 * Back Button Component
 *
 * Navigates back to a specific route.
 */
export function BackButton(props) {
  const { to, label = "Back" } = props;

  return (
    <button .ghost .sm onclick={() => navigateTo(to)}>
      ← {label}
    </button>
  );
}

/**
 * Breadcrumb Component
 *
 * Shows navigation path like: Home > Workspace > Settings
 */
export function Breadcrumb(props) {
  const { items } = props;

  return (
    <nav .breadcrumb>
      {items.map((item, index) => (
        <span key={index}>
          {index > 0 && <span .separator>/</span>}
          {item.route ? (
            <a href={`route:${item.route}`}>{item.label}</a>
          ) : (
            <span .current>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
