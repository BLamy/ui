'use client';

/* TuiPreview lives in Docstream, which owns the sandbox and the OpenTUI runtime protocol, so documentation, registry
   installs and chat responses run on one implementation. This module carries the component and the types of its props
   and state, from the library's own docstream entry (by the package's name: the registry doesn't copy docstream). The
   default runtime URL and the `tui` fence test are Docstream's: `@brett_lamy/ui/docstream/tui`. */
export { TuiPreview } from '@brett_lamy/ui/docstream/tui';
export type { TuiPreviewProps, TuiPreviewOptions, TuiPreviewState, TuiAppearance, TuiTheme } from '@brett_lamy/ui/docstream/tui';
