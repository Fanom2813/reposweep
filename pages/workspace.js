/**
 * Workspace Page - project list
 */

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
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export class WorkspacePage extends Element {
  render(props) {
    const state = props?.state || {};
    const projects = props?.projects || [];
    const totalReclaimable = projects.reduce((s, p) => s + (p.reclaimableBytes || 0), 0);
    const rootName = state.selectedRoot ? state.selectedRoot.split("/").pop() || state.selectedRoot : "Workspace";

    return <div .workspace>
      <div .workspace-header>
        <div .workspace-header-top>
          <h1>{rootName}</h1>
          <button .ghost .sm #change-root>Change</button>
          <button .primary .sm #rescan disabled={!state.selectedRoot || state.scanning}>
            {state.scanning ? "Scanning..." : "Rescan"}
          </button>
        </div>
        <div .workspace-meta>
          <span .meta-item>
            <span .meta-label>Path</span>
            <span .meta-value .mono>{state.selectedRoot || "None"}</span>
          </span>
          <span .meta-item>
            <span .meta-label>Projects</span>
            <span .meta-value>{projects.length}</span>
          </span>
          <span .meta-item>
            <span .meta-label>Reclaimable</span>
            <span .meta-value .text-accent>{formatBytes(totalReclaimable)}</span>
          </span>
        </div>
      </div>

      <div .filter-bar>
        <input|text .search searchBox value={state.search} novalue="Search projects..." />
        <select|list .sm filterSelect value={state.filter}>
          <option value="All">All Types</option>
          <option value="Node">Node</option>
          <option value="Flutter">Flutter</option>
          <option value="Rust">Rust</option>
          <option value="Python">Python</option>
          <option value="Git">Git</option>
          <option value="Unknown">Unknown</option>
        </select>
      </div>

      <div .project-list>
        {projects.length > 0
          ? projects.map(project => <div .project-item key={project.id}>
              <div .project-info>
                <div .project-name>{project.name}</div>
                <div .project-path>{project.path}</div>
                <div .project-meta>
                  <span .badge class={project.type.toLowerCase()}>{project.type}</span>
                  <span .text-tertiary .text-xs>{timeAgo(project.modifiedAt)}</span>
                  {project.cleanupTargets?.length > 0
                    ? <span .text-tertiary .text-xs>{project.cleanupTargets.length} targets</span>
                    : []}
                </div>
              </div>
              <div .project-size>{formatBytes(project.reclaimableBytes)}</div>
              <div .project-actions>
                <button .primary .sm data-id={project.id} disabled={!project.cleanupTargets?.length}>Clean</button>
                <button .ghost .sm data-open={project.path}>Open</button>
              </div>
            </div>)
          : <div .workspace-empty>
              <h2>No projects found</h2>
              <p>{state.search ? "Try adjusting your search or filters." : "Scan a workspace to discover your projects."}</p>
            </div>
        }
      </div>
    </div>;
  }
}
