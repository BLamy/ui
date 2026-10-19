const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeTheme,
  screen,
  session,
  shell,
} = require('electron');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { createFolderAccess } = require('./folder-access.cjs');

const NAME = 'Worktree Atlas';
const BLOCK = 'blocks/worktree-atlas';
const DEMO = `https://blamy.github.io/ui/?demo=${BLOCK}`;
const ORIGIN = new URL(DEMO).origin;
const DESKTOP_CSS = readFileSync(path.join(__dirname, 'desktop.css'), 'utf8');
const permissions = new Set([
  'clipboard-sanitized-write',
  'persistent-storage',
  'fullscreen',
]);

app.setName(NAME);
app.setPath('userData', path.join(app.getPath('appData'), NAME));
const statePath = path.join(app.getPath('userData'), 'window.json');
let window;

function isDemo(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === ORIGIN &&
      parsed.pathname === '/ui/' &&
      parsed.searchParams.get('demo') === BLOCK
    );
  } catch {
    return false;
  }
}

function isOrigin(url) {
  try {
    return new URL(url).origin === ORIGIN;
  } catch {
    return false;
  }
}

function openInBrowser(url) {
  try {
    if (['https:', 'http:'].includes(new URL(url).protocol)) {
      void shell.openExternal(url).catch(console.error);
    }
  } catch {
    /* Ignore malformed links. */
  }
}

function restoreWindow() {
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    const { x, y, width, height } = state.bounds;
    if (
      ![x, y, width, height].every(Number.isFinite) ||
      width < 900 ||
      height < 560
    )
      return {};
    const visible = screen
      .getAllDisplays()
      .some(
        ({ workArea: area }) =>
          x + width > area.x + 80 &&
          x < area.x + area.width - 80 &&
          y >= area.y &&
          y < area.y + area.height - 80,
      );
    return visible
      ? state
      : { bounds: { width, height }, maximized: state.maximized };
  } catch {
    return {};
  }
}

async function loadDemo(target) {
  try {
    await target.loadURL(DEMO);
  } catch (error) {
    if (target.isDestroyed()) return;
    target.show();
    const { response } = await dialog.showMessageBox(target, {
      type: 'warning',
      title: NAME,
      message: 'Unable to reach Worktree Atlas',
      detail:
        'Worktree Atlas loads the hosted block. Check your internet connection and try again. Your folders and repositories stay on this Mac.',
      buttons: ['Try Again', 'Open in Browser', 'Close'],
      defaultId: 0,
      cancelId: 2,
    });
    if (target.isDestroyed()) return;
    if (response === 0) void loadDemo(target);
    else if (response === 1) openInBrowser(DEMO);
    console.error('Demo load failed:', error.message);
  }
}

/** Presses a visible, enabled button in the page, as a user gesture (the folder picker needs one). */
function press(label) {
  showWindow();
  if (!isDemo(window.webContents.getURL())) return;
  void window.webContents
    .executeJavaScript(
      `Array.from(document.querySelectorAll('button[aria-label=${JSON.stringify(label)}]')).find(b => b.checkVisibility() && !b.disabled && !b.closest("[inert]"))?.click()`,
      true,
    )
    .catch(console.error);
}

function createWindow() {
  const state = restoreWindow();
  const target = new BrowserWindow({
    width: 1320,
    height: 860,
    ...state.bounds,
    minWidth: 900,
    minHeight: 560,
    title: NAME,
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 19 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#ffffff',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      navigateOnDragDrop: false,
    },
  });
  window = target;
  target.setWindowButtonVisibility(true);
  target.setSheetOffset(52);
  target.webContents.on('dom-ready', () => {
    if (isDemo(target.webContents.getURL())) {
      void target.webContents.insertCSS(DESKTOP_CSS).catch(console.error);
    }
  });
  target.once('ready-to-show', () => {
    if (state.maximized) target.maximize();
    target.show();
  });
  target.on('page-title-updated', (event) => {
    event.preventDefault();
    target.setTitle(NAME);
  });
  target.on('close', () => {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(
      statePath,
      JSON.stringify({
        bounds: target.getNormalBounds(),
        maximized: target.isMaximized(),
      }),
    );
    target.webContents.session.flushStorageData();
  });
  target.on('closed', () => {
    window = undefined;
  });
  target.webContents.on('will-navigate', (event, url) => {
    if (!isDemo(url)) {
      event.preventDefault();
      openInBrowser(url);
    }
  });
  target.webContents.on('will-redirect', (event, url) => {
    if (!isDemo(url)) event.preventDefault();
  });
  target.webContents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url);
    return { action: 'deny' };
  });
  target.webContents.on('will-attach-webview', (event) =>
    event.preventDefault(),
  );
  target.webContents.on('render-process-gone', () => {
    if (!target.isDestroyed()) void loadDemo(target);
  });
  void loadDemo(target);
  return target;
}

