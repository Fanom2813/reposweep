/**
 * Badge & Tag Components - Linear/Stack Style
 * ===========================================
 * Reusable badge and tag components.
 *
 * Usage:
 *   import { Badge, Tag, TagGroup } from "components/Badge.js";
 *
 *   <Badge variant="accent">New</Badge>
 *   <Tag removable onRemove={handleRemove}>Tag Name</Tag>
 */

/**
 * Badge Component
 */
export class Badge extends Element {
  static defaults = {
    variant: "default",
    size: "md"
  };

  constructor(props = {}) {
    super();
    this.props = { ...Badge.defaults, ...props };
  }

  render(props = {}) {
    const { variant, size, children } = { ...this.props, ...props };

    const classes = [
      "badge",
      variant !== "default" && `badge-${variant}`,
      size !== "md" && `badge-${size}`
    ].filter(Boolean).join(" ");

    return (
      <span class={classes} styleset={styles}>
        {children}
      </span>
    );
  }
}

/**
 * Tag Component
 */
export class Tag extends Element {
  static defaults = {
    removable: false,
    onRemove: null
  };

  constructor(props = {}) {
    super();
    this.props = { ...Tag.defaults, ...props };
  }

  render(props = {}) {
    const { removable, onRemove, children } = { ...this.props, ...props };

    return (
      <span class="tag" styleset={styles}>
        <span class="tag-text">{children}</span>
        {removable && (
          <span class="tag-remove" onclick={onRemove}>×</span>
        )}
      </span>
    );
  }
}

/**
 * TagGroup - Container for multiple tags
 */
export class TagGroup extends Element {
  render() {
    return (
      <span class="tag-group" styleset={styles}>
        {this.children}
      </span>
    );
  }
}

// Inline styles for Badge component
const styles = `
  @set badge {
    /* Base Badge */
    span.badge {
      display: inline-block;
      padding: var(--space-0\.5) var(--space-2);
      border-radius: var(--radius-full);
      background: color(bg-tertiary);
      color: color(text-secondary);
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      line-height: 1.2;
    }

    /* Variants */
    span.badge-accent {
      background: color(accent-subtle);
      color: color(accent);
    }

    span.badge-success {
      background: color(success-subtle);
      color: color(success);
    }

    span.badge-warning {
      background: color(warning-subtle);
      color: color(warning);
    }

    span.badge-error {
      background: color(error-subtle);
      color: color(error);
    }

    span.badge-info {
      background: color(info-subtle);
      color: color(info);
    }

    span.badge-primary {
      background: color(text-primary);
      color: color(bg-primary);
    }

    /* Sizes */
    span.badge-sm {
      padding: 1dip var(--space-1\.5);
      font-size: 10dip;
    }

    span.badge-lg {
      padding: var(--space-1) var(--space-3);
      font-size: var(--text-sm);
    }

    /* Tag */
    span.tag {
      display: inline-block;
      flow: horizontal;
      border-spacing: var(--space-1);
      vertical-align: middle;
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-md);
      background: color(bg-tertiary);
      border: 1dip solid color(border-default);
      font-size: var(--text-xs);
      color: color(text-secondary);
      line-height: 1.2;
    }

    .tag-text {
      vertical-align: middle;
    }

    .tag-remove {
      cursor: pointer;
      opacity: 0.5;
      padding: 0 var(--space-1);
      margin-right: calc(-1 * var(--space-1));
      transition: opacity var(--transition-fast);
    }

    .tag-remove:hover {
      opacity: 1;
    }

    /* Tag Group */
    span.tag-group {
      display: inline-block;
      flow: horizontal;
      border-spacing: var(--space-2);
      vertical-align: middle;
    }
  }
`;
