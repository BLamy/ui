export interface ButtonProps {
  label?: string
}

export function Button({ label = "Vite-mounted button" }: ButtonProps) {
  return <button style={{ border: 0, borderRadius: 8, padding: "10px 14px", background: "#4f46e5", color: "white" }}>{label}</button>
}
