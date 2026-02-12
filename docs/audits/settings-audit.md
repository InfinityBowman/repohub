# Settings Audit

**Date:** 2026-02-11
**Scope:** Full comparison of current settings vs. recommended settings across all features

---

## Executive Summary

RepoHub has **14 config keys** in `AppConfig` but only **8 are exposed in the Settings UI**. Across 14+ services there are **60+ hardcoded values** (timeouts, limits, thresholds, intervals) that have no configuration path at all. Several existing settings have bugs or gaps in how they're applied. This audit catalogs everything and recommends what should change.

### Completed Fixes (2026-02-11)

- **Fixed** portScanInterval bug — PortService now has `updateInterval()`, called from config handler on save
- **Removed** dead `autoStartMonitoring` config key entirely
- **Added** `protectedBranches` setting — configurable in Settings, GitBranchService reads from config
- **Added** `accentColor` setting — preset swatches + native color picker, live preview via CSS variables
- **Added** `uiFontSize` setting — slider (12–18px), live preview via root font-size
- **Added** `repoScanDepth` setting — RepositoryService reads from config instead of hardcoded `5`
- **Added** `defaultShell` setting — ProcessService reads from config for all PTY spawns
- **Added** `githubPRCooldown` setting — GitHubService reads from config (seconds → ms conversion)
- **Redesigned** Settings UI — 7-tab layout (General, Repositories, Code Search, GitHub, Terminals, Ports, Scaffolding) with flat rows, tag lists, and stacked directory inputs

---

## Current Settings

### AppConfig Keys (19 total)

| #   | Key                         | Type                       | Default                       | Has UI?  | Notes                                            |
| --- | --------------------------- | -------------------------- | ----------------------------- | -------- | ------------------------------------------------ |
| 1   | `version`                   | `number`                   | `1`                           | No       | Internal schema version. No UI needed.           |
| 2   | `scanDirectory`             | `string`                   | `~/Documents/Repos`           | **Yes**  | Text input in Settings (Repositories tab).       |
| 3   | `ignorePatterns`            | `string[]`                 | 3 patterns                    | **Yes**  | Tag list in Settings (Repositories tab).         |
| 4   | `portScanInterval`          | `number`                   | `5000` ms                     | **Yes**  | Number input in Settings (Ports tab).            |
| 5   | `commandOverrides`          | `Record<string, string>`   | `{}`                          | Indirect | Edited per-repo in detail view, not in Settings. |
| 6   | `projectTemplatesDir`       | `string`                   | `""`                          | **Yes**  | Text input in Settings (Scaffolding tab).        |
| 7   | `scaffoldRecipes`           | `ScaffoldRecipe[]`         | `[]`                          | Indirect | Managed via ScaffoldDialog, not in Settings.     |
| 8   | `hiddenDefaultRecipes`      | `string[]`                 | `[]`                          | Indirect | Managed via ScaffoldDialog.                      |
| 9   | `setupTemplateDir`          | `string`                   | `""`                          | **Yes**  | Text input in Settings (Scaffolding tab).        |
| 10  | `codeSearchEnabled`         | `boolean`                  | `true`                        | **Yes**  | Switch in Settings (Code Search tab).            |
| 11  | `codeSearchExcludePatterns` | `string[]`                 | 5 patterns                    | **Yes**  | Tag list in Settings (Code Search tab).          |
| 12  | `codeSearchMaxFileSize`     | `number`                   | `1048576` (1MB)               | **Yes**  | Number input in Settings (Code Search tab).      |
| 13  | `theme`                     | `'default' \| 'palenight'` | `'palenight'`                 | **Yes**  | Toggle buttons in Settings (General tab).        |
| 14  | `colorOverrides`            | `Record<string, string>`   | `{}` (theme defaults)         | **Yes**  | Per-role color pickers in Settings (General).    |
| 15  | `uiFontSize`                | `number`                   | `14`                          | **Yes**  | Slider (12–18px) in Settings (General tab).      |
| 16  | `protectedBranches`         | `string[]`                 | `['main','master','develop']` | **Yes**  | Tag list in Settings (Repositories tab).         |
| 17  | `repoScanDepth`             | `number`                   | `5`                           | **Yes**  | Number input in Settings (Repositories tab).     |
| 18  | `defaultShell`              | `string`                   | `''` (env fallback)           | **Yes**  | Text input in Settings (Terminals tab).          |
| 19  | `githubPRCooldown`          | `number`                   | `120` (seconds)               | **Yes**  | Number input in Settings (GitHub tab).           |

