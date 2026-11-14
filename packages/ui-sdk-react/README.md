# @brett_lamy/ui-sdk-react

The BL fork of [`@ui-sdk/react`](https://ui-sdk.dev), built from [BLamy/ui-sdk](https://github.com/BLamy/ui-sdk).
It is upstream UI SDK plus the one thing `@brett_lamy/ui` cannot build from its public API: layer hosts
(an element with `data-layer-host` keeps the popups rendered inside it out of the top layer, placed against its
box and modal to it alone), `active` on `bindLayer`, and two exported kernel types. Each is written to be
proposed upstream.

Install it under upstream's name, so imports read like the UI SDK docs:

```bash
npm install @ui-sdk/react@npm:@brett_lamy/ui-sdk-react
```

Licensed under Apache-2.0, like upstream. Files changed from upstream say so at the top.
