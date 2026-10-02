const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** "0 B", "840 B", "1.5 KB", "12 MB". Binary units (1 KB = 1024 B); an invalid size gives ''. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const text = unit === 0 || value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
  return `${text} ${UNITS[unit]}`;
}
