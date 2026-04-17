# RepoSweep

Reclaim disk space across your dev workspaces. RepoSweep scans a folder,
detects what each project is (Node, Rust, .NET, Flutter, Python, Go,
Java, …), surfaces the cleanup targets it can safely remove
(`node_modules`, `target/`, `.venv`, `build/`, `bin/`, `obj/`, …), and
frees them with one click.

Cross-platform desktop app — macOS, Windows, Linux. Built on
[Avalonia](https://avaloniaui.net).

---

## Highlights

- One-click cleanup per project or per workspace
- Detects 20+ project types out of the box, extensible via JSON
- Cleanup history with restore (uses the system trash, not permanent
  delete)
- Stats: top space consumers, breakdown by project type
- Light / dark / system theme, custom title bar
- Self-updates via GitHub releases — banner appears in the title bar

---

## Install

Download the latest installer for your OS from the
[Releases page](https://github.com/Fanom2813/reposweep/releases).
After install the app keeps itself up to date.

---

## Contributing

Contributions are welcome — bug reports, feature ideas, and pull
requests all appreciated. Open an issue to start a discussion before
landing larger changes. Release flow lives in
[docs/RELEASING.md](docs/RELEASING.md).

---

## Acknowledgements

Port of the [Sciter.js](https://sciter.com) original RepoSweep. Icons
from [Lucide](https://lucide.dev) and
[Devicon](https://github.com/devicons/devicon). Updates powered by
[Velopack](https://velopack.io).
