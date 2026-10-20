export default function Badge({ variant = "soft" }: { variant?: string }) {
  const solid = variant === "solid"
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: 16 }}>
      {["New", "Beta", "Deprecated"].map((label) => (
        <span key={label} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 13, background: solid ? "#5b5bd6" : "#5b5bd61f", color: solid ? "#fff" : "#5b5bd6" }}>
          {label}
        </span>
      ))}
    </div>
  )
}
