/**
 * Section Component - Linear/Stack Style
 * ======================================
 * Reusable section component for page layouts.
 *
 * Usage:
 *   import { Section, SectionHeader, SectionContent } from "components/Section.js";
 *
 *   <Section>
 *     <SectionHeader title="Section Title" action={<button>Action</button>} />
 *     <SectionContent>Content here</SectionContent>
 *   </Section>
 */

/**
 * Section - Container for page sections
 */
export class Section extends Element {
  static defaults = {
    padded: true,
    bordered: false,
    class: ""
  };

  constructor(props = {}) {
    super();
    this.props = { ...Section.defaults, ...props };
  }

  render(props = {}) {
    const { padded, bordered, class: className, children } = { ...this.props, ...props };

    const classes = [
      "section",
      padded && "section-padded",
      bordered && "section-bordered",
      className
    ].filter(Boolean).join(" ");

    return (
      <section class={classes} styleset={styles}>
        {children}
      </section>
    );
  }
}

/**
 * SectionHeader - Header for a section
 */
export class SectionHeader extends Element {
  static defaults = {
    title: "",
    subtitle: "",
    action: null,
    size: "md"
  };

  constructor(props = {}) {
    super();
    this.props = { ...SectionHeader.defaults, ...props };
  }

  render(props = {}) {
    const { title, subtitle, action, size } = { ...this.props, ...props };

    const titleClass = size === "lg" ? "section-title-lg" : "section-title";

    return (
      <header class="section-header">
        <div class="section-titles">
          {title && <h2 class={titleClass}>{title}</h2>}
          {subtitle && <p class="section-subtitle">{subtitle}</p>}
        </div>
        {action && <div class="section-action">{action}</div>}
      </header>
    );
  }
}

/**
 * SectionContent - Content area for a section
 */
export class SectionContent extends Element {
  static defaults = {
    class: ""
  };

  constructor(props = {}) {
    super();
    this.props = { ...SectionContent.defaults, ...props };
  }

  render(props = {}) {
    const { class: className, children } = { ...this.props, ...props };

    return (
      <div class={`section-content ${className}`}>
        {children}
      </div>
    );
  }
}

/**
 * PageSection - Full page section with standard padding
 */
export class PageSection extends Element {
  static defaults = {
    title: "",
    subtitle: "",
    action: null,
    maxWidth: null
  };

  constructor(props = {}) {
    super();
    this.props = { ...PageSection.defaults, ...props };
  }

  render(props = {}) {
    const { title, subtitle, action, maxWidth, children } = { ...this.props, ...props };

    const style = maxWidth ? `max-width: ${maxWidth}; margin: 0 auto;` : "";

    return (
      <section class="page-section" styleset={styles}>
        <div class="page-section-inner" style={style}>
          {(title || subtitle || action) && (
            <SectionHeader title={title} subtitle={subtitle} action={action} />
          )}
          <SectionContent>{children}</SectionContent>
        </div>
      </section>
    );
  }
}

/**
 * HeroSection - Large hero area for landing pages
 */
export class HeroSection extends Element {
  static defaults = {
    eyebrow: "",
    title: "",
    description: "",
    actions: null,
    centered: true
  };

  constructor(props = {}) {
    super();
    this.props = { ...HeroSection.defaults, ...props };
  }

  render(props = {}) {
    const { eyebrow, title, description, actions, centered } = { ...this.props, ...props };

    const classes = [
      "hero-section",
      centered && "hero-centered"
    ].filter(Boolean).join(" ");

    return (
      <section class={classes} styleset={styles}>
        {eyebrow && <div class="hero-eyebrow">{eyebrow}</div>}
        {title && <h1 class="hero-title">{title}</h1>}
        {description && <p class="hero-description">{description}</p>}
        {actions && <div class="hero-actions">{actions}</div>}
      </section>
    );
  }
}

/**
 * FeatureSection - Grid of feature items
 */
export class FeatureSection extends Element {
  static defaults = {
    features: [],
    columns: 3
  };

  constructor(props = {}) {
    super();
    this.props = { ...FeatureSection.defaults, ...props };
  }

  render(props = {}) {
    const { features, columns } = { ...this.props, ...props };

    const gridClass = `feature-grid-${columns}`;

    return (
      <section class="feature-section" styleset={styles}>
        <div class={gridClass}>
          {features.map((feature, index) => (
            <article class="feature-item" key={index}>
              {feature.icon && <div class="feature-icon">{feature.icon}</div>}
              <h3 class="feature-title">{feature.title}</h3>
              <p class="feature-description">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }
}

// Inline styles for Section component
const styles = `
  @set section {
    /* Base Section */
    section.section {
      display: block;
    }

    section.section-padded {
      padding: var(--space-6) 0;
    }

    section.section-bordered {
      border-bottom: 1dip solid color(border-default);
    }

    /* Section Header */
    header.section-header {
      flow: horizontal;
      border-spacing: var(--space-3);
      vertical-align: middle;
      margin-bottom: var(--space-4);
    }

    .section-titles {
      flex: 1;
      flow: vertical;
      border-spacing: var(--space-1);
    }

    .section-title {
      font-size: var(--text-lg);
      font-weight: 600;
      margin: 0;
    }

    .section-title-lg {
      font-size: var(--text-xl);
      font-weight: 600;
      margin: 0;
    }

    .section-subtitle {
      font-size: var(--text-sm);
      color: color(text-secondary);
      margin: 0;
    }

    .section-action {
      margin-left: *;
    }

    /* Section Content */
    .section-content {
      flow: vertical;
      border-spacing: var(--space-4);
    }

    /* Page Section */
    section.page-section {
      padding: var(--space-6);
    }

    .page-section-inner {
      max-width: 720dip;
    }

    /* Hero Section */
    section.hero-section {
      padding: var(--space-12) var(--space-6);
    }

    section.hero-centered {
      text-align: center;
    }

    .hero-eyebrow {
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: color(accent);
      margin-bottom: var(--space-4);
    }

    .hero-title {
      font-size: var(--text-4xl);
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: var(--space-4);
      line-height: 1.1;
    }

    .hero-centered .hero-title {
      max-width: 600dip;
      margin-left: auto;
      margin-right: auto;
    }

    .hero-description {
      font-size: var(--text-lg);
      color: color(text-secondary);
      line-height: 1.6;
      margin-bottom: var(--space-6);
    }

    .hero-centered .hero-description {
      max-width: 560dip;
      margin-left: auto;
      margin-right: auto;
    }

    .hero-actions {
      flow: horizontal;
      border-spacing: var(--space-3);
      vertical-align: middle;
    }

    .hero-centered .hero-actions {
      justify-content: center;
    }

    /* Feature Section */
    section.feature-section {
      padding: var(--space-8) 0;
    }

    .feature-grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-6);
    }

    .feature-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-6);
    }

    .feature-grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-6);
    }

    article.feature-item {
      text-align: center;
      padding: var(--space-4);
    }

    .feature-icon {
      size: 48dip;
      margin: 0 auto var(--space-3);
      background: color(accent-subtle);
      border-radius: var(--radius-lg);
      vertical-align: middle;
    }

    .feature-title {
      font-size: var(--text-sm);
      font-weight: 600;
      margin-bottom: var(--space-1);
    }

    .feature-description {
      font-size: var(--text-sm);
      color: color(text-secondary);
      line-height: 1.5;
      margin: 0;
    }
  }
`;
