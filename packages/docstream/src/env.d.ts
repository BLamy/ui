declare module "*.css" {
  const href: string
  export default href
}

// @strudel/web ships no types; src/strudel/engine.ts types the slice it uses.
declare module "@strudel/web"
