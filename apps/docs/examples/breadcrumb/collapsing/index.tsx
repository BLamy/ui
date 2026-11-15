import { useState, type CSSProperties } from 'react'
import { Breadcrumb, type BreadcrumbItemData } from '@/components/ui/breadcrumb'
import { Slider } from '@/components/ui/slider'

// When the items don't fit, the middle collapses into one `…` button whose
// menu lists the hidden items. The first and the last always stay, and as many
// trailing items as fit. Resize the frame (slider, or drag its corner).
const PATH: BreadcrumbItemData[] = [
  { value: 'home', label: 'Home', icon: 'house', href: '#home' },
  { value: 'workspace', label: 'Workspace', href: '#workspace' },
  { value: 'projects', label: 'Projects', href: '#projects' },
  { value: 'design', label: 'Design system', href: '#design' },
  { value: 'components', label: 'Components', href: '#components' },
  { value: 'breadcrumb', label: 'Breadcrumb' },
]

export default function Collapsing() {
  const [width, setWidth] = useState(300)
  return (
    <div className="mx-auto grid max-w-md gap-4 p-2">
      <Slider<number> label="Frame width" min={140} max={440} step={4} value={width} onValueChange={setWidth} />
      <div
        style={{ '--frame': `${width}px` } as CSSProperties}
        className="w-(--frame) max-w-full resize-x overflow-hidden rounded-card border border-border bg-card p-2"
      >
        <Breadcrumb items={PATH} />
      </div>
    </div>
  )
}
