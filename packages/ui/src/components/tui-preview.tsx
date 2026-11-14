'use client';

/* TuiPreview lives in Docstream, which owns the sandbox and the OpenTUI runtime protocol, so documentation, registry
   installs and chat responses run on one implementation. This module carries the component and the types of its props
   and status. The default runtime URL and the `tui` fence test are Docstream's: `@brett_lamy/docstream/tui`. */
export { TuiPreview } from '@brett_lamy/docstream/tui';
export type { TuiPreviewProps, TuiPreviewOptions, TuiPreviewState, TuiTheme } from '@brett_lamy/docstream/tui';
