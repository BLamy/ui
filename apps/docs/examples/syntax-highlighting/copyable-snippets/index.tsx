import { SyntaxHighlighting } from '@/components/ui/syntax-highlighting'

export default function CopyableSnippets() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* No title: the copy button floats top-right (on hover, and always on
          touch). */}
      <SyntaxHighlighting
        showCopy
        language="bash"
        code={
          'pnpm add @brett_lamy/ui\npnpm add -D tailwindcss @tailwindcss/vite'
        }
      />
      <SyntaxHighlighting
        showCopy
        title="main.tsx"
        language="tsx"
        code={
          "import '@brett_lamy/ui/styles.css'\n" +
          "import { BLProvider } from '@brett_lamy/ui'"
        }
      />
    </div>
  )
}
