import { useEffect, useId, useMemo, useRef, useState } from "react"

export const DEFAULT_TUI_RUNTIME_URL = "https://blamy.github.io/opentui/workbench/example/"

export type TuiPreviewState = "idle" | "starting" | "running" | "error" | "stopped"

export interface TuiTheme {
  mode: "light" | "dark"
  background: string
  foreground: string
}

export interface TuiPreviewOptions {
  /** A trusted OpenTUI example runtime, including its deployment base path. Relative and absolute HTTP(S) URLs are accepted. */
  runtimeUrl?: string
  title?: string
  /** Terminal height in pixels, bounded to 160–720 (default 360). */
  height?: number
  theme?: TuiTheme
  /** Time allowed for the runtime's ready handshake (default 30 seconds). */
  startupTimeoutMs?: number
  /** Time allowed for the first rendered frame after sending source (default 30 seconds). */
  renderTimeoutMs?: number
}

export interface TuiPreviewProps extends TuiPreviewOptions {
  code: string
  language?: string
  className?: string
  /** Blocks execution while an AI response is still being streamed. */
  isStreaming?: boolean
  onStatusChange?: (state: TuiPreviewState) => void
}

const DEFAULT_THEME: TuiTheme = { mode: "dark", background: "#000000", foreground: "#ededed" }

