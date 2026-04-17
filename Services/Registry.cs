using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Avalonia;
using Avalonia.Platform;
using RepoSweep.Models;

namespace RepoSweep.Services;

public sealed class Registry
{
    private readonly List<ProjectTypeDefinition> _types = new();

    public static readonly ProjectTypeDefinition Generic = new()
    {
        Id = "unknown",
        Name = "Unknown",
        Icon = "icon-folder",
        Targets = new List<string> { ".cache", "dist", "build", "out", ".output" },
        Priority = 0,
    };

    private static readonly HashSet<string> BuiltInSkipDirs = new()
    {
        ".git", ".svn", ".hg", "Library", "Applications", "System",
    };

    public IReadOnlyList<ProjectTypeDefinition> All => _types;

    public ProjectTypeDefinition GetById(string id)
        => _types.FirstOrDefault(t => t.Id == id) ?? Generic;

    public void LoadFromAssetUri(string uri)
    {
        try
        {
            using var stream = AssetLoader.Open(new System.Uri(uri));
            LoadFromStream(stream);
        }
        catch
        {
            // missing resource — skip
        }
    }

    public void LoadFromFile(string path)
    {
        if (!File.Exists(path)) return;
        try
        {
            using var stream = File.OpenRead(path);
            LoadFromStream(stream);
        }
        catch
        {
            // malformed — skip
        }
    }

    private void LoadFromStream(Stream stream)
    {
        var defs = JsonSerializer.Deserialize<List<ProjectTypeDefinition>>(stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (defs == null) return;
        foreach (var def in defs) Register(def);
    }

    public void Register(ProjectTypeDefinition def)
    {
        if (string.IsNullOrEmpty(def.Id) || string.IsNullOrEmpty(def.Name)) return;
        var idx = _types.FindIndex(t => t.Id == def.Id);
        if (idx >= 0) _types[idx] = def;
        else _types.Add(def);
        _types.Sort((a, b) => b.Priority.CompareTo(a.Priority));
    }

    public HashSet<string> GetSkipDirs()
    {
        var skip = new HashSet<string>(BuiltInSkipDirs);
        foreach (var t in _types)
            foreach (var target in t.Targets)
                if (!target.Contains('*') && !target.Contains('/'))
                    skip.Add(target);
        return skip;
    }

    public ProjectTypeDefinition Detect(IEnumerable<string> entryNames)
    {
        var names = entryNames as HashSet<string> ?? new HashSet<string>(entryNames);
        foreach (var def in _types)
        {
            foreach (var marker in def.Markers)
            {
                if (marker.StartsWith("*."))
                {
                    var ext = marker.Substring(1);
                    if (names.Any(n => n.EndsWith(ext))) return def;
                }
                else
                {
                    if (names.Contains(marker)) return def;
                }
            }
        }
        return Generic;
    }

    public List<string> GetTargets(ProjectTypeDefinition def, IEnumerable<string> entryNames)
    {
        var names = entryNames as HashSet<string> ?? new HashSet<string>(entryNames);
        var result = new List<string>();
        foreach (var target in def.Targets)
        {
            if (target.Contains('*'))
            {
                var pattern = target.Replace("*", "");
                foreach (var name in names)
                    if (name.Contains(pattern) || name.EndsWith(pattern))
                        result.Add(name);
            }
            else if (target.Contains('/'))
            {
                var first = target.Split('/')[0];
                if (names.Contains(first)) result.Add(first);
            }
            else
            {
                if (names.Contains(target)) result.Add(target);
            }
        }
        return result;
    }

    public List<string> GetAllTargetNames()
    {
        var names = new HashSet<string>();
        foreach (var t in _types)
            foreach (var target in t.Targets)
                if (!target.Contains('*') && !target.Contains('/'))
                    names.Add(target);
        return names.ToList();
    }

    public List<string> GetAllMarkerNames()
    {
        var names = new HashSet<string>();
        foreach (var t in _types)
            foreach (var marker in t.Markers)
                if (!marker.StartsWith("*."))
                    names.Add(marker);
        return names.ToList();
    }
}
