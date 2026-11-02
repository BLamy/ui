import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardHeader, HoverCardTrigger } from '@/components/ui/hover-card'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

// Rest the pointer on a name, a link or an avatar (or Tab to it): a card
// previews what it points at. Move into the card to select its text or press
// its button; sweep to the next trigger and it opens at once. Touch never opens
// one, so each trigger also works as a plain link.
function Person({ name, handle, role }: { name: string; handle: string; role: string }) {
  return (
    <>
      <HoverCardHeader
        media={<Avatar name={name} size={44} />}
        title={name}
        subtitle={`@${handle}`}
        action={<Button size="sm" variant="secondary">Follow</Button>}
      />
      <p className="mt-3 mb-0 text-footnote text-muted-foreground">{role}</p>
    </>
  )
}

export default function Profile() {
  // The ThemeScope is only here so the portalled card wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-lg gap-5 py-6 text-body leading-7">
      <p className="m-0">
        Reviewed by{' '}
        <HoverCardTrigger>
          <a href="#ada" className="font-semibold text-primary">@ada</a>
          <HoverCard placement="bottom start">
            <Person name="Ada Lovelace" handle="ada" role="Maintainer · Analytical Engine. Reviews the motion and layout parts." />
          </HoverCard>
        </HoverCardTrigger>{' '}
        and merged into{' '}
        <HoverCardTrigger>
          <a href="#ui" className="font-mono text-primary">BLamy/ui</a>
          <HoverCard placement="bottom start" arrow>
            <HoverCardHeader media={<Icon name="folder" size={28} />} title="BLamy/ui" subtitle="Public · TypeScript" />
            <p className="mt-3 mb-2 text-footnote text-muted-foreground">An iOS-flavoured React kit on react-aria and Tailwind 4.</p>
            <div className="flex gap-2"><Badge variant="tinted">★ 1.2k</Badge><Badge variant="outline">v5.13</Badge></div>
          </HoverCard>
        </HoverCardTrigger>
        .
      </p>
      <div className="flex items-center gap-2">
        <span className="text-footnote text-muted-foreground">Avatars take a <code>card</code>:</span>
        {[
          ['Ada Lovelace', 'ada', 'Maintainer'],
          ['Miles Okafor', 'miles', 'Design systems'],
          ['Wei Chen', 'wei', 'Accessibility review'],
        ].map(([name, handle, role]) => (
          <Avatar key={handle} name={name} size={32} card={<Person name={name!} handle={handle!} role={role!} />} />
        ))}
      </div>
    </ThemeScope>
  )
}
