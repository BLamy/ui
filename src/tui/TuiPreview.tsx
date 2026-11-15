import { useEffect, useId, useMemo, useRef, useState } from "react"
import { ChevronRight, CircleAlert, Keyboard, Play, RotateCcw, Square } from "lucide-react"
import { Button } from "@ui-sdk/react/button"
import { DetailsCollapsible } from "../ui/details-collapsible"
import { useColorScheme } from "../ui/use-color-scheme"

export const DEFAULT_TUI_RUNTIME_URL = "https://blamy.github.io/opentui/workbench/example/"

export type TuiPreviewState = "idle" | "starting" | "running" | "error" | "stopped"

export interface TuiTheme {
  mode: "light" | "dark"
  background: string
  foreground: string
}

/** How the terminal picks its colors: "auto" follows the page (the default), or force one scheme. */
export type TuiAppearance = "auto" | "light" | "dark"

export interface TuiPreviewOptions {
  /** A trusted OpenTUI example runtime, including its deployment base path. Relative and absolute HTTP(S) URLs are accepted. */
  runtimeUrl?: string
  title?: string
  /** Terminal height in pixels, bounded to 160–720 (default 360). */
  height?: number
  /**
   * Light or dark terminal. "auto" (the default) follows the nearest `.dark` / `.light` class or `data-theme` /
   * `data-appearance` attribute, else the page's `color-scheme` and the system setting, as docstream's other widgets do.
   * Switching it while a program runs ends the program, like any other source change.
   * @defaultValue "auto"
   */
  appearance?: TuiAppearance
  /**
   * Explicit terminal colors, over the ones `appearance` picks. Any field you leave out comes from the appearance;
   * `mode` overrides it.
   */
  theme?: Partial<TuiTheme>
  /** Time allowed for the runtime's ready handshake (default 30 seconds). */
  startupTimeoutMs?: number
  /** Time allowed for the first rendered frame after sending source (default 30 seconds). */
  renderTimeoutMs?: number
}

export interface TuiPreviewProps extends TuiPreviewOptions {
  code: string
  language?: string
  className?: string
  /** Blocks execution while an AI response is still being streamed, as MarkdownView's `streaming` does. */
  streaming?: boolean
  /** @deprecated Use `streaming`. Still honored; `streaming` wins when both are set. */
  isStreaming?: boolean
  /** Runs when the preview moves between `idle`, `starting`, `running`, `error` and `stopped`. */
  onStateChange?: (state: TuiPreviewState) => void
  /** @deprecated Use `onStateChange`, which gets the same calls. Still called. */
  onStatusChange?: (state: TuiPreviewState) => void
}

/** The terminal colors each appearance starts from. Dark is 2.0.0's default. */
const TUI_THEMES: Readonly<Record<"light" | "dark", TuiTheme>> = {
  light: { mode: "light", background: "#fafafa", foreground: "#18181b" },
  dark: { mode: "dark", background: "#000000", foreground: "#ededed" },
}

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
 * Changing source, runtime or colors destroys the previous session, including its listeners.
 */
export function TuiPreview(props: TuiPreviewProps) {
  const [measure, scheme] = useColorScheme(props.appearance)
  const supplied = props.theme
  const mode = supplied?.mode === "light" || supplied?.mode === "dark" ? supplied.mode : scheme
  const background = supplied?.background ?? TUI_THEMES[mode].background
  const foreground = supplied?.foreground ?? TUI_THEMES[mode].foreground
  // OpenTUI's runtime draws text in its own (white) default unless an example sets a color, so a light terminal
  // it renders itself is unreadable. Unless the host chose the colors, a light terminal is the dark one, inverted
  // (as the tscircuit preview does): the runtime gets the inverse colors and the frame a CSS invert filter.
  const inverted = mode === "light" && supplied?.background === undefined && supplied?.foreground === undefined
  const theme = useMemo<TuiTheme>(() => ({ mode, background, foreground }), [mode, background, foreground])
  const runtimeTheme = useMemo<TuiTheme>(
    () => (inverted ? { mode: "dark", background: invertHex(background), foreground: invertHex(foreground) } : theme),
    [inverted, theme, background, foreground],
  )
  const streaming = props.streaming ?? props.isStreaming ?? false
  // Remounting ends a running program immediately when a streamed source, runtime or theme changes.
  const session = JSON.stringify([
    props.code, props.language, props.runtimeUrl, streaming,
    theme.mode, theme.background, theme.foreground, inverted, props.startupTimeoutMs, props.renderTimeoutMs,
  ])
  return <TuiSession key={session} {...props} theme={theme} runtimeTheme={runtimeTheme} inverted={inverted} streaming={streaming} rootRef={measure} />
}

/** `#rrggbb` → its RGB inverse. */
function invertHex(color: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1]
  if (!hex) return color
  return `#${(0xffffff ^ parseInt(hex, 16)).toString(16).padStart(6, "0")}`
}

