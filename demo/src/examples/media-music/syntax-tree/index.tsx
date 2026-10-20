import { useMemo, useState } from "react"
import { StepGrid, mixCode, parseStrudel, setMethod, setMiniAtom, formatNumber, type StrudelSong } from "@brett_lamy/docstream/strudel"
import { TreeView } from "./TreeView"

const START = `setcps(0.5)
drums: s("bd*2 [~ bd] ~ bd, ~ sd")
bass: note("<c2 a1 f1 g1>*2").s("sawtooth").lpf(700)`

// parseStrudel turns the code into a song: tempo, tracks, method chains and every mini-notation
// string, each with source ranges. The edit helpers rewrite only the characters a node covers.
export default function SyntaxTree() {
  const [code, setCode] = useState(START)
  const [solo, setSolo] = useState<number | null>(null)
  const parsed = useMemo((): { song: StrudelSong } | { error: string } => {
    try {
      return { song: parseStrudel(code) }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }, [code])

  return (
    <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
      <textarea
        value={code}
        onChange={(e) => setCode(e.currentTarget.value)}
        spellCheck={false}
        rows={4}
        style={{ font: "12px/1.5 ui-monospace, monospace", padding: 10, borderRadius: 8, border: "1px solid color-mix(in oklab, currentColor 20%, transparent)", background: "transparent", color: "inherit" }}
      />
      {"error" in parsed ? (
        <div role="alert" style={{ color: "#dc2626" }}>{parsed.error}</div>
      ) : (
        <>
          <div>
            tempo <b>{parsed.song.tempo ? `${formatNumber(parsed.song.tempo.cps)} cps (${parsed.song.tempo.unit})` : "default"}</b> · layout{" "}
            <b>{parsed.song.layout}</b> · {parsed.song.tracks.length} tracks · {parsed.song.minis.length} mini-notation strings
          </div>
          {parsed.song.tracks.map((track) => {
            const head = track.chain.head
            const mini = "args" in head ? head.args.find((a) => a.kind === "mini") : undefined
            return (
              <section key={track.index} style={{ display: "grid", gap: 6, padding: 10, borderRadius: 10, border: "1px solid color-mix(in oklab, currentColor 14%, transparent)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <b>{track.label ?? `track ${track.index}`}</b>
                  <span style={{ opacity: 0.7 }}>
                    {track.kind} · {track.sound ?? "no sound"} · {head.name}(…){track.chain.methods.map((m) => `.${m.name}`).join("")}
                  </span>
                  <button type="button" style={btn} onClick={() => setCode(setMethod(code, track.chain, "room", formatNumber(0.6)))}>
                    setMethod room .6
                  </button>
                  <button type="button" style={btn} aria-pressed={solo === track.index} onClick={() => setSolo(solo === track.index ? null : track.index)}>
                    solo (mixCode)
                  </button>
                </div>
                {mini?.kind === "mini" && mini.mini && (
                  <StepGrid mini={mini.mini} label={`${track.label ?? "track"} steps`} onAtomChange={(atom, text) => setCode(setMiniAtom(code, mini, atom, text))} />
                )}
                {mini?.kind === "mini" && mini.mini && (
                  <details>
                    <summary style={{ cursor: "pointer" }}>Mini-notation tree for "{mini.source}"</summary>
                    <TreeView node={mini.mini} source={mini.source} />
                  </details>
                )}
              </section>
            )
          })}
          {solo !== null && (
            <pre style={{ margin: 0, padding: 10, borderRadius: 8, background: "color-mix(in oklab, currentColor 6%, transparent)", whiteSpace: "pre-wrap" }}>
              {"// mixCode(song, { solo: new Set([" + solo + "]) })\n" + mixCode(parsed.song, { solo: new Set([solo]) })}
            </pre>
          )}
        </>
      )}
    </div>
  )
}

const btn = {
  font: "inherit",
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 6,
  border: "1px solid color-mix(in oklab, currentColor 22%, transparent)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
}
