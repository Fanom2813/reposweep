using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Platform.Storage;
using Avalonia.Styling;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using RepoSweep.Models;
using RepoSweep.Services;

namespace RepoSweep.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly Registry _registry;
    private readonly Scanner _scanner;
    private readonly SettingsStore _store;
    private readonly Dictionary<string, CachedScan> _scanCache = new();
    private int _epoch;

    // ===== Observable collections =====

    public ObservableCollection<WorkspaceRootViewModel> Roots { get; } = new();
    public ObservableCollection<Project> AllProjects { get; } = new();
    public ObservableCollection<Project> FilteredProjects { get; } = new();
    public ObservableCollection<HistoryEntry> History { get; } = new();
    public ObservableCollection<FilterOption> FilterOptions { get; } = new();

    // ===== State =====

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(SelectedRootName), nameof(HasSelectedRoot), nameof(ShowOnboarding), nameof(ShowShell), nameof(ShowWorkspaceEmpty))]
    private string _selectedRoot = "";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(ShowOnboarding), nameof(ShowShell))]
    private int _rootsCount;

    [ObservableProperty]
    private bool _isScanning;

    [ObservableProperty]
    private string _searchText = "";

    [ObservableProperty]
    private FilterOption _selectedFilter = new("All", "All");

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsWorkspacePage), nameof(IsSettingsPage), nameof(IsHistoryPage), nameof(IsStatsPage))]
    private string _currentPage = "workspace";

    [ObservableProperty]
    private bool _sidebarVisible = true;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(ShowWorkspaceEmpty), nameof(ShowWorkspaceData))]
    private int _visibleCount;

    [ObservableProperty]
    private string _reclaimableLabel = "0 B";

    [ObservableProperty]
    private string _projectsCountLabel = "0 projects · 0 B reclaimable";

    // ===== Settings (flattened) =====

    [ObservableProperty] private string _theme = "system";
    [ObservableProperty] private bool _useTrash = true;
    [ObservableProperty] private bool _dryRunDefault;
    [ObservableProperty] private int _confirmThreshold = 100;
    [ObservableProperty] private bool _autoScan = true;
    [ObservableProperty] private bool _deepScan;
    [ObservableProperty] private int _scanDepth = 2;
    [ObservableProperty] private int _staleDays = 30;
    [ObservableProperty] private string _exclusionsText = ".env\n.env.local\nsecrets";

    // ===== Stats =====

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(TitlebarStat))]
    private StatsViewModel _stats = new();

    // ===== Computed =====

    public bool HasSelectedRoot => !string.IsNullOrEmpty(SelectedRoot);
    public bool HasHistory => History.Count > 0;
    public string SelectedRootName
    {
        get
        {
            if (string.IsNullOrEmpty(SelectedRoot)) return "";
            var name = Path.GetFileName(SelectedRoot.TrimEnd(Path.DirectorySeparatorChar, '/', '\\'));
            return string.IsNullOrEmpty(name) ? SelectedRoot : name;
        }
    }

    public bool ShowOnboarding => RootsCount == 0;
    public bool ShowShell => RootsCount > 0;
    public bool IsWorkspacePage => CurrentPage == "workspace";
    public bool IsSettingsPage => CurrentPage == "settings";
    public bool IsHistoryPage => CurrentPage == "history";
    public bool IsStatsPage => CurrentPage == "stats";
    public bool ShowWorkspaceEmpty => HasSelectedRoot && VisibleCount == 0 && !IsScanning && string.IsNullOrWhiteSpace(SearchText);
    public bool ShowWorkspaceData => HasSelectedRoot && !ShowWorkspaceEmpty;

    public string TitlebarStat =>
        Stats.CurrentlyReclaimable > 0
            ? $"↻ {Stats.CurrentlyReclaimableLabel}"
            : "";

    // ===== Window placement (persisted across sessions) =====

    public WindowPlacement LoadWindowPlacement() =>
        _store.Load()?.Window ?? new WindowPlacement();

    public void SaveWindowPlacement(WindowPlacement w)
    {
        _windowPlacement = w;
        Persist();
    }

    private WindowPlacement _windowPlacement = new();

    // ===== Theme toggle (used by the title bar) =====

    public void ToggleTheme()
    {
        Theme = Theme switch
        {
            "light" => "dark",
            "dark"  => "system",
            _       => "light",
        };
    }

    // ===== Update banner (Velopack) =====

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(UpdateBannerLabel))]
    private bool _updateAvailable;

    public string UpdateBannerLabel =>
        string.IsNullOrEmpty(App.Updater.AvailableVersion)
            ? "Update available"
            : $"Update {App.Updater.AvailableVersion} available";

    public async Task ApplyUpdateAsync() => await App.Updater.ApplyAndRestartAsync();

    public MainViewModel(Registry registry, Scanner scanner, SettingsStore store)
    {
        _registry = registry;
        _scanner = scanner;
        _store = store;

        // Load persisted state
        var saved = _store.Load();
        if (saved != null)
        {
            foreach (var r in saved.Roots)
                Roots.Add(new WorkspaceRootViewModel(r, r == saved.SelectedRoot));
            _selectedRoot = string.IsNullOrEmpty(saved.SelectedRoot) && saved.Roots.Count > 0
                ? saved.Roots[0] : saved.SelectedRoot;
            LoadSettingsInto(saved.Settings);
            foreach (var h in saved.History) History.Add(h);
            _windowPlacement = saved.Window ?? new WindowPlacement();
        }
        _rootsCount = Roots.Count;

        History.CollectionChanged += (_, _) => OnPropertyChanged(nameof(HasHistory));

        App.Updater.UpdateAvailable += () =>
            Dispatcher.UIThread.Post(() =>
            {
                UpdateAvailable = true;
                OnPropertyChanged(nameof(UpdateBannerLabel));
            });

        RebuildFilterOptions();
        ApplyTheme();

        if (!string.IsNullOrEmpty(SelectedRoot) && AutoScan)
        {
            IsScanning = true;
            _ = ScanAsync();
        }
    }

    private bool _suppressPersist;

    private void LoadSettingsInto(AppSettings s)
    {
        _suppressPersist = true;
        try
        {
            Theme = s.Theme;
            UseTrash = s.UseTrash;
            DryRunDefault = s.DryRunDefault;
            ConfirmThreshold = s.ConfirmThreshold;
            AutoScan = s.AutoScan;
            DeepScan = s.DeepScan;
            ScanDepth = s.ScanDepth;
            StaleDays = s.StaleDays;
            ExclusionsText = string.Join("\n", s.Exclusions);
        }
        finally
        {
            _suppressPersist = false;
        }
    }

    private AppSettings CurrentSettings() => new()
    {
        Theme = Theme,
        UseTrash = UseTrash,
        DryRunDefault = DryRunDefault,
        ConfirmThreshold = ConfirmThreshold,
        AutoScan = AutoScan,
        DeepScan = DeepScan,
        ScanDepth = ScanDepth,
        StaleDays = StaleDays,
        Exclusions = (ExclusionsText ?? "").Split('\n')
            .Select(s => s.Trim())
            .Where(s => s.Length > 0)
            .ToList(),
    };

    private void Persist()
    {
        if (_suppressPersist) return;
        var state = new PersistedState
        {
            Roots = Roots.Select(r => r.Path).ToList(),
            RecentRoots = Roots.Select(r => r.Path).ToList(),
            SelectedRoot = SelectedRoot,
            Settings = CurrentSettings(),
            History = History.ToList(),
            Window = _windowPlacement,
        };
        _store.Save(state);
    }

    private void RebuildFilterOptions()
    {
        FilterOptions.Clear();
        FilterOptions.Add(new FilterOption("All", "All"));
        foreach (var t in _registry.All)
            FilterOptions.Add(new FilterOption(t.Id, t.Name));
        SelectedFilter = FilterOptions[0];
    }

    // ===== Setting change hooks =====

    partial void OnThemeChanged(string value) { ApplyTheme(); Persist(); }
    partial void OnUseTrashChanged(bool value) => Persist();
    partial void OnDryRunDefaultChanged(bool value) => Persist();
    partial void OnConfirmThresholdChanged(int value) => Persist();
    partial void OnAutoScanChanged(bool value) => Persist();
    partial void OnDeepScanChanged(bool value) => Persist();
    partial void OnScanDepthChanged(int value) => Persist();
    partial void OnStaleDaysChanged(int value) => Persist();
    partial void OnExclusionsTextChanged(string value) => Persist();

    partial void OnSearchTextChanged(string value) => ApplyFilter();
    partial void OnSelectedFilterChanged(FilterOption value) => ApplyFilter();

    private void ApplyTheme()
    {
        if (Application.Current == null) return;
        Application.Current.RequestedThemeVariant = Theme switch
        {
            "dark" => ThemeVariant.Dark,
            "light" => ThemeVariant.Light,
            _ => ThemeVariant.Default,
        };
    }

    private void ApplyFilter()
    {
        var query = (SearchText ?? "").Trim();
        var filterName = SelectedFilter?.Name ?? "All";
        FilteredProjects.Clear();
        long totalBytes = 0;
        foreach (var p in AllProjects)
        {
            if (filterName != "All" && p.Type != filterName) continue;
            if (query.Length > 0)
            {
                var q = query.ToLowerInvariant();
                if (!p.Name.ToLowerInvariant().Contains(q)
                    && !p.Path.ToLowerInvariant().Contains(q)
                    && !p.Type.ToLowerInvariant().Contains(q))
                    continue;
            }
            FilteredProjects.Add(p);
            totalBytes += p.ReclaimableBytes;
        }
        VisibleCount = FilteredProjects.Count;
        ReclaimableLabel = Scanner.FormatBytes(totalBytes);
        ProjectsCountLabel = $"{FilteredProjects.Count} projects · {ReclaimableLabel} reclaimable";
    }

    // ===== Root management =====

    public void AddRoot(string path)
    {
        if (string.IsNullOrEmpty(path)) return;
        if (Roots.Any(r => r.Path == path)) return;
        foreach (var r in Roots) r.IsSelected = false;
        Roots.Add(new WorkspaceRootViewModel(path, true));
        RootsCount = Roots.Count;
        SelectedRoot = path;
        Persist();
    }

    [RelayCommand]
    public void RemoveRoot(WorkspaceRootViewModel root)
    {
        var idx = Roots.IndexOf(root);
        if (idx < 0) return;
        Roots.RemoveAt(idx);
        _scanCache.Remove(root.Path);
        RootsCount = Roots.Count;

        if (SelectedRoot == root.Path)
        {
            if (Roots.Count > 0)
            {
                Roots[0].IsSelected = true;
                SelectedRoot = Roots[0].Path;
                if (_scanCache.TryGetValue(SelectedRoot, out var cached)) RestoreFromCache(cached);
                else { AllProjects.Clear(); ApplyFilter(); _ = ScanAsync(); }
            }
            else
            {
                SelectedRoot = "";
                AllProjects.Clear();
                ApplyFilter();
                CurrentPage = "workspace";
            }
        }
        Persist();
    }

    [RelayCommand]
    public async Task SelectRoot(WorkspaceRootViewModel root)
    {
        if (root == null) return;
        if (SelectedRoot == root.Path)
        {
            CurrentPage = "workspace";
            return;
        }

        // Cache current state
        if (!string.IsNullOrEmpty(SelectedRoot))
        {
            _scanCache[SelectedRoot] = new CachedScan
            {
                Projects = AllProjects.ToList(),
                Search = SearchText,
                Filter = SelectedFilter,
            };
        }

        foreach (var r in Roots) r.IsSelected = r.Path == root.Path;
        SelectedRoot = root.Path;
        CurrentPage = "workspace";

        if (_scanCache.TryGetValue(root.Path, out var cached))
        {
            RestoreFromCache(cached);
        }
        else
        {
            AllProjects.Clear();
            SearchText = "";
            SelectedFilter = FilterOptions[0];
            ApplyFilter();
            await ScanAsync();
        }
        Persist();
    }

    private void RestoreFromCache(CachedScan cached)
    {
        AllProjects.Clear();
        foreach (var p in cached.Projects) AllProjects.Add(p);
        SearchText = cached.Search ?? "";
        SelectedFilter = cached.Filter ?? FilterOptions[0];
        ApplyFilter();
    }

    [RelayCommand]
    public async Task AddWorkspaceAsync()
    {
        var path = await PickFolderAsync();
        if (string.IsNullOrEmpty(path)) return;
        AddRoot(path);
        CurrentPage = "workspace";
        await ScanAsync();
    }

    [RelayCommand]
    public async Task AutoDetectAsync()
    {
        var roots = _scanner.ScanLikelyRoots();
        foreach (var r in roots)
        {
            if (!Roots.Any(x => x.Path == r))
                Roots.Add(new WorkspaceRootViewModel(r, false));
        }
        RootsCount = Roots.Count;
        if (string.IsNullOrEmpty(SelectedRoot) && Roots.Count > 0)
        {
            Roots[0].IsSelected = true;
            SelectedRoot = Roots[0].Path;
        }
        Persist();
        CurrentPage = "workspace";
        if (HasSelectedRoot) await ScanAsync();
    }

    private static async Task<string?> PickFolderAsync()
    {
        if (Application.Current?.ApplicationLifetime is not IClassicDesktopStyleApplicationLifetime desktop) return null;
        var win = desktop.MainWindow;
        if (win == null) return null;
        var folders = await win.StorageProvider.OpenFolderPickerAsync(new FolderPickerOpenOptions
        {
            Title = "Select workspace folder",
            AllowMultiple = false,
        });
        if (folders.Count == 0) return null;
        var path = folders[0].TryGetLocalPath();
        return path;
    }

    // ===== Scanning =====

    [RelayCommand]
    public async Task ScanAsync()
    {
        if (string.IsNullOrEmpty(SelectedRoot)) return;
        IsScanning = true;
        var myEpoch = Interlocked.Increment(ref _epoch);

        List<Project>? result = null;
        try
        {
            result = await _scanner.ScanRootAsync(SelectedRoot, CurrentSettings(), myEpoch, () => Volatile.Read(ref _epoch));
        }
        catch { result = null; }

        if (_epoch != myEpoch) return; // a newer scan has superseded
        await Dispatcher.UIThread.InvokeAsync(() =>
        {
            IsScanning = false;
            if (result == null) return;
            AllProjects.Clear();
            foreach (var p in result) AllProjects.Add(p);
            ApplyFilter();
            _scanCache[SelectedRoot] = new CachedScan
            {
                Projects = result,
                Search = SearchText,
                Filter = SelectedFilter,
            };
        });
    }

    // ===== Cleanup =====

    public async Task<bool> CleanProjectAsync(Project project, Func<string, string, Task<bool>> confirm)
    {
        if (project == null || project.CleanupTargets.Count == 0) return false;
        var ok = await confirm(project.Name,
            $"Clean {project.CleanupTargets.Count} target(s) in {project.Name}?\nThis will remove {project.ReclaimableLabel} of caches and build folders.");
        if (!ok) return false;

        foreach (var t in project.CleanupTargets)
            _scanner.RemoveTree(t.Path);

        History.Insert(0, new HistoryEntry
        {
            ProjectName = project.Name,
            ProjectPath = project.Path,
            ProjectType = project.Type,
            ProjectTypeId = project.TypeId,
            Devicon = project.Devicon,
            TargetsCleaned = project.CleanupTargets.Select(t => t.Name).ToList(),
            BytesReclaimed = project.ReclaimableBytes,
            CanRestore = UseTrash,
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
        });
        while (History.Count > 100) History.RemoveAt(History.Count - 1);

        // Rescan that single project
        var typeDef = _registry.GetById(project.TypeId);
        var remaining = _scanner.FindCleanupTargets(project.Path, typeDef, CurrentSettings().Exclusions);
        var reclaimable = remaining.Sum(t => t.Bytes);

        if (reclaimable == 0)
        {
            AllProjects.Remove(project);
        }
        else
        {
            project.CleanupTargets = remaining;
            project.ReclaimableBytes = reclaimable;
            project.ReclaimableLabel = Scanner.FormatBytes(reclaimable);
            // Trigger collection-level refresh (rebuild filtered view)
        }
        ApplyFilter();

        _scanCache[SelectedRoot] = new CachedScan
        {
            Projects = AllProjects.ToList(),
            Search = SearchText,
            Filter = SelectedFilter,
        };
        Persist();
        return true;
    }

    [RelayCommand]
    public void OpenFolder(string path)
    {
        if (string.IsNullOrEmpty(path)) return;
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = path,
                UseShellExecute = true,
            });
        }
        catch { }
    }

    [RelayCommand]
    public void Navigate(string page)
    {
        if (string.IsNullOrEmpty(page)) return;
        CurrentPage = page;
        if (page == "stats") RefreshStats();
    }

    [RelayCommand]
    public void ToggleSidebar() => SidebarVisible = !SidebarVisible;

    [RelayCommand]
    public void ClearHistory()
    {
        History.Clear();
        Persist();
    }

    [RelayCommand]
    public void ResetSettings()
    {
        LoadSettingsInto(new AppSettings());
        ApplyTheme();
        Persist();
    }

    public void RefreshStats()
    {
        var s = new StatsViewModel();
        long totalReclaimed = 0;
        foreach (var h in History) totalReclaimed += h.BytesReclaimed;

        var map = new Dictionary<string, (int count, long reclaimable, string typeId, string devicon)>();
        foreach (var p in AllProjects)
        {
            map.TryGetValue(p.Type, out var existing);
            existing.count += 1;
            existing.reclaimable += p.ReclaimableBytes;
            existing.typeId = p.TypeId;
            existing.devicon = p.Devicon;
            map[p.Type] = existing;
        }
        long totalReclaimable = map.Values.Sum(v => v.reclaimable);
        s.TotalReclaimed = totalReclaimed;
        s.TotalReclaimedLabel = Scanner.FormatBytes(totalReclaimed);
        s.CurrentlyReclaimable = totalReclaimable;
        s.CurrentlyReclaimableLabel = Scanner.FormatBytes(totalReclaimable);
        s.TotalProjectsScanned = AllProjects.Count;
        s.TotalProjectsCleaned = History.Count;

        s.TypeBreakdown = map
            .Select(kvp => new StatsTypeBreakdown
            {
                Name = kvp.Key,
                Devicon = kvp.Value.devicon,
                Count = kvp.Value.count,
                Reclaimable = kvp.Value.reclaimable,
                ReclaimableLabel = Scanner.FormatBytes(kvp.Value.reclaimable),
                Percentage = totalReclaimable > 0 ? (kvp.Value.reclaimable * 100.0 / totalReclaimable) : 0,
                BarPercent = totalReclaimable > 0 ? Math.Max(2, (kvp.Value.reclaimable * 100.0 / totalReclaimable)) : 2,
            })
            .OrderByDescending(t => t.Reclaimable)
            .ToList();

        s.LargestProjects = AllProjects
            .OrderByDescending(p => p.ReclaimableBytes)
            .Take(10)
            .Select((p, i) => new StatsLargestProject
            {
                Rank = i + 1,
                Name = p.Name,
                Path = p.Path,
                Type = p.Type,
                TypeId = p.TypeId,
                Devicon = p.Devicon,
                Size = p.ReclaimableBytes,
                SizeLabel = Scanner.FormatBytes(p.ReclaimableBytes),
            })
            .ToList();

        Stats = s;
    }

    // ===== Types =====

    private sealed class CachedScan
    {
        public List<Project> Projects { get; set; } = new();
        public string? Search { get; set; }
        public FilterOption? Filter { get; set; }
    }
}
