import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { parseStl, type StlMesh } from "./parse"

export interface StlViewerProps {
  /** URL of a binary or ASCII `.stl` file. */
  src: string
  title?: string
  className?: string
  /** Model color; any CSS color. Defaults to the element's `color` (the theme's primary). */
  color?: string
  /** Turn slowly until the reader interacts. Ignored under prefers-reduced-motion. Defaults to true. */
  autoRotate?: boolean
}

const VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uProjection;
uniform float uDistance;
varying vec3 vNormal;
void main() {
  vec4 p = uModel * vec4(aPosition, 1.0);
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uProjection * vec4(p.xyz - vec3(0.0, 0.0, uDistance), 1.0);
}`

const FRAGMENT = `
precision mediump float;
uniform vec3 uColor;
varying vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float key = max(dot(n, normalize(vec3(0.45, 0.65, 0.6))), 0.0);
  float fill = max(dot(n, normalize(vec3(-0.6, -0.2, 0.4))), 0.0);
  float sky = 0.5 + 0.5 * n.y;
  vec3 c = uColor * (0.28 + 0.14 * sky + 0.62 * key + 0.18 * fill);
  float spec = pow(max(dot(n, normalize(vec3(0.45, 0.65, 0.6) + vec3(0.0, 0.0, 1.0))), 0.0), 48.0);
  gl_FragColor = vec4(c + vec3(0.12 * spec), 1.0);
}`

const FOV = (35 * Math.PI) / 180
const HOME = { yaw: -0.6, pitch: 0.45, zoom: 1 }

type View = typeof HOME

// Column-major 4×4: rotate (pitch about X, then yaw about Y) a model that was centered,
// scaled to a unit sphere and turned Z-up → Y-up (the STL convention → the screen's).
function modelMatrix(mesh: StlMesh, { yaw, pitch }: View): Float32Array {
  const c = mesh.min.map((v, i) => (v + mesh.max[i]!) / 2)
  const r = Math.hypot(...mesh.max.map((v, i) => (v - mesh.min[i]!) / 2)) || 1
  const s = 1 / r
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
  // R = Rx(pitch) · Ry(yaw) · Rx(-90°); rows of R written as columns below.
  // Rx(-90°) maps (x, y, z) → (x, z, -y).
  const ry = [
    [cy, 0, sy],
    [0, 1, 0],
    [-sy, 0, cy],
  ]
  const rx = [
    [1, 0, 0],
    [0, cp, -sp],
    [0, sp, cp],
  ]
  const up = [
    [1, 0, 0],
    [0, 0, 1],
    [0, -1, 0],
  ]
  const mul = (a: number[][], b: number[][]) =>
    a.map((row) => [0, 1, 2].map((j) => row[0]! * b[0]![j]! + row[1]! * b[1]![j]! + row[2]! * b[2]![j]!))
  const R = mul(mul(rx, ry), up)
  const m = new Float32Array(16)
  for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) m[col * 4 + row] = R[row]![col]! * s
  for (let row = 0; row < 3; row++) m[12 + row] = -s * (R[row]![0]! * c[0]! + R[row]![1]! * c[1]! + R[row]![2]! * c[2]!)
  m[15] = 1
  return m
}

function perspective(aspect: number): Float32Array {
  const f = 1 / Math.tan(FOV / 2), near = 0.05, far = 100
  const m = new Float32Array(16)
  m[0] = f / aspect
  m[5] = f
  m[10] = (far + near) / (near - far)
  m[11] = -1
  m[14] = (2 * far * near) / (near - far)
  return m
}

// Resolve any CSS color (oklch, var(), named…) to linear-ish RGB floats via a 1×1 canvas.
function cssColor(color: string): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d")
  if (!ctx) return [0.4, 0.45, 0.95]
  ctx.fillStyle = "#6670f2"
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r! / 255, g! / 255, b! / 255]
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader")
  return shader
}

function formatSize(mesh: StlMesh): string {
  const d = mesh.max.map((v, i) => v - mesh.min[i]!)
  const fmt = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2))
  return d.map(fmt).join(" × ")
}

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; mesh: StlMesh }

/** Interactive WebGL preview of an `.stl` model: drag to orbit, pinch / ⌘-scroll or +/− to zoom, double-click to reset. */
export function StlViewer({ src, title, className, color, autoRotate = true }: StlViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>({ kind: "loading" })
  const view = useRef<View>({ ...HOME })
  const spinning = useRef(autoRotate)
  const draw = useRef<() => void>(() => {})
  const drag = useRef<{ x: number; y: number; id: number } | null>(null)

  useEffect(() => {
    let live = true
    setStatus({ kind: "loading" })
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim())
        return res.arrayBuffer()
      })
      .then((buf) => live && setStatus({ kind: "ready", mesh: parseStl(buf) }))
      .catch((err: unknown) => live && setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) }))
    return () => {
      live = false
    }
  }, [src])

  const mesh = status.kind === "ready" ? status.mesh : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !mesh) return
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true })
    if (!gl) {
      setStatus({ kind: "error", message: "WebGL is unavailable" })
      return
    }
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    gl.useProgram(program)
    const buffer = (data: Float32Array, name: string) => {
      const b = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, b)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      const loc = gl.getAttribLocation(program, name)
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0)
      return b
    }
    const buffers = [buffer(mesh.positions, "aPosition"), buffer(mesh.normals, "aNormal")]
    const uModel = gl.getUniformLocation(program, "uModel")
    const uProjection = gl.getUniformLocation(program, "uProjection")
    const uDistance = gl.getUniformLocation(program, "uDistance")
    const uColor = gl.getUniformLocation(program, "uColor")
    gl.enable(gl.DEPTH_TEST)

    const resolveColor = () => cssColor(color ?? getComputedStyle(canvas).color)
    let rgb = resolveColor()
    let frame = 0
    const render = () => {
      frame = 0
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.uniformMatrix4fv(uModel, false, modelMatrix(mesh, view.current))
      gl.uniformMatrix4fv(uProjection, false, perspective(w / h))
      // Fit the unit sphere with a little margin, then apply zoom.
      gl.uniform1f(uDistance, (1.12 / Math.sin(FOV / 2)) / view.current.zoom)
      gl.uniform3fv(uColor, rgb)
      gl.drawArrays(gl.TRIANGLES, 0, mesh.triangles * 3)
      if (spinning.current) {
        view.current.yaw += 0.006
        frame = requestAnimationFrame(render)
      }
    }
    draw.current = () => {
      if (!frame) frame = requestAnimationFrame(render)
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) spinning.current = false
    draw.current()
    const resize = new ResizeObserver(() => draw.current())
    resize.observe(canvas)
    // Theme switches change `color`; redraw so the model follows.
    const theme = new MutationObserver(() => {
      rgb = resolveColor()
      draw.current()
    })
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] })
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      theme.disconnect()
      draw.current = () => {}
      buffers.forEach((b) => gl.deleteBuffer(b))
      gl.deleteProgram(program)
    }
  }, [mesh, color])

  const stop = () => {
    spinning.current = false
  }
  const update = useCallback((next: Partial<View>) => {
    const v = view.current
    Object.assign(v, next)
    v.pitch = Math.max(-1.5, Math.min(1.5, v.pitch))
    v.zoom = Math.max(0.3, Math.min(8, v.zoom))
    draw.current()
  }, [])
  const reset = () => {
    stop()
    update({ ...HOME })
  }

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    stop()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
  }
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const v = view.current
    update({ yaw: v.yaw + (e.clientX - d.x) * 0.01, pitch: v.pitch + (e.clientY - d.y) * 0.01 })
    d.x = e.clientX
    d.y = e.clientY
  }
  const onPointerUp = () => {
    drag.current = null
  }
  // Plain scrolling keeps scrolling the page; pinch (ctrlKey) and ⌘/Ctrl-scroll zoom.
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    stop()
    update({ zoom: view.current.zoom * Math.exp(-e.deltaY * 0.01) })
  }
  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const v = view.current
    const step = 0.15
    const next: Record<string, Partial<View>> = {
      ArrowLeft: { yaw: v.yaw - step },
      ArrowRight: { yaw: v.yaw + step },
      ArrowUp: { pitch: v.pitch - step },
      ArrowDown: { pitch: v.pitch + step },
      "+": { zoom: v.zoom * 1.2 },
      "=": { zoom: v.zoom * 1.2 },
      "-": { zoom: v.zoom / 1.2 },
      "0": { ...HOME },
    }
    const change = next[e.key]
    if (!change) return
    e.preventDefault()
    stop()
    update(change)
  }

  // React attaches wheel listeners passively; zoom needs preventDefault, so bind natively.
  const wheelRef = useRef(onWheel)
  wheelRef.current = onWheel
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const listener = (e: WheelEvent) => wheelRef.current(e)
    canvas.addEventListener("wheel", listener, { passive: false })
    return () => canvas.removeEventListener("wheel", listener)
  }, [mesh])

  const label = title ?? src.split(/[?#]/)[0]!.split("/").pop() ?? "STL model"
  return (
    <figure className={`docstream-stl ${className ?? ""}`.trim()} data-state={status.kind}>
      <div className="docstream-stl__stage">
        {mesh ? (
          <canvas
            ref={canvasRef}
            className="docstream-stl__canvas"
            tabIndex={0}
            role="img"
            aria-label={`${label}: 3D model. Drag or use arrow keys to rotate, plus and minus to zoom, 0 to reset.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={reset}
            onKeyDown={onKeyDown}
          />
        ) : (
          <div className="docstream-stl__status" role={status.kind === "error" ? "alert" : "status"}>
            {status.kind === "error" ? `Couldn't load ${label}: ${status.message}` : `Loading ${label}…`}
          </div>
        )}
        {mesh && (
          <button type="button" className="docstream-stl__reset" onClick={reset} aria-label="Reset view">
            Reset
          </button>
        )}
      </div>
      <figcaption className="docstream-stl__caption">
        <a href={src} target="_blank" rel="noreferrer" download>
          {label}
        </a>
        {mesh && (
          <span>
            {mesh.triangles.toLocaleString()} triangles · {formatSize(mesh)}
          </span>
        )}
      </figcaption>
    </figure>
  )
}
