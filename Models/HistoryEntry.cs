using System.Collections.Generic;

namespace RepoSweep.Models;

public sealed class HistoryEntry
{
    public string ProjectName { get; set; } = "";
    public string ProjectPath { get; set; } = "";
    public string ProjectType { get; set; } = "";
    public string ProjectTypeId { get; set; } = "";
    public string Devicon { get; set; } = "";
    public List<string> TargetsCleaned { get; set; } = new();
    public long BytesReclaimed { get; set; }
    public bool CanRestore { get; set; }
    public double Timestamp { get; set; }
}
