/**
 * Workspace views — project list, empty state, toolbar.
 */

import { formatBytes } from "../lib/scanner.js";

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
    <div .h-full>
      <div .col .gap-2 .m-auto .text-center>
        <i .icon-search .mx-auto style="font-size:28dip; size:28dip; line-height:28dip; color:color(fg-3);" />
        <h3 .text-lg .medium>{hasProjects ? "No matches" : "No projects scanned yet"}</h3>
        <p .fg-2 .text-sm>Click Scan to discover projects in this workspace.</p>
      </div>
    </div>
  </div>;
}

/**
 * Workspace view — toolbar + scrollable project list.
 */
export function WorkspaceView(props) {
  const { state, projects, projectTypes } = props;
  const totalReclaimable = projects.reduce((sum, p) => sum + (p.reclaimableBytes || 0), 0);
  const rootName = rootLabel(state.selectedRoot);

  return <div .workspace>
    <div .row .gap-3 .px-5 .py-3 .border-b>
      <h3 .text-lg .semibold .nowrap>{rootName}</h3>
      <span .text-xs .fg-3 .nowrap>{projects.length} projects · {formatBytes(totalReclaimable)} reclaimable</span>
      <div .spacer />
      <input|text .search .sm searchBox value={state.search} novalue="Search..." style="width:180dip;" />
      <select|list .sm filterSelect value={state.filter} style="width:100dip;">
        <option value="All">All</option>
        {(projectTypes || []).map(t => <option value={t.name} key={t.id}>{t.name}</option>)}
      </select>
      <button .ghost .sm #rescan disabled={state.scanning} title="Rescan"><i .icon-refresh-cw /></button>
    </div>
    <div .project-list>
      {projects.map(project => <div .project-row .row .gap-3 .px-5 .py-2 .border-b key={project.id}>
        <div .col .gap-1 .w-full style="min-width:200dip;">
          <span .text-sm .medium>{project.name}</span>
          <span .font-mono .text-xs .fg-3 .truncate>{project.path}</span>
        </div>
        <div .row .gap-2>
          <span .badge class={project.type.toLowerCase()}>{project.type}</span>
          <span .fg-3 .text-xs>{timeAgo(project.modifiedAt)}</span>
        </div>
        <span .font-mono .text-sm .semibold .fg-grn .nowrap style="width:90dip; text-align:right;">
          {formatBytes(project.reclaimableBytes)}
        </span>
        <div .actions .row .gap-1>
          <button .primary .sm data-id={project.id} disabled={!project.cleanupTargets?.length}>Clean</button>
          <button .ghost .sm data-open={project.path} title="Open"><i .icon-external-link /></button>
        </div>
      </div>)}
    </div>
  </div>;
}
