using System;
using System.Threading;
using System.Threading.Tasks;
using Velopack;
using Velopack.Sources;

namespace RepoSweep.Services;

/// <summary>
/// Wraps Velopack to check a GitHub release feed for updates and apply
/// them on demand. The actual restart is user-triggered (via the
/// title-bar banner) — never automatic, so an in-progress scan is
/// never lost without warning.
/// </summary>
public sealed class UpdateService
{
    // TODO: set to your real repo. The release feed must be a GitHub
    // release that contains Velopack-produced assets (`vpk pack` output).
    private const string GithubRepoUrl = "https://github.com/Fanom2813/reposweep";
    private const bool   IncludePreRelease = false;

    private readonly UpdateManager? _manager;
    private UpdateInfo? _pending;

    public bool IsSupported => _manager is { IsInstalled: true };
    public string? AvailableVersion => _pending?.TargetFullRelease.Version.ToString();

    public event Action? UpdateAvailable;

    public UpdateService()
    {
        try
        {
            var source = new GithubSource(GithubRepoUrl, accessToken: null!,
                prerelease: IncludePreRelease, downloader: null!);
            _manager = new UpdateManager(source);
        }
        catch
        {
            // No locator (running un-installed / from `dotnet run`) — disable.
            _manager = null;
        }
    }

    public async Task CheckAsync(CancellationToken ct = default)
    {
        if (!IsSupported) return;
        try
        {
            var info = await _manager!.CheckForUpdatesAsync().ConfigureAwait(false);
            if (info is null || ct.IsCancellationRequested) return;
            _pending = info;
            UpdateAvailable?.Invoke();
        }
        catch
        {
            // Network / rate-limit errors shouldn't crash the app.
        }
    }

    public async Task ApplyAndRestartAsync()
    {
        if (!IsSupported || _pending is null) return;
        await _manager!.DownloadUpdatesAsync(_pending).ConfigureAwait(false);
        _manager.ApplyUpdatesAndRestart(_pending);
    }
}
