# Embedded Browser Preview

**Category**: Quick Win
**Effort**: Medium
**Payoff**: See your running app without switching to Chrome. Preview + terminal + API docs in one window.
demo is located in `_reference/`

## The Problem

You start a dev server in RepoHub. It opens on localhost:3000. You Cmd+Tab to Chrome, navigate to localhost:3000 (or it auto-opens a new tab). Now you're juggling RepoHub, VS Code, Chrome, and maybe Claude Code terminal. Every change means looking at Chrome, then back to your code.

For a dev cockpit, the browser is the one missing piece. You can manage processes, see ports, run agents — but you can't see your actual running app.

## The Feature

### Web Preview — Inline Browser Panel

In the repo detail view, when a process is running and has an open port, a browser preview panel appears:

```
┌─────────────────────────────────────────────────────────────────┐
│ ◀ my-web-app  ● Running :3000  [DevTools] [Open External] [Stop]│
│─────────────────────────────────────────────────────────────────│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ← → ↻  localhost:3000          [Desktop|Tablet|Mobile] [↗] │ │
│ │─────────────────────────────────────────────────────────────│ │
│ │                                                             │ │
│ │              Your actual running web app                    │ │
│ │              rendered in an Electron webview                │ │
│ │                                                             │ │
│ │                                                             │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ $ pnpm dev                                                  │ │
│ │ > VITE v5.4.0 ready in 312ms                               │ │
│ │ > Local: http://localhost:3000/                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

**Auto-Detection**

- When a process starts and a port appears (via PortService), the preview auto-loads that URL
- Configurable per repo: which port to preview, or disable auto-preview
- Falls back to first detected port if no config

**Responsive Preview**

- Toggle between viewport sizes: Desktop, Tablet, Mobile
- Custom dimensions input
- Or drag to resize freely
- Shows current dimensions in the toolbar

**DevTools**

- Uses Electron's real DevTools — the webview exposes `webContents.openDevTools()`
- "DevTools" button in the toolbar opens/closes the real Chrome DevTools panel
- No need to build a fake console/network/elements panel — the real thing is right there
- DevTools can be docked to the bottom or opened in a separate window

**Hot Reload Awareness**

- The webview auto-refreshes when the dev server pushes an update (Vite HMR just works)
- Manual refresh button for when it doesn't

**Split View Options**

- Preview + Terminal (vertical split, default)
- Preview only (full width)
- Terminal only (current behavior)

### API Reference — Scalar Integration

For non-web projects (APIs, CLIs), instead of building a custom API client, we embed [Scalar](https://github.com/scalar/scalar) — an open-source, full-featured OpenAPI reference UI with a built-in request client.

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚡ API Reference  ● my-api :3001  [OpenAPI spec detected]  [↗]  │
│──────────────────────────────────────────────────────────────────│
│                                                                  │
│ ┌──────────┬─────────────────────────────────────────────────┐   │
│ │ Search   │  GET /api/users                                 │   │
│ │          │  List all users                                 │   │
│ │ Auth     │                                                 │   │
│ │  POST /l │  Parameters                                     │   │
│ │  GET  /m │  ┌─────────────┬──────────┬─────────────────┐   │   │
│ │          │  │ Name        │ Type     │ Description     │   │   │
│ │ Users    │  │ limit       │ integer  │ Max results     │   │   │
│ │  GET  /u │  │ offset      │ integer  │ Pagination      │   │   │
│ │  POST /u │  └─────────────┴──────────┴─────────────────┘   │   │
│ │  GET  /u │                                                 │   │
│ │  PUT  /u │  Try It                                         │   │
│ │  DEL  /u │  ┌─────────────────────────────────────────┐    │   │
│ │          │  │ GET http://localhost:3001/api/users      │    │   │
│ │ Posts    │  │                                [Send →]  │    │   │
│ │  GET  /p │  └─────────────────────────────────────────┘    │   │
│ │  POST /p │                                                 │   │
│ │          │  Response  200 OK  18ms                          │   │
│ │ Health   │  ┌─────────────────────────────────────────┐    │   │
│ │  GET  /h │  │ [{ "id": 1, "name": "Alice" }, ...]    │    │   │
│ └──────────┴──┴─────────────────────────────────────────┘    │   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Why Scalar instead of a custom client:**

- Full-featured OpenAPI reference with "Try It" request builder already built
- Schema visualization, authentication configuration, code examples in multiple languages
- Themeable with CSS variables — we match it to RepoHub's palenight palette
- Maintained open-source project, not something we need to build and maintain
- React component: `@scalar/api-reference-react`

**What we get for free from Scalar:**

- Endpoint list with method badges and grouping by tag
- Request builder with parameter forms, body editor, auth headers
- Response viewer with syntax highlighting
- Schema/model documentation
- Code generation (curl, JS, Python, etc.)
- Request history

**OpenAPI Spec Detection:**
The feature scans the repo for OpenAPI specs in common locations:

- `openapi.json`, `openapi.yaml`, `openapi.yml`
- `swagger.json`, `swagger.yaml`
- `docs/openapi.*`, `api/openapi.*`
- Or a configured path per repo
- Also checks if the running server serves a spec at well-known paths: `/openapi.json`, `/api-docs`, `/swagger.json`, `/docs`

## Technical Approach

### Web Preview: Electron WebView

Electron provides `<webview>` tag for embedding web content with full DevTools access:

```typescript
// In renderer - using webview tag
<webview
  ref={webviewRef}
  src={`http://localhost:${port}`}
  style={{ width: viewportWidth, height: '100%' }}
  webpreferences="contextIsolation=yes"
