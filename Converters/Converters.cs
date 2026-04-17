using System;
using System.Globalization;
using Avalonia.Data.Converters;

namespace RepoSweep.Converters;

public sealed class BoolToClassConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is bool b && b && parameter is string cls) return cls;
        return "";
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

public sealed class TimeAgoConverter : IValueConverter
{
    public static readonly TimeAgoConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value == null) return "";
        long ts = value switch
        {
            long l => l,
            double d => (long)d,
            _ => 0,
        };
        if (ts == 0) return "";
        var seconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - ts;
        if (seconds < 60) return "Just now";
        var minutes = seconds / 60;
        if (minutes < 60) return $"{minutes}m ago";
        var hours = minutes / 60;
        if (hours < 24) return $"{hours}h ago";
        var days = hours / 24;
        if (days < 30) return $"{days}d ago";
        return $"{days / 30}mo ago";
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

public sealed class BytesConverter : IValueConverter
{
    public static readonly BytesConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        long bytes = value switch
        {
            long l => l,
            int i => i,
            double d => (long)d,
            _ => 0,
        };
        return Services.Scanner.FormatBytes(bytes);
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

public sealed class InverseZeroToTrueConverter : IValueConverter
{
    public static readonly InverseZeroToTrueConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        int count = value switch
        {
            int i => i,
            long l => (int)l,
            _ => 0,
        };
        return count == 0;
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

public sealed class DeviconUriConverter : IValueConverter
{
    // project-types.json stores paths like "icons/devicon/nodejs.svg".
    // Turn that into the avares URI Svg.Skia expects, or return null when
    // there's no devicon so the binding stays empty.
    public static readonly DeviconUriConverter Instance = new();
    private const string Prefix = "avares://RepoSweep/Assets/";

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is not string s || string.IsNullOrWhiteSpace(s)) return null;
        if (s.StartsWith("avares://", StringComparison.Ordinal)) return s;
        return Prefix + s.TrimStart('/');
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

public sealed class JoinStringsConverter : IValueConverter
{
    public static readonly JoinStringsConverter Instance = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is System.Collections.Generic.IEnumerable<string> list)
            return string.Join(", ", list);
        return "";
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
