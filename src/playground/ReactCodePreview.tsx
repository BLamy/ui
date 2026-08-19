import { useEffect, useState, type CSSProperties } from "react"
import {
  createAlmostNodeWorkspace,
  createReactDemoFiles,
  type AlmostNodeFiles,
  type AlmostNodeWorkspace,
  type AlmostNodeWorkspaceOptions,
} from "./filesystem"

export interface ReactDemoProps {
  /** Complete project file map. Relative paths are rooted at `/`. */
  files: AlmostNodeFiles
  /** Vite entry file. Defaults to `/src/main.jsx`. */
  entry?: string
  /** Preferred virtual port. almost-node picks the next free port if needed. */
  port?: number
  /** Height of the embedded preview. */
  height?: number | string
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

type PreviewState = "idle" | "starting" | "ready" | "error"

const DETACHED_SERVER_ENV = { ALMOSTNODE_DETACH_DEV_SERVERS: "1" }

function errorFromUnknown(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function frameHeight(height: number | string): CSSProperties {
  return { height: typeof height === "number" ? `${height}px` : height }
}

/** Render a multi-file React/JSX/TSX project through almost-node's Vite server. */
export function ReactDemo({
  files,
  entry = "/src/main.jsx",
  port = 4173,
  height = 360,
  title = "Live React preview",
  autoStart = true,
  sandbox = "allow-scripts allow-same-origin allow-forms allow-modals",
  workspaceOptions,
  className,
  onReady,
  onError,
}: ReactDemoProps) {
  const [run, setRun] = useState(autoStart ? 1 : 0)
  const [state, setState] = useState<PreviewState>(autoStart ? "starting" : "idle")
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
        const projectFiles = createReactDemoFiles(files, { entry })
        workspace = await createAlmostNodeWorkspace(projectFiles, {
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
  }, [entry, files, onError, onReady, port, run, workspaceOptions])

  const wrapperClass = className ? `docs-react-demo ${className}` : "docs-react-demo"
  const running = state === "starting"

  return (
    <section className={wrapperClass} data-docstream-react-demo="">
      <header className="docs-react-demo-header">
        <span>{title}</span>
        <span className={`docs-react-demo-status docs-react-demo-status-${state}`}>
          {state === "ready" ? "ready" : state === "starting" ? "starting" : state}
        </span>
        {!autoStart || state === "error" ? (
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
      {error ? (
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
    </section>
  )
}

export function ReactCodePreview(props: ReactCodePreviewProps) {
  return <ReactDemo {...props} />
}