function showWindow() {
  const target = window ?? createWindow();
  if (target.isMinimized()) target.restore();
  target.show();
  target.focus();
}

const writes = (details) => details.fileAccessType === 'writable';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    const folderAccess = createFolderAccess(
      path.join(app.getPath('userData'), 'folder-permissions.json'),
      async (filePath, directory, write) => {
        const target = window;
        if (!target || target.isDestroyed()) return false;
        const name = path.basename(filePath);
        const { response } = await dialog.showMessageBox(target, {
          type: write ? 'warning' : 'question',
          title: NAME,
          message: write
            ? `Allow Worktree Atlas to delete worktrees in “${name}”?`
            : `Allow Worktree Atlas to read “${name}”?`,
          detail: write
            ? `Worktree Atlas only deletes the worktrees you confirm, and keeps ones with uncommitted changes unless you choose otherwise.\n\n${filePath}`
            : `Worktree Atlas will look for Git repositories and worktrees ${directory ? 'in this folder and its subfolders' : 'in this file'}, and read their files and history. Nothing is uploaded.\n\n${filePath}`,
          buttons: ["Don't Allow", write ? 'Allow Deleting' : 'Allow Access'],
          defaultId: 1,
          cancelId: 0,
        });
        return response === 1;
      },
    );
    session.defaultSession.setPermissionCheckHandler(
      (contents, permission, origin, details) => {
        const requestingUrl =
          origin || details.requestingUrl || contents?.getURL();
        if (
          !isOrigin(requestingUrl) ||
          (contents && !isDemo(contents.getURL()))
        )
          return false;
        if (permission === 'fileSystem')
          return folderAccess.isGranted(details.filePath, writes(details));
        return permissions.has(permission);
      },
    );
    session.defaultSession.setPermissionRequestHandler(
      (contents, permission, callback, details) => {
        const requestingUrl = details.requestingUrl || contents?.getURL();
        if (
          !isOrigin(requestingUrl) ||
          !contents ||
          !isDemo(contents.getURL())
        ) {
          callback(false);
          return;
        }
        if (permission === 'fileSystem') {
          void folderAccess
            .request(details.filePath, details.isDirectory, writes(details))
            .then(callback, (error) => {
              console.error('Folder permission failed:', error);
              callback(false);
            });
        } else callback(permissions.has(permission));
      },
    );
    // Electron has no Chrome permission bubble. Explain a blocked system folder
    // (your whole home folder, for one) instead of silently cancelling the picker.
    session.defaultSession.on(
      'file-system-access-restricted',
      async (_event, details, callback) => {
        if (!isOrigin(details.origin) || !window || window.isDestroyed()) {
          callback('deny');
          return;
        }
        try {
          const { response } = await dialog.showMessageBox(window, {
            type: 'info',
            title: NAME,
            message: 'Choose a more specific folder',
            detail: `macOS or Chromium protects this location:\n\n${details.path}\n\nChoose the folder your projects live in (like ~/Code), or a folder your agents keep worktrees in (like ~/.codex).`,
            buttons: ['Choose Another Folder', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
          });
          callback(response === 0 ? 'tryAgain' : 'deny');
        } catch {
          callback('deny');
        }
      },
    );
    app.setAboutPanelOptions({
      applicationName: NAME,
      applicationVersion: app.getVersion(),
      copyright: 'Every Git worktree on this Mac, by BL UI',
      iconPath: path.join(__dirname, 'assets', 'icon.png'),
    });
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: 'appMenu' },
        {
          label: 'File',
          submenu: [
            {
              label: 'Open Folder…',
              accelerator: 'CommandOrControl+O',
              click: () => press('Add folder'),
            },
            {
              label: 'Scan Again',
              accelerator: 'CommandOrControl+R',
              click: () => press('Scan again'),
            },
            { type: 'separator' },
            { role: 'close' },
          ],
        },
        { role: 'editMenu' },
        {
          label: 'View',
          submenu: [
            { role: 'forceReload', label: 'Reload Page' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
          ],
        },
        { role: 'windowMenu' },
        {
          role: 'help',
          submenu: [
            { label: 'Open in Browser', click: () => openInBrowser(DEMO) },
          ],
        },
      ]),
    );
    createWindow();
    app.on('activate', showWindow);
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', () => {
    session.defaultSession?.flushStorageData();
  });
}
