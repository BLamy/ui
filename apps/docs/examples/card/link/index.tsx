import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Icon } from '@/lib/icon'

const POSTS = [
  { href: '#/migrating-to-6', title: 'Migrating to 6.0', description: 'What moved, what was renamed, and the codemods.' },
  { href: '#/theming', title: 'Theming', description: 'Tokens, ThemeScope and a palette of your own.' },
]

// A whole card that is one link: `render={<a href />}`. Its name is the
// card's text, so nothing inside it should be interactive.
export default function Link() {
  return (
    <div className="mx-auto grid max-w-md gap-3 rounded-card bg-muted p-5">
      {POSTS.map((post) => (
        <Card
          key={post.href}
          variant="elevated"
          render={<a href={post.href} />}
          className="no-underline outline-none transition-transform duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/45 active:scale-[.98] motion-reduce:transition-none"
        >
          <CardHeader className="pb-4">
            <CardTitle render={<h2 />}>{post.title}</CardTitle>
            <CardDescription>{post.description}</CardDescription>
            <CardAction className="self-center">
              <Icon name="chevron-right" size={16} className="text-tertiary-foreground" />
            </CardAction>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
