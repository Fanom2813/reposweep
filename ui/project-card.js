/**
 * ProjectCard Component - Compact Linear/Stack Style
 *
 * NOTE: This component is deprecated. Projects are now rendered inline in WorkspacePage.
 * Kept for reference but not used in the new compact design.
 */

function prettyDate(timestamp) {
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

/**
 * @deprecated Use inline project-item rendering in WorkspacePage instead
 */
export function ProjectCard(project) {
  return (
    <article class="project-item">
      <div class="project-info">
        <div class="project-name">{project.name}</div>
        <div class="project-path">{project.path}</div>
        <div class="project-meta">
          <span class="badge" class={project.type.toLowerCase()}>{project.type}</span>
          <span class="text-tertiary">{prettyDate(project.modifiedAt)}</span>
        </div>
      </div>
      <div class="project-size">{formatBytes(project.reclaimableBytes)}</div>
      <div class="project-actions">
        <button class="primary sm" disabled={!project.cleanupTargets?.length} data-id={project.id}>
          Clean
        </button>
      </div>
    </article>
  );
}
