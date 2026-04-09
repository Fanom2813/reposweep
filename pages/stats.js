/**
 * Stats Page — workspace analytics, Notion-style.
 * Functional component — no wrapper element, fills the panel.
 */

import { EmptyState } from "../ui/empty-state.js";

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

export function StatsPage(props) {
  const stats = props?.stats || {};
  const typeBreakdown = stats.typeBreakdown || [];
  const largestProjects = stats.largestProjects || [];
  const hasData = stats.totalProjectsScanned > 0;

  if (!hasData) {
    return <div .workspace>
      <div .row .middle .gap-3 .px-5 .py-3 .border-b>
        <h3 .text-lg .semibold>Statistics</h3>
      </div>
      <EmptyState
        icon="icon-bar-chart-2"
        title="No data yet"
        message="Scan a workspace to see statistics."
      />
    </div>;
  }

  return <div .workspace>
    <div .row .middle .gap-3 .px-5 .py-3 .border-b>
      <div .col>
        <h3 .text-lg .semibold>Statistics</h3>
        <span .text-xs .fg-2>Workspace analytics and insights</span>
      </div>
    </div>

    <div .stats-body>
      {/* Summary cards */}
      <div .stats-row>
        <div .stat-box>
          <div .stat-value>{formatBytes(stats.currentlyReclaimable || 0)}</div>
          <div .stat-label>Reclaimable</div>
        </div>
        <div .stat-box>
          <div .stat-value>{stats.totalProjectsScanned || 0}</div>
          <div .stat-label>Projects</div>
        </div>
        <div .stat-box>
          <div .stat-value>{formatBytes(stats.totalReclaimed || 0)}</div>
          <div .stat-label>Total Reclaimed</div>
        </div>
        <div .stat-box>
          <div .stat-value>{stats.totalProjectsCleaned || 0}</div>
          <div .stat-label>Cleanups</div>
        </div>
      </div>

      {/* Type breakdown */}
      {typeBreakdown.length > 0 &&
        <div .stats-section>
          <div .section-title>By Project Type</div>
          <div .col .gap-2>
            {typeBreakdown.map(type => <div .row .middle .gap-3 key={type.name}>
              <div .row .middle .gap-2 style="width:100dip;">
                <span .text-sm .semibold>{type.name}</span>
              </div>
              <div .bar-track style="width:*;">
                <div .bar-fill style={`width:${Math.max(type.percentage, 2)}%`} />
              </div>
              <span .text-xs .fg-2 .nowrap style="width:60dip; text-align:right;">{type.count} proj</span>
              <span .text-xs .semibold .nowrap style="width:70dip; text-align:right;">{formatBytes(type.reclaimable)}</span>
            </div>)}
          </div>
        </div>
      }

      {/* Top consumers */}
      {largestProjects.length > 0 &&
        <div .stats-section>
          <div .section-title>Top Space Consumers</div>
          <div .col>
            {largestProjects.map((project, index) => <div .row .middle .gap-3 .py-2 .border-b key={index}>
              <span .fg-3 .text-xs .semibold style="width:20dip;">{index + 1}</span>
              <div .col .w-full style="overflow-x:hidden;">
                <span .text-sm .semibold style="overflow-x:hidden; text-overflow:ellipsis;">{project.name}</span>
                <span .text-xs .fg-3 .font-mono style="overflow-x:hidden; text-overflow:ellipsis;">{project.path}</span>
              </div>
              <span .badge class={project.typeId || project.type.toLowerCase()}>
                {project.devicon ? <img .devicon src={project.devicon} /> : []}
                {project.type}
              </span>
              <span .size-text .nowrap style="width:70dip; text-align:right;">{formatBytes(project.size)}</span>
            </div>)}
          </div>
        </div>
      }
    </div>
  </div>;
}
