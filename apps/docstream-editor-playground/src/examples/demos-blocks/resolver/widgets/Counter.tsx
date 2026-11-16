import { useState } from "react"

export default function Counter() {
  const [count, setCount] = useState(0)
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", padding: 16 }}>
      <button type="button" onClick={() => setCount((c) => c - 1)}>−</button>
      <strong style={{ fontSize: 28, minWidth: 48, textAlign: "center" }}>{count}</strong>
      <button type="button" onClick={() => setCount((c) => c + 1)}>+</button>
    </div>
  )
}
