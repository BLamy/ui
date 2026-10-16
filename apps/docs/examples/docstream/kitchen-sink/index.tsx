import { useEffect, useState } from 'react'
import { createBundledSourceClient, SourcePreview, type DemoResolver, type SourceRefNode } from '@brett_lamy/docstream'
import { Button } from '@/components/ui/button'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { MarkdownView, type ReferenceNode } from '@/components/ui/markdown-view'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs'
import Counter from './counter'
import counterSource from './counter.tsx?raw'
import { kitchenSinkMarkdown } from './document'
import * as fixtures from './fixtures'
import './styles.css'

const demoIds = ['kitchen-sink/counter', 'kitchen-sink/inline-counter']
const demoResolver: DemoResolver = {
  list: () => demoIds,
  meta: async () => ({ entry: 'counter.tsx', layout: 'single', height: 100 }),
  files: async (src) => demoIds.includes(src)
    ? [{ path: 'counter.tsx', content: counterSource, language: 'tsx' }]
    : [],
  load: async (src) => {
    if (!demoIds.includes(src)) throw new Error('Unknown kitchen sink demo: ' + src)
    return Counter
  },
}
const sourceClient = createBundledSourceClient({ 'kitchen-sink:fixtures.tsx': fixtures })
const renderSource = (reference: SourceRefNode) => <SourcePreview reference={reference} client={sourceClient} />
const references = {
  mentions: [{ id: 'maya', label: 'Maya', description: 'Document author' }, { id: 'jonas', label: 'Jonas' }],
  tags: [{ id: 'docs', label: 'Docs' }, { id: 'release', label: 'Release' }],
  codebases: [{ id: 'blamy/ui', label: 'BL UI' }, { id: 'blamy/docstream', label: 'Docstream' }],
}

export default function KitchenSink() {
  const [markdown, setMarkdown] = useState(kitchenSinkMarkdown)
  const [mode, setMode] = useState('markdown')
  const [streamedLength, setStreamedLength] = useState<number | null>(null)
  const [picked, setPicked] = useState<ReferenceNode | null>(null)
  const editing = mode === 'editor'
  const streaming = !editing && streamedLength !== null

  useEffect(() => {
    if (!streaming) return
    const timer = window.setInterval(() => {
      setStreamedLength((position) => {
        if (position === null) return null
        const next = position + 160
        return next >= markdown.length ? null : next
      })
    }, 40)
    return () => window.clearInterval(timer)
  }, [streaming, markdown.length])

  const reset = () => {
    setMarkdown(kitchenSinkMarkdown)
    setStreamedLength(null)
    setPicked(null)
  }
  const preview = (
    <MarkdownView
      markdown={streaming ? markdown.slice(0, streamedLength ?? 0) : markdown}
      streaming={streaming}
      demoResolver={demoResolver}
      sourceRenderer={renderSource}
      onReferenceClick={setPicked}
    />
  )

  return (
    <div className="docstream-kitchen-sink">
      <Tabs selectedKey={mode} onSelectionChange={(key) => setMode(String(key))} className="sink-tabs">
        <div className="sink-controls">
          <TabList aria-label="Document mode">
            <Tab id="markdown">Markdown</Tab>
            <Tab id="editor">Rich editor</Tab>
            <Tab id="preview">Preview</Tab>
          </TabList>
          {mode !== 'editor' && (
            <Button size="sm" variant="secondary" onPress={() => { setPicked(null); setStreamedLength(streaming ? null : 0) }}>
              {streaming ? 'Show full document' : 'Stream example'}
            </Button>
          )}
          <Button size="sm" variant="ghost" onPress={reset}>Reset example</Button>
          <span className="sink-status" role="status">
            {streaming ? 'Streaming…' : picked ? picked.kind + ': ' + picked.id : 'Every Docstream block, one document'}
          </span>
        </div>
        <TabPanel id="markdown" className="sink-workspace sink-workspace-split">
          <section className="sink-panel">
            <div className="sink-panel-label">Markdown source</div>
            <textarea
              className="sink-source"
              aria-label="Kitchen sink Markdown source"
              value={markdown}
              onChange={(event) => { setStreamedLength(null); setMarkdown(event.target.value) }}
              spellCheck={false}
            />
          </section>
          <section className="sink-panel">
            <div className="sink-panel-label">Rendered preview</div>
            <div className="sink-panel-body sink-preview" tabIndex={0} role="region" aria-label="Kitchen sink preview">
              {preview}
            </div>
          </section>
        </TabPanel>
        <TabPanel id="editor" className="sink-workspace sink-workspace-split">
          <section className="sink-panel">
            <div className="sink-panel-label">Rich editor · type / for blocks</div>
            <div className="sink-panel-body">
              <MarkdownEditor
                aria-label="Kitchen sink document"
                variant="ghost"
                value={markdown}
                onValueChange={setMarkdown}
                toolbar
                references={references}
                demoResolver={demoResolver}
                minHeight={480}
              />
            </div>
          </section>
          <section className="sink-panel">
            <div className="sink-panel-label">Rendered preview</div>
            <div className="sink-panel-body sink-preview" tabIndex={0} role="region" aria-label="Kitchen sink preview">
              {preview}
            </div>
          </section>
        </TabPanel>
        <TabPanel id="preview" className="sink-workspace">
          <section className="sink-panel">
            <div className="sink-panel-label">Rendered preview</div>
            <div className="sink-panel-body sink-preview" tabIndex={0} role="region" aria-label="Kitchen sink preview">
              {preview}
            </div>
          </section>
        </TabPanel>
      </Tabs>
    </div>
  )
}
