/**
 * Card Component - Linear/Stack Style
 * ===================================
 * Reusable card component with multiple variants.
 *
 * Usage:
 *   import { Card, CardHeader, CardBody, CardFooter } from "components/Card.js";
 *
 *   <Card variant="elevated" interactive>
 *     <CardHeader title="Title" subtitle="Subtitle" action={<button>Action</button>} />
 *     <CardBody>Content here</CardBody>
 *     <CardFooter align="right">
 *       <button>Cancel</button>
 *       <button .primary>Save</button>
 *     </CardFooter>
 *   </Card>
 */

/**
 * Card - Container component
 * Extends Element for full Sciter integration
 */
export class Card extends Element {
  static defaults = {
    variant: "default",
    size: "md",
    interactive: false,
    selected: false
  };

  constructor(props = {}) {
    super();
    this.props = { ...Card.defaults, ...props };
  }

  render(props = {}) {
    const merged = { ...this.props, ...props };
    const { variant, size, interactive, selected, children } = merged;

    const classes = [
      "card",
      variant !== "default" && `card-${variant}`,
      size !== "md" && `card-${size}`,
      interactive && "interactive",
      selected && "selected"
    ].filter(Boolean).join(" ");

    return (
      <div class={classes} styleset={styles}>
        {children}
      </div>
    );
  }
}

/**
 * CardHeader - Header section with title and optional action
 */
export class CardHeader extends Element {
  constructor(props = {}) {
    super();
    this.props = props;
  }

  render(props = {}) {
    const { title, subtitle, action, icon } = { ...this.props, ...props };

    return (
      <header class="card-header">
        {icon && <span class="card-icon">{icon}</span>}
        <div class="card-titles">
          {title && <h3 class="card-title">{title}</h3>}
          {subtitle && <span class="card-subtitle">{subtitle}</span>}
        </div>
        {action && <span class="card-action">{action}</span>}
      </header>
    );
  }
}

/**
 * CardBody - Main content area
 */
export class CardBody extends Element {
  render() {
    return <div class="card-body">{this.children}</div>;
  }
}

/**
 * CardFooter - Footer section
 */
export class CardFooter extends Element {
  static defaults = { align: "left" };

  constructor(props = {}) {
    super();
    this.props = { ...CardFooter.defaults, ...props };
  }

  render(props = {}) {
    const { align } = { ...this.props, ...props };
    const alignClass = align !== "left" ? `justify-${align}` : "";

    return (
      <footer class={`card-footer ${alignClass}`}>
        {this.children}
      </footer>
    );
  }
}

/**
 * StatCard - Specialized card for displaying statistics
 */
export class StatCard extends Element {
  constructor(props = {}) {
    super();
    this.props = props;
  }

  render(props = {}) {
    const {
      label,
      value,
      change,
      changeType = "neutral",
      icon
    } = { ...this.props, ...props };

    return (
      <Card variant="subtle">
        <div class="stat-card-content">
          {icon && <div class="stat-icon">{icon}</div>}
          <div class="stat-value">{value}</div>
          <div class="stat-label">{label}</div>
          {change && (
            <span class={`stat-change ${changeType}`}>{change}</span>
          )}
        </div>
      </Card>
    );
  }
}

/**
 * ListCard - Card optimized for list items
 */
export class ListCard extends Element {
  static defaults = {
    items: [],
    emptyText: "No items",
    renderItem: null
  };

  constructor(props = {}) {
    super();
    this.props = { ...ListCard.defaults, ...props };
  }

