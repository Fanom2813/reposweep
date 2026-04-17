using System.Collections.Generic;

namespace RepoSweep.ViewModels;

public sealed class StatsViewModel
{
    public long TotalReclaimed { get; set; }
    public int TotalProjectsScanned { get; set; }
    public int TotalProjectsCleaned { get; set; }
    public long CurrentlyReclaimable { get; set; }
    public string TotalReclaimedLabel { get; set; } = "0 B";
    public string CurrentlyReclaimableLabel { get; set; } = "0 B";
    public List<StatsTypeBreakdown> TypeBreakdown { get; set; } = new();
    public List<StatsLargestProject> LargestProjects { get; set; } = new();
    public bool HasData => TotalProjectsScanned > 0;
}

public sealed class StatsTypeBreakdown
{
    public string Name { get; set; } = "";
    public string Devicon { get; set; } = "";
    public int Count { get; set; }
    public long Reclaimable { get; set; }
    public string ReclaimableLabel { get; set; } = "";
    public double Percentage { get; set; }
    public double BarPercent { get; set; }
    public string CountLabel => $"{Count} proj";
}

public sealed class StatsLargestProject
{
    public int Rank { get; set; }
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public string Type { get; set; } = "";
    public string TypeId { get; set; } = "";
    public string Devicon { get; set; } = "";
    public long Size { get; set; }
    public string SizeLabel { get; set; } = "";
}
