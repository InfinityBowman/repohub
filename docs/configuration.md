# Configuration

All settings are persisted to `~/Library/Application Support/repohub/config.json` via electron-store.

## Settings UI

Accessible via the Settings tab in the sidebar.

## Options

| Setting                     | Default                                                                        | Description                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `scanDirectory`             | `~/Documents/Repos`                                                            | Root directory to recursively scan for projects                                                                       |
| `ignorePatterns`            | `**/node_modules`, `**/.git`, `**/ThirdParty/**`                               | Glob patterns for directories to skip during scan                                                                     |
| `portScanInterval`          | `5000` (5 seconds)                                                             | How often to poll for open localhost ports, in milliseconds                                                           |
| `commandOverrides`          | `{}`                                                                           | Per-repo custom run commands, keyed by repository ID                                                                  |
| `projectTemplatesDir`       | `''`                                                                           | Path to directory where each subdirectory is a project template for "New Project"                                     |
| `scaffoldRecipes`           | `[]`                                                                           | User-added custom scaffold recipes                                                                                    |
| `hiddenDefaultRecipes`      | `[]`                                                                           | IDs of default scaffold recipes the user has removed                                                                  |
| `setupTemplateDir`          | `''`                                                                           | Path to directory containing config files (eslint, prettier, etc.) to copy into new projects after recipe scaffolding |
| `codeSearchEnabled`         | `true`                                                                         | Whether to enable code search file watching and indexing                                                              |
| `codeSearchExcludePatterns` | `**/node_modules/**`, `**/.git/**`, `**/dist/**`, `**/build/**`, `**/*.min.js` | Glob patterns to exclude from code search indexing                                                                    |
| `codeSearchMaxFileSize`     | `1048576` (1MB)                                                                | Maximum file size in bytes for code search indexing                                                                   |
| `theme`                     | `'palenight'`                                                                  | UI theme: `'default'` or `'palenight'`                                                                               |
| `protectedBranches`         | `['main', 'master', 'develop']`                                                | Branch names that can never be deleted via branch cleanup                                                             |

## Scan Directory

RepoHub recursively scans this directory up to 5 levels deep, looking for project marker files (`package.json`, `Cargo.toml`, etc.). When a project is found, recursion stops for that branch (nested projects within a project are not scanned).

Change this in Settings and click Save. A rescan runs automatically when the directory changes.

## Ignore Patterns

Glob patterns that match directory names or relative paths. Common patterns:

- `**/node_modules` -- skip all node_modules directories
- `**/.git` -- skip .git directories
- `**/ThirdParty/**` -- skip anything under ThirdParty folders

Add or remove patterns in Settings. Changes take effect on the next scan.

## Command Overrides

Each repository has an auto-detected default command (e.g., `pnpm dev`). You can override this per-repo:

1. Click a repository card to open the detail view
2. In the Process section, click the pencil icon next to the command
3. Type your custom command
4. Press Enter or click the checkmark

To reset to the default, clear the field and save. Overrides are stored by repository ID (MD5 hash of the full path).

## Config File Location

The raw config file is at:

```
~/Library/Application Support/repohub/config.json
```

You can edit this directly, but changes won't take effect until the app is restarted.
