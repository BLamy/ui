# @brett_lamy/ui-sdk-react

The BL fork of [`@ui-sdk/react`](https://ui-sdk.dev), built from [BLamy/ui-sdk](https://github.com/BLamy/ui-sdk).
It is upstream UI SDK plus the one thing `@brett_lamy/ui` cannot build from its public API: layer hosts
(an element with `data-layer-host` keeps the popups rendered inside it out of the top layer, placed against its
box and modal to it alone), a `when` option on `bindLayer`, and the kernel type `SlotProps` exported from
`@ui-sdk/core/renderer`. Each is written to be
proposed upstream.

This package is private to the BLamy/ui workspace and is not on npm. `@brett_lamy/ui` ships its output inside
its own dist, so an app gets it with the library and imports it as `@brett_lamy/ui/sdk/react/<part>`:
wherever UI SDK's docs say `@ui-sdk/…`, write `@brett_lamy/ui/sdk/…`.

Licensed under Apache-2.0, like upstream. Files changed from upstream say so at the top.
