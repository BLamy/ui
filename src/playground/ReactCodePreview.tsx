import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { CollapsibleCode } from "../docs/CollapsibleCode"
import {
  createAlmostNodeWorkspace,
  createReactDemoFiles,
  normalizeAlmostNodeFiles,
  normalizeAlmostNodePath,
  type AlmostNodeFiles,
  type AlmostNodeWorkspace,
  type AlmostNodeWorkspaceOptions,
} from "./filesystem"

export interface ReactDemoProps {
  /** Complete project file map. Relative paths are rooted at `/`. Not needed when `preview` is given. */
  files?: AlmostNodeFiles
  /**
   * Render this in place of the almost-node iframe — for hosts that can mount the demo directly
   * (components already on the page). No runtime starts; the frame, header, and code panel stay the same.
   */
  preview?: ReactNode
  /** Source text for the code panel. Overrides reading `codeFile` from `files`. */
  code?: string
  /** Highlighting language for `code` (e.g. "tsx"). Defaults to the extension of `codeFile`. */
  language?: string
  /** Header status. Defaults to the runtime state ("ready", "starting"…); pass `false` to hide it. */
  status?: ReactNode | false
  /** Extra header content after the status, e.g. controls that switch between demo variants. */
  actions?: ReactNode
  /** Vite entry file. Defaults to `/src/main.jsx`. */
  entry?: string
  /** Preferred virtual port. almost-node picks the next free port if needed. */
  port?: number
  /** Height of the embedded preview. */
  height?: number | string
  /** Source file displayed below the preview. Defaults to the entry file. */
  codeFile?: string
  /** Number of source lines visible while the code preview is collapsed. Defaults to 3. */
  collapsedCodeLines?: number
  /** Maximum visible source lines before expanded code scrolls. Defaults to 30. */
  expandedCodeLines?: number
  /** Label shown above the preview. */
  title?: string
  /** Start the runtime on mount (default true). */
  autoStart?: boolean
  /** iframe sandbox value. The same-origin permission lets the almost-node service worker route the preview. */
  sandbox?: string
  /** Extra options spread into `createAlmostNodeWorkspace` (e.g. `basePath` for static hosting). */
  workspaceOptions?: Partial<AlmostNodeWorkspaceOptions>
  className?: string
  onReady?: (url: string) => void
  onError?: (error: Error) => void
}

export type ReactCodePreviewProps = ReactDemoProps

export type PreviewState = "idle" | "starting" | "ready" | "error"

const DETACHED_SERVER_ENV = { ALMOSTNODE_DETACH_DEV_SERVERS: "1" }

function errorFromUnknown(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function frameHeight(height: number | string): CSSProperties {
  return { height: typeof height === "number" ? `${height}px` : height }
}

function sourceLanguage(path: string): string | null {
  const extension = path.split(".").pop()?.toLowerCase()
  return extension && extension !== path ? extension : null
}

function sourceText(files: AlmostNodeFiles, requestedPath: string): string | null {
  const normalizedPath = normalizeAlmostNodePath(requestedPath)
  const file = normalizeAlmostNodeFiles(files).find(
    (candidate) => normalizeAlmostNodePath(candidate.path) === normalizedPath,
  )
  if (!file) return null
  return typeof file.content === "string" ? file.content : new TextDecoder().decode(file.content)
}

export interface AlmostNodeServerOptions {
  /** The complete project (see `createReactDemoFiles`). Keep its identity stable between renders. */
  files: AlmostNodeFiles
  port?: number
  /** Start when > 0; bump to restart. 0 stops (and disposes) the server. */
  run: number
  workspaceOptions?: Partial<AlmostNodeWorkspaceOptions>
  onReady?: (url: string) => void
  onError?: (error: Error) => void
}

export interface AlmostNodeServerState {
  state: PreviewState
  url: string | null
  error: string | null
}

/** Boots `vite` for `files` in an almost-node container; disposes it on change/unmount. */
export function useAlmostNodeServer({ files, port = 4173, run, workspaceOptions, onReady, onError }: AlmostNodeServerOptions): AlmostNodeServerState {
  const [state, setState] = useState<PreviewState>(run ? "starting" : "idle")
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!run) {
      setState("idle")
      setUrl(null)
      setError(null)
      return
    }

    let cancelled = false
    let workspace: AlmostNodeWorkspace | null = null
    let readyUrl: string | null = null
    setState("starting")
    setUrl(null)
    setError(null)

    const start = async () => {
      try {
        workspace = await createAlmostNodeWorkspace(files, {
          ...workspaceOptions,
          env: { ...DETACHED_SERVER_ENV, ...workspaceOptions?.env },
          onServerReady: (serverPort, serverUrl) => {
            readyUrl = serverUrl.endsWith("/") ? serverUrl : `${serverUrl}/`
            workspaceOptions?.onServerReady?.(serverPort, serverUrl)
          },
        })

        const result = await workspace.container.run(`vite --port ${port}`, {
          env: DETACHED_SERVER_ENV,
        })
        if (result.exitCode !== 0) {
          throw new Error(result.stderr || result.stdout || "almost-node could not start Vite")
        }

        const serverUrl = readyUrl ?? `${workspace.container.serverBridge.getServerUrl(port)}/`
        if (cancelled) {
          workspace.dispose()
          return
        }
        setUrl(serverUrl)
        setState("ready")
        onReady?.(serverUrl)
      } catch (cause) {
        const nextError = errorFromUnknown(cause)
        if (!cancelled) {
          setState("error")
          setError(nextError.message)
          onError?.(nextError)
        }
        workspace?.dispose()
      }
    }

    void start()
    return () => {
      cancelled = true
      workspace?.dispose()
    }
  }, [files, onError, onReady, port, run, workspaceOptions])

  return { state, url, error }
}

