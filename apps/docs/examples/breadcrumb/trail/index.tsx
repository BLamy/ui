import { Breadcrumb, BreadcrumbItem, type BreadcrumbItemData } from '@/components/ui/breadcrumb'

// Every item but the last is a link (`href`) or a button (`onPress`); the last
// is the current page (aria-current), plain text unless it has a handler.
const PATH: BreadcrumbItemData[] = [
  { id: 'home', label: 'Home', icon: 'house', href: '#home' },
  { id: 'projects', label: 'Projects', href: '#projects' },
  { id: 'design', label: 'Design system', href: '#design' },
  { id: 'breadcrumb', label: 'Breadcrumb' },
]

export default function Trail() {
  return (
    <div className="mx-auto grid max-w-md gap-5 p-2">
      <Breadcrumb items={PATH} />

      {/* `size` scales the text, icons and hit areas. */}
      <div className="grid gap-3">
        <Breadcrumb size="sm" items={PATH} />
        <Breadcrumb size="lg" items={PATH} />
      </div>

      {/* The same trail, composed from parts, with its own separator. */}
      <Breadcrumb separator="/">
        <BreadcrumbItem href="#home" icon="house">
          Home
        </BreadcrumbItem>
        <BreadcrumbItem href="#docs">Docs</BreadcrumbItem>
        <BreadcrumbItem>Breadcrumb</BreadcrumbItem>
      </Breadcrumb>
    </div>
  )
}
