/**
 * Alert Component - Linear/Stack Style
 * ====================================
 * Reusable alert/banner components.
 *
 * Usage:
 *   import { Alert, Banner } from "components/Alert.js";
 *
 *   <Alert variant="success" title="Success!">
 *     Operation completed successfully.
 *   </Alert>
 */

/**
 * Alert Component
 */
export class Alert extends Element {
  static defaults = {
    variant: "info",
    title: "",
    dismissible: false,
    onDismiss: null
  };

  constructor(props = {}) {
    super();
    this.props = { ...Alert.defaults, ...props };
    this.state = { dismissed: false };
  }

  render(props = {}) {
    if (this.state.dismissed) {
      return <div style="display:none" />;
    }

    const { variant, title, dismissible, onDismiss, children } = {
      ...this.props,
      ...props
    };

    const classes = [`alert`, `alert-${variant}`];

    return (
      <div class={classes.join(" ")} styleset={styles}>
        <div class="alert-content">
          {title && <strong class="alert-title">{title}</strong>}
          <div class="alert-message">{children}</div>
        </div>
        {dismissible && (
          <button
            class="alert-dismiss"
            onclick={() => {
              this.state.dismissed = true;
              this.componentUpdate();
              onDismiss && onDismiss();
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  }
}

/**
 * Banner Component - Inline alert at top of section
 */
export class Banner extends Element {
  static defaults = {
    variant: "info",
    action: null
  };

  constructor(props = {}) {
    super();
    this.props = { ...Banner.defaults, ...props };
  }

  render(props = {}) {
    const { variant, action, children } = { ...this.props, ...props };

    const classes = [`banner`, `banner-${variant}`];

    return (
      <div class={classes.join(" ")} styleset={styles}>
        <div class="banner-content">{children}</div>
        {action && <div class="banner-action">{action}</div>}
      </div>
    );
  }
}

// Inline styles for Alert component
const styles = `
  @set alert {
    /* Base Alert */
    div.alert {
      display: block;
      flow: horizontal;
      border-spacing: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      border: 1dip solid;
      vertical-align: middle;
    }

    .alert-content {
      flex: 1;
      flow: vertical;
      border-spacing: var(--space-1);
    }

    .alert-title {
      font-weight: 600;
      font-size: var(--text-sm);
    }

    .alert-message {
      font-size: var(--text-sm);
    }

    .alert-dismiss {
      appearance: none;
      background: transparent;
      border: none;
      font-size: var(--text-lg);
      color: currentColor;
      opacity: 0.5;
      cursor: pointer;
      padding: 0 var(--space-1);
    }

    .alert-dismiss:hover {
      opacity: 1;
    }

    /* Variants */
    div.alert-info {
      background: color(info-subtle);
      border-color: color(info);
      color: color(info);
    }

    div.alert-success {
      background: color(success-subtle);
      border-color: color(success);
      color: color(success);
    }

    div.alert-warning {
      background: color(warning-subtle);
      border-color: color(warning);
      color: color(warning);
    }

    div.alert-error {
      background: color(error-subtle);
      border-color: color(error);
      color: color(error);
    }

    /* Banner */
    div.banner {
      display: block;
      flow: horizontal;
      border-spacing: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: color(bg-secondary);
      border-bottom: 1dip solid color(border-default);
      vertical-align: middle;
    }

    .banner-content {
      flex: 1;
      font-size: var(--text-sm);
    }

    .banner-action {
      margin-left: *;
    }
  }
`;
