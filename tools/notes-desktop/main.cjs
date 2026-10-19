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

const NAME = 'BL Notes';
const DEMO = 'https://blamy.github.io/ui/?demo=blocks/apple-notes';
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
      parsed.searchParams.get('demo') === 'blocks/apple-notes'
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
      width < 840 ||
      height < 540
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
      message: 'Unable to reach your notes app',
      detail:
        'BL Notes loads your hosted demo. Check your internet connection and try again. Your saved notes remain on this Mac.',
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

function createWindow() {
  const state = restoreWindow();
  const target = new BrowserWindow({
    width: 1220,
    height: 820,
    ...state.bounds,
    minWidth: 840,
    minHeight: 540,
    title: NAME,
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 19 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#ffffff',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
      navigateOnDragDrop: false,
    },
  });
  window = target;
  target.setWindowButtonVisibility(true);
  target.setSheetOffset(50);
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

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    const folderAccess = createFolderAccess(
      path.join(app.getPath('userData'), 'folder-permissions.json'),
      async (filePath, directory) => {
        const target = window;
        if (!target || target.isDestroyed()) return false;
        const { response } = await dialog.showMessageBox(target, {
          type: 'question',
          title: NAME,
          message: `Allow BL Notes to read and edit “${path.basename(filePath)}”?`,
          detail: `BL Notes will be able to open and save ${directory ? 'Markdown files in this folder and its subfolders' : 'this file'}.\n\n${filePath}`,
          buttons: ["Don't Allow", 'Allow Access'],
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
          return folderAccess.isGranted(details.filePath);
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
            .request(details.filePath, details.isDirectory)
            .then(callback, (error) => {
              console.error('Folder permission failed:', error);
              callback(false);
            });
        } else callback(permissions.has(permission));
      },
    );
    // Electron has no Chrome permission bubble. Explain a blocked system folder
    // instead of silently cancelling the directory picker.
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
            message: 'Choose a more specific notes folder',
            detail: `macOS or Chromium protects this location:\n\n${details.path}\n\nChoose a subfolder containing your Markdown notes.`,
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
      copyright: 'Your personal BL UI notes app',
      iconPath: path.join(__dirname, 'assets', 'icon.png'),
    });
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: 'appMenu' },
        {
          label: 'File',
          submenu: [
            {
              label: 'New Note',
              accelerator: 'CommandOrControl+N',
              click: () => {
                showWindow();
                if (isDemo(window.webContents.getURL())) {
                  void window.webContents
                    .executeJavaScript(
                      'Array.from(document.querySelectorAll(\'button[aria-label="New note"]\')).find(button => button.checkVisibility() && !button.closest("[inert]"))?.click()',
                      true,
                    )
                    .catch(console.error);
                }
              },
            },
            { type: 'separator' },
            { role: 'close' },
          ],
        },
        { role: 'editMenu' },
        {
          label: 'View',
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
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
            { label: 'Open Demo in Browser', click: () => openInBrowser(DEMO) },
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