  render(props = {}) {
    const { items, emptyText, renderItem } = { ...this.props, ...props };

    return (
      <Card variant="ghost" class="list-card">
        {items.length === 0 ? (
          <div class="list-card-empty">{emptyText}</div>
        ) : (
          <div class="list-card-items">
            {items.map((item, index) => (
              <div class="list-card-item" key={index}>
                {renderItem ? renderItem(item, index) : item}
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }
}

// Inline styles for Card component
const styles = `
  @set card {
    :root {
      display: block;
      padding: var(--space-4);
      background: color(bg-secondary);
      border: 1dip solid color(border-default);
      border-radius: var(--radius-lg);
      transition: all var(--transition-fast);
    }

    :root:hover {
      border-color: color(border-strong);
    }

    :root.interactive {
      cursor: pointer;
    }

    :root.interactive:hover {
      background: color(bg-tertiary);
      border-color: color(border-hover);
    }

    :root.selected {
      background: color(bg-selected);
      border-color: color(accent);
    }

    /* Variants */
    :root.card-elevated {
      background: color(bg-elevated);
      box-shadow: var(--shadow-sm);
      border-color: transparent;
    }

    :root.card-elevated:hover {
      box-shadow: var(--shadow-md);
    }

    :root.card-ghost {
      background: transparent;
      border-color: color(border-default);
    }

    :root.card-subtle {
      background: color(bg-tertiary);
      border: none;
    }

    /* Sizes */
    :root.card-sm {
      padding: var(--space-3);
    }

    :root.card-lg {
      padding: var(--space-6);
    }

    /* Header */
    header {
      flow: horizontal;
      border-spacing: var(--space-3);
      vertical-align: middle;
      margin-bottom: var(--space-3);
      padding-bottom: var(--space-3);
      border-bottom: 1dip solid color(border-default);
    }

    header:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }

    .card-icon {
      size: 24dip;
      vertical-align: middle;
    }

    .card-titles {
      flex: 1;
      flow: vertical;
      border-spacing: 0;
    }

    .card-title {
      font-size: var(--text-md);
      font-weight: 600;
      margin: 0;
    }

    .card-subtitle {
      font-size: var(--text-sm);
      color: color(text-secondary);
    }

    .card-action {
      margin-left: *;
    }

    /* Body */
    .card-body {
      flow: vertical;
      border-spacing: var(--space-3);
    }

    /* Footer */
    footer {
      flow: horizontal;
      border-spacing: var(--space-2);
      vertical-align: middle;
      margin-top: var(--space-3);
      padding-top: var(--space-3);
      border-top: 1dip solid color(border-default);
    }

    footer.justify-center {
      content-horizontal-align: center;
    }

    footer.justify-right {
      content-horizontal-align: right;
    }

    /* Stat Card */
    .stat-card-content {
      text-align: center;
      padding: var(--space-2);
    }

    .stat-icon {
      size: 40dip;
      margin: 0 auto var(--space-3);
      background: color(accent-subtle);
      border-radius: var(--radius-lg);
      vertical-align: middle;
    }

    .stat-value {
      font-size: var(--text-2xl);
      font-weight: 700;
      color: color(accent);
      margin-bottom: var(--space-1);
    }

    .stat-label {
      font-size: var(--text-sm);
      color: color(text-secondary);
    }

    .stat-change {
      display: inline-block;
      margin-top: var(--space-1);
      font-size: var(--text-xs);
      font-weight: 600;
      padding: var(--space-0\.5) var(--space-2);
      border-radius: var(--radius-full);
    }

    .stat-change.positive {
      background: color(success-subtle);
      color: color(success);
    }

    .stat-change.negative {
      background: color(error-subtle);
      color: color(error);
    }

    .stat-change.neutral {
      background: color(bg-tertiary);
      color: color(text-tertiary);
    }

    /* List Card */
    .list-card-empty {
      padding: var(--space-8);
      text-align: center;
      color: color(text-secondary);
    }

    .list-card-items {
      flow: vertical;
      border-spacing: var(--space-1);
    }

    .list-card-item {
      padding: var(--space-2);
      border-radius: var(--radius-md);
      transition: background var(--transition-fast);
    }

    .list-card-item:hover {
      background: color(bg-hover);
    }
  }
`;