/>

// Open real DevTools
webviewRef.current.openDevTools()

// Navigation controls
webviewRef.current.goBack()
webviewRef.current.goForward()
webviewRef.current.reload()
```

The `<webview>` tag gives us real browser behavior: navigation events, DevTools access, reload API, URL tracking. HMR/hot reload works automatically since the webview is a real Chromium instance.

### API Reference: Scalar Embed

```typescript
import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'

function ApiReference({ specUrl }: { specUrl: string }) {
  return (
    <ApiReferenceReact
      configuration={{
        url: specUrl,
        theme: 'none',        // disable default theme
        darkMode: true,        // force dark mode
        withDefaultFonts: false,
        hiddenClients: true,   // optional: simplify UI
      }}
    />
  )
}
```

Custom palenight theming via CSS variables:

```css
.scalar-api-reference {
  --scalar-background-1: #292d3e;
  --scalar-background-2: #1a1c2e;
  --scalar-background-3: #333747;
  --scalar-color-1: #d0d4f0;
  --scalar-color-2: #a6accd;
  --scalar-color-3: #7982b4;
  --scalar-color-accent: #82aaff;
  --scalar-border-color: #4e5579;
  --scalar-font: 'Inter', sans-serif;
  --scalar-font-code: 'JetBrains Mono', monospace;
}
```

### Auto-Detection Logic

```typescript
// When a port appears for a managed process, check what it serves
async function detectPreviewMode(port: number, repoPath: string): Promise<'web' | 'api' | null> {
  // 1. Check if an OpenAPI spec file exists in the repo
  const specPath = await findOpenApiSpec(repoPath);
  if (specPath) return 'api';

  // 2. Check if the server serves HTML or JSON
  try {
    const response = await fetch(`http://localhost:${port}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000),
    });
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) return 'web';
    if (contentType.includes('application/json')) return 'api';
  } catch {
    return null;
  }
  return null;
}

// Scan repo for OpenAPI spec files
async function findOpenApiSpec(repoPath: string): Promise<string | null> {
  const candidates = [
    'openapi.json',
    'openapi.yaml',
    'openapi.yml',
    'swagger.json',
    'swagger.yaml',
    'swagger.yml',
    'docs/openapi.json',
    'docs/openapi.yaml',
    'api/openapi.json',
    'api/openapi.yaml',
  ];
  for (const candidate of candidates) {
    const fullPath = path.join(repoPath, candidate);
    if (await fs.pathExists(fullPath)) return fullPath;
  }
  return null;
}
```

### Per-Repo Config

Add to ConfigService:

```typescript
interface RepoPreviewConfig {
  enabled: boolean; // default: true
  port?: number; // override auto-detection
  path?: string; // e.g., "/dashboard" instead of "/"
  mode: 'web' | 'api' | 'auto';
  defaultViewport: 'desktop' | 'tablet' | 'mobile';
  openApiSpecPath?: string; // override spec detection, e.g., "docs/api.yaml"
}
```

### Renderer Components

- `BrowserPreview` — Webview wrapper with toolbar (URL bar, refresh, viewport selector, DevTools toggle)
- `ViewportSelector` — Desktop/tablet/mobile toggle with dimensions display
- `ApiReference` — Scalar `ApiReferenceReact` wrapper with palenight theme and spec detection
- `PreviewLayout` — Split view manager (preview + terminal)

### IPC Channels

- `preview:detect-mode` — Check if a port serves web content or if repo has OpenAPI spec
- `preview:find-spec` — Scan repo for OpenAPI spec files
- Config channels already exist for per-repo settings

## Wow Moment

You start your web app from RepoHub. The terminal shows "ready on :3000". Above the terminal, a browser preview appears showing your actual app. You make a change in VS Code — Vite HMR fires — the preview updates instantly. You toggle to mobile view to check responsive layout. You click "DevTools" and the real Chrome DevTools open right there. You never opened Chrome.

For your API, you start the server and RepoHub detects your `openapi.yaml`. A full Scalar API reference appears — your endpoints grouped by tag, schemas documented, "Try It" buttons ready to go. You click "GET /api/users", hit Send, see the response. It's the full Scalar experience, themed to match RepoHub, auto-connected to your running server.

## Scope

- **Phase 1**: Basic webview preview with auto-detection, URL bar, refresh, viewport toggle, "Open External" escape hatch, DevTools button
- **Phase 2**: Split view layouts (preview + terminal), per-repo preview config, viewport presets
- **Phase 3**: OpenAPI spec detection + embedded Scalar API reference with palenight theming
- **Phase 4**: Runtime spec detection (hit `/api-docs` etc.), per-repo spec path config, request history persistence
