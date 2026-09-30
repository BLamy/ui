# ChatShell

Chat layouts, from parts. `ChatShell` is a thin layout root — it measures its own width, owns the compact navigation drawer, and opens the `chat` theme scope — and every region inside it is an ordinary component you place yourself. Leave out what a layout doesn't need: a DM view has no rail, a support widget has no navigation at all.

## Installation

`ChatShell` and its regions are parts of the **discord-clone** [block](https://blamy.github.io/ui/#/blocks), not the library: the shell is the layout of one product, so it is copied into your app, where it is yours to change. Adding the block also copies the library parts it is built from (AdaptivePane, SideDrawer, TabView, Composer, …).

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/discord-clone.json{% endcommand %}

The shell lands in `components/blocks/discord-clone/components/chat-shell.tsx` (context in `chat-shell-context.ts`), with the chat palette in `chat-theme.css` next to the block. Import from your alias:

```tsx
import {
  ChatShell, ChatShellNav, ChatShellSidebar, ChatShellMain,
  ChatShellHeader, ChatShellTitle, ChatShellFooter,
} from '@/components/blocks/discord-clone/components/chat-shell'
import { useChatShell } from '@/components/blocks/discord-clone/components/chat-shell-context'
```

The block's `page.tsx` imports `chat-theme.css`, which defines the `chat` [theme scope](https://blamy.github.io/ui/#/theming) the shell opens. If you render the shell without that page, import the stylesheet once yourself.

```tsx
import {
  ChatShell, ChatShellNav, ChatShellSidebar, ChatShellMain, ChatShellHeader,
  ChatShellNavTrigger, ChatShellHeaderIcon, ChatShellTitle, ChatShellFooter,
  ChatShellAside, ChatShellPanel,
} from '@/components/blocks/discord-clone/components/chat-shell'
import {
  TabView, TabViewBar, TabViewList, TabViewTab, TabViewIndicator,
} from '@/components/ui/tab-view'
import {
  SidebarHeader, SidebarContent, SidebarSection, SidebarItem,
} from '@/components/ui/sidebar'
import { Icon } from '@/lib/icon'
import {
  Composer, ComposerCard, ComposerInput, ComposerFooter, ComposerSpacer, ComposerSend,
} from '@/components/ui/composer/composer'

export function Chat() {
  const [channel, setChannel] = useState('general')
  return (
    <ChatShell breakpoint={880} tint="#0A84FF">
      <ChatShellNav>
        <TabView orientation="vertical" defaultSelectedKey="hq" className="contents">
          <TabViewBar variant="workspace">
            <TabViewList aria-label="Workspaces">
              <TabViewTab id="hq" textValue="HQ">
                <TabViewIndicator variant="pill" />
                <span className="…">H</span>
              </TabViewTab>
            </TabViewList>
          </TabViewBar>
        </TabView>
        <ChatShellSidebar>
          <SidebarHeader>HQ</SidebarHeader>
          <SidebarContent>
            <SidebarSection title="Team">
              <SidebarItem icon={<Icon name="number" size={13} />} label="general"
                active={channel === 'general'} onPress={() => setChannel('general')} />
            </SidebarSection>
          </SidebarContent>
        </ChatShellSidebar>
      </ChatShellNav>
      <ChatShellMain>
        <ChatShellHeader>
          <ChatShellNavTrigger />
          <ChatShellHeaderIcon />
          <ChatShellTitle>{channel}</ChatShellTitle>
        </ChatShellHeader>
        <div role="log" className="min-h-0 flex-1 overflow-y-auto">{/* messages */}</div>
        <ChatShellFooter>
          <Composer onSubmit={send}>
            <ComposerCard>
              <ComposerInput placeholder={'Message #' + channel} />
              <ComposerFooter><ComposerSpacer /><ComposerSend /></ComposerFooter>
            </ComposerCard>
          </Composer>
        </ChatShellFooter>
      </ChatShellMain>
      <ChatShellAside>{/* members */}</ChatShellAside>
      <ChatShellPanel open={!!thread} onOpenChange={closeThread}>
        …
      </ChatShellPanel>
    </ChatShell>
  )
}
```

The regions hold whatever you give them. The Discord-style parts — channel list with thread rows, messages with reactions and thread previews, member list, typing indicator, the one-line composer — are more block files next to the shell (`components/blocks/discord-clone/components/*`), also yours to change.

## Live example

The full Discord layout is a registry block — `npx shadcn add` copies `page.tsx` (below), its channel, message, member and composer parts, a thread view and a sample-data file into your app. Switch widths to watch the navigation dock, collapse into a drawer, or make room for the member list:

{% demo src="blocks/discord-clone" %}

## Built from

`useContainerWidth` measures the shell. [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane) turns `ChatShellNav` into a docked column or a left [EdgeDrawer](https://blamy.github.io/ui/#/edge-drawer); [SideDrawer](https://blamy.github.io/ui/#/side-drawer) gives `ChatShellPanel` its docked and overlay modes; the rail is a vertical [TabView](https://blamy.github.io/ui/#/tab-view) with a `workspace` bar; the channel column can use the [Sidebar](https://blamy.github.io/ui/#/sidebar) parts. For a phone-style stack, put the sidebar and conversation in a [SplitView](https://blamy.github.io/ui/#/split-view) (below).

## Parts

| Part | What it is |
| --- | --- |
| `ChatShell` | Root. Measures itself (`breakpoint`, default 880), holds the compact drawer (`defaultNavOpen` / `navOpen` / `onNavOpenChange`), opens the `chat` theme scope for `appearance` (default: the ambient `AppearanceProvider`, else dark) and the `tint` accent. |
| `ChatShellNav` | Rail + sidebar. A docked column when wide; one left drawer over a scrim when compact. |
| `ChatShellNavTrigger` | The hamburger that opens the drawer. Renders nothing while the navigation is docked. |
| `ChatShellSidebar` | The 222px channel column (a header, the channel list, the signed-in user). |
| `ChatShellMain` | The conversation column; takes the remaining width. |
| `ChatShellHeader` | 46px title bar. Holds `ChatShellHeaderIcon` (a # by default), `ChatShellTitle`, `ChatShellDescription` (the topic, fills the middle) and `ChatShellHeaderActions` › `ChatShellHeaderAction` (`variant="icon"` with `isActive`, or `"outline"`). `ChatShellBack` is a tinted back button for views that replace the channel. |
| `ChatShellFooter` | Pins the composer under the transcript. |
| `ChatShellAside` | A docked trailing column (the member list). Shows from `minWidth` (1320) and while `open`. |
| `ChatShellPanel` | Thread / details panel. Docks as a column from `dockWidth` (1180), overlays below it. `open`, `onOpenChange`, `title`, `width`. |

## Context

Anything inside the shell can call `useChatShell()`:

| Field | Meaning |
| --- | --- |
| `width` | Measured shell width |
| `compact` | `width < breakpoint` |
| `navOpen` / `setNavOpen` | The compact drawer — call `setNavOpen(false)` when a channel is picked |

`useOptionalChatShell()` returns the same, or `null` outside a shell — for parts that also render standalone.

## Compositions

### Direct messages

Two columns and no rail: a DM list in `ChatShellSidebar` (Sidebar parts, avatars as the icons).

{% demo src="chat-shell/direct-messages" %}

### Thread side panel

`ChatShellPanel` docks a thread beside the channel when there's room and slides it over the channel when there isn't.

{% demo src="chat-shell/thread-panel" %}

### Compact stack

On phones a drawer isn't the only answer. Put the sidebar and the conversation in a `SplitView`: compact shows one at a time — picking a channel pushes the conversation, back or an edge-swipe pops — and wider, the same two columns tile.

{% demo src="chat-shell/mobile-stack" %}

### Support chat

The smallest shell is just `ChatShellMain`: a header, a transcript and a composer in the product's accent.

{% demo src="chat-shell/support-chat" %}

### The rail

A vertical `TabView` with `TabViewBar variant="workspace"`, tiles in Discord's style: a tile is a circle at rest and morphs into a rounded square when hovered or selected, and the pill on its leading edge grows from the unread nub to half height on hover and full height when selected — corners and pill on springs, a small dip on press.

{% demo src="chat-shell/workspace-rail" %}

### Signed-in user

The foot of the channel column: who you are and your status, from library parts.

{% demo src="chat-shell/user-panel" %}