/** Render a multi-file React/JSX/TSX project through almost-node's Vite server. */
const NO_FILES: AlmostNodeFiles = {}

export function ReactDemo({
  files = NO_FILES,
  preview,
  code: codeProp,
  language,
  status,
  actions,
  entry = "/src/main.jsx",
  port = 4173,
  height = 360,
  codeFile,
  collapsedCodeLines = 3,
  expandedCodeLines = 30,
  title = "Live React preview",
  autoStart = true,
  sandbox = "allow-scripts allow-same-origin allow-forms allow-modals",
  workspaceOptions,
  className,
  onReady,
  onError,
}: ReactDemoProps) {
  const inline = preview !== undefined
  const [run, setRun] = useState(autoStart && !inline ? 1 : 0)
  const projectFiles = useMemo(() => createReactDemoFiles(files, { entry }), [files, entry])
  const { state: serverState, url, error } = useAlmostNodeServer({
    files: projectFiles,
    port,
    run: inline ? 0 : run,
    workspaceOptions,
    onReady,
    onError,
  })
  const state: PreviewState = inline ? "ready" : serverState
  const displayedCodeFile = codeFile ?? entry
  const code = useMemo(
    () => codeProp ?? sourceText(files, displayedCodeFile),
    [codeProp, displayedCodeFile, files],
  )

  const wrapperClass = className ? `docs-react-demo ${className}` : "docs-react-demo"
  const running = state === "starting"

  return (
    <section className={wrapperClass} data-docstream-react-demo="">
      <header className="docs-react-demo-header">
        <span>{title}</span>
        {status === false ? null : (
          <span className={`docs-react-demo-status docs-react-demo-status-${state}`}>
            {status ?? (state === "ready" ? "ready" : state === "starting" ? "starting" : state)}
          </span>
        )}
        {actions}
        {!inline && (!autoStart || state === "error") ? (
          <button
            type="button"
            className="docs-react-demo-run"
            disabled={running}
            onClick={() => setRun((value) => value + 1)}
          >
            {state === "error" ? "Retry" : "Run demo"}
          </button>
        ) : null}
      </header>
      {inline ? (
        <div className="docs-react-demo-preview" style={frameHeight(height)}>{preview}</div>
      ) : error ? (
        <pre className="docs-react-demo-error">{error}</pre>
      ) : url ? (
        <iframe
          title={title}
          className="docs-react-demo-frame"
          src={url}
          sandbox={sandbox}
          style={frameHeight(height)}
        />
      ) : (
        <div className="docs-react-demo-placeholder" style={frameHeight(height)}>
          {running ? "Starting almost-node…" : "Run the demo to open its virtual filesystem."}
        </div>
      )}
      {code !== null ? (
        <CollapsibleCode
          code={code}
          language={language ?? sourceLanguage(displayedCodeFile)}
          collapsedLines={collapsedCodeLines}
          expandedLines={expandedCodeLines}
        />
      ) : null}
    </section>
  )
}

export function ReactCodePreview(props: ReactCodePreviewProps) {
  return <ReactDemo {...props} />
}