### Settings UI Summary (SettingsView.tsx)

19 config keys across 7 tabs: General (theme, accent color, font size), Repositories (scan dir, ignore patterns, scan depth, protected branches), Code Search (enabled, exclude patterns, max file size), GitHub (PR cooldown), Terminals (default shell), Ports (scan interval), Scaffolding (templates dir, setup template dir).

---

## Issues Found

### ~~Bug: portScanInterval Not Applied After Change~~ — FIXED

~~**Severity: Medium**~~

PortService now has `updateInterval()` method. The config handler calls it when `portScanInterval` changes.

### ~~Bug: autoStartMonitoring Has No UI and No Effect~~ — FIXED

~~**Severity: Low**~~

Dead config key removed from `AppConfig` and `DEFAULT_CONFIG` entirely. Port monitoring always starts.

### Issue: Duplicated AppConfig Type

**Severity: Low**
**Location:** `src/main/types/config.types.ts` and `src/renderer/src/types/index.ts:166-181`

The `AppConfig` interface is duplicated across main and renderer. Adding a new config key requires updating both files. Should use a shared types path or auto-generate.

### Issue: No Config Change Propagation to Main Services

**Severity: Low**
**Location:** `src/main/ipc/config.handler.ts`

When config is updated via IPC, no event is emitted to notify main-process services. Most services re-read config lazily per-operation (which works), but the PortService bug above is a direct consequence of this gap.

---

## Missing Settings — Recommended Additions

### Priority 1: High-Value, Easy to Add

These settings control user-visible behavior and have obvious sensible defaults.

| Setting             | Current Hardcoded Value         | Where Used             | Status       | Rationale                                                                                         |
| ------------------- | ------------------------------- | ---------------------- | ------------ | ------------------------------------------------------------------------------------------------- |
| `protectedBranches` | `['main', 'master', 'develop']` | `GitBranchService.ts`  | **DONE**     | Users may have other branches they never want deleted (e.g., `release`, `staging`, `production`). |
| `githubPRCooldown`  | `120000` (2 min)                | `GitHubService.ts`     | **DONE**     | Power users may want faster refresh; rate-limited users may want slower.                          |
| `maxLogFileSize`    | `100000` (100KB)                | `LogService.ts:5`      | Not yet done | Users with verbose output may want larger logs.                                                   |
| `repoScanDepth`     | `5`                             | `RepositoryService.ts` | **DONE**     | Users with deeply nested project structures may need more depth.                                  |

### Priority 2: Power-User Tuning

These provide value for advanced users who want to tune performance or behavior.

| Setting                   | Current Hardcoded Value                                       | Where Used                              | Rationale                                                        |
| ------------------------- | ------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| `gitCommandTimeout`       | `3000-5000` ms                                                | `RepositoryService`, `GitBranchService` | Slow disks or large repos may need longer timeouts.              |
| `ghCliTimeout`            | `5000-10000` ms                                               | `GitHubService.ts` (6+ locations)       | Network-dependent; users on slow connections need higher values. |
| `healthCheckTimeout`      | `30000` ms                                                    | `DependencyHealthService.ts:94,164`     | Large monorepos may need more time for audit/outdated.           |
| `healthThresholds`        | critical>=1\|\|high>=5 (red), high>=1\|\|outdated>=5 (yellow) | `DependencyHealthService.ts:195-196`    | Different teams have different risk tolerances.                  |
| `codeSearchBatchSize`     | `10`                                                          | `CodeSearchService.ts:23`               | Tuning for indexing speed vs memory on different machines.       |
| `codeSearchMinSimilarity` | `0.2`                                                         | `CodeSearchService.ts:246`              | Users may want stricter or looser fuzzy matching.                |
| `packageCacheTTL`         | `3600000` (1hr)                                               | `PackageIntelligenceService.ts:9`       | Frequent searchers may want shorter cache.                       |

### Priority 3: Nice to Have

Lower priority but would improve completeness.

