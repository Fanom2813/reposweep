using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using RepoSweep.Models;

namespace RepoSweep.Services;

public sealed class Scanner
{
    private readonly Registry _registry;

    public Scanner(Registry registry) => _registry = registry;

    // ===== Public API =====

    public static string FormatBytes(long value)
    {
        string[] units = { "B", "KB", "MB", "GB", "TB" };
        double size = value;
        int unit = 0;
        while (size >= 1024 && unit < units.Length - 1)
        {
            size /= 1024;
            unit++;
        }
        return $"{size.ToString(unit < 2 ? "F0" : "F1", System.Globalization.CultureInfo.InvariantCulture)} {units[unit]}";
    }

    public async Task<List<Project>?> ScanRootAsync(string rootPath, AppSettings settings, int epoch, Func<int> getEpoch, CancellationToken ct = default)
    {
        var scanDepth = Math.Max(1, settings.ScanDepth);
        var exclusions = settings.Exclusions;
        var staleThreshold = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - settings.StaleDays * 86400L;

        // Phase 1 — discovery
        var discovery = await DiscoverProjectsNativeAsync(rootPath, scanDepth, ct);
        if (discovery == null)
        {
            discovery = DiscoverProjectsManaged(rootPath, scanDepth);
        }

        var projectMap = discovery.Projects;
        var preTargets = discovery.Targets;

        // Phase 2 — detect type, resolve targets
        var projects = new List<Project>();
        var allTargetPaths = new List<string>();
        var projectTargetsMap = new Dictionary<string, List<(string name, string path)>>();

        foreach (var kvp in projectMap)
        {
            if (getEpoch() != epoch) return null;

            var dirPath = kvp.Key;
            var markerFiles = kvp.Value;

            var typeDef = _registry.Detect(markerFiles);

            if (typeDef.Id == "unknown")
            {
                var fullEntries = SafeListEntries(dirPath);
                typeDef = _registry.Detect(fullEntries);
            }

            List<(string name, string path)> targets;
            if (preTargets != null && preTargets.TryGetValue(dirPath, out var pre))
            {
                targets = ResolveTargets(dirPath, typeDef, pre, exclusions);
            }
            else
            {
                targets = ResolveTargets(dirPath, typeDef, null, exclusions);
            }

            long modifiedAt = 0;
            try { modifiedAt = new DirectoryInfo(dirPath).LastWriteTimeUtc.ToFileTimeUtc() == 0 ? 0 : ((DateTimeOffset)new DirectoryInfo(dirPath).LastWriteTimeUtc).ToUnixTimeSeconds(); }
            catch { }

            var project = new Project
            {
                Id = Guid.NewGuid().ToString(),
                Name = Path.GetFileName(dirPath.TrimEnd('/', '\\')),
                Path = dirPath,
                Type = typeDef.Name,
                TypeId = typeDef.Id,
                Icon = typeDef.Icon,
                Devicon = typeDef.Devicon ?? "",
                ModifiedAt = modifiedAt,
                IsStale = modifiedAt > 0 && modifiedAt < staleThreshold,
                CleanupTargets = targets.Select(t => new CleanupTarget
                {
                    Name = t.name,
                    Path = t.path,
                    Bytes = 0,
                    PrettyBytes = "...",
                }).ToList(),
                ReclaimableBytes = 0,
                ReclaimableLabel = "...",
                Sizing = "pending",
            };
            projects.Add(project);
            projectTargetsMap[project.Id] = targets;
            foreach (var t in targets) allTargetPaths.Add(t.path);
        }

        projects.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));

        // Phase 3 — batch size
        if (allTargetPaths.Count > 0)
        {
            var unique = allTargetPaths.Distinct().ToList();
            var sizeMap = await FolderSizesBatchAsync(unique, ct);

            foreach (var project in projects)
            {
                if (getEpoch() != epoch) return null;

                long reclaimable = 0;
                var sized = new List<CleanupTarget>();
                foreach (var t in projectTargetsMap[project.Id])
                {
                    sizeMap.TryGetValue(t.path, out var bytes);
                    sized.Add(new CleanupTarget
                    {
                        Name = t.name,
                        Path = t.path,
                        Bytes = bytes,
                        PrettyBytes = FormatBytes(bytes),
                    });
                    reclaimable += bytes;
                }
                project.CleanupTargets = sized;
                project.ReclaimableBytes = reclaimable;
                project.ReclaimableLabel = FormatBytes(reclaimable);
                project.Sizing = "deep";
            }
        }
        else
        {
            foreach (var project in projects) project.Sizing = "deep";
        }

        var filtered = projects.Where(p => p.ReclaimableBytes > 0).ToList();
        filtered.Sort((a, b) =>
        {
            var byBytes = b.ReclaimableBytes.CompareTo(a.ReclaimableBytes);
            return byBytes != 0 ? byBytes : string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);
        });
        return filtered;
    }

    public List<CleanupTarget> FindCleanupTargets(string path, ProjectTypeDefinition typeDef, List<string> exclusions)
    {
        var entries = SafeListEntries(path);
        var names = _registry.GetTargets(typeDef, entries);
        var targets = new List<CleanupTarget>();
        foreach (var name in names)
        {
            if (IsExcluded(name, exclusions)) continue;
            var full = Path.Combine(path, name);
            if (!Directory.Exists(full) && !File.Exists(full)) continue;
            var size = FolderSizeShallow(full);
            targets.Add(new CleanupTarget
            {
                Name = name,
                Path = full,
                Bytes = size,
                PrettyBytes = FormatBytes(size),
            });
        }
        return targets;
    }

    public void RemoveTree(string path)
    {
        try
        {
            if (File.Exists(path) || IsSymlink(path))
            {
                File.Delete(path);
                return;
            }
            if (Directory.Exists(path))
            {
                Directory.Delete(path, recursive: true);
            }
        }
        catch
        {
            // best-effort
        }
    }

    public List<string> ScanLikelyRoots()
    {
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string[] common = { "Documents", "Developer", "Code", "Projects", "Sites", "Workspace", "Work", "repos", "src" };
        var roots = new List<string>();
        foreach (var name in common)
        {
            var path = Path.Combine(home, name);
            if (Directory.Exists(path)) roots.Add(path);
        }
        return roots;
    }

    // ===== Helpers =====

    private static bool IsSymlink(string path)
    {
        try
        {
            var info = new FileInfo(path);
            if ((info.Attributes & FileAttributes.ReparsePoint) != 0) return true;
            var dInfo = new DirectoryInfo(path);
            return (dInfo.Attributes & FileAttributes.ReparsePoint) != 0;
        }
        catch { return false; }
    }

    private bool IsExcluded(string name, List<string> exclusions)
    {
        if (exclusions == null || exclusions.Count == 0) return false;
        foreach (var pattern in exclusions)
        {
            if (string.IsNullOrEmpty(pattern)) continue;
            if (name == pattern) return true;
            if (pattern.StartsWith('*') && name.EndsWith(pattern.Substring(1))) return true;
        }
        return false;
    }

    private List<(string name, string path)> ResolveTargets(string dirPath, ProjectTypeDefinition typeDef, List<(string name, string path)>? preDiscovered, List<string> exclusions)
    {
        var validTargets = new HashSet<string>(typeDef.Targets
            .Where(t => !t.Contains('*'))
            .Select(t => t.Contains('/') ? t.Split('/')[0] : t));
        var globPatterns = typeDef.Targets.Where(t => t.Contains('*')).Select(t => t.Replace("*", "")).ToList();

        var result = new List<(string name, string path)>();
        if (preDiscovered != null)
        {
            foreach (var t in preDiscovered)
            {
                if (IsExcluded(t.name, exclusions)) continue;
                if (validTargets.Contains(t.name)) result.Add(t);
            }
            if (globPatterns.Count > 0)
            {
                var entries = SafeListEntries(dirPath);
                foreach (var name in entries)
                {
                    if (IsExcluded(name, exclusions)) continue;
                    foreach (var pattern in globPatterns)
                    {
                        if (name.Contains(pattern) || name.EndsWith(pattern))
                        {
                            var full = Path.Combine(dirPath, name);
                            if (Directory.Exists(full) || File.Exists(full))
                                result.Add((name, full));
                        }
                    }
                }
            }
        }
        else
        {
            var entries = SafeListEntries(dirPath);
            var targetNames = _registry.GetTargets(typeDef, entries);
            foreach (var name in targetNames)
            {
                if (IsExcluded(name, exclusions)) continue;
                var full = Path.Combine(dirPath, name);
                if (Directory.Exists(full) || File.Exists(full))
                    result.Add((name, full));
            }
        }
        return result;
    }

    private static HashSet<string> SafeListEntries(string path)
    {
        var result = new HashSet<string>();
        try
        {
            foreach (var entry in Directory.EnumerateFileSystemEntries(path))
            {
                result.Add(Path.GetFileName(entry));
            }
        }
        catch { }
        return result;
    }

    private static long FolderSizeShallow(string path)
    {
        try
        {
            if (File.Exists(path)) return new FileInfo(path).Length;
            if (!Directory.Exists(path)) return 0;
            long total = 0;
            foreach (var file in Directory.EnumerateFiles(path))
            {
                try { total += new FileInfo(file).Length; } catch { }
            }
            return total;
        }
        catch { return 0; }
    }

    // ===== Discovery — native =====

    private sealed class DiscoveryResult
    {
        public Dictionary<string, HashSet<string>> Projects { get; set; } = new();
        public Dictionary<string, List<(string name, string path)>>? Targets { get; set; }
    }

    private async Task<DiscoveryResult?> DiscoverProjectsNativeAsync(string rootPath, int scanDepth, CancellationToken ct)
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            return await DiscoverProjectsSpotlightAsync(rootPath, scanDepth, ct);
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            return await DiscoverProjectsFindAsync(rootPath, scanDepth, ct);
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return await DiscoverProjectsWindowsAsync(rootPath, scanDepth, ct);
        return null;
    }

    private async Task<DiscoveryResult?> DiscoverProjectsSpotlightAsync(string rootPath, int scanDepth, CancellationToken ct)
    {
        var markers = _registry.GetAllMarkerNames();
        if (markers.Count == 0) return new DiscoveryResult();

        var query = string.Join(" || ", markers.Select(m => $"kMDItemFSName == '{m}'"));
        var output = await RunCommandAsync("mdfind", new[] { "-onlyin", rootPath, query }, ct);
        if (output == null) return null;

        var projects = new Dictionary<string, HashSet<string>>();
        var markerSet = new HashSet<string>(markers);
        foreach (var raw in output.Split('\n'))
        {
            var filePath = raw.Trim();
            if (filePath.Length == 0) continue;
            var parsed = ParseRelativePath(filePath, rootPath, scanDepth);
            if (parsed == null) continue;
            if (!markerSet.Contains(parsed.Value.entryName)) continue;
            if (!projects.TryGetValue(parsed.Value.projectPath, out var set))
            {
                set = new HashSet<string>();
                projects[parsed.Value.projectPath] = set;
            }
            set.Add(parsed.Value.entryName);
        }
        return new DiscoveryResult { Projects = projects };
    }

    private async Task<DiscoveryResult?> DiscoverProjectsFindAsync(string rootPath, int scanDepth, CancellationToken ct)
    {
        var markers = _registry.GetAllMarkerNames();
        var targetNames = _registry.GetAllTargetNames();
        if (markers.Count == 0 && targetNames.Count == 0) return new DiscoveryResult();

        var args = new List<string> { rootPath, "-maxdepth", (scanDepth + 1).ToString() };
        if (markers.Count > 0 && targetNames.Count > 0)
        {
            args.Add("(");
            args.Add("("); args.Add("-type"); args.Add("f"); args.Add("(");
            for (int i = 0; i < markers.Count; i++)
            {
                if (i > 0) args.Add("-o");
                args.Add("-name"); args.Add(markers[i]);
            }
            args.Add(")"); args.Add(")");
            args.Add("-o");
            args.Add("("); args.Add("-type"); args.Add("d"); args.Add("(");
            for (int i = 0; i < targetNames.Count; i++)
            {
                if (i > 0) args.Add("-o");
                args.Add("-name"); args.Add(targetNames[i]);
            }
            args.Add(")"); args.Add(")");
            args.Add(")");
        }
        else if (markers.Count > 0)
        {
            args.Add("-type"); args.Add("f"); args.Add("(");
            for (int i = 0; i < markers.Count; i++)
            {
                if (i > 0) args.Add("-o");
                args.Add("-name"); args.Add(markers[i]);
            }
            args.Add(")");
        }
        else
        {
            return new DiscoveryResult();
        }

        var output = await RunCommandAsync("find", args.ToArray(), ct);
        if (output == null) return null;

        var markerSet = new HashSet<string>(markers);
        var projects = new Dictionary<string, HashSet<string>>();
        var targets = new Dictionary<string, List<(string name, string path)>>();

        foreach (var raw in output.Split('\n'))
        {
            var filePath = raw.Trim();
            if (filePath.Length == 0) continue;
            var parsed = ParseRelativePath(filePath, rootPath, scanDepth);
            if (parsed == null) continue;

            var (projectPath, entryName) = parsed.Value;
            if (markerSet.Contains(entryName))
            {
                if (!projects.TryGetValue(projectPath, out var set))
                {
                    set = new HashSet<string>();
                    projects[projectPath] = set;
                }
                set.Add(entryName);
            }
            else
            {
                if (!targets.TryGetValue(projectPath, out var list))
                {
                    list = new List<(string, string)>();
                    targets[projectPath] = list;
                }
                list.Add((entryName, filePath));
            }
        }

        // Keep only targets belonging to confirmed projects
        var toRemove = targets.Keys.Where(k => !projects.ContainsKey(k)).ToList();
        foreach (var k in toRemove) targets.Remove(k);

        return new DiscoveryResult { Projects = projects, Targets = targets };
    }

    private async Task<DiscoveryResult?> DiscoverProjectsWindowsAsync(string rootPath, int scanDepth, CancellationToken ct)
    {
        var markers = _registry.GetAllMarkerNames();
        if (markers.Count == 0) return new DiscoveryResult();

        var includeList = string.Join(",", markers.Select(m => $"'{m}'"));
        var cmd = $"Get-ChildItem -LiteralPath '{rootPath}' -Depth {scanDepth} -File -Include {includeList} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName";
        var output = await RunCommandAsync("powershell", new[] { "-NoProfile", "-Command", cmd }, ct);
        if (output == null) return null;

        var projects = new Dictionary<string, HashSet<string>>();
        var sep = rootPath.Contains('\\') ? '\\' : '/';
        foreach (var raw in output.Split('\n'))
        {
            var filePath = raw.Trim();
            if (filePath.Length == 0) continue;
            if (filePath.Length <= rootPath.Length + 1) continue;
            var relative = filePath.Substring(rootPath.Length + 1);
            var parts = relative.Split(sep);
            if (parts.Length < 2 || parts.Length > scanDepth + 1) continue;
            var entryName = parts[parts.Length - 1];
            var projectRel = string.Join("/", parts.Take(parts.Length - 1));
            var projectPath = Path.Combine(rootPath, projectRel.Replace('/', Path.DirectorySeparatorChar));
            if (!projects.TryGetValue(projectPath, out var set))
            {
                set = new HashSet<string>();
                projects[projectPath] = set;
            }
            set.Add(entryName);
        }
        return new DiscoveryResult { Projects = projects };
    }

    private DiscoveryResult DiscoverProjectsManaged(string rootPath, int scanDepth)
    {
        var result = new DiscoveryResult();
        var skipDirs = _registry.GetSkipDirs();

        void ScanDir(string dirPath, int depth)
        {
            if (depth > scanDepth) return;
            IEnumerable<string> entries;
            try { entries = Directory.EnumerateDirectories(dirPath); }
            catch { return; }

            foreach (var childPath in entries)
            {
                var name = Path.GetFileName(childPath);
                if (skipDirs.Contains(name)) continue;

                var childEntries = SafeListEntries(childPath);
                var markerSet = new HashSet<string>();
                foreach (var def in _registry.All)
                {
                    foreach (var marker in def.Markers)
                    {
                        if (marker.StartsWith("*."))
                        {
                            var ext = marker.Substring(1);
                            foreach (var n in childEntries)
                                if (n.EndsWith(ext)) markerSet.Add(n);
                        }
                        else if (childEntries.Contains(marker))
                        {
                            markerSet.Add(marker);
                        }
                    }
                }

                if (markerSet.Count > 0)
                {
                    result.Projects[childPath] = markerSet;
                }
                else if (depth < scanDepth)
                {
                    ScanDir(childPath, depth + 1);
                }
            }
        }
        ScanDir(rootPath, 1);
        return result;
    }

    private static (string projectPath, string entryName)? ParseRelativePath(string filePath, string rootPath, int scanDepth)
    {
        if (filePath.Length <= rootPath.Length + 1) return null;
        var relative = filePath.Substring(rootPath.Length + 1);
        var parts = relative.Split('/');
        if (parts.Length < 2 || parts.Length > scanDepth + 1) return null;
        var entryName = parts[parts.Length - 1];
        var projectRel = string.Join("/", parts.Take(parts.Length - 1));
        var projectPath = Path.Combine(rootPath, projectRel);
        return (projectPath, entryName);
    }

    // ===== Sizing =====

    private async Task<Dictionary<string, long>> FolderSizesBatchAsync(List<string> paths, CancellationToken ct)
    {
        var result = new Dictionary<string, long>();
        if (paths.Count == 0) return result;

        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            var args = new List<string> { "-sk" };
            args.AddRange(paths);
            var output = await RunCommandAsync("du", args.ToArray(), ct);
            if (output != null)
            {
                foreach (var line in output.Split('\n'))
                {
                    var trimmed = line.TrimEnd();
                    if (trimmed.Length == 0) continue;
                    var tab = trimmed.IndexOf('\t');
                    if (tab <= 0) continue;
                    if (long.TryParse(trimmed.Substring(0, tab), out var kb))
                    {
                        var p = trimmed.Substring(tab + 1);
                        result[p] = kb * 1024L;
                    }
                }
                foreach (var p in paths) if (!result.ContainsKey(p)) result[p] = 0;
                return result;
            }
        }

        // Fallback (Windows or du failed): parallel managed sizes
        await Task.Run(() =>
        {
            Parallel.ForEach(paths, new ParallelOptions { MaxDegreeOfParallelism = 8, CancellationToken = ct },
                p =>
                {
                    var size = DeepSize(p);
                    lock (result) result[p] = size;
                });
        }, ct);
        return result;
    }

    private static long DeepSize(string path)
    {
        try
        {
            if (File.Exists(path)) return new FileInfo(path).Length;
            if (!Directory.Exists(path)) return 0;
            long total = 0;
            var stack = new Stack<string>();
            stack.Push(path);
            while (stack.Count > 0)
            {
                var dir = stack.Pop();
                try
                {
                    foreach (var file in Directory.EnumerateFiles(dir))
                    {
                        try { total += new FileInfo(file).Length; } catch { }
                    }
                    foreach (var sub in Directory.EnumerateDirectories(dir))
                    {
                        try
                        {
                            var info = new DirectoryInfo(sub);
                            if ((info.Attributes & FileAttributes.ReparsePoint) != 0) continue;
                            stack.Push(sub);
                        }
                        catch { }
                    }
                }
                catch { }
            }
            return total;
        }
        catch { return 0; }
    }

    // ===== Process helper =====

    private static async Task<string?> RunCommandAsync(string fileName, string[] args, CancellationToken ct)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = fileName,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            foreach (var a in args) psi.ArgumentList.Add(a);
            using var proc = Process.Start(psi);
            if (proc == null) return null;
            var stdout = await proc.StandardOutput.ReadToEndAsync(ct);
            await proc.WaitForExitAsync(ct);
            return stdout;
        }
        catch
        {
            return null;
        }
    }
}
