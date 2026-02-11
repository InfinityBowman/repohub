# Package Intelligence

**Category**: Quick Win
**Effort**: Medium
**Payoff**: Stop leaving RepoHub to google npm packages. Research, compare, and understand dependencies without opening a browser.
demo is located in `_reference/`

## The Problem

You're working on a project and need a library. Or you see an unfamiliar dependency in a `package.json`. Or you want to check if a package is worth using before adding it. Right now, that means:

1. Open browser
2. Go to npmjs.com or bundlephobia.com or github.com
3. Search for the package
4. Check bundle size, downloads, last publish, license
5. Maybe read the README
6. Maybe check the source code structure
7. Come back to your project

This happens multiple times a day. It's not individually painful, but it's a constant paper-cut of context switching.

You also mentioned wanting to "have an AI summarize a repo's structure" and "clone a repo so AI can check it out." That's the same itch — understanding external code without leaving your workflow.

## The Feature

### Package Explorer

A new view (or panel within repo detail) for exploring npm packages:

```
┌──────────────────────────────────────────────────────────────┐
│ Package Intelligence                                         │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search packages...                                   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ sharp                                          v0.33.2  │ │
│ │ High performance Node.js image processing               │ │
│ │                                                          │ │
│ │ Size: 3.8 MB (1.2 MB dl)  ·  Weekly: 4.2M  ·  Apache   │ │
│ │ Last publish: 12 days ago  ·  TS: built-in              │ │
│ │                                                          │ │
│ │ Used in: my-api, image-tool           [View on GitHub]  │ │
│ │                                                          │ │
│ │ [README]  [Source Tree]  [AI Summary]  [Versions]       │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ sharp vs jimp vs squoosh                    [Compare]   │ │
│ │                                                          │ │
│ │           sharp       jimp        @aspect/squoosh       │ │
│ │ Unpacked  3.8 MB      1.2 MB      2.4 MB               │ │
│ │ Download  1.2 MB      384 KB      512 KB               │ │
│ │ Files     47          86          24                    │ │
│ │ Weekly    4.2M        1.1M        89K                   │ │
│ │ Types     built-in    built-in    built-in              │ │
│ │ Native    yes (C++)   no (pure)   no (wasm)             │ │
│ │ Last pub  12d ago     3mo ago     8mo ago               │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Key Features

**Quick Stats**

- Package size (unpacked on disk, compressed download, file count) from npm registry `dist` metadata
- Weekly downloads via npm registry API
- Last publish date, TypeScript support, license
- Which of YOUR repos use this package (cross-referenced from your lockfiles)

**README Preview**

- Fetch and render the package's README right in the panel
- Syntax-highlighted code examples
- No need to visit npmjs.com

**Source Tree**

- Browse the package's published files (via unpkg or the npm tarball)
- Click to read source files with syntax highlighting
- Understand how a library works without cloning it

**AI Summary**

- One-click AI analysis of a package
- "This is an image processing library built on libvips. Key exports: `sharp()` for creating pipelines, `.resize()`, `.format()`, `.toBuffer()`. It uses native C++ bindings via node-addon-api, which means it needs a compile step on install but is 10x faster than pure-JS alternatives."
- Powered by Claude — reads the README + key source files and explains

**Package Comparison**

- Select 2-3 packages → side-by-side comparison table
- Stats, size, activity, ecosystem compatibility
- AI-generated comparison summary: "sharp is fastest but requires native deps. jimp is pure JS but slower. squoosh is smallest but less maintained."

### GitHub Repo Intelligence

Beyond npm packages, point at any GitHub repo URL and get:

```
┌──────────────────────────────────────────────────────────────┐
│ Repo: github.com/drizzle-team/drizzle-orm                   │
│                                                              │
│ ⭐ 24.3K  ·  Forks: 612  ·  Issues: 423  ·  License: MIT  │
│ Last commit: 2 days ago  ·  Contributors: 187               │
│                                                              │
│ [README]  [Source Tree]  [AI Summary]  [Clone & Explore]    │
└──────────────────────────────────────────────────────────────┘
```

**"Clone & Explore"**: Clones the repo to a temp directory and launches a Researcher agent (from Agent Command Center) to analyze it. The agent reads the code and reports back with a structured summary: architecture, key patterns, how it works. Much better than skimming a README.

### Integration Points

**From Repo Detail View**: Click any dependency in the package.json preview → opens Package Intelligence for that package.

**From Cmd+K**: "package sharp" or "npm sharp" → opens Package Intelligence.

**From Agent Sessions**: When an agent recommends a library, it could link to Package Intelligence for you to evaluate.

## Technical Approach

### Data Sources

| Data             | Source                    | API                                                                                             |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| Package metadata | npm registry              | `https://registry.npmjs.org/{package}`                                                          |
| Package size     | npm registry              | `dist.unpackedSize`, `dist.fileCount` from packument; tarball `Content-Length` via HEAD request |
| Downloads        | npm API                   | `https://api.npmjs.org/downloads/point/last-week/{package}`                                     |
| README           | npm registry              | Included in package metadata                                                                    |
| Source files     | unpkg                     | `https://unpkg.com/{package}@{version}/`                                                        |
| GitHub stats     | GitHub API (gh)           | `gh api repos/{owner}/{repo}`                                                                   |
| AI summary       | Claude API or Claude Code | Analysis of README + source                                                                     |

