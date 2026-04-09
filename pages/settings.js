/**
 * Settings Page
 */

export class SettingsPage extends Element {
  render(props) {
    const state = props?.state || {};
    const settings = state.settings || {};

    return <div .page-scroll>
      <div .page-narrow>
        <div .page-header>
          <h1>Settings</h1>
          <p .text-secondary>Configure RepoSweep behavior and preferences.</p>
        </div>

        <section .settings-section>
          <h2>Appearance</h2>
          <div .setting-row>
            <div .setting-label>
              <h3>Theme</h3>
              <p>Choose your preferred color scheme</p>
            </div>
            <div .setting-control>
              <select|list .sm themeSelect value={settings.theme || "system"}>
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </section>

        <section .settings-section>
          <h2>Safety</h2>
          <div .setting-row>
            <div .setting-label>
              <h3>Move to Trash</h3>
              <p>Use system trash instead of permanent deletion</p>
            </div>
            <div .setting-control>
              <input|checkbox useTrash checked={settings.useTrash ?? true} />
            </div>
          </div>
          <div .setting-row>
            <div .setting-label>
              <h3>Dry Run Preview</h3>
              <p>Always preview before cleaning</p>
            </div>
            <div .setting-control>
              <input|checkbox dryRunDefault checked={settings.dryRunDefault} />
            </div>
          </div>
          <div .setting-row>
            <div .setting-label>
              <h3>Confirmation Threshold</h3>
              <p>Require confirmation for cleanups larger than (MB)</p>
            </div>
            <div .setting-control>
              <input|integer .sm confirmThreshold value={settings.confirmThreshold || 100} min="0" step="10" />
            </div>
          </div>
        </section>

        <section .settings-section>
          <h2>Scanning</h2>
          <div .setting-row>
            <div .setting-label>
              <h3>Deep Scan</h3>
              <p>Scan subdirectories for nested projects</p>
            </div>
            <div .setting-control>
              <input|checkbox deepScan checked={settings.deepScan} />
            </div>
          </div>
          <div .setting-row>
            <div .setting-label>
              <h3>Scan Depth</h3>
              <p>Maximum directory depth (1-5)</p>
            </div>
            <div .setting-control>
              <input|integer .sm scanDepth value={settings.scanDepth || 2} min="1" max="5" />
            </div>
          </div>
          <div .setting-row>
            <div .setting-label>
              <h3>Stale Threshold</h3>
              <p>Days since modification to mark as stale</p>
            </div>
            <div .setting-control>
              <input|integer .sm staleDays value={settings.staleDays || 30} min="7" />
            </div>
          </div>
        </section>

        <section .settings-section>
          <h2>Exclusions</h2>
          <div .setting-row>
            <div .setting-label>
              <h3>Protected patterns</h3>
              <p>Files matching these patterns will never be deleted</p>
            </div>
            <div .setting-control .setting-control-wide>
              <textarea exclusions rows="4"
                value={(settings.exclusions || [".env", ".env.local", "secrets"]).join("\n")}
                placeholder="One pattern per line" />
            </div>
          </div>
        </section>

        <section .settings-section>
          <h2>Keyboard Shortcuts</h2>
          <div .setting-row>
            <div .setting-label><h3>Rescan</h3></div>
            <div .setting-control><kbd>Cmd/Ctrl + R</kbd></div>
          </div>
          <div .setting-row>
            <div .setting-label><h3>Focus Search</h3></div>
            <div .setting-control><kbd>Cmd/Ctrl + F</kbd></div>
          </div>
          <div .setting-row>
            <div .setting-label><h3>Go Back</h3></div>
            <div .setting-control><kbd>Esc</kbd></div>
          </div>
        </section>

        <footer .settings-footer>
          <button .primary #save-settings>Save</button>
          <button .ghost #reset-settings>Reset to defaults</button>
        </footer>
      </div>
    </div>;
  }
}
