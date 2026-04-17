using System;
using System.IO;
using System.Text.Json;
using RepoSweep.Models;

namespace RepoSweep.Services;

public sealed class SettingsStore
{
    private readonly string _dbDir;
    private readonly string _dbPath;
    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
    };

    public SettingsStore()
    {
        _dbDir = ResolveDir();
        _dbPath = Path.Combine(_dbDir, "state.json");
        MigrateLegacyIfNeeded();
    }

    public string DirectoryPath => _dbDir;
    public string UserTypesPath => Path.Combine(_dbDir, "reposweep-types.json");

    public PersistedState? Load()
    {
        try
        {
            if (!File.Exists(_dbPath)) return null;
            var json = File.ReadAllText(_dbPath);
            return JsonSerializer.Deserialize<PersistedState>(json, Options);
        }
        catch
        {
            // Corrupt or schema-mismatched file — fall back to defaults.
            return null;
        }
    }

    public void Save(PersistedState state)
    {
        try
        {
            Directory.CreateDirectory(_dbDir);
            var json = JsonSerializer.Serialize(state, Options);

            // Atomic write: write to .tmp, then rename. A crash between the
            // two leaves either the old or new file intact, never a half-
            // written one. File.Move(..., overwrite: true) is atomic on
            // Windows, macOS and Linux when source/dest are on the same
            // filesystem (always true for our temp file).
            var tmp = _dbPath + ".tmp";
            File.WriteAllText(tmp, json);
            File.Move(tmp, _dbPath, overwrite: true);
        }
        catch
        {
            // Best-effort: a failed save shouldn't crash the app.
        }
    }

    // ---------- Path resolution ----------

    private static string ResolveDir()
    {
        // Per Avalonia data-persistence guide and platform conventions:
        //   Windows  → %APPDATA%\reposweep\
        //   macOS    → ~/Library/Application Support/reposweep/
        //   Linux    → $XDG_CONFIG_HOME/reposweep/  (or ~/.config/reposweep/)
        if (OperatingSystem.IsMacOS())
        {
            var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            return Path.Combine(home, "Library", "Application Support", "reposweep");
        }
        if (OperatingSystem.IsLinux())
        {
            var xdg = Environment.GetEnvironmentVariable("XDG_CONFIG_HOME");
            var baseDir = string.IsNullOrEmpty(xdg)
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".config")
                : xdg;
            return Path.Combine(baseDir, "reposweep");
        }
        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "reposweep");
    }

    private void MigrateLegacyIfNeeded()
    {
        // Earlier builds used Environment.SpecialFolder.ApplicationData on
        // every platform, which lands at ~/.config/reposweep/ on macOS.
        // If the new location is empty but a legacy state.json exists, copy
        // it across so existing installs don't lose their data.
        if (!OperatingSystem.IsMacOS()) return;
        if (File.Exists(_dbPath)) return;

        var legacy = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "reposweep");
        var legacyState = Path.Combine(legacy, "state.json");
        if (!File.Exists(legacyState)) return;

        try
        {
            Directory.CreateDirectory(_dbDir);
            File.Copy(legacyState, _dbPath, overwrite: false);
            var legacyTypes = Path.Combine(legacy, "reposweep-types.json");
            if (File.Exists(legacyTypes))
                File.Copy(legacyTypes, UserTypesPath, overwrite: false);
        }
        catch
        {
            // Migration is opportunistic; ignore errors.
        }
    }
}
