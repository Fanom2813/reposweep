# Repo Sweep Roadmap

This document outlines the planned development phases for Repo Sweep. Each phase builds on the previous one, with features prioritized by user value and implementation complexity.

---

## Phase 0: MVP ✅ COMPLETE

**Goal:** Core functionality working end-to-end

- [x] Workspace root selection
- [x] Project type auto-detection (Node, Flutter, Rust, Python, Git)
- [x] Safe target identification per stack
- [x] Manual scan and cleanup
- [x] Disk space calculation
- [x] Project filtering and search
- [x] State persistence
- [x] Confirmation dialog

**Status:** Ready for use

---

## Phase 1: Safety & Polish

**Goal:** Make the app production-ready with safety features and UI refinements

### 1.1 Safety Features
- [ ] **Dry Run Mode** - Preview deletions without actually deleting
  - Add "Preview" button to project cards
  - Show list of files/folders that would be removed
  - Display total count and size

- [ ] **Trash Instead of Delete** - Move to system trash for recovery
  - Implement `moveToTrash()` using platform APIs
  - Add user preference: permanent delete vs trash
  - Show "Emptied Trash" reminder after 30 days

- [ ] **Protected Projects** - Mark projects as never-delete
  - Star/lock icon on project cards
  - Protected projects grayed out in bulk operations
  - Persist protected list to settings

- [ ] **Process Detection** - Warn if project files are in use
  - Check for running Node/Cargo/Flutter processes
  - Show warning banner on affected projects
  - "Force clean" option for advanced users

### 1.2 UI/UX Improvements
- [ ] **Dark Mode** - Toggle between light/dark themes
  - Add theme toggle in titlebar
  - Create dark color palette in CSS variables
  - Persist theme preference

- [ ] **Compact List View** - Alternative to grid view
  - View toggle button in toolbar
  - Dense row layout with inline actions
  - Better for large workspaces (100+ projects)

- [ ] **Keyboard Shortcuts** - Power-user navigation
  - `Cmd/Ctrl+R` - Rescan
  - `Cmd/Ctrl+F` - Focus search
  - `Cmd/Ctrl+1-9` - Select project by index
  - `Delete` - Clean selected project
  - `?` - Show shortcuts help

- [ ] **Sort Options** - More control over project ordering
  - Sort by name, size, date modified, type
  - Click column headers to sort
  - Persist sort preference

### 1.3 Stability
- [ ] **Better Error Handling** - Graceful failures
  - Permission denied handling
  - Network drive disconnection handling
  - Corrupted project detection
  - Retry mechanism for failed operations

- [ ] **Progress Indicators** - Show work in progress
  - Progress bar for long scans
  - Per-project cleanup progress
  - Cancel long-running operations

**Phase 1 Completion Criteria:**
- User can preview before deleting
- No accidental permanent deletions
- Theme preference saved
- All operations cancellable

---

## Phase 2: Power Features

**Goal:** Support advanced use cases and larger workspaces

### 2.1 Scanning Enhancements
- [ ] **Deep Scan Mode** - Recursively scan nested projects
  - Toggle: "Scan subdirectories"
  - Detect monorepo packages as separate projects
  - Configurable depth limit (1-5 levels)
  - Warning for very deep scans

- [ ] **Git Integration** - Smart git-aware cleanup
  - Show branch name and uncommitted changes count
  - Warn if unpushed commits exist
  - "Clean but keep .git" option
  - Auto-fetch to check remote status

- [ ] **Stale Project Detection** - Highlight old projects
  - Configurable threshold (30/60/90 days)
  - Visual indicator (badge) on stale projects
  - Filter by "Stale only"
  - Batch clean all stale projects

- [ ] **Custom Project Types** - User-defined detection
  - Settings panel for custom markers
  - Define cleanup targets per custom type
  - Import/export custom type definitions

### 2.2 Bulk Operations
- [ ] **Multi-Select** - Clean multiple projects at once
  - Checkboxes on project cards
  - "Select All" / "Select None"
  - "Select Stale" / "Select Large (>100MB)"
  - Bulk cleanup with single confirmation

- [ ] **Selective Cleanup** - Choose specific targets
  - Expandable project card showing individual targets
  - Checkbox per target (e.g., clean `node_modules` but not `.next`)
  - Remember choices per project

- [ ] **Exclusion Patterns** - Glob patterns to ignore
  - Settings panel for global exclusions
  - Per-project exclusion rules
  - Common presets ("Keep all .env files")

### 2.3 Data & Insights
- [ ] **Cleanup History** - Track what's been cleaned
  - Timeline view of past cleanups
  - Total space reclaimed counter
  - Per-project cleanup history
  - Undo last cleanup (if in trash)

