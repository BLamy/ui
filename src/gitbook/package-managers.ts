import type { CommandNode, PackageManager } from "./ast"

/** Display order of the command box's manager tabs. The first is the default choice. */
export const PACKAGE_MANAGERS: readonly PackageManager[] = ["pnpm", "npm", "yarn", "bun"]

type Others = Exclude<PackageManager, "npm">

const INSTALL = new Set(["install", "i", "add"])
const UNINSTALL = new Set(["uninstall", "un", "remove", "rm", "r"])
const LIFECYCLE = new Set(["test", "start", "stop", "restart"])

/** npm install flags → per-manager flags. Unknown flags pass through unchanged. */
const FLAGS: Record<string, Record<Others, string | null>> = {
  "-D": { pnpm: "-D", yarn: "-D", bun: "-d" },
  "--save-dev": { pnpm: "-D", yarn: "-D", bun: "-d" },
  "-E": { pnpm: "-E", yarn: "-E", bun: "--exact" },
  "--save-exact": { pnpm: "-E", yarn: "-E", bun: "--exact" },
  "-O": { pnpm: "-O", yarn: "-O", bun: "--optional" },
  "--save-optional": { pnpm: "-O", yarn: "-O", bun: "--optional" },
  "-P": { pnpm: "-P", yarn: null, bun: null },
  "--save-prod": { pnpm: "-P", yarn: null, bun: null },
  "-S": { pnpm: null, yarn: null, bun: null },
  "--save": { pnpm: null, yarn: null, bun: null },
}

function flags(args: string[], pm: Others): string[] {
  return args.flatMap((arg) => {
    const mapped = FLAGS[arg]
    if (!mapped) return [arg]
    const next = mapped[pm]
    return next ? [next] : []
  })
}

const join = (...parts: (string | string[])[]) => parts.flat().filter(Boolean).join(" ")

/** One npm / npx invocation (already split into words) for another manager, or null if it isn't one. */
function convertWords(words: string[], pm: Others): string | null {
  const [head, sub, ...rest] = words
  if (head === "npx") {
    const args = words.slice(1).filter((w) => w !== "-y" && w !== "--yes")
    return join(pm === "bun" ? "bunx" : `${pm} dlx`, args)
  }
  if (head !== "npm" || sub === undefined) return head === "npm" ? pm : null
  if (sub === "exec" || sub === "x") {
    const args = rest[0] === "--" ? rest.slice(1) : rest
    return join(pm === "bun" ? "bunx" : `${pm} dlx`, args.filter((w) => w !== "-y" && w !== "--yes"))
  }
  if (INSTALL.has(sub)) {
    const global = rest.some((w) => w === "-g" || w === "--global")
    const args = rest.filter((w) => w !== "-g" && w !== "--global")
    const packages = args.filter((w) => !w.startsWith("-"))
    if (!packages.length && !global) return join(`${pm} install`, flags(args, pm))
    if (global) return join(pm === "yarn" ? "yarn global add" : `${pm} add -g`, flags(args, pm))
    return join(`${pm} add`, flags(args, pm))
  }
  if (sub === "ci") return `${pm} install --frozen-lockfile`
  if (UNINSTALL.has(sub)) {
    const global = rest.some((w) => w === "-g" || w === "--global")
    const args = rest.filter((w) => w !== "-g" && w !== "--global")
    return join(global ? (pm === "yarn" ? "yarn global remove" : `${pm} remove -g`) : `${pm} remove`, flags(args, pm))
  }
  if (sub === "run" || sub === "run-script") {
    const [script, ...args] = rest
    const tail = args[0] === "--" && pm !== "bun" ? args.slice(1) : args
    return join(pm === "bun" ? "bun run" : pm, script ?? "", tail)
  }
  if (LIFECYCLE.has(sub)) return join(pm === "bun" ? "bun run" : pm, sub, rest[0] === "--" && pm !== "bun" ? rest.slice(1) : rest)
  if (sub === "create" || (sub === "init" && rest.length && !rest[0].startsWith("-"))) return join(`${pm} create`, rest)
  if (sub === "update" || sub === "up" || sub === "upgrade") return join(pm === "yarn" ? "yarn upgrade" : `${pm} update`, rest)
  return join(pm, sub, rest)
}

/** One line (possibly `a && b`) for another manager. Lines that aren't npm/npx commands are kept. */
function convertLine(line: string, pm: Others): string {
  const indent = line.match(/^\s*/)![0]
  return indent + line.trim().split(/\s+&&\s+/).map((segment) => {
    const prompt = segment.match(/^\$\s+/)?.[0] ?? ""
    const words = segment.slice(prompt.length).split(/\s+/).filter(Boolean)
    const converted = words.length ? convertWords(words, pm) : null
    return converted === null ? segment : prompt + converted
  }).join(" && ")
}

/**
 * The pnpm / yarn / bun forms of an npm / npx command:
 * `npm install x` → `pnpm add x`, `yarn add x`, `bun add x` (with `-D`, `-E`, `-g`, …);
 * `npx x` → `pnpm dlx x`, `yarn dlx x`, `bunx x`; `npm run s` → `pnpm s`, `yarn s`, `bun run s`;
 * `npm create x` → `<pm> create x`. Other lines (comments, `cd`, …) are kept as they are.
 * `overrides` replace a manager's derived command verbatim.
 */
export function packageManagerCommands(
  npmCommand: string,
  overrides: CommandNode["overrides"] = {},
): Record<PackageManager, string> {
  const derive = (pm: Others) => overrides[pm] ?? npmCommand.split("\n").map((line) => convertLine(line, pm)).join("\n")
  return { npm: npmCommand, pnpm: derive("pnpm"), yarn: derive("yarn"), bun: derive("bun") }
}
