/**
 * Workspace views — project table, empty state, toolbar, busy state.
 * Pure functional components — all data comes via props from the parent.
 */

import { formatBytes } from "../lib/store.js";
import { EmptyState } from "../ui/empty-state.js";

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function rootLabel(path) {
  if (!path) return "";
  const parts = path.split("/");
  return parts[parts.length - 1] || parts[parts.length - 2] || path;
}

/**
 * Scanning indicator — indeterminate progress bar.
 */
function ScanBar() {
  return <div .scan-bar>
    <div .scan-bar-track>
      <div .scan-bar-fill />
    </div>
  </div>;
}

/**
 * Empty workspace — root selected but no projects scanned yet.
 */
export function WorkspaceEmpty(props) {
  const { rootName, hasProjects } = props;
  return <div .workspace>
    <div .row .gap-3 .px-5 .py-3 .border-b>
      <h3 .text-lg .semibold .nowrap>{rootName}</h3>
      <div .spacer />
      <button .primary .sm #rescan><i .icon-refresh-cw /> Scan</button>
    </div>
    <EmptyState
      icon="icon-search"
      title={hasProjects ? "No matches" : "No projects scanned yet"}
      message="Click Scan to discover projects in this workspace."
    />
  </div>;
}

/**
 * Workspace view — toolbar + scrollable project table.
 * All data passed via props — no signal reads here.
 */
export function WorkspaceView(props) {
  const { projects, projectTypes, scanning, searchValue, filterValue, selectedRoot } = props;
  const totalReclaimable = projects.reduce((sum, p) => sum + (p.reclaimableBytes || 0), 0);
  const rootName = rootLabel(selectedRoot);

  return <div .workspace>
    <div .row .middle .gap-3 .px-5 .py-3 .border-b>
      <div .col .middle>
        <h3 .text-lg .semibold .nowrap>{rootName}</h3>
        {!scanning &&
          <span .text-xs .fg-2 .nowrap>{projects.length} projects · {formatBytes(totalReclaimable)} reclaimable</span>
        }
      </div>
      <div .spacer />
      <input|text(searchBox) .search .sm .middle value={searchValue} novalue="Search..." style="width:180dip;" />
      <select|dropdown(filterSelect) .sm .middle value={filterValue} style="width:100dip;">
        <option value="All">All</option>
        {(projectTypes || []).map(t => <option value={t.name} key={t.id}>{t.name}</option>)}
      </select>
      <button .ghost .sm .middle #rescan disabled={scanning} title="Rescan">
        <i .icon-refresh-cw class={scanning ? "spinning" : ""} />
      </button>
    </div>
    {scanning ? <ScanBar /> : []}
    <table .table class={scanning ? "busy" : ""}>
      <thead>
        <tr>
          <th .col-name>Project</th>
          <th .col-type>Type</th>
          <th .col-modified>Modified</th>
          <th .col-size>Size</th>
          <th .col-actions></th>
        </tr>
      </thead>
      <tbody>
        {projects.map(project => <tr key={project.id} class={project.isStale ? "stale" : ""}>
          <td .col-name>
            <div .cell-name>
              <span .name-text>{project.name}</span>
              <span .path-text>{project.path}</span>
            </div>
          </td>
          <td .col-type>
            <span .badge class={project.typeId || project.type.toLowerCase()}>
              {project.devicon ? <img .devicon src={project.devicon} /> : []}
              {project.type}
            </span>
          </td>
          <td .col-modified>
            <span .modified-text>{timeAgo(project.modifiedAt)}</span>
          </td>
          <td .col-size>
            <span .size-text>
              {project.sizing === "pending" ? "..." : formatBytes(project.reclaimableBytes)}
            </span>
          </td>
          <td .col-actions>
            <div .actions>
              <button .primary .xs data-id={project.id}
                disabled={scanning || !project.cleanupTargets?.length}>Clean</button>
              <button .ghost .xs data-open={project.path} title="Open"><i .icon-external-link /></button>
            </div>
          </td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
