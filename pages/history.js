/**
 * History Page — cleanup activity log, full-width table.
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

export function HistoryPage(props) {
  const history = props?.history || [];

  if (history.length === 0) {
    return <div .workspace>
      <div .row .middle .gap-3 .px-5 .py-3 .border-b>
        <h3 .text-lg .semibold>History</h3>
      </div>
      <EmptyState
        icon="icon-clock"
        title="No cleanup history yet"
        message="Clean some projects and they will appear here."
      />
    </div>;
  }

  return <div .workspace>
    <div .row .middle .gap-3 .px-5 .py-3 .border-b>
      <div .col>
        <h3 .text-lg .semibold>History</h3>
        <span .text-xs .fg-2>{history.length} cleanup{history.length !== 1 ? "s" : ""} recorded</span>
      </div>
      <div .spacer />
      <button .ghost .sm #clear-history>Clear All</button>
    </div>
    <table .table>
      <thead>
        <tr>
          <th style="width:70dip">When</th>
          <th .col-name>Project</th>
          <th .col-type>Type</th>
          <th style="width:*">Cleaned</th>
          <th .col-size>Reclaimed</th>
        </tr>
      </thead>
      <tbody>
        {history.map((entry, index) => <tr key={index}>
          <td .text-xs .fg-2 .nowrap>{timeAgo(entry.timestamp)}</td>
          <td .col-name>
            <div .cell-name>
              <span .name-text>{entry.projectName}</span>
              <span .path-text>{entry.projectPath}</span>
            </div>
          </td>
          <td .col-type>
            <span .badge class={entry.projectTypeId}>
              {entry.devicon ? <img .devicon src={entry.devicon} /> : []}
              {entry.projectType}
            </span>
          </td>
          <td .text-sm .fg-2>{(entry.targetsCleaned || []).join(", ")}</td>
          <td .col-bytes>{formatBytes(entry.bytesReclaimed)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
