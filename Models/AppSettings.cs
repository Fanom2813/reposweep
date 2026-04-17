using System.Collections.Generic;

namespace RepoSweep.Models;

public sealed class AppSettings
{
    public string Theme { get; set; } = "system";
    public bool UseTrash { get; set; } = true;
    public bool DryRunDefault { get; set; }
    public int ConfirmThreshold { get; set; } = 100;
    public bool DeepScan { get; set; }
    public int ScanDepth { get; set; } = 2;
    public int StaleDays { get; set; } = 30;
    public List<string> Exclusions { get; set; } = new() { ".env", ".env.local", "secrets" };
    public bool AutoScan { get; set; } = true;

    public AppSettings Clone() => new()
    {
        Theme = Theme,
        UseTrash = UseTrash,
        DryRunDefault = DryRunDefault,
        ConfirmThreshold = ConfirmThreshold,
        DeepScan = DeepScan,
        ScanDepth = ScanDepth,
        StaleDays = StaleDays,
        Exclusions = new List<string>(Exclusions),
        AutoScan = AutoScan,
    };
}
