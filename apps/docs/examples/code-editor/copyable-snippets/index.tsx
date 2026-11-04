import { CodeEditor } from '@/components/ui/code-editor'

export default function CopyableSnippets() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* No title: the copy button floats top-right (on hover, and always on
          touch). */}
      <CodeEditor
        readOnly
        showCopy
        language="bash"
        value={
          'pnpm add @brett_lamy/ui\npnpm add -D tailwindcss @tailwindcss/vite'
        }
      />
      <CodeEditor
        readOnly
        showCopy
        title="main.tsx"
        language="tsx"
        value={
          "import '@brett_lamy/ui/styles.css'\n" +
          "import { BLProvider } from '@brett_lamy/ui'"
        }
      />
    </div>
  )
}
