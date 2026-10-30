'use client';

// Docstream owns the sandbox and the OpenTUI runtime protocol. Keep documentation,
// registry installs and chat responses on the same implementation.
export {
  TuiPreview, TuiEmbed, DEFAULT_TUI_RUNTIME_URL, isTuiCodeBlock,
} from '@brett_lamy/docstream/tui';
export type {
  TuiPreviewProps, TuiPreviewOptions, TuiPreviewState, TuiTheme,
} from '@brett_lamy/docstream/tui';
