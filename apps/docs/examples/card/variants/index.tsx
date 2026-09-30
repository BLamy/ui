import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const variants = [
  {
    variant: 'default',
    title: 'Default',
    note: 'Fills with the card color. Use it on the grouped background.',
  },
  {
    variant: 'elevated',
    title: 'Elevated',
    note: 'Adds a soft shadow and hairline so it lifts off any surface.',
  },
  {
    variant: 'outline',
    title: 'Outline',
    note: 'A hairline and no fill, for places that already have a surface.',
  },
] as const

// One panel per variant, on the grouped (bg-muted) background an inset card
// is designed for.
export default function Variants() {
  return (
    <div className="grid gap-4 rounded-card bg-muted p-5 sm:grid-cols-3">
      {variants.map((v) => (
        <Card key={v.variant} variant={v.variant}>
          <CardHeader>
            <CardTitle>{v.title}</CardTitle>
            <CardDescription>variant="{v.variant}"</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">{v.note}</CardContent>
        </Card>
      ))}
    </div>
  )
}
