/**
 * Settings Page
 *
 * All changes apply in real time — no save button needed.
 * Each control fires events that bubble to app.js.
 */

export class SettingsPage extends Element {
  render(props) {
    const settings = props?.settings || {};

    return <div .page-scroll .p-6>
      <div style="max-width:640dip;">

        <div .col .gap-1 .mb-6>
          <h1 .text-2xl .bold>Settings</h1>
          <p .fg-3 .text-sm>Changes are saved automatically.</p>
        </div>

        <Section title="Appearance">
          <Row label="Theme" desc="Choose your preferred color scheme">
            <select|dropdown(themeSelect) value={settings.theme || "system"}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Row>
        </Section>

        <Section title="Safety">
          <Row label="Move to Trash" desc="Use system trash instead of permanent deletion">
            <input|checkbox(settingToggle) data-key="useTrash" state-value={settings.useTrash ?? true} />
          </Row>
          <Row label="Dry Run Preview" desc="Always show preview before cleaning">
            <input|checkbox(settingToggle) data-key="dryRunDefault" state-value={settings.dryRunDefault || false} />
          </Row>
          <Row label="Confirmation Threshold" desc="Require confirmation above this size (MB)">
            <input|integer(settingNumber) data-key="confirmThreshold" state-value={settings.confirmThreshold || 100} min="0" step="10" style="width:72dip;" />
          </Row>
        </Section>

        <Section title="Scanning">
          <Row label="Auto-scan on launch" desc="Scan workspace automatically when app opens">
            <input|checkbox(settingToggle) data-key="autoScan" state-value={settings.autoScan ?? true} />
          </Row>
          <Row label="Deep Scan" desc="Scan subdirectories for nested projects">
            <input|checkbox(settingToggle) data-key="deepScan" state-value={settings.deepScan || false} />
          </Row>
          <Row label="Scan Depth" desc="Maximum directory depth (1-5)">
            <input|integer(settingNumber) data-key="scanDepth" state-value={settings.scanDepth || 2} min="1" max="5" style="width:56dip;" />
          </Row>
          <Row label="Stale Threshold" desc="Days since modification to mark as stale">
            <input|integer(settingNumber) data-key="staleDays" state-value={settings.staleDays || 30} min="7" step="1" style="width:56dip;" />
          </Row>
        </Section>

        <Section title="Exclusions">
          <div .col .gap-2 .py-3>
            <div .col .gap-1>
              <span .text-sm .medium>Protected patterns</span>
              <span .text-xs .fg-3>Files and folders matching these patterns will never be deleted. One per line.</span>
            </div>
            <textarea(settingExclusions) .font-mono .text-sm rows="5"
              value={(settings.exclusions || [".env", ".env.local", "secrets"]).join("\n")}
              placeholder="One pattern per line" style="width:*;" />
          </div>
        </Section>

        <Section title="Keyboard Shortcuts">
          <ShortcutRow label="Rescan workspace" keys="Cmd/Ctrl + R" />
          <ShortcutRow label="Focus search" keys="Cmd/Ctrl + F" />
          <ShortcutRow label="Go back" keys="Esc" />
          <ShortcutRow label="Toggle sidebar" keys="Cmd/Ctrl + B" />
        </Section>

        <Section title="About">
          <div .col .gap-3 .py-3>
            <div .row .gap-3 .middle>
              <img src="icon.svg" style="size:32dip;" />
              <div .col .gap-1>
                <span .text-sm .semibold>RepoSweep</span>
                <span .text-xs .fg-3>Workspace cleanup utility</span>
              </div>
            </div>
            <div .col .gap-1>
              <span .text-xs .fg-3>Version 1.0.0</span>
              <span .text-xs .fg-3>Built with Sciter.js</span>
            </div>
          </div>
        </Section>

        <div .row .gap-3 .py-4 .mt-2>
          <button .ghost #reset-settings><i .icon-refresh-cw /> Reset to defaults</button>
        </div>

      </div>
    </div>;
  }
}

function Section(props, kids) {
  return <div .col .mb-4>
    <div .fg-3 .text-xs .medium .mb-2 .pb-2 .border-b
         style="text-transform:uppercase; letter-spacing:0.04em;">
      {props.title}
    </div>
    <div .col>{kids}</div>
  </div>;
}

function Row(props, kids) {
  return <div .row .gap-4 .py-2 .middle>
    <div .col .gap-1 .w-full>
      <span .text-sm .medium>{props.label}</span>
      {props.desc ? <span .text-xs .fg-3>{props.desc}</span> : []}
    </div>
    <div style="width:max-content; white-space:nowrap;">
      {kids}
    </div>
  </div>;
}

function ShortcutRow(props) {
  return <div .row .gap-4 .py-2 .middle>
    <span .text-sm .w-full>{props.label}</span>
    <kbd>{props.keys}</kbd>
  </div>;
}
