# Settings Audit

**Date:** 2026-02-11
**Scope:** Full comparison of current settings vs. recommended settings across all features

---

## Executive Summary

RepoHub has **14 config keys** in `AppConfig` but only **8 are exposed in the Settings UI**. Across 14+ services there are **60+ hardcoded values** (timeouts, limits, thresholds, intervals) that have no configuration path at all. Several existing settings have bugs or gaps in how they're applied. This audit catalogs everything and recommends what should change.

---

## Current Settings

### AppConfig Keys (14 total)

| #   | Key                         | Type                       | Default             | Has UI?  | Notes                                            |
| --- | --------------------------- | -------------------------- | ------------------- | -------- | ------------------------------------------------ |
| 1   | `version`                   | `number`                   | `1`                 | No       | Internal schema version. No UI needed.           |
| 2   | `scanDirectory`             | `string`                   | `~/Documents/Repos` | **Yes**  | Text input in Settings.                          |
| 3   | `ignorePatterns`            | `string[]`                 | 3 patterns          | **Yes**  | Tag list with add/remove.                        |
| 4   | `portScanInterval`          | `number`                   | `5000` ms           | **Yes**  | Number input (seconds).                          |
| 5   | `commandOverrides`          | `Record<string, string>`   | `{}`                | Indirect | Edited per-repo in detail view, not in Settings. |
| 6   | `autoStartMonitoring`       | `boolean`                  | `true`              | **No**   | No UI toggle exists.                             |
| 7   | `projectTemplatesDir`       | `string`                   | `""`                | **Yes**  | Text input in Settings.                          |
| 8   | `scaffoldRecipes`           | `ScaffoldRecipe[]`         | `[]`                | Indirect | Managed via ScaffoldDialog, not in Settings.     |
| 9   | `hiddenDefaultRecipes`      | `string[]`                 | `[]`                | Indirect | Managed via ScaffoldDialog.                      |
| 10  | `setupTemplateDir`          | `string`                   | `""`                | **Yes**  | Text input in Settings.                          |
| 11  | `codeSearchEnabled`         | `boolean`                  | `true`              | **Yes**  | Checkbox in Settings.                            |
| 12  | `codeSearchExcludePatterns` | `string[]`                 | 41 patterns         | **Yes**  | Tag list with add/remove.                        |
| 13  | `codeSearchMaxFileSize`     | `number`                   | `1048576` (1MB)     | **Yes**  | Number input (KB).                               |
| 14  | `theme`                     | `'default' \| 'palenight'` | `'palenight'`       | **Yes**  | Toggle buttons.                                  |

### Settings UI Summary (SettingsView.tsx)

8 settings across 6 cards: Theme, Scan Directory, Ignore Patterns, Project Templates Dir, Setup Template Dir, Code Search (3 settings), Port Scan Interval.

---

## Issues Found

### Bug: portScanInterval Not Applied After Change

**Severity: Medium**
**Location:** `src/main/index.ts:35`

The `PortService` receives `portScanInterval` as a constructor argument at app startup:

```typescript
const portService = new PortService(processService, configService.get().portScanInterval);
```

Changing this value in Settings has **no effect** until the app is restarted. The PortService should either re-read config or listen for config change events.

### Bug: autoStartMonitoring Has No UI and No Effect

**Severity: Low**
**Location:** `src/main/types/config.types.ts:9`

The `autoStartMonitoring` config key exists and defaults to `true`, but:

- No UI toggle in Settings
- No code path checks this value — port monitoring always starts
- Dead config key that should either get a UI toggle + implementation, or be removed

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

| Setting             | Current Hardcoded Value         | Where Used                | Rationale                                                                                         |
| ------------------- | ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `protectedBranches` | `['main', 'master', 'develop']` | `GitBranchService.ts:7`   | Users may have other branches they never want deleted (e.g., `release`, `staging`, `production`). |
| `githubPRCooldown`  | `120000` (2 min)                | `GitHubService.ts:17`     | Power users may want faster refresh; rate-limited users may want slower.                          |
| `maxLogFileSize`    | `100000` (100KB)                | `LogService.ts:5`         | Users with verbose output may want larger logs.                                                   |
| `repoScanDepth`     | `5`                             | `RepositoryService.ts:61` | Users with deeply nested project structures may need more depth.                                  |

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

### Immediate Fixes

1. **Fix portScanInterval bug** — Make PortService re-read config or accept updates via method call
2. **Resolve autoStartMonitoring** — Either add a UI toggle + implementation, or remove the dead config key
3. **Add `protectedBranches` setting** — Most impactful missing setting; add to config + Settings UI with tag list

### Short-Term Additions (Settings UI)

4. Add `githubPRCooldown` to Settings (number input, seconds)
5. Add `maxLogFileSize` to Settings (number input, KB)
6. Add `repoScanDepth` to Settings (number input)
7. Group GitHub-related settings into a "GitHub" card in Settings

### Medium-Term

8. Add a "Performance" or "Advanced" section in Settings for timeout/threshold tuning
9. Fix the duplicated `AppConfig` type (shared types package or single source of truth)
10. Add config change event propagation from config handler to main-process services

---

## Settings UI Organization (Proposed)

Current layout is a flat list of cards. Proposed grouping:

| Section             | Settings                                                        |
| ------------------- | --------------------------------------------------------------- |
| **Appearance**      | Theme                                                           |
| **Repositories**    | Scan Directory, Ignore Patterns, Scan Depth, Protected Branches |
| **Terminals**       | (Default Shell — future)                                        |
| **Code Search**     | Enabled, Exclude Patterns, Max File Size, Min Similarity        |
| **GitHub**          | PR Cooldown, PR Limit                                           |
| **Port Monitoring** | Scan Interval, Auto Start                                       |
| **Scaffolding**     | Templates Dir, Setup Template Dir                               |
| **Logging**         | Max Log File Size                                               |
| **Advanced**        | Git Timeout, GH CLI Timeout, Health Check Timeout               |
