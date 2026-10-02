import { useState } from 'react'

export default function Counter({ variant }: { variant?: string }) {
  const [count, setCount] = useState(0)
  return (
    <button
      type="button"
      onClick={() => setCount((value) => value + 1)}
      style={{
        padding: '10px 16px',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--card)',
        color: 'var(--foreground)',
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      {variant === 'compact' ? count : 'Clicked ' + count + ' times'}
    </button>
  )
}
