/* The projects handed to ReactCodePreview. Paths are absolute inside the almost-node VFS;
   createReactDemoFiles adds package.json and index.html because neither is here. */

export interface Project {
  title: string
  entry: string
  codeFile: string
  files: Record<string, string>
}

const MAIN = `import { createRoot } from "react-dom/client"
import App from "./App.jsx"

createRoot(document.getElementById("root")).render(<App />)
`

export const PROJECTS: Record<string, Project> = {
  counter: {
    title: "Counter — a real Vite dev server in your browser",
    entry: "/src/main.jsx",
    codeFile: "/src/App.jsx",
    files: {
      "/src/main.jsx": MAIN,
      "/src/App.jsx": `import { useState } from "react"

export default function App() {
  const [count, setCount] = useState(0)
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1 style={{ margin: "0 0 8px" }}>Counter</h1>
      <p data-count>Count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </div>
  )
}
`,
    },
  },
  todos: {
    title: "Todos — three modules and a stylesheet",
    entry: "/src/main.jsx",
    codeFile: "/src/App.jsx",
    files: {
      "/src/main.jsx": `import "./todos.css"\n${MAIN}`,
      "/src/App.jsx": `import { useState } from "react"
import { TodoItem } from "./TodoItem.jsx"

export default function App() {
  const [items, setItems] = useState([
    { id: 1, text: "Write the docs page", done: true },
    { id: 2, text: "Add a live demo", done: false },
  ])
  const [draft, setDraft] = useState("")
  const add = (event) => {
    event.preventDefault()
    if (!draft.trim()) return
    setItems((list) => [...list, { id: Date.now(), text: draft.trim(), done: false }])
    setDraft("")
  }
  const toggle = (id) => setItems((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  return (
    <main className="todos">
      <h1>Todos <small>{items.filter((t) => !t.done).length} left</small></h1>
      <form onSubmit={add}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a task" />
        <button>Add</button>
      </form>
      <ul>{items.map((t) => <TodoItem key={t.id} todo={t} onToggle={() => toggle(t.id)} />)}</ul>
    </main>
  )
}
`,
      "/src/TodoItem.jsx": `export function TodoItem({ todo, onToggle }) {
  return (
    <li data-done={todo.done || undefined}>
      <label>
        <input type="checkbox" checked={todo.done} onChange={onToggle} />
        {todo.text}
      </label>
    </li>
  )
}
`,
      "/src/todos.css": `.todos { font-family: system-ui, sans-serif; padding: 20px; max-width: 420px; }
.todos h1 { font-size: 20px; margin: 0 0 12px; }
.todos small { font-size: 12px; opacity: 0.6; font-weight: 500; }
.todos form { display: flex; gap: 6px; margin-bottom: 10px; }
.todos input:not([type]) { flex: 1; padding: 6px 10px; }
.todos ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.todos li[data-done] { opacity: 0.55; text-decoration: line-through; }
`,
    },
  },
}
