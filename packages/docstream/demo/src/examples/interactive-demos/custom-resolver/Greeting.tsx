export function Greeting({ variant = "hello" }: { variant?: string }) {
  return (
    <p style={{ margin: 0, fontSize: 22, fontWeight: 600, textAlign: "center" }}>
      {variant === "hello" ? "Hello" : "Goodbye"}, docstream!
    </p>
  )
}
