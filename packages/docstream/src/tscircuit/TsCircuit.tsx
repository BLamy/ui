import { useEffect, useRef, useState } from "react"
import { SplitCard, SplitResult, SplitSource } from "../docs/SplitCard"
import { TSCIRCUIT_COMPILER_WORKER_URL } from "./worker"

export const DEFAULT_TSCIRCUIT_RUNTIME_URL = "https://runframe.vercel.app/iframe.html"
export const isTsCircuitLanguage = (language?: string | null) => ["tscircuit", "ts-circuit"].includes(language?.toLowerCase() ?? "")
export interface TsCircuitProps {
  code: string
  /** A RunFrame-compatible runtime on a separate origin. */
  runtimeUrl?: string
  title?: string
}

/** RunFrame compiles and runs TSX in its own cross-origin frame and worker. */
export function TsCircuitPreview({ code, runtimeUrl = DEFAULT_TSCIRCUIT_RUNTIME_URL, title = "tscircuit schematic, PCB and 3D preview" }: TsCircuitProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const latestCode = useRef(code)
  latestCode.current = code
  const ready = useRef(false)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [dark, setDark] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  let origin = ""
  try {
    const url = new URL(runtimeUrl)
    if (["https:", "http:"].includes(url.protocol)) origin = url.origin
  } catch { /* An invalid runtime produces an inline error. */ }
  useEffect(() => {
    const element = host.current
    if (!element) return
    const update = () => {
      const theme = element.parentElement?.closest('[data-theme], [data-appearance], .dark, .light')
      setDark(theme ? theme.matches('.dark, [data-theme="dark"], [data-appearance="dark"]') : getComputedStyle(element).colorScheme === "dark")
    }
    update()
    const observer = new MutationObserver(update)
    for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) observer.observe(parent, { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-appearance"] })
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", update)
    return () => { observer.disconnect(); media.removeEventListener("change", update) }
  }, [])
  useEffect(() => {
    ready.current = false
    setStatus("loading")
    setError("")
    if (!origin || origin === window.location.origin) { setError("The tscircuit runtime must use a separate HTTP(S) origin."); setStatus("error"); return }
    const send = () => frame.current?.contentWindow?.postMessage({ runframe_type: "runframe_props_changed", runframe_props: {
      evalVersion: "0.0.1675", evalWebWorkerBlobUrl: TSCIRCUIT_COMPILER_WORKER_URL,
      fsMap: { "main.tsx": latestCode.current }, entrypoint: "main.tsx", defaultActiveTab: "schematic", availableTabs: ["schematic", "pcb", "cad"], showCodeTab: false, showToggleFullScreen: false,
    } }, origin)
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin || !event.data || typeof event.data !== "object") return
      if (event.data.runframe_type === "runframe_ready_to_receive") { ready.current = true; setStatus("ready"); setError(""); send() }
      if ((event.data.runframe_type === "runframe_event" || event.data.type === "runframe_event") && event.data.runframe_event?.type === "error") {
        setError(String(event.data.runframe_event.error_message ?? "Unable to render circuit."))
      }
    }
    window.addEventListener("message", receive)
    const timer = window.setTimeout(() => { if (!ready.current) { setStatus("error"); setError("The circuit runtime did not load. Check your connection and retry.") } }, 30000)
    return () => { window.removeEventListener("message", receive); window.clearTimeout(timer) }
  }, [origin, runtimeUrl, attempt])
  useEffect(() => {
    if (!ready.current || !origin) return
    setError("")
    frame.current?.contentWindow?.postMessage({ runframe_type: "runframe_props_changed", runframe_props: { fsMap: { "main.tsx": code } } }, origin)
  }, [code, origin])
  return <SplitResult label="tscircuit">
    <div ref={host} className="docs-tscircuit-result" data-theme={dark ? "dark" : "light"}>
      {status === "loading" ? <p role="status" className="docs-tscircuit-status">Loading circuit preview…</p> : null}
      {error ? <div className="docs-tscircuit-status"><pre className="docs-mermaid-error" role="alert">{error}</pre><button type="button" className="docs-split-action" onClick={() => setAttempt((n) => n + 1)}>Retry circuit preview</button></div> : null}
      {origin && (typeof window === "undefined" || origin !== window.location.origin) ? <iframe key={`${runtimeUrl}:${attempt}`} ref={frame} src={runtimeUrl} title={title} sandbox="allow-scripts allow-same-origin" loading="eager" referrerPolicy="no-referrer" className="docs-tscircuit-frame" onError={() => { setStatus("error"); setError("Unable to load the circuit runtime.") }} /> : null}
    </div>
  </SplitResult>
}

export function TsCircuit({ code, ...options }: TsCircuitProps) {
  return <SplitCard className="docs-tscircuit-preview" data-docstream-tscircuit="">
    <SplitSource label="tscircuit" code={code} language="tsx" />
    <TsCircuitPreview code={code} {...options} />
  </SplitCard>
}
