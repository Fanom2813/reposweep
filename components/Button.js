/**
 * Button Component - Linear/Stack Style
 * =====================================
 * Reusable button component with multiple variants and sizes.
 *
 * Usage:
 *   import { Button, ButtonGroup } from "components/Button.js";
 *
 *   <Button variant="primary" size="lg" onclick={handleClick}>
 *     Click Me
 *   </Button>
 *
 *   <ButtonGroup>
 *     <Button>First</Button>
 *     <Button>Second</Button>
 *   </ButtonGroup>
 */

/**
 * Button Component
 */
export class Button extends Element {
  static defaults = {
    variant: "default",
    size: "md",
    disabled: false,
    type: "button"
  };

  constructor(props = {}) {
    super();
    this.props = { ...Button.defaults, ...props };
  }

  render(props = {}) {
    const merged = { ...this.props, ...props };
    const {
      variant,
      size,
      disabled,
      type,
      children,
      onclick,
      class: className
    } = merged;

    const classes = [
      "btn",
      variant !== "default" && `btn-${variant}`,
      size !== "md" && `btn-${size}`,
      className
    ].filter(Boolean).join(" ");

    return (
      <button
        class={classes}
        disabled={disabled}
        type={type}
        onclick={onclick}
        styleset={styles}
      >
        {children}
      </button>
    );
  }
}

/**
 * IconButton - Button with just an icon
 */
export class IconButton extends Element {
  static defaults = {
    variant: "ghost",
    size: "md",
    icon: null,
    label: ""
  };

  constructor(props = {}) {
    super();
    this.props = { ...IconButton.defaults, ...props };
  }

  render(props = {}) {
    const { variant, size, icon, label, onclick } = { ...this.props, ...props };

    const classes = [
      "btn",
      "btn-icon",
      variant !== "default" && `btn-${variant}`,
      size !== "md" && `btn-${size}`
    ].filter(Boolean).join(" ");

    return (
      <button
        class={classes}
        title={label}
        onclick={onclick}
        styleset={styles}
      >
        {icon}
      </button>
    );
  }
}

/**
 * ButtonGroup - Group related buttons together
 */
export class ButtonGroup extends Element {
  render() {
    return (
      <div class="btn-group" styleset={styles}>
        {this.children}
      </div>
    );
  }
}

// Inline styles for Button component
const styles = `
  @set button {
    /* Base Button */
    button {
      appearance: none;
      display: inline-block;
      padding: var(--space-2) var(--space-3);
      border: 1dip solid color(border-default);
      border-radius: var(--radius-md);
      background: color(bg-tertiary);
      color: color(text-primary);
      font-size: var(--text-sm);
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      transition: all var(--transition-fast);
      vertical-align: middle;
      text-align: center;
      white-space: nowrap;
    }

    button:hover {
      background: color(bg-hover);
      border-color: color(border-hover);
    }

    button:active {
      background: color(bg-active);
      transform: translateY(1dip);
    }

    button:focus {
      outline: none;
      box-shadow: 0 0 0 3dip color(accent-glow);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    button:disabled:hover {
      background: color(bg-tertiary);
      border-color: color(border-default);
    }

    /* Variants */
    button.btn-primary {
      background: color(accent);
      border-color: color(accent);
      color: color(text-inverse);
    }

    button.btn-primary:hover {
      background: color(accent-hover);
      border-color: color(accent-hover);
    }

    button.btn-secondary {
      background: color(bg-secondary);
      border-color: color(border-strong);
    }

    button.btn-ghost {
      background: transparent;
      border-color: transparent;
      color: color(text-secondary);
    }

    button.btn-ghost:hover {
      background: color(bg-hover);
      color: color(text-primary);
    }

    button.btn-subtle {
      background: transparent;
      border-color: color(border-default);
      color: color(text-secondary);
    }

    button.btn-subtle:hover {
      background: color(bg-hover);
      color: color(text-primary);
      border-color: color(border-hover);
    }

    button.btn-danger {
      background: transparent;
      border-color: color(error);
      color: color(error);
    }

    button.btn-danger:hover {
      background: color(error-subtle);
    }

    button.btn-link {
      background: transparent;
      border-color: transparent;
      color: color(accent);
      padding: 0;
      height: auto;
    }

    button.btn-link:hover {
      background: transparent;
      text-decoration: underline;
    }

    /* Sizes */
    button.btn-xs {
      padding: var(--space-1) var(--space-2);
      height: 24dip;
      font-size: var(--text-xs);
    }

    button.btn-sm {
      padding: var(--space-1) var(--space-2);
      height: 28dip;
      font-size: var(--text-xs);
    }

    button.btn-lg {
      padding: var(--space-3) var(--space-4);
      height: 40dip;
      font-size: var(--text-md);
    }

    button.btn-xl {
      padding: var(--space-4) var(--space-6);
      height: 48dip;
      font-size: var(--text-lg);
    }

    /* Icon Button */
    button.btn-icon {
      width: 32dip;
      height: 32dip;
      padding: 0;
      vertical-align: middle;
    }

    button.btn-icon.btn-sm {
      width: 28dip;
      height: 28dip;
    }

    button.btn-icon.btn-lg {
      width: 40dip;
      height: 40dip;
    }

    /* Button Group */
    .btn-group {
      display: inline-block;
      flow: horizontal;
      border-spacing: 0;
    }

    .btn-group > button {
      border-radius: 0;
      margin-left: -1dip;
    }

    .btn-group > button:first-child {
      border-radius: var(--radius-md) 0 0 var(--radius-md);
      margin-left: 0;
    }

    .btn-group > button:last-child {
      border-radius: 0 var(--radius-md) var(--radius-md) 0;
    }

    .btn-group > button:focus {
      z-index: 1;
    }
  }
`;
