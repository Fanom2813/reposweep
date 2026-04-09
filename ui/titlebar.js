/**
 * TitleBar Component
 *
 * Minimal title bar - navigation is handled by the sidebar.
 * Kept for backward compatibility if pages still import it.
 */

export function TitleBar() {
  return (
    <window-header>
      <window-caption role="window-caption">
        <span style="font-size: 12dip; color: color(text-tertiary);">RepoSweep</span>
      </window-caption>
      <window-buttons>
        <button .win-btn role="window-minimize" title="Minimize" />
        <button .win-btn role="window-maximize" title="Maximize" />
        <button .win-btn role="window-close" title="Close" />
      </window-buttons>
    </window-header>
  );
}
