using System.Collections.Generic;

namespace RepoSweep.Models;

public sealed class Project
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public string Type { get; set; } = "";
    public string TypeId { get; set; } = "";
    public string Icon { get; set; } = "";
    public string Devicon { get; set; } = "";
    public long ModifiedAt { get; set; }
    public bool IsStale { get; set; }
    public List<CleanupTarget> CleanupTargets { get; set; } = new();
    public long ReclaimableBytes { get; set; }
    public string ReclaimableLabel { get; set; } = "...";
    public string Sizing { get; set; } = "pending";
}
