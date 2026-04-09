/**
 * Project Detail Page
 */

import * as env from "@env";

function formatBytes(value) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit < 2 ? 0 : 1)} ${units[unit]}`;
}

function timeAgo(timestamp) {
  if (!timestamp) return "Unknown";
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export class ProjectDetailPage extends Element {
  selectedTargets = new Set();

  render(props) {
    const project = props?.project;

    if (!project) {
      return <div .page-scroll>
        <div .empty-state>
          <h3>Project not found</h3>
          <p>The requested project could not be loaded.</p>
          <a .button .primary href="route:workspace">Back to Workspace</a>
        </div>
      </div>;
    }

    const totalReclaimable = project.cleanupTargets.reduce((sum, t) => sum + (t.bytes || 0), 0);
    const selectedBytes = project.cleanupTargets
      .filter(t => this.selectedTargets.has(t.name))
      .reduce((sum, t) => sum + (t.bytes || 0), 0);

    return <div .page-scroll>
      <div .page-narrow>
        <div .detail-header>
          <a .back-link href="route:workspace">Back to workspace</a>
          <h1>{project.name}</h1>
          <div .detail-path>{project.path}</div>
        </div>

        <div .detail-grid>
          <div .detail-cell>
            <div .cell-label>Type</div>
            <div .cell-value><span .badge class={project.type.toLowerCase()}>{project.type}</span></div>
          </div>
          <div .detail-cell>
            <div .cell-label>Modified</div>
            <div .cell-value>{timeAgo(project.modifiedAt)}</div>
          </div>
          <div .detail-cell>
            <div .cell-label>Targets</div>
            <div .cell-value>{project.cleanupTargets.length}</div>
          </div>
          <div .detail-cell>
            <div .cell-label>Reclaimable</div>
            <div .cell-value .text-accent>{formatBytes(totalReclaimable)}</div>
          </div>
        </div>

        <section .mb-6>
          <h2 .section-title>Cleanup Targets</h2>
          <p .text-secondary .text-sm .mb-3>Select specific targets to clean.</p>
          {project.cleanupTargets.length > 0
            ? <div>
                <div .targets-list>
                  {project.cleanupTargets.map(target => <div .target-row key={target.name}>
                    <input type="checkbox"
                      checked={this.selectedTargets.has(target.name)}
                      data-target={target.name} />
                    <span .target-name>{target.name}</span>
                    <span .target-size>{formatBytes(target.bytes)}</span>
                  </div>)}
                </div>
                <div .target-actions>
                  <button .ghost .xs onclick={() => this.selectAll(project)}>Select All</button>
                  <button .ghost .xs onclick={() => this.deselectAll()}>Deselect All</button>
                </div>
              </div>
            : <p .text-tertiary>No cleanup targets found.</p>
          }
        </section>

        {this.selectedTargets.size > 0 ? <div .selection-summary>
          <strong>{this.selectedTargets.size}</strong> targets selected,
          <strong .text-accent> {formatBytes(selectedBytes)}</strong> will be reclaimed
        </div> : []}

        <footer .detail-footer>
          <button .ghost data-open={project.path}>Open Folder</button>
          <div .spacer />
          <a .button .ghost href="route:workspace">Cancel</a>
          <button .primary disabled={this.selectedTargets.size === 0}>
            Clean {this.selectedTargets.size > 0 ? formatBytes(selectedBytes) : ""}
          </button>
        </footer>
      </div>
    </div>;
  }

  selectAll(project) {
    this.selectedTargets = new Set(project.cleanupTargets.map(t => t.name));
    this.componentUpdate();
  }

  deselectAll() {
    this.selectedTargets = new Set();
    this.componentUpdate();
  }

  ["on change at input[type='checkbox']"](evt, checkbox) {
    const targetName = checkbox.attributes["data-target"];
    const newSet = new Set(this.selectedTargets);
    if (checkbox.checked) {
      newSet.add(targetName);
    } else {
      newSet.delete(targetName);
    }
    this.componentUpdate({ selectedTargets: newSet });
    return true;
  }
}
