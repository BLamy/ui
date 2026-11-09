/* A block-level root that centres itself the way page content does. The canvas is block flow,
   so it keeps its 480px (a grid or flex canvas would shrink it to its content). */
export default function Signup() {
  return (
    <form
      style={{
        maxWidth: 480,
        margin: "0 auto",
        display: "grid",
        gap: 10,
        padding: 20,
        borderRadius: 14,
        border: "1px solid color-mix(in srgb, currentColor 16%, transparent)",
      }}
      onSubmit={(event) => event.preventDefault()}
    >
      <strong style={{ fontSize: 15 }}>Join the beta</strong>
      <input
        type="email"
        placeholder="you@example.com"
        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid color-mix(in srgb, currentColor 22%, transparent)", background: "transparent", color: "inherit" }}
      />
      <button type="submit" style={{ padding: "8px 10px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", fontWeight: 600 }}>
        Request access
      </button>
    </form>
  )
}
