/**
 * Home Page - Notion-inspired onboarding
 */

export class HomePage extends Element {
  render(props) {
    const state = props?.state || {};
    const roots = state.roots || [];
    const selectedRoot = state.selectedRoot || "";

    return <div .landing>
      <div .landing-content>
        <div .landing-hero>
          <img .hero-icon src="icon.svg" />
          <h1>Clean your workspace</h1>
          <p .hero-text>
            Scan your project folders, find build caches and dependencies,
            and reclaim disk space in seconds.
          </p>
        </div>

        <div .setup-card>
          <header>
            <h2>Get started</h2>
            <p .text-secondary>Select a folder that contains your projects, or let RepoSweep find them.</p>
          </header>

          <div .setup-actions>
            <button .primary .lg #auto-detect>Find projects</button>
            <button .lg #select-path>Select folder...</button>
          </div>

          {roots.length > 0 ? <div .root-list>
            {roots.map(root => <div .root-item key={root} state-selected={root === selectedRoot}>
              <input|radio(rootChoice) value={root} checked={root === selectedRoot} />
              <div .root-info>
                <div .root-name>{root.split("/").pop() || root}</div>
                <div .root-path>{root}</div>
              </div>
              <div .root-actions>
                <button .ghost .xs .inline-remove data-path={root}>x</button>
              </div>
            </div>)}
            <div .root-list-actions>
              <button .primary #start disabled={!selectedRoot}>Scan workspace</button>
            </div>
          </div> : []}
        </div>

        <div .feature-grid>
          <div .feature-item>
            <h3>Safe by default</h3>
            <p>Only caches and build artifacts. Source code is never touched.</p>
          </div>
          <div .feature-item>
            <h3>Stack aware</h3>
            <p>Detects Node, Rust, Flutter, Python, and Git projects.</p>
          </div>
          <div .feature-item>
            <h3>Space recovery</h3>
            <p>Projects sorted by size so you clean the biggest wins first.</p>
          </div>
        </div>
      </div>
    </div>;
  }
}
