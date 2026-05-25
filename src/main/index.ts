import path from 'path';
import os from 'os';
import { app, BrowserWindow, ipcMain, globalShortcut, protocol, net } from 'electron';
import { createMainWindow, createOverlayWindow } from './window';

// macOS packaged apps inherit a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin).
// Augment with common tool directories so gh, git, pnpm, npm, node etc. are found.
// Uses only static paths to avoid blocking the main thread at startup.
const extraPaths = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin'];
const currentPath = process.env.PATH || '';
const currentParts = new Set(currentPath.split(':'));
const newParts = extraPaths.filter(p => !currentParts.has(p));
if (newParts.length > 0) {
  process.env.PATH = [...newParts, currentPath].join(':');
}

import { registerAllHandlers } from './ipc';
import { ConfigService } from './services/ConfigService';
import { RepositoryService } from './services/RepositoryService';
import { ProcessService } from './services/ProcessService';
import { PortService } from './services/PortService';
import { LogService } from './services/LogService';
import { DependencyHealthService } from './services/DependencyHealthService';
import { GitHubService } from './services/GitHubService';
import { GitBranchService } from './services/GitBranchService';
import { ScaffoldService } from './services/ScaffoldService';
import { CodeSearchService } from './services/CodeSearchService';
import { PackageIntelligenceService } from './services/PackageIntelligenceService';
import { PackageCloneService } from './services/PackageCloneService';
import { AgentService } from './services/AgentService';
import { ClaudeSessionReader } from './services/ClaudeSessionReader';
import { SkillsService } from './services/SkillsService';
import { SystemMonitorService } from './services/SystemMonitorService';
import { ScreenshotWatcherService } from './services/ScreenshotWatcherService';
import { RecentCommitsService } from './services/RecentCommitsService';
import { registerOverlayHandlers } from './ipc/overlay.handler';

const BUILD_ID: string = __BUILD_ID__;

// Initialize services
const configService = new ConfigService();
const repositoryService = new RepositoryService(configService);
const processService = new ProcessService(repositoryService, configService);
const portService = new PortService(processService, configService.get().portScanInterval);
const logService = new LogService();
const healthService = new DependencyHealthService(repositoryService);
const githubService = new GitHubService(repositoryService, configService);
const gitBranchService = new GitBranchService(configService);
const scaffoldService = new ScaffoldService(configService);
const codeSearchService = new CodeSearchService(configService, repositoryService);
const packageService = new PackageIntelligenceService();
const packageCloneService = new PackageCloneService();
const agentService = new AgentService();
const claudeSessionReader = new ClaudeSessionReader();
const skillsService = new SkillsService();
const systemMonitor = new SystemMonitorService(2000);
const screenshotWatcher = new ScreenshotWatcherService();
const recentCommits = new RecentCommitsService(repositoryService);

