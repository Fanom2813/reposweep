/**
 * Settings Page
 *
 * Notion-style grouped settings with section headers.
 * Uses utility classes — no custom CSS needed.
 */

export class SettingsPage extends Element {
  render(props) {
    const settings = props?.settings || {};

    return <div .page-scroll .p-6>
      <div style="max-width:640dip;">

        {/* Header */}
        <div .col .gap-1 .mb-6>
          <h1 .text-2xl .bold>Settings</h1>
          <p .fg-3 .text-sm>Configure RepoSweep behavior and preferences.</p>
        </div>

        {/* Appearance */}
        <Section title="Appearance">
          <Row label="Theme" desc="Choose your preferred color scheme">
            <select|list .sm themeSelect value={settings.theme || "system"} style="width:120dip;">
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Row>
        </Section>

        {/* Safety */}
        <Section title="Safety">
          <Row label="Move to Trash" desc="Use system trash instead of permanent deletion">
            <input|checkbox useTrash checked={settings.useTrash ?? true} />
          </Row>
          <Row label="Dry Run Preview" desc="Always show preview before cleaning">
            <input|checkbox dryRunDefault checked={settings.dryRunDefault} />
          </Row>
          <Row label="Confirmation Threshold" desc="Require confirmation above this size (MB)">
            <input|integer .sm confirmThreshold value={settings.confirmThreshold || 100} min="0" step="10" style="width:80dip;" />
          </Row>
        </Section>

        {/* Scanning */}
        <Section title="Scanning">
          <Row label="Auto-scan on launch" desc="Scan workspace automatically when app opens">
            <input|checkbox autoScan checked={settings.autoScan ?? true} />
          </Row>
          <Row label="Deep Scan" desc="Scan subdirectories for nested projects">
            <input|checkbox deepScan checked={settings.deepScan} />
          </Row>
          <Row label="Scan Depth" desc="Maximum directory depth (1-5)">
            <input|integer .sm scanDepth value={settings.scanDepth || 2} min="1" max="5" style="width:60dip;" />
          </Row>
          <Row label="Stale Threshold" desc="Days since modification to mark as stale">
            <input|integer .sm staleDays value={settings.staleDays || 30} min="7" style="width:60dip;" />
          </Row>
        </Section>

        {/* Exclusions */}
        <Section title="Exclusions">
          <div .col .gap-2 .py-3>
            <div .col .gap-1>
              <span .text-sm .medium>Protected patterns</span>
              <span .text-xs .fg-3>Files and folders matching these patterns will never be deleted. One per line.</span>
            </div>
            <textarea .font-mono .text-sm exclusions rows="5"
              value={(settings.exclusions || [".env", ".env.local", "secrets"]).join("\n")}
              placeholder="One pattern per line" style="width:*;" />
          </div>
        </Section>

        {/* Keyboard Shortcuts */}
        <Section title="Keyboard Shortcuts">
          <ShortcutRow label="Rescan workspace" keys="Cmd/Ctrl + R" />
          <ShortcutRow label="Focus search" keys="Cmd/Ctrl + F" />
          <ShortcutRow label="Go back" keys="Esc" />
          <ShortcutRow label="Toggle sidebar" keys="Cmd/Ctrl + B" />
        </Section>

        {/* About */}
        <Section title="About">
          <div .col .gap-2 .py-3>
            <div .row .gap-3 .middle>
              <img src="icon.svg" style="size:32dip;" />
              <div .col .gap-1>
                <span .text-sm .semibold>RepoSweep</span>
                <span .text-xs .fg-3>Workspace cleanup utility</span>
              </div>
            </div>
            <div .col .gap-1 .mt-2>
              <span .text-xs .fg-3>Version 1.0.0</span>
              <span .text-xs .fg-3>Built with Sciter.js</span>
            </div>
          </div>
        </Section>

        {/* Actions */}
        <div .row .gap-2 .py-4 .border-t .mt-4>
          <button .primary #save-settings><i .icon-check /> Save</button>
          <button .ghost #reset-settings><i .icon-refresh-cw /> Reset to defaults</button>
        </div>

      </div>
    </div>;
  }
}

/**
 * Section — grouped block with uppercase label header.
 */
function Section(props, kids) {
  return <div .col .mb-6>
    <div .fg-3 .text-xs .medium .mb-3 .pb-2 .border-b
         style="text-transform:uppercase; letter-spacing:0.04em;">
      {props.title}
    </div>
    <div .col>{kids}</div>
  </div>;
}

/**
 * Row — label + description on left, control on right.
 */
function Row(props, kids) {
  return <div .row .gap-4 .py-3 .border-b style="min-height:40dip;">
    <div .col .gap-1 .w-full>
      <span .text-sm .medium>{props.label}</span>
      {props.desc ? <span .text-xs .fg-3>{props.desc}</span> : []}
    </div>
    <div .row .middle style="width:max-content; white-space:nowrap;">
      {kids}
    </div>
  </div>;
}

/**
 * ShortcutRow — keyboard shortcut display.
 */
function ShortcutRow(props) {
  return <div .row .gap-4 .py-2>
    <span .text-sm .w-full>{props.label}</span>
    <kbd>{props.keys}</kbd>
  </div>;
}
