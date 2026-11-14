import { useState } from 'react'
import { Toggle } from '@/components/ui/toggle'
import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator, ToolbarText, type ToolbarSize, type ToolbarVariant } from '@/components/ui/toolbar'
import { Icon } from '@/lib/icon'

function Formatting({ variant, size }: { variant: ToolbarVariant; size: ToolbarSize }) {
  const [zoom, setZoom] = useState(100)
  const icon = size === 'sm' ? 'icon-sm' : size === 'lg' ? 'icon-lg' : 'icon'
  return (
    <Toolbar variant={variant} size={size} aria-label={`Formatting (${variant}, ${size})`}>
      <ToolbarGroup aria-label="Zoom">
        <ToolbarButton size={icon} aria-label="Zoom out" disabled={zoom <= 50} onClick={() => setZoom((z) => z - 25)}>
          <Icon name="minus" size={16} />
        </ToolbarButton>
        <ToolbarText aria-live="polite">{zoom}%</ToolbarText>
        <ToolbarButton size={icon} aria-label="Zoom in" disabled={zoom >= 200} onClick={() => setZoom((z) => z + 25)}>
          <Icon name="plus" size={16} />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator />
      <Toggle variant="quiet" size={icon} aria-label="Favorite" className={icon === 'icon-sm' ? undefined : icon === 'icon' ? 'rounded-ctl' : 'rounded-xl'}>
        <Icon name="star" size={16} />
      </Toggle>
      <ToolbarButton size={icon} aria-label="Insert link"><Icon name="link" size={16} /></ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton>Share</ToolbarButton>
      <ToolbarButton size={icon} tone="destructive" aria-label="Delete"><Icon name="trash" size={16} /></ToolbarButton>
    </Toolbar>
  )
}

export default function ToolbarLooks() {
  return (
    <div className="flex flex-col items-start gap-5 py-4">
      <Formatting variant="plain" size="default" />
      <div className="flex w-full flex-col items-center gap-4 rounded-card bg-muted p-6">
        <Formatting variant="floating" size="sm" />
        <Formatting variant="floating" size="default" />
        <Formatting variant="floating" size="lg" />
      </div>
    </div>
  )
}
