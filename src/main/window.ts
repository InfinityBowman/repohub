import { BrowserWindow, nativeImage, screen } from 'electron';
import { join } from 'path';

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

export function createOverlayWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const { y: workAreaY } = display.workArea;
  const overlayWidth = 300;
  const inset = 8;

  const overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: height - inset * 2,
    x: width - overlayWidth - inset,
    y: workAreaY + inset,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '?mode=overlay');
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { mode: 'overlay' },
    });
  }

  return overlayWindow;
}

import { readFileSync } from 'fs';
import { shell } from 'electron';

const THUMB_SIZE = 160;
const THUMB_MARGIN = 16;
const THUMB_DISMISS_MS = 5000;

let activeThumbWindow: BrowserWindow | null = null;

export function showScreenshotThumbnail(filePath: string): void {
  if (activeThumbWindow && !activeThumbWindow.isDestroyed()) {
    activeThumbWindow.destroy();
  }

  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const { y: workAreaY } = display.workArea;

  const imgData = readFileSync(filePath).toString('base64');
  const dataUrl = `data:image/png;base64,${imgData}`;

  const win = new BrowserWindow({
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    x: width - THUMB_SIZE - THUMB_MARGIN,
    y: workAreaY + height - THUMB_SIZE - THUMB_MARGIN,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: join(__dirname, '../preload/index.js'),
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.showInactive();

  const escapedPath = filePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: transparent; overflow: hidden; }
  .thumb {
    width: ${THUMB_SIZE}px;
    height: ${THUMB_SIZE}px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: slideIn 0.3s ease-out;
    cursor: pointer;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }
  @keyframes slideIn {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; transform: scale(0.9); }
  }
  .dismissing { animation: fadeOut 0.3s ease-in forwards; }
</style></head><body>
  <div class="thumb" id="thumb">
    <img src="${dataUrl}" />
  </div>
  <script>
    const thumb = document.getElementById('thumb');
    thumb.addEventListener('click', () => {
      window.electron.shell.openUrl('file://${escapedPath}');
    });
    thumb.addEventListener('dragstart', (e) => {
      e.preventDefault();
      window.electron.overlay.startDrag('${escapedPath}');
    });
    thumb.setAttribute('draggable', 'true');
  </script>
</body></html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  activeThumbWindow = win;

  setTimeout(() => {
    if (win.isDestroyed()) return;
    win.webContents.executeJavaScript(
      `document.getElementById('thumb').classList.add('dismissing')`,
    );
    setTimeout(() => {
      if (!win.isDestroyed()) win.destroy();
      if (activeThumbWindow === win) activeThumbWindow = null;
    }, 300);
  }, THUMB_DISMISS_MS);
}
