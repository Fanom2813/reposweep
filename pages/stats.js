/**
 * Stats Page
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

export class StatsPage extends Element {
  render(props) {
    const stats = props?.stats || {};
    const typeBreakdown = stats.typeBreakdown || [];
    const monthlyReclaim = stats.monthlyReclaim || [];
    const largestProjects = stats.largestProjects || [];
    const recommendations = stats.recommendations || [];

    return <div .page-scroll>
      <div .p-6 style="width:*;">
      <div .page-wide>
        <div .col .gap-1 .mb-6>
          <h1 .text-2xl .bold>Statistics</h1>
          <p .fg-3 .text-sm>Workspace analytics and insights.</p>
        </div>

        <div .stats-row .mb-6>
          <div .stat-box>
            <div .stat-value>{formatBytes(stats.totalReclaimed || 0)}</div>
            <div .stat-label>Total Reclaimed</div>
          </div>
          <div .stat-box>
            <div .stat-value>{stats.totalProjectsScanned || 0}</div>
            <div .stat-label>Projects Scanned</div>
          </div>
          <div .stat-box>
            <div .stat-value>{stats.totalProjectsCleaned || 0}</div>
            <div .stat-label>Projects Cleaned</div>
          </div>
          <div .stat-box>
            <div .stat-value>{formatBytes(stats.currentlyReclaimable || 0)}</div>
            <div .stat-label>Currently Reclaimable</div>
          </div>
        </div>

        <section .stats-section>
          <h2 .section-title>By Project Type</h2>
          <div .type-breakdown>
            {typeBreakdown.length > 0
              ? typeBreakdown.map(type => <div .type-row key={type.name}>
                  <div .type-bar-bg>
                    <div .type-bar-fill style={`width: ${Math.max(type.percentage, 5)}%`} />
                  </div>
                  <div .type-info>
                    <span .type-name>{type.name}</span>
                    <span .text-tertiary .text-xs>{type.count} projects</span>
                    <span .type-bytes>{formatBytes(type.reclaimable)}</span>
                  </div>
                </div>)
              : <p .text-tertiary>Scan a workspace to see breakdown.</p>
            }
          </div>
        </section>

        {monthlyReclaim.length > 0 ? <section .stats-section>
          <h2 .section-title>Monthly Trend</h2>
          <div .chart-container>
            {monthlyReclaim.map(month => <div .chart-bar key={month.label}>
              <div .chart-bar-fill style={`height: ${Math.max(month.percentage * 1.2, 4)}dip`}
                   title={`${month.label}: ${formatBytes(month.bytes)}`} />
              <div .chart-bar-label>{month.label}</div>
            </div>)}
          </div>
        </section> : []}

        <section .stats-section>
          <h2 .section-title>Top Space Consumers</h2>
          <div .list>
            {largestProjects.length > 0
              ? largestProjects.map((project, index) => <div .list-item key={index}>
                  <span .list-rank>#{index + 1}</span>
                  <div .list-item-info>
                    <div .list-item-name>{project.name}</div>
                    <div .list-item-path>{project.path}</div>
                  </div>
                  <span .badge class={project.typeId || project.type.toLowerCase()}>
                    {project.devicon ? <img .devicon src={project.devicon} /> : []}
                    {project.type}
                  </span>
                  <span .list-item-size>{formatBytes(project.size)}</span>
                </div>)
              : <p .text-tertiary>Scan a workspace to see top consumers.</p>
            }
          </div>
        </section>

        {recommendations.length > 0 ? <section .stats-section>
          <h2 .section-title>Recommendations</h2>
          <div .recommendations>
            {recommendations.map((rec, index) => <div .recommendation key={index}>
              <div .recommendation-title>{rec.title}</div>
              <div .recommendation-desc>{rec.description}</div>
            </div>)}
          </div>
        </section> : []}
      </div>
      </div>
    </div>;
  }
}
