# Releasing RepoSweep

RepoSweep ships auto-updates via [Velopack](https://velopack.io). Every
release published to GitHub becomes an in-app update for existing
installs — they see a banner in the title bar and click to restart into
the new version.

---

## How it works in the app

| Piece | Where |
|---|---|
| Velopack hook (must run first in `Main`) | `Program.cs` |
| GitHub release feed wrapper | `Services/UpdateService.cs` |
| Background probe 30 s after launch | `App.axaml.cs` (`OnFrameworkInitializationCompleted`) |
| `UpdateAvailable` flag + `ApplyUpdateAsync()` | `ViewModels/MainViewModel.cs` |
| "Update X.Y.Z available" banner button | `Views/TitleBar.axaml` (visible only when flag is true) |

Restarts are **never automatic**. The user clicks the banner; we then
`DownloadUpdatesAsync` + `ApplyUpdatesAndRestart`. Running un-installed
(`dotnet run`) is a no-op — `UpdateService.IsSupported` is false.

The repo URL lives in **one place**:
`Services/UpdateService.cs:14` → `GithubRepoUrl`. Update it before the
first release.

---

## One-time setup

```bash
dotnet tool install -g vpk
```

`vpk` is the Velopack CLI. Use `dotnet tool update -g vpk` to refresh.

---

## Cutting a release

Repeat per RID. The minimal flow for a single platform:

```bash
VERSION=1.0.0
RID=osx-arm64                # or win-x64, linux-x64, osx-x64

# 1. Publish — produces ONE binary at publish/$RID/RepoSweep[.exe].
#    Single-file + self-contained + ReadyToRun are baked into
#    reposweeep.csproj for any Release+RuntimeIdentifier publish, so
#    no extra flags here.
dotnet publish -c Release -r $RID -o publish/$RID

# 2. Pack into a Velopack release (installer + delta nupkg + RELEASES)
vpk pack \
  -u RepoSweep \
  -v $VERSION \
  --packDir publish/$RID \
  --outputDir releases/$RID \
  --mainExe RepoSweep        # or RepoSweep.exe on Windows

# 3. Upload as a GitHub release
vpk upload github \
  --repoUrl https://github.com/<owner>/<repo> \
  --tag v$VERSION \
  --releaseDir releases/$RID \
  --publish                  # mark release as published (not draft)
```

After upload, every existing install will see the update on its next
30-second probe.

### What gets uploaded

For each RID, a release contains roughly:

- `RepoSweep-1.0.0-full.nupkg` — full payload
- `RepoSweep-1.0.0-delta.nupkg` — delta from the previous release
- `RepoSweep-1.0.0-Setup.exe` / `.dmg` / `.AppImage` — installer
- `RELEASES` — manifest the client downloads first

Velopack diffs between the last two `*-full.nupkg` files to produce
the delta. First release has no delta.

### Code signing

Skip on first release. Add when you have certs:

- macOS: `--signAppleId <id> --signAppleIdPassword <app-password> --signAppleTeam <team>`
- Windows: `--signParams "/td sha256 /fd sha256 /tr http://timestamp.digicert.com /a"`

---

## Automating with GitHub Actions

The maintained workflow lives at
[`.github/workflows/release.yml`](../.github/workflows/release.yml).
It runs on tag push (`v*`), builds for `osx-arm64`, `osx-x64`,
`win-x64`, and `linux-x64` in parallel, downloads the previous release
of each channel so Velopack can compute deltas, packs, and uploads
back to the GitHub release of the same tag.

Day-to-day:

```bash
git tag v1.0.1
git push origin v1.0.1
```

That's the whole release. Existing installs see the update on their
next 30-second probe.

A separate [`ci.yml`](../.github/workflows/ci.yml) runs a Debug build
across all three OSes on every PR and `main` push so regressions are
caught before tagging.

---

## Versioning

Velopack treats version strings as semver. Pre-releases (`1.0.0-beta.1`)
are filtered out by the in-app updater unless `IncludePreRelease` is
flipped to `true` in `UpdateService.cs`. Use that for a TestFlight-style
preview channel later.

---

## Troubleshooting

- **Banner never appears**: check `App.Updater.IsSupported`. False means
  the app wasn't installed via a Velopack package — running `dotnet run`
  always returns false.
- **`No releases found`** at `vpk upload`: the GitHub tag must exist and
  the token must have `contents: write`.
- **Delta build fails**: missing previous `*-full.nupkg`. `vpk pack` needs
  the prior release in its outputDir; in CI we re-download from GitHub
  before packing (see `vpk download github`).

---

## References

- [Velopack docs](https://docs.velopack.io)
- [GithubSource API](https://docs.velopack.io/reference/cs/Velopack/Sources/GithubSource)
- [GitHub Actions workflow reference](https://docs.velopack.io/distributing/github-actions)
