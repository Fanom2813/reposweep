/**
 * History Page
 */

function formatDate(timestamp) {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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

export class HistoryPage extends Element {
  render(props) {
    const history = props?.history || [];
    const totalCleaned = history.reduce((sum, e) => sum + (e.bytesReclaimed || 0), 0);

    return <div .page-scroll>
      <div .page-wide>
        <div .page-header>
          <h1>History</h1>
          <p .text-secondary>Track your cleanup activity over time.</p>
        </div>

        <div .stats-row .mb-6>
          <div .stat-box>
            <div .stat-value>{formatBytes(totalCleaned)}</div>
            <div .stat-label>Total Reclaimed</div>
          </div>
          <div .stat-box>
            <div .stat-value>{history.length}</div>
            <div .stat-label>Cleanups</div>
          </div>
          <div .stat-box>
            <div .stat-value>{history.length > 0 ? formatBytes(totalCleaned / history.length) : "0 B"}</div>
            <div .stat-label>Average</div>
          </div>
        </div>

        {history.length > 0
          ? <div>
              <table .history-table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Path</th>
                    <th>Type</th>
                    <th>Targets</th>
                    <th .text-right>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, index) => <tr key={index}>
                    <td .text-secondary .text-xs>{formatDate(entry.timestamp)}</td>
                    <td><strong>{entry.projectName}</strong></td>
                    <td .col-path>{entry.projectPath}</td>
                    <td><span .badge class={entry.projectType?.toLowerCase()}>{entry.projectType}</span></td>
                    <td>{entry.targetsCleaned?.length || 0}</td>
                    <td .col-bytes>{formatBytes(entry.bytesReclaimed)}</td>
                  </tr>)}
                </tbody>
              </table>
              <footer .history-footer>
                <button .ghost .sm #export-history>Export CSV</button>
                <div .spacer />
                <button .danger .sm #clear-history>Clear History</button>
              </footer>
            </div>
          : <div .empty-state>
              <h3>No cleanup history yet</h3>
              <p>Clean some projects and they will appear here.</p>
            </div>
        }
      </div>
    </div>;
  }
}
