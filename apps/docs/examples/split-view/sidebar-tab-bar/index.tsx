import { useState } from 'react'
import { SplitViewResizableDemo } from '@/components/blocks/split-view-demos/demos'
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackLargeTitle,
  NavigationStackLeading,
  NavigationStackPage,
  NavigationStackTitle,
  useNavigationStack,
} from '@/components/ui/navigation-stack'
import { List, ListRow, ListSection } from '@/components/ui/list'
import {
  SplitView,
  SplitViewContent,
  SplitViewDetail,
  SplitViewHeader,
  SplitViewItem,
  SplitViewSection,
  SplitViewSidebar,
  SplitViewSidebarTrigger,
} from '@/components/ui/split-view'

// Podcasts: a sidebar on a tablet or a wide pane, the iOS tab bar on a phone.
// Drag the frame below 640px: the same SplitView turns its sidebar into the
// tab bar (`compactPresentation="tabs"`). The `tab` items are tabs; the
// Library section is one tab, current while any of its rows is the selection.
// The detail's NavigationStack stays mounted the whole time.
const titles: Record<string, string> = {
  home: 'Home',
  new: 'New',
  search: 'Search',
  library: 'Library',
  shows: 'Shows',
  saved: 'Saved',
  downloads: 'Downloaded',
}

function Section({ section }: { section: string }) {
  const stack = useNavigationStack()
  return (
    <List variant="inset">
      <ListSection>
        {['Morning Brief', 'The Long Read', 'Field Notes'].map((show, i) => (
          <ListRow key={show} title={show} description={`${titles[section]} · episode ${i + 12}`} accessory="chevron" divider={i < 2}
            onClick={() => stack.push(`episode:${show}`)} />
        ))}
      </ListSection>
    </List>
  )
}

export default function SidebarTabBar() {
  const [section, setSection] = useState('home')
  return (
    <SplitViewResizableDemo initial={390} min={320} height={560}>
      <SplitView aria-label="Podcasts" value={{ sidebar: section }}
        onValueChange={(v) => { if (v.sidebar) setSection(v.sidebar) }}>
        <SplitViewSidebar compactPresentation="tabs" aria-label="Podcasts">
          <SplitViewHeader title="Podcasts" />
          <SplitViewContent className="px-2.5">
            <SplitViewSection>
              <SplitViewItem value="home" title="Home" icon="house" tab />
              <SplitViewItem value="new" title="New" icon="star" tab />
              <SplitViewItem value="search" title="Search" icon="magnifyingglass" tab />
            </SplitViewSection>
            <SplitViewSection title="Library" tab value="library" icon="books-vertical">
              <SplitViewItem value="shows" title="Shows" icon="layers" />
              <SplitViewItem value="saved" title="Saved" icon="bookmark" />
              <SplitViewItem value="downloads" title="Downloaded" icon="arrow-down-circle" />
            </SplitViewSection>
          </SplitViewContent>
        </SplitViewSidebar>
        <SplitViewDetail>
          <NavigationStack defaultPages={['root']} resetKey={section}
            renderPage={(key) => (
              <NavigationStackPage value={key}>
                <NavigationStackBar><NavigationStackTitle>{key.slice(8)}</NavigationStackTitle></NavigationStackBar>
                <NavigationStackContent><NavigationStackLargeTitle /></NavigationStackContent>
              </NavigationStackPage>
            )}>
            <NavigationStackPage value="root">
              <NavigationStackBar>
                <NavigationStackLeading><SplitViewSidebarTrigger /></NavigationStackLeading>
                <NavigationStackTitle>{titles[section]}</NavigationStackTitle>
              </NavigationStackBar>
              <NavigationStackContent>
                <NavigationStackLargeTitle />
                <Section section={section} />
              </NavigationStackContent>
            </NavigationStackPage>
          </NavigationStack>
        </SplitViewDetail>
      </SplitView>
    </SplitViewResizableDemo>
  )
}
