import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin')
  throw new Error('Worktree Atlas is packaged for macOS.');
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(root, '../../dist/tools/worktree-atlas-desktop');
const temporary = mkdtempSync(path.join(os.tmpdir(), 'worktree-atlas-build-'));
const source = path.join(temporary, 'source');
const iconset = path.join(temporary, 'Worktree Atlas.iconset');
const icon = path.join(temporary, 'Worktree Atlas.icns');
const metadata = JSON.parse(
  readFileSync(path.join(root, 'package.json'), 'utf8'),
);

try {
  mkdirSync(path.join(source, 'assets'), { recursive: true });
  mkdirSync(iconset);
  copyFileSync(path.join(root, 'main.cjs'), path.join(source, 'main.cjs'));
  copyFileSync(
    path.join(root, 'folder-access.cjs'),
    path.join(source, 'folder-access.cjs'),
  );
  copyFileSync(
    path.join(root, 'desktop.css'),
    path.join(source, 'desktop.css'),
  );
  copyFileSync(
    path.join(root, 'assets/icon.png'),
    path.join(source, 'assets/icon.png'),
  );
  writeFileSync(
    path.join(source, 'package.json'),
    JSON.stringify(
      {
        name: 'worktree-atlas',
        version: metadata.version,
        main: 'main.cjs',
        description: metadata.description,
        author: metadata.author,
        license: metadata.license,
      },
      null,
      2,
    ),
  );
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const pixels = size * scale;
      execFileSync(
        'sips',
        [
          '-z',
          String(pixels),
          String(pixels),
          path.join(root, 'assets/icon.png'),
          '--out',
          path.join(
            iconset,
            `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`,
          ),
        ],
        { stdio: 'ignore' },
      );
    }
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icon]);
  const packages = await packager({
    dir: source,
    out: output,
    name: 'Worktree Atlas',
    executableName: 'Worktree Atlas',
    appBundleId: 'io.github.blamy.worktree-atlas',
    appCategoryType: 'public.app-category.developer-tools',
    appVersion: metadata.version,
    electronVersion: metadata.devDependencies.electron,
    platform: 'darwin',
    arch: process.arch,
    icon,
    asar: true,
    overwrite: true,
    prune: false,
    darwinDarkModeSupport: true,
    extendInfo: {
      NSHumanReadableCopyright: 'Brett Lamy',
      CFBundleDisplayName: 'Worktree Atlas',
    },
  });
  for (const location of packages) {
    const bundle = path.join(location, 'Worktree Atlas.app');
    // Ad-hoc signing is sufficient for an app built and used on this Mac.
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', bundle], {
      stdio: 'inherit',
    });
    console.log(`Built ${bundle}`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