| Setting                             | Current Hardcoded Value             | Where Used                                | Rationale                                        |
| ----------------------------------- | ----------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| `ptyBufferDebounce`                 | `50` ms                             | `ProcessService.ts` (4 locations)         | Terminal responsiveness tuning.                  |
| `defaultShell`                      | `process.env.SHELL \|\| '/bin/zsh'` | `ProcessService.ts:50,196,303`            | Let user override shell for PTY.                 |
| `ptyDefaultCols` / `ptyDefaultRows` | `120` / `30`                        | `ProcessService.ts`, `ScaffoldService.ts` | Terminal dimension preference.                   |
| `trendingStarsThreshold`            | `50`                                | `GitHubService.ts:273`                    | Control what counts as "trending".               |
| `trendingResultsLimit`              | `25`                                | `GitHubService.ts:280`                    | Number of trending repos to fetch.               |
| `githubPRLimit`                     | `10`                                | `GitHubService.ts:144`                    | Max PRs per repo.                                |
| `cloneTimeout`                      | `30000` ms                          | `PackageCloneService.ts:12`               | Slow networks may need more time.                |
| `agentSessionCleanupDelay`          | `1800000` (30 min)                  | `AgentService.ts:17`                      | How long to keep completed agent sessions.       |
| `agentToolResultMaxDisplay`         | `2000` chars                        | `AgentService.ts:16`                      | Truncation limit for tool results in agent chat. |

---

## Settings That Should NOT Be Added

These are correctly hardcoded and would create confusion or risk if configurable.

| Value                           | Location                  | Why Keep Hardcoded                                |
| ------------------------------- | ------------------------- | ------------------------------------------------- |
| PATH augmentation paths         | `index.ts:7`              | macOS-specific, fixed locations.                  |
| Repository ID hash length (12)  | `RepositoryService.ts:84` | Changing would break existing data.               |
| Chunk size limits in CodeParser | `CodeParser.ts`           | Implementation details of the embedding pipeline. |
| electron-store names            | All stores                | Internal identifiers.                             |
| `version` config key            | `config.types.ts:4`       | Schema migration marker, not user-facing.         |

---

## Separate Electron Stores

3 stores exist. These are internal and do not need settings, but are documented for completeness.

| Store Name          | Service             | Data                                       |
| ------------------- | ------------------- | ------------------------------------------ |
| `config`            | ConfigService       | User settings (`AppConfig`)                |
| `code-search-files` | CodeSearchService   | File indexing state (hash, mtime per file) |
| `package-clones`    | PackageCloneService | Cloned package metadata (path, timestamp)  |

---

## Recommended Action Plan

### Immediate Fixes — COMPLETED

1. ~~**Fix portScanInterval bug**~~ — PortService `updateInterval()` method, config handler propagation
2. ~~**Resolve autoStartMonitoring**~~ — Removed dead config key entirely
3. ~~**Add `protectedBranches` setting**~~ — Config + Settings UI tag list + GitBranchService integration

### Short-Term Additions — COMPLETED

4. ~~Add `githubPRCooldown` to Settings~~ — Number input (seconds) in GitHub tab
5. Add `maxLogFileSize` to Settings (number input, KB) — **NOT YET DONE**
6. ~~Add `repoScanDepth` to Settings~~ — Number input in Repositories tab
7. ~~Group GitHub-related settings into a "GitHub" tab~~ — Settings redesigned with 7 tabs

### Additional Completed Items

- Added `colorOverrides` with per-role color pickers for accent, background, surface, sidebar, border, text (General tab)
- Added `uiFontSize` with slider 12–18px (General tab)
- Added `defaultShell` text input (Terminals tab)
- Redesigned Settings UI into 7-tab layout with flat rows and tag lists

### Medium-Term (Remaining)

8. Add a "Performance" or "Advanced" section for timeout/threshold tuning
9. Fix the duplicated `AppConfig` type (shared types package or single source of truth)
10. Add config change event propagation from config handler to main-process services

---

## Settings UI Organization — IMPLEMENTED

7-tab layout with custom sidebar navigation, flat row layout, and tag lists:

| Tab              | Settings                                                           |
| ---------------- | ------------------------------------------------------------------ |
| **General**      | Theme toggle, Accent color (swatches + picker), Font size (slider) |
| **Repositories** | Scan Directory, Ignore Patterns, Scan Depth, Protected Branches    |
| **Code Search**  | Enabled (switch), Exclude Patterns, Max File Size                  |
| **GitHub**       | PR Cooldown (seconds)                                              |
| **Terminals**    | Default Shell                                                      |
| **Ports**        | Scan Interval (seconds)                                            |
| **Scaffolding**  | Templates Dir, Setup Template Dir                                  |

### Future tabs to consider

| Tab          | Settings                                          |
| ------------ | ------------------------------------------------- |
| **Logging**  | Max Log File Size                                 |
| **Advanced** | Git Timeout, GH CLI Timeout, Health Check Timeout |
