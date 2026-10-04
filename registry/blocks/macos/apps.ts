/* The desktop's apps: every other example block, installed as a macOS app. Each is loaded on first launch (so the
   desktop itself stays light) and opens in a window of the given size. To trim the desktop, delete an entry — and
   the block it imports from. */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Tailscale } from '@/lib/tailscale';

/** What the desktop shares with its apps: one Tailscale controller, so the menu bar and Safari are always in step.
    Null when no provider is above the desktop (an app then falls back to its own). */
export interface DesktopShared {
  tailscale: Tailscale | null;
}

export interface DesktopApp {
  id: string;
  name: string;
  /** What the app is, shown under its name in Alfred. */
  description: string;
  /** Extra words Alfred matches ("todo" finds Reminders). */
  keywords: string[];
  /** The app icon's gradient, top → bottom. */
  tile: readonly [string, string];
  /** The glyph on the app icon (an Icon name). */
  icon: string;
  /** A dark glyph, for light icons. */
  darkGlyph?: boolean;
  /** The window it opens in. */
  size: { w: number; h: number };
  /** Props for the app (Settings drops its own window dots: the window has them), or a function of what the desktop shares
      (Safari takes the desktop's Tailscale controller). */
  props?: Record<string, unknown> | ((shared: DesktopShared) => Record<string, unknown>);
  // Each app has its own props (all optional); `props` supplies the few the desktop sets.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: LazyExoticComponent<ComponentType<any>>;
}

export const APPS: DesktopApp[] = [
  {
    id: 'reminders', name: 'Reminders', description: 'Lists, smart lists and due dates', keywords: ['todo', 'tasks', 'list', 'checklist'],
    tile: ['#FFFFFF', '#E9EAEE'], icon: 'checklist', darkGlyph: true, size: { w: 780, h: 560 },
    Component: lazy(() => import('../apple-reminders/page')),
  },
  {
    id: 'mail', name: 'Mail', description: 'Mailboxes, threads and compose', keywords: ['email', 'inbox', 'message'],
    tile: ['#5AC8FA', '#0A7CFF'], icon: 'envelope-fill', size: { w: 960, h: 620 },
    Component: lazy(() => import('../apple-mail/page')),
  },
  {
    id: 'safari', name: 'Safari', description: 'Browse through your tailnet', keywords: ['browser', 'web', 'internet', 'tailnet', 'tailscale', 'vpn', 'exit node'],
    tile: ['#5AD1F5', '#0A6CF0'], icon: 'globe', size: { w: 1000, h: 680 }, props: ({ tailscale }) => ({ controller: tailscale ?? undefined }),
    Component: lazy(() => import('../safari/page')),
  },
  {
    id: 'notes', name: 'Notes', description: 'Folders and Markdown notes', keywords: ['write', 'memo', 'document'],
    tile: ['#FFE066', '#FFB800'], icon: 'note', darkGlyph: true, size: { w: 900, h: 600 },
    Component: lazy(() => import('../apple-notes/page')),
  },
  {
    id: 'music', name: 'Music', description: 'Library, radio and Now Playing', keywords: ['songs', 'player', 'itunes', 'audio'],
    tile: ['#FF6A88', '#FA233B'], icon: 'music-note', size: { w: 940, h: 620 },
    Component: lazy(() => import('../apple-music/page')),
  },
  {
    id: 'passwords', name: 'Passwords', description: 'Logins, codes and Wi-Fi', keywords: ['keychain', 'security', 'login', 'vault'],
    tile: ['#A3A8B3', '#6B7080'], icon: 'key-fill', size: { w: 920, h: 600 },
    Component: lazy(() => import('../apple-passwords/page')),
  },
  {
    id: 'timemachine', name: 'Time Machine', description: 'Watch back every session of this desktop', keywords: ['history', 'replay', 'recording', 'rrweb', 'sessions', 'backup'],
    tile: ['#63E08A', '#1E9E4A'], icon: 'clock-dial', size: { w: 960, h: 620 },
    Component: lazy(() => import('../timemachine/page')),
  },
  {
    id: 'settings', name: 'System Settings', description: 'Appearance, Wi-Fi and more', keywords: ['preferences', 'prefs', 'appearance', 'dark mode'],
    tile: ['#B8BBC4', '#7A7E8A'], icon: 'gear', size: { w: 860, h: 600 }, props: { windowControls: false },
    Component: lazy(() => import('../apple-settings/page')),
  },
  {
    id: 'maps', name: 'Maps', description: 'Ask a map about places', keywords: ['directions', 'navigation', 'places', 'chat'],
    tile: ['#7CE08A', '#2FB24C'], icon: 'mappin-fill', size: { w: 900, h: 620 },
    Component: lazy(() => import('../map-chat/page')),
  },
  {
    id: 'delivery', name: 'Delivery', description: 'Track a package on a map', keywords: ['tracking', 'package', 'order', 'shipping'],
    tile: ['#FFB547', '#F08A00'], icon: 'archivebox-fill', size: { w: 900, h: 620 },
    Component: lazy(() => import('../delivery-tracking/page')),
  },
  {
    id: 'freeform', name: 'Freeform', description: 'An infinite board for notes, shapes and drawing', keywords: ['whiteboard', 'draw', 'sketch', 'pencil', 'canvas', 'sticky', 'brainstorm'],
    tile: ['#FFFFFF', '#E6ECF5'], icon: 'pencil-tip', darkGlyph: true, size: { w: 1000, h: 660 },
    Component: lazy(() => import('../freeform/page')),
  },
  {
    id: 'github', name: 'GitHub', description: 'Repositories, issues and pull requests', keywords: ['git', 'code', 'repo', 'pr', 'issues'],
    tile: ['#3A3F47', '#161B22'], icon: 'layers', size: { w: 1000, h: 640 },
    Component: lazy(() => import('../github-clone/page')),
  },
  {
    id: 'discord', name: 'Discord', description: 'Servers, channels and threads', keywords: ['chat', 'messages', 'server', 'community'],
    tile: ['#7C86FF', '#4B55E0'], icon: 'message-fill', size: { w: 1000, h: 640 },
    Component: lazy(() => import('../discord-clone/page')),
  },
  {
    id: 'codex', name: 'Codex', description: 'An AI coding agent and its threads', keywords: ['ai', 'chat', 'agent', 'openai', 'assistant'],
    tile: ['#4B4F63', '#1E2030'], icon: 'bolt-fill', size: { w: 1000, h: 640 },
    Component: lazy(() => import('../codex-clone/page')),
  },
  {
    id: 't3', name: 'T3 Code', description: 'Threads, terminal and diffs', keywords: ['ai', 'ide', 'agent', 'code', 'terminal'],
    tile: ['#2B2B31', '#0B0B0E'], icon: 'terminal', size: { w: 1040, h: 660 },
    Component: lazy(() => import('../t3-clone/page')),
  },
  {
    id: 'loop', name: 'Loop QA', description: 'Projects, runs and bugs', keywords: ['qa', 'testing', 'bugs', 'replay', 'tests'],
    tile: ['#C58BFF', '#8E4BF2'], icon: 'check-circle-fill', size: { w: 1040, h: 660 },
    Component: lazy(() => import('../loop-qa/page')),
  },
];

export const appById = (id: string) => APPS.find((a) => a.id === id);
