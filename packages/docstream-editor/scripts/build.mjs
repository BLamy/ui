// Compile src/ to per-file ESM in dist/ (tsc: .js + .d.ts + maps), then make the output
// consumable by any ESM loader: fully-specified relative imports (`./x` → `./x.js` or
// `./x/index.js`, which Node and webpack require for "type": "module" packages) and the
// CSS files copied next to the modules that import them. Dependencies are never bundled;
// dynamic `import()` stays dynamic so lazy features (mermaid, KaTeX, rrweb) stay lazy.
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const src = join(root, "src")
const dist = join(root, "dist")

rmSync(dist, { recursive: true, force: true })
const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc")
execFileSync(process.execPath, [tsc, "-p", join(root, "tsconfig.build.json")], { stdio: "inherit" })

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

for (const file of walk(src)) {
  if (file.endsWith(".css") && !file.includes("__fixtures__")) cpSync(file, join(dist, relative(src, file)))
}

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']*)\2/g
function specify(file, spec) {
  if (/\.(m?js|css|json)$/.test(spec)) return spec
  const base = resolve(dirname(file), spec)
  if (existsSync(`${base}.js`)) return `${spec}.js`
  if (existsSync(join(base, "index.js"))) return `${spec.replace(/\/$/, "")}/index.js`
  throw new Error(`${relative(root, file)}: cannot resolve ${spec}`)
}
for (const file of walk(dist)) {
  if (!/\.(js|d\.ts)$/.test(file)) continue
  const text = readFileSync(file, "utf8")
  let next = text.replace(SPECIFIER, (_, head, quote, spec) => `${head}${quote}${specify(file, spec)}${quote}`)
  // Stylesheet side-effect imports are runtime-only; keep declarations free of them so a
  // consumer's type-check never needs a `*.css` module declaration.
  // (Blanked rather than removed, so the declaration maps stay line-aligned.)
  if (file.endsWith(".d.ts")) next = next.replace(/^import\s*["'][^"']+\.css["'];?$/gm, "")
  if (next !== text) writeFileSync(file, next)
}