### Caching

- Package metadata cached for 1 hour
- Package size included in metadata (no separate cache needed — comes with packument)
- Source tree cached for the specific version (immutable)
- AI summaries cached permanently until package version changes

Cache location: `~/Library/Application Support/repohub/package-cache/`

### New Service: `PackageIntelligenceService`

```typescript
class PackageIntelligenceService extends EventEmitter {
  searchPackages(query: string): Promise<PackageSearchResult[]>;
  getPackageInfo(name: string): Promise<PackageInfo>;
  getPackageSize(name: string, version?: string): Promise<PackageSize>; // unpacked, download, fileCount from registry
  getReadme(name: string, version?: string): Promise<string>;
  getSourceTree(name: string, version?: string): Promise<FileTree>;
  getSourceFile(name: string, filePath: string, version?: string): Promise<string>;
  comparePackages(names: string[]): Promise<PackageComparison>;
  getAISummary(name: string): Promise<string>;

  // Cross-repo usage
  findUsageAcrossRepos(packageName: string): Promise<RepoUsage[]>;

  // GitHub repo intelligence
  getGitHubRepoInfo(url: string): Promise<GitHubRepoInfo>;
  cloneAndExplore(url: string): Promise<string>; // returns agentId
}
```

### IPC Channels

- `package:search`, `package:info`, `package:size`
- `package:readme`, `package:source-tree`, `package:source-file`
- `package:compare`, `package:ai-summary`
- `package:find-usage`
- `package:github-info`, `package:clone-explore`

### Renderer Components

- `PackageExplorer` — Main view/panel with search + results
- `PackageCard` — Stats overview for a single package
- `PackageReadme` — Rendered markdown README
- `PackageSourceBrowser` — File tree + source viewer
- `PackageComparison` — Side-by-side table
- `AISummaryPanel` — AI-generated package explanation
- `GitHubRepoCard` — GitHub repo stats + actions

## Wow Moment

You're reading your project's package.json in the detail view. You see `hono` as a dependency and think "wait, what version am I on? Is there a new one?" You click it. Package Intelligence opens: you're on 4.0.8, latest is 4.1.2, bundle is 19KB, 500K weekly downloads, published 3 days ago. You click "AI Summary" and in 5 seconds get a breakdown of Hono's architecture and key APIs. You never opened a browser.

Later, someone mentions `effect-ts` on Twitter. You Cmd+K → "package effect". Read the README, check the bundle size (too big?), hit "AI Summary" to understand what it actually does. All without leaving RepoHub.

## Scope

- **Phase 1**: Package search + stats (npm registry + bundlephobia APIs), README preview, "used in your repos" cross-reference
- **Phase 2**: Source tree browser, AI summary, Cmd+K integration
- **Phase 3**: Package comparison, GitHub repo intelligence, "Clone & Explore" with agent handoff