function runtimeAddress(value: string): string | null {
  if (!value.trim()) return null
  try {
    const url = new URL(value, globalThis.location?.href ?? DEFAULT_TUI_RUNTIME_URL)
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

const bounded = (value: number | undefined, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

/**
 * A terminal preview that runs only after a reader clicks Run. Source is sent to an
 * opaque-origin iframe; environment variables and host credentials are never passed.
 * Changing source or runtime destroys the previous session, including its listeners.
 */
export function TuiPreview(props: TuiPreviewProps) {
  const suppliedTheme = props.theme ?? DEFAULT_THEME
  const theme = useMemo(() => ({ ...suppliedTheme }), [suppliedTheme.mode, suppliedTheme.background, suppliedTheme.foreground])
  // Remounting ends a running program immediately when a streamed source, runtime or theme changes.
  const session = JSON.stringify([
    props.code, props.language, props.runtimeUrl, props.isStreaming,
    theme.mode, theme.background, theme.foreground, props.startupTimeoutMs, props.renderTimeoutMs,
  ])
  return <TuiSession key={session} {...props} theme={theme} />
}

function TuiSession({
  code,
  language = "typescript",
  runtimeUrl = DEFAULT_TUI_RUNTIME_URL,
  title = "OpenTUI preview",
  height,
  theme = DEFAULT_THEME,
  startupTimeoutMs,
  renderTimeoutMs,
  className,
  isStreaming = false,
  onStatusChange,
}: TuiPreviewProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const callback = useRef(onStatusChange)
  callback.current = onStatusChange
  const id = useId()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<TuiPreviewState>("idle")
  const [message, setMessage] = useState("")
  const address = runtimeAddress(runtimeUrl)
  const active = !!address && !isStreaming && (state === "starting" || state === "running")
  const displayedState = address ? state : "error"
  const terminalHeight = bounded(height, 360, 160, 720)

  useEffect(() => callback.current?.(displayedState), [displayedState])

  useEffect(() => {
    if (!active) return
    const terminal = frame.current?.contentWindow
    if (!terminal) {
      setMessage("The terminal window could not be created. Try again.")
      setState("error")
      return
    }
    const requestId = `${id}-${attempt}`
    let sent = false
    let live = true
    let timeout: ReturnType<typeof setTimeout>
    const fail = (detail: string) => {
      if (!live) return
      live = false
      clearTimeout(timeout)
      setMessage(detail)
      setState("error")
    }
    timeout = setTimeout(
      () => fail("The terminal runtime did not become ready. Check the runtime URL and try again."),
      bounded(startupTimeoutMs, 30_000, 1000, 120_000),
    )
    const receive = (event: MessageEvent) => {
      // sandbox="allow-scripts" gives the child an opaque origin. Checking its exact
      // WindowProxy is essential: unrelated opaque frames also have origin "null".
      if (!live || event.source !== terminal || event.origin !== "null") return
      const data = event.data
      if (!data || typeof data !== "object") return
      if (data.type === "opentui-example:ready" && !sent) {
        sent = true
        clearTimeout(timeout)
        setMessage("Rendering terminal…")
        timeout = setTimeout(
          () => fail("The terminal did not render in time. Try again or check the example source."),
          bounded(renderTimeoutMs, 30_000, 1000, 120_000),
        )
        try {
          // An opaque sandbox cannot be addressed with the runtime URL's origin.
          // The target window is the validated iframe and receives only this source.
          terminal.postMessage({
            type: "opentui-example:run", code,
            language: language.toLowerCase() === "tui" ? "typescript" : language,
            theme, requestId,
          }, "*")
        } catch {
          fail("The terminal runtime could not receive the example. Try again.")
        }
      } else if (sent && data.type === "opentui-example:status" && data.requestId === requestId) {
        if (data.status === "rendered") {
          clearTimeout(timeout)
          setMessage("")
          setState("running")
        } else if (data.status === "error") {
          fail(typeof data.message === "string" && data.message ? data.message.slice(0, 2000) : "The terminal could not render this example.")
        }
      }
    }
    window.addEventListener("message", receive)
    return () => {
      live = false
      clearTimeout(timeout)
      window.removeEventListener("message", receive)
    }
  }, [active, attempt, code, language, id, theme, startupTimeoutMs, renderTimeoutMs])

  const status = !address ? "The terminal runtime URL must resolve to an HTTP or HTTPS URL without credentials."
    : isStreaming ? "Waiting for the response to finish before running."
    : state === "starting" ? message || "Starting terminal…"
    : state === "running" ? "Terminal running."
    : state === "error" ? message
    : state === "stopped" ? "Terminal stopped."
    : "Run this example to open an interactive terminal."

  return (
    <section
      className={className}
      data-slot="tui-preview"
      data-tui-state={displayedState}
      aria-label={title}
      style={{ width: "100%", minWidth: 0, overflow: "hidden", border: "1px solid var(--docstream-tui-border, #73737350)", borderRadius: 10 }}
    >
      <div data-slot="tui-preview-toolbar" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "10px 12px" }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{title}</span>
        {state === "running" && <button type="button" onClick={() => { frame.current?.contentWindow?.focus(); frame.current?.focus() }}>Focus terminal</button>}
        <button
          type="button"
          disabled={active || isStreaming || !address || !code.trim()}
          onClick={() => { setMessage(""); setState("starting"); setAttempt((n) => n + 1) }}
        >
          {state === "error" ? "Retry" : state === "stopped" ? "Run again" : "Run"}
        </button>
        {active && <button type="button" onClick={() => { setMessage(""); setState("stopped") }}>Stop</button>}
      </div>
      <div
        data-slot="tui-preview-terminal"
        aria-busy={state === "starting"}
        style={{ height: terminalHeight, width: "100%", overflow: "hidden", background: theme.background, color: theme.foreground }}
      >
        {active ? (
          <iframe
            key={attempt}
            ref={frame}
            src={address!}
            title={`${title} terminal`}
            sandbox="allow-scripts"
            referrerPolicy="strict-origin"
            tabIndex={0}
            aria-describedby={`${id}-status`}
            style={{ display: "block", width: "100%", height: "100%", border: 0 }}
            onError={() => { setMessage("The terminal runtime could not load. Check the runtime URL and try again."); setState("error") }}
          />
        ) : (
          <div aria-hidden="true" style={{ height: "100%", display: "grid", placeItems: "center", padding: 20, boxSizing: "border-box", fontFamily: "monospace", fontSize: 13 }}>
            {displayedState === "error" ? "Terminal unavailable" : "OpenTUI · browser terminal"}
          </div>
        )}
      </div>
      <p id={`${id}-status`} role="status" aria-live="polite" data-slot="tui-preview-status" style={{ margin: 0, padding: "10px 12px", fontSize: 12, overflowWrap: "anywhere" }}>
        {status}{state === "running" ? " Click the terminal or use Focus terminal to send keyboard input. Stop ends the program." : ""}
      </p>
      <details data-slot="tui-preview-source" style={{ borderTop: "1px solid var(--docstream-tui-border, #73737350)" }}>
        <summary style={{ cursor: "pointer", padding: "10px 12px", fontSize: 12 }}>Source code · {language}</summary>
        <pre style={{ margin: 0, padding: 12, maxHeight: 288, overflow: "auto", fontSize: 12 }}><code>{code}</code></pre>
      </details>
    </section>
  )
}

/** Alias for hosts that use Embed names for interactive response attachments. */
export const TuiEmbed = TuiPreview
