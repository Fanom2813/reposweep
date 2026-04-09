/**
 * EmptyState Component - Linear/Stack Style
 * =========================================
 * Reusable empty state component for lists and pages.
 *
 * Usage:
 *   import { EmptyState } from "components/EmptyState.js";
 *
 *   <EmptyState
 *     icon={folderIcon}
 *     title="No projects found"
 *     description="Get started by adding your first project"
 *     action={<button .primary>Add Project</button>}
 *   />
 */

/**
 * EmptyState Component
 */
export class EmptyState extends Element {
  static defaults = {
    icon: null,
    title: "",
    description: "",
    action: null,
    compact: false
  };

  constructor(props = {}) {
    super();
    this.props = { ...EmptyState.defaults, ...props };
  }

  render(props = {}) {
    const { icon, title, description, action, compact } = {
      ...this.props,
      ...props
    };

    const classes = [
      "empty-state",
      compact && "empty-state-compact"
    ].filter(Boolean).join(" ");

    return (
      <div class={classes} styleset={styles}>
        {icon && <div class="empty-state-icon">{icon}</div>}
        {title && <h3 class="empty-state-title">{title}</h3>}
        {description && (
          <p class="empty-state-description">{description}</p>
        )}
        {action && <div class="empty-state-action">{action}</div>}
      </div>
    );
  }
}

/**
 * Loading Component - Spinner for loading states
 */
export class Loading extends Element {
  static defaults = {
    size: "md",
    label: ""
  };

  constructor(props = {}) {
    super();
    this.props = { ...Loading.defaults, ...props };
  }

  render(props = {}) {
    const { size, label } = { ...this.props, ...props };

    const classes = [`loading`, `loading-${size}`];

    return (
      <div class="loading-container" styleset={styles}>
        <div class={classes.join(" ")} />
        {label && <span class="loading-label">{label}</span>}
      </div>
    );
  }
}

/**
 * Skeleton Component - Placeholder loading state
 */
export class Skeleton extends Element {
  static defaults = {
    width: "100%",
    height: "20dip",
    circle: false
  };

  constructor(props = {}) {
    super();
    this.props = { ...Skeleton.defaults, ...props };
  }

  render(props = {}) {
    const { width, height, circle } = { ...this.props, ...props };

    const classes = [`skeleton`, circle && "skeleton-circle"];

    const style = `width: ${width}; height: ${height};`;

    return (
      <div class={classes.join(" ")} style={style} styleset={styles} />
    );
  }
}

// Inline styles for EmptyState component
const styles = `
  @set emptyState {
    /* Empty State */
    div.empty-state {
      padding: var(--space-12) var(--space-8);
      text-align: center;
      color: color(text-secondary);
    }

    div.empty-state-compact {
      padding: var(--space-6);
    }

    .empty-state-icon {
      size: 48dip;
      margin: 0 auto var(--space-4);
      opacity: 0.5;
      vertical-align: middle;
    }

    .empty-state-title {
      margin-bottom: var(--space-2);
      color: color(text-primary);
      font-size: var(--text-lg);
      font-weight: 600;
    }

    .empty-state-description {
      margin-bottom: var(--space-4);
      max-width: 320dip;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.5;
    }

    /* Loading */
    div.loading-container {
      flow: vertical;
      border-spacing: var(--space-3);
      align-items: center;
      text-align: center;
      padding: var(--space-8);
    }

    div.loading {
      display: inline-block;
      size: 20dip;
      border: 2dip solid color(border-default);
      border-top-color: color(accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    div.loading-sm {
      size: 16dip;
      border-width: 1.5dip;
    }

    div.loading-lg {
      size: 32dip;
      border-width: 3dip;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-label {
      font-size: var(--text-sm);
      color: color(text-secondary);
    }

    /* Skeleton */
    div.skeleton {
      display: block;
      background: linear-gradient(
        90deg,
        color(bg-tertiary) 25%,
        color(bg-hover) 50%,
        color(bg-tertiary) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s ease-in-out infinite;
      border-radius: var(--radius-sm);
    }

    div.skeleton-circle {
      border-radius: 50%;
    }

    @keyframes skeleton-loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  }
`;