function TuiSession({
  code,
  language = "typescript",
  runtimeUrl = DEFAULT_TUI_RUNTIME_URL,
  title = "OpenTUI preview",
  height,
  theme,
  runtimeTheme,
  inverted,
  startupTimeoutMs,
  renderTimeoutMs,
  className,
  streaming,
  onStateChange,
  onStatusChange,
  rootRef,
}: Omit<TuiPreviewProps, "theme" | "streaming" | "isStreaming" | "appearance"> & {
  /** The colors the reader sees. */
  theme: TuiTheme
  /** The colors sent to the runtime: `theme`, or its inverse when `inverted`. */
  runtimeTheme: TuiTheme
  inverted: boolean
  streaming: boolean
  rootRef: (element: HTMLElement | null) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const callbacks = useRef({ onStateChange, onStatusChange })
  callbacks.current = { onStateChange, onStatusChange }
  const id = useId()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<TuiPreviewState>("idle")
  const [message, setMessage] = useState("")
  const address = runtimeAddress(runtimeUrl)
  const active = !!address && !streaming && (state === "starting" || state === "running")
  const displayedState = address ? state : "error"
  const terminalHeight = bounded(height, 360, 160, 720)

  useEffect(() => {
    callbacks.current.onStateChange?.(displayedState)
    callbacks.current.onStatusChange?.(displayedState)
  }, [displayedState])

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
            theme: runtimeTheme, requestId,
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
  }, [active, attempt, code, language, id, runtimeTheme, startupTimeoutMs, renderTimeoutMs])

  const failed = displayedState === "error"
  const status = !address ? "The terminal runtime URL must resolve to an HTTP or HTTPS URL without credentials."
    : streaming ? "Waiting for the response to finish before running."
    : state === "starting" ? message || "Starting terminal…"
    : state === "running" ? "Terminal running."
    : state === "error" ? message
    : state === "stopped" ? "Terminal stopped."
    : "Run this example to open an interactive terminal."
  const run = () => { setMessage(""); setState("starting"); setAttempt((n) => n + 1) }
  const runLabel = state === "error" ? "Retry" : state === "stopped" ? "Run again" : "Run"
  const RunIcon = state === "error" || state === "stopped" ? RotateCcw : Play

  return (
    <section
      ref={rootRef}
      className={["docstream-tui", className].filter(Boolean).join(" ")}
      data-slot="tui-preview"
      data-tui-state={displayedState}
      data-appearance={theme.mode}
      aria-label={title}
      // Layout that has to hold without docstream's stylesheet; the look is in styles.css (.docstream-tui).
      style={{ width: "100%", minWidth: 0, overflow: "hidden" }}
    >
      <div data-slot="tui-preview-toolbar" className="docstream-tui__toolbar" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span className="docstream-tui__title" style={{ flex: 1, minWidth: 0 }}>{title}</span>
        {state === "running" && (
          <Button className="docstream-tui__button" data-variant="secondary" onClick={() => { frame.current?.contentWindow?.focus(); frame.current?.focus() }}>
            <Keyboard size={14} aria-hidden="true" />
            Focus terminal
          </Button>
        )}
        {/* One button that turns from Run into Stop and back, so focus stays on it. */}
        <Button
          className="docstream-tui__button"
          data-variant={active ? "secondary" : "primary"}
          disabled={!active && (streaming || !address || !code.trim())}
          onClick={active ? () => { setMessage(""); setState("stopped") } : run}
        >
          {active ? <Square size={12} aria-hidden="true" /> : <RunIcon size={14} aria-hidden="true" />}
          {active ? "Stop" : runLabel}
        </Button>
      </div>
      <div
        data-slot="tui-preview-terminal"
        className="docstream-tui__terminal"
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
            data-inverted={inverted || undefined}
            style={{ display: "block", width: "100%", height: "100%", border: 0, filter: inverted ? "invert(1) hue-rotate(180deg)" : undefined }}
            onError={() => { setMessage("The terminal runtime could not load. Check the runtime URL and try again."); setState("error") }}
          />
        ) : (
          <div aria-hidden="true" className="docstream-tui__placeholder" style={{ height: "100%", display: "grid", placeItems: "center", padding: 20, boxSizing: "border-box" }}>
            {failed ? "Terminal unavailable" : "OpenTUI · browser terminal"}
          </div>
        )}
      </div>
      {failed ? (
        // An error is announced at once and drawn in the danger tone; the other states are polite status text.
        <div id={`${id}-status`} role="alert" data-slot="tui-preview-status" data-tone="error" className="docstream-tui__status">
          <CircleAlert className="docstream-tui__status-icon" size={14} aria-hidden="true" />
          <span>{status}</span>
        </div>
      ) : (
        <p id={`${id}-status`} role="status" aria-live="polite" data-slot="tui-preview-status" className="docstream-tui__status" style={{ margin: 0 }}>
          {status}{state === "running" ? " Click the terminal or use Focus terminal to send keyboard input. Stop ends the program." : ""}
        </p>
      )}
      {/* The wrapper keeps the 2.0.0 hook: once hydrated the disclosure's own root is UI SDK's (data-slot="collapsible"). */}
      <div data-slot="tui-preview-source" className="docstream-tui__source">
        <DetailsCollapsible
          triggerClassName="docstream-tui__source-trigger"
          panelClassName="docstream-tui__source-body"
          summary={<>
            <ChevronRight className="docstream-tui__caret" size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Source code</span>
            <span className="docstream-tui__language">{language}</span>
          </>}
        >
          <pre className="docstream-tui__code" style={{ margin: 0, overflow: "auto" }}><code>{code}</code></pre>
        </DetailsCollapsible>
      </div>
    </section>
  )
}

/** Alias for hosts that use Embed names for interactive response attachments.
 * @deprecated Use `TuiPreview`; the alias stays for 2.x. */
export const TuiEmbed = TuiPreview
