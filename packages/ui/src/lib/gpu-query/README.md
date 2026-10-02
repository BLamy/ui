# gpu-query (vendored runtime)

The browser runtime of **gpu-query** by Safzan Pirani, copied from
<https://github.com/safzanpirani/gpu-query> (`site/src/runtime/`) at commit
`41739a28ecc930ad9c550ec347c602dd6a3308cc` (2026-09-12). MIT licensed: see `LICENSE`, and the attribution
header on every source file. `weights.json` is byte-for-byte upstream's (sha256 `8a4711d1…c9d77`).

gpu-query is "a feasibility spike. Nothing is published to npm." It is a 29,597-parameter neural tagger that turns a
phrase into filter clauses (`{ field, cmp, value, neg }`) against a schema, on the CPU or, for batches of 32 or more,
WebGPU. The model never sees field names: the schema enters through the featurizer and a fuzzy matcher. Its author's
98.9% is on his own generated corpus, not on real phrasing. BL UI uses it for `FilterInput` (`lib/filter-query.ts`).

## What changed from upstream

- **Lazy weights.** `weights.json` is loaded by dynamic `import()` on first use (`loadModel()`), so an app that never
  parses a phrase never downloads the ~40 KB. `parse` is therefore async; `parseWith(model, text, schema)` is the
  synchronous core. The model, the CPU `forward` and the WebGPU backend take the decoded weights as an argument
  instead of reading module state. The label set and feature layout are asserted against the blob when it loads.
- **Dropped fragments.** `compile` also returns the clause fragments it dropped (`dropped`) and the token range each
  clause came from (`spans`), so a UI can say what was not understood.
- **Optional segmentation.** `parseWith(…, { segment: true })` also starts a clause where the model's own boundary
  score is positive, and at a field token that names a different field once the clause has a value, for phrases with
  no "and" between parts. Off by default; with it on the checkpoint's own 20 parity phrases still compile identically.
- **Local WebGPU types.** `webgpu.ts` declares the slice of the API it uses and the flag constants, so it compiles
  without `@webgpu/types` and works in a copied-in project.
- **Removed:** the per-stage traces `forward` returned for the explainer film, and the demo's `PARAMETERS` /
  `TRANSFER_EXACT_AST` exports (still on the model object). `parity.json` is not shipped; a trimmed copy of its
  phrases is the vendored smoke test's fixture (`lib/gpu-query.test.ts`).

`schema.ts`, `featurize.ts` and `kernel.wgsl.ts` are unchanged apart from the header.

## Limits worth knowing

AND and OR are both clause separators, so everything is effectively ANDed. Clauses that cannot form a legal clause are
silently dropped (by upstream; here they are reported). Values are raw strings: dates and numbers are not normalised
(`lib/filter-query.ts` does that). The WebGPU path caps a query at 24 tokens.
