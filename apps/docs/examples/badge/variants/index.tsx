import { Badge } from '@/components/ui/badge'
import { Icon } from '@/lib/icon'

const VARIANTS = ['default', 'secondary', 'tinted', 'outline', 'destructive', 'success'] as const

// Every variant, then the two shapes of content a badge usually carries: a
// word and a count. An svg child is sized to 12px by the recipe.
export default function Variants() {
  return (
    <div className="mx-auto grid max-w-lg gap-5 p-2">
      <div className="flex flex-wrap items-center gap-2.5">
        {VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge variant="success">
          <Icon name="check" size={12} sw={2.6} />
          Verified
        </Badge>
        <Badge variant="destructive">
          <Icon name="warning" size={12} sw={2.2} />
          Overdue
        </Badge>
        <Badge variant="tinted">
          <Icon name="bolt" size={12} sw={2.2} />
          Beta
        </Badge>
        <Badge>12</Badge>
        <Badge variant="secondary">99+</Badge>
      </div>
    </div>
  )
}