- [ ] **Export Report** - Share scan results
  - Export to CSV/JSON
  - Include project paths, sizes, types
  - Generate cleanup recommendations text

- [ ] **Project Size Trends** - Track growth over time
  - Store size snapshots on each scan
  - Simple line chart per project
  - Alert on unusual growth

**Phase 2 Completion Criteria:**
- Monorepo support works well
- Can clean 10+ projects in one action
- History view shows past cleanups
- Git status visible before cleanup

---

## Phase 3: Automation

**Goal:** Reduce manual work through smart automation

### 3.1 Watch Mode
- [ ] **Background Monitor** - Watch workspace for changes
  - System tray icon with status
  - Notification when cleanup needed
  - Configurable threshold (notify at 1GB reclaimable)

- [ ] **Auto-Cleanup Rules** - Conditional automatic cleaning
  - "Clean projects not touched in X days"
  - "Clean when disk space below X%"
  - "Clean specific targets automatically (safe caches only)"
  - Rule preview before enabling

### 3.2 Smart Features
- [ ] **Cleanup Recommendations** - AI-like suggestions
  - "You have 5GB in stale Flutter projects"
  - "node_modules in X can be safely cleaned"
  - Priority score for cleanup candidates

- [ ] **Dependency Reinstall** - Clean + rebuild workflow
  - "Clean and reinstall" button
  - Runs `npm install`, `cargo build`, etc.
  - Shows rebuild progress
  - Rollback on build failure

### 3.3 Integration
- [ ] **CLI Mode** - Command-line interface
  - `reposweep scan /path/to/workspace`
  - `reposweep clean --dry-run`
  - `reposweep stats --json`
  - CI/CD pipeline integration

- [ ] **IDE Integration** - VS Code extension
  - Sidebar panel showing current project status
  - One-click cleanup from IDE
  - Status bar indicator

**Phase 3 Completion Criteria:**
- Background monitoring works
- Auto-cleanup rules configurable
- CLI usable in scripts
- Can clean without opening GUI

---

## Phase 4: Advanced/Enterprise

**Goal:** Support teams, complex setups, and power users

### 4.1 Team Features
- [ ] **Multi-User Support** - Per-user settings
  - User profiles with different roots
  - Shared workspace configurations
  - Permission levels (view-only, clean-approved, admin)

- [ ] **Team Dashboard** - Aggregate workspace stats
  - Shared disk usage across team
  - Cleanup coordination (don't clean shared deps)
  - Report export for managers

### 4.2 Advanced Scanning
- [ ] **Docker Support** - Clean container artifacts
  - Detect Docker projects
  - Clean build cache, unused images
  - Prune volumes option

- [ ] **Network Drives** - Scan remote workspaces
  - SMB/NFS mounted workspace support
  - Optimized scanning for network latency
  - Offline mode with cached data

- [ ] **Remote Execution** - Clean SSH-accessible servers
  - Add SSH hosts as workspace roots
  - Remote scanning via SSH
  - Batch clean across multiple servers

### 4.3 Enterprise
- [ ] **Policy Enforcement** - Organization rules
  - Mandatory exclusion patterns
  - Approved cleanup targets only
  - Require approval for projects >X size

- [ ] **Audit Logging** - Compliance tracking
  - Log all cleanup operations
  - Export audit trail
  - Integration with SIEM tools

- [ ] **Cloud Sync** - Settings across machines
  - Sync workspace roots via cloud
  - Share custom project types
  - Backup/restore configuration

**Phase 4 Completion Criteria:**
- Team collaboration features work
- Remote scanning stable
- Enterprise security requirements met

---

## Phase 5: Platform Expansion

**Goal:** Beyond desktop app

- [ ] **Mobile Companion** - iOS/Android status viewer
- [ ] **Web Dashboard** - Browser-based management
- [ ] **Plugin System** - Third-party extensions
- [ ] **Package Manager Plugins** - `npm clean`, `cargo sweep` integration

---

## Priority Quick Reference

### Next 3 Tasks (Do These First)
1. Dry Run Mode - Critical safety feature
2. Trash Instead of Delete - Prevents accidents
3. Dark Mode - High user expectation

### This Month
- Keyboard shortcuts
- Deep scan mode
- Progress indicators
- Better error handling

### This Quarter
- Git integration
- Multi-select bulk operations
- Cleanup history
- System tray/watch mode

### Future Considerations
- CLI mode
- Team features
- Docker support
- Remote execution

---

## How to Contribute

1. Pick a task from the current phase
2. Open an issue to discuss implementation
3. Submit a PR referencing the roadmap

**Principles:**
- Safety over convenience
- Explicit over implicit
- Transparent operations
- Respect user data