// Single instance lock (Signal pattern)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.whenReady().then(() => {
  // Register custom protocol for serving local screenshot files
  protocol.handle('safe-file', request => {
    const url = new URL(request.url);
    const filePath = path.resolve(decodeURIComponent(url.pathname));
    const allowed = [
      screenshotWatcher.getStorageDir(),
    ];
    if (!allowed.some(dir => filePath.startsWith(dir + path.sep))) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(`file://${filePath}`);
  });

  // Register IPC handlers
  registerAllHandlers({
    repositoryService,
    processService,
    portService,
    configService,
    healthService,
    githubService,
    gitBranchService,
    scaffoldService,
    codeSearchService,
    packageService,
    packageCloneService,
    agentService,
    claudeSessionReader,
    skillsService,
  });

  // Create windows
  const mainWindow = createMainWindow();
  const overlayWindow = createOverlayWindow();

  // Register overlay IPC handlers
  registerOverlayHandlers(
    systemMonitor,
    screenshotWatcher,
    recentCommits,
    () => mainWindow,
    () => overlayWindow,
  );

  // Push system snapshots to all windows
  systemMonitor.on('snapshot', snapshot => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('overlay:system-snapshot', snapshot);
    }
  });

  // Push screenshot events to all windows
  screenshotWatcher.on('screenshot', info => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('overlay:screenshot', info);
    }
  });

  // Global hotkey: Option+Space toggles overlay
  globalShortcut.register('Alt+Space', () => {
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.showInactive();
    }
  });

  // Intercept Cmd+Shift+4 to capture screenshots instantly
  globalShortcut.register('CommandOrControl+Shift+4', () => {
    screenshotWatcher.capture();
  });

  // Refresh git info and GitHub PRs when window regains focus
  mainWindow.on('focus', () => {
    repositoryService.refreshGitInfo().then(repos => {
      mainWindow.webContents.send('repo:changed', repos);
    });
    githubService.refreshIfNeeded();
  });

  // Persist process output to log files
  processService.on('output', (data: { repoId: string; data: string }) => {
    logService.append(data.repoId, data.data);
  });

  // IPC handlers for log persistence
  ipcMain.handle('logs:get', async (_event, repoId: string) => {
    return logService.get(repoId);
  });

  ipcMain.handle('logs:clear', async (_event, repoId: string) => {
    logService.clear(repoId);
    return { success: true };
  });

  // Build ID for version tracking
  ipcMain.handle('app:build-id', () => BUILD_ID);

  // Initial scan
  repositoryService.scan();
  repositoryService.startWatching();

  // Start port monitoring
  portService.startMonitoring();

  // Start overlay services
  systemMonitor.start();
  screenshotWatcher.start();

  // Initialize code search (watching starts automatically after first indexing completes)
  codeSearchService.initialize();

  // --- Window lifecycle (Gitify + Signal Desktop patterns) ---
  //
  // Key insight: on macOS, Cmd+Q triggers before-quit. We PREVENT the quit
  // and hide to background instead. Only app.exit() actually terminates.
  // This means windows are never destroyed during normal use.

  // Signal pattern: force window to front
  function focusAndForceToTop(win: BrowserWindow): void {
    win.setAlwaysOnTop(true);
    win.focus();
    win.setAlwaysOnTop(false);
  }

  function showMainWindow(): void {
    if (app.dock) app.dock.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (mainWindow.isVisible()) {
      focusAndForceToTop(mainWindow);
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  }

  function hideToBackground(): void {
    mainWindow.hide();
    overlayWindow.hide();
    if (app.dock) app.dock.hide();
  }

  function quitForReal(): void {
    globalShortcut.unregisterAll();
    processService.stopAll();
    portService.stopMonitoring();
    repositoryService.stopWatching();
    codeSearchService.shutdown();
    packageService.shutdown();
    agentService.shutdown();
    skillsService.shutdown();
    systemMonitor.stop();
    screenshotWatcher.stop();
    app.exit(0);
  }

  // Cmd+Q / app menu Quit: hide to background instead of quitting.
  // app.exit() in quitForReal() bypasses this handler entirely.
  app.on('before-quit', (e) => {
    e.preventDefault();
    hideToBackground();
  });

  // Close button: hide instead of destroy (Gitify pattern — preserves renderer state)
  mainWindow.on('close', (e) => {
    e.preventDefault();
    setImmediate(() => {
      if (!mainWindow.isDestroyed()) mainWindow.hide();
      if (app.dock) app.dock.hide();
    });
  });

  overlayWindow.on('close', (e) => {
    e.preventDefault();
    setImmediate(() => {
      if (!overlayWindow.isDestroyed()) overlayWindow.hide();
    });
  });

  // Signal pattern: second-instance shows existing window (Spotlight relaunch)
  app.on('second-instance', () => {
    showMainWindow();
  });

  // macOS dock click reactivation
  app.on('activate', () => {
    showMainWindow();
  });

  // Keep app alive when all windows are hidden
  app.on('window-all-closed', () => {
    // no-op: app stays alive for hotkeys and background services
  });

  // IPC for explicit quit (from menu or UI button)
  ipcMain.handle('app:quit', () => {
    quitForReal();
  });
});
