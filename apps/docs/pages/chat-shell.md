# ChatShell

Chat layouts, from parts. `ChatShell` is a thin layout root — it measures its own width, owns the compact navigation drawer, and applies the chat palette — and every region inside it is an ordinary component you place yourself. Leave out what a layout doesn't need: a DM view has no rail, a support widget has no navigation at all.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ChatShell, ChatShellSidebar, ChatShellMain, ChatShellHeader,
  ChannelList, ChannelItem, MessageList, Message, ChatComposer,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/chat-shell.json{% endcommand %}

Adds `@/components/ui/chat-shell.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  ChatShell, ChatShellSidebar, ChatShellMain, ChatShellHeader,
  ChannelList, ChannelItem, MessageList, Message, ChatComposer,
} from '@/components/ui/chat-shell'
```
{% endtab %}
{% endtabs %}

```tsx
import {
  ChatShell, ChatShellNav, ChatShellSidebar, ChatShellMain, ChatShellHeader,
  ChatShellNavTrigger, ChatShellHeaderIcon, ChatShellTitle, ChatShellFooter,
  ChatShellAside, ChatShellPanel,
  WorkspaceRail, WorkspaceRailList, WorkspaceRailItem, ServerHeader,
  ChannelList, ChannelGroup, ChannelItem, UserPanel, MessageList, MemberList,
  ChatComposer,
} from '@brett_lamy/ui'

export function Chat() {
  const [channel, setChannel] = useState('general')
  return (
    <ChatShell breakpoint={880} tint="#0A84FF">
      <ChatShellNav>
        <WorkspaceRail defaultSelectedKey="hq">
          <WorkspaceRailList>
            <WorkspaceRailItem id="hq" label="H" title="HQ" />
          </WorkspaceRailList>
        </WorkspaceRail>
        <ChatShellSidebar>
          <ServerHeader>HQ</ServerHeader>
          <ChannelList selectedKey={channel} onSelectionChange={setChannel}>
            <ChannelGroup label="Team">
              <ChannelItem id="general">general</ChannelItem>
              <ChannelItem id="dev" unread mentions={2}>dev</ChannelItem>
            </ChannelGroup>
          </ChannelList>
          <UserPanel>…</UserPanel>
        </ChatShellSidebar>
      </ChatShellNav>
      <ChatShellMain>
        <ChatShellHeader>
          <ChatShellNavTrigger />
          <ChatShellHeaderIcon />
          <ChatShellTitle>{channel}</ChatShellTitle>
        </ChatShellHeader>
        <MessageList scrollKey={channel}>{/* Message parts */}</MessageList>
        <ChatShellFooter>
          <ChatComposer placeholder={'Message #' + channel} onSend={send} />
        </ChatShellFooter>
      </ChatShellMain>
      <ChatShellAside><MemberList>…</MemberList></ChatShellAside>
      <ChatShellPanel open={!!thread} onOpenChange={closeThread}>
        …
      </ChatShellPanel>
    </ChatShell>
  )
}
```

## Live example

The full Discord layout is a registry block — `npx shadcn add` copies `page.tsx` (below), a message component, a thread view and a sample-data file into your app. Switch widths to watch the navigation dock, collapse into a drawer, or make room for the member list:

{% demo src="blocks/discord-clone" %}

## Built from

`useContainerWidth` measures the shell. [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane) turns `ChatShellNav` into a docked column or a left [EdgeDrawer](https://blamy.github.io/ui/#/edge-drawer); [SideDrawer](https://blamy.github.io/ui/#/side-drawer) gives `ChatShellPanel` its docked and overlay modes; the rail is a vertical [TabView](https://blamy.github.io/ui/#/tab-view). For a phone-style stack, put the sidebar and conversation in a [SplitView](https://blamy.github.io/ui/#/split-view) (below).

## Parts

### Layout

| Part | What it is |
| --- | --- |
| `ChatShell` | Root. Measures itself (`breakpoint`, default 880), holds the compact drawer (`defaultNavOpen` / `navOpen` / `onNavOpenChange`), applies `--ck-*` tokens for `appearance` (default: the ambient `AppearanceProvider`, else dark) and the `tint` accent. |
| `ChatShellNav` | Rail + sidebar. A docked column when wide; one left drawer over a scrim when compact. |
| `ChatShellNavTrigger` | The hamburger that opens the drawer. Renders nothing while the navigation is docked. |
| `ChatShellSidebar` | The 222px channel column that stacks `ServerHeader`, `ChannelList`, `UserPanel`. |
| `ChatShellMain` | The conversation column; takes the remaining width. |
| `ChatShellHeader` | 46px title bar. Holds `ChatShellHeaderIcon` (a # by default), `ChatShellTitle`, `ChatShellDescription` (the topic, fills the middle) and `ChatShellHeaderActions` › `ChatShellHeaderAction` (`variant="icon"` with `isActive`, or `"outline"`). `ChatShellBack` is a tinted back button for views that replace the channel. |
| `ChatShellFooter` | Pins the composer under the transcript. |
| `ChatShellAside` | A docked trailing column (the member list). Shows from `minWidth` (1320) and while `open`. |
| `ChatShellPanel` | Thread / details panel. Docks as a column from `dockWidth` (1180), overlays below it. `open`, `onOpenChange`, `title`, `width`. |

### Navigation

| Part | What it is |
| --- | --- |
| `WorkspaceRail` | The server rail (vertical TabView): `selectedKey` / `defaultSelectedKey` / `onSelectionChange`. |
| `WorkspaceRailList` › `WorkspaceRailItem` | The tiles: `id`, `label`, `color`, `title`, `unread` (pill nub), `mentions` (red badge), or custom `children`. `WorkspaceRailHome` is the DM tile; `WorkspaceRailSeparator` a rule arrow keys skip. |
| `WorkspaceRailAction` | A dashed tile that is a button, not a tab ("Add workspace"). |
| `ServerHeader` | The workspace name. Inside a compact shell its trailing control closes the drawer; otherwise a chevron (or your `action`). |
| `ChannelList` | The scrolling list; owns `selectedKey` / `onSelectionChange`. |
| `ChannelGroup` | A labelled section. |
| `ChannelItem` | A channel: `id`, `icon` (a # by default — pass an avatar for DMs), `unread` (bold + tint dot), `mentions` (red pill). Picking one closes a compact drawer. |
| `ChannelThreadItem` | An indented thread row with an elbow connector. |
| `UserPanel` | The signed-in user: `ChatAvatar`, `UserPanelInfo` › `UserPanelName` + `UserPanelStatus` (`online` · `idle` · `dnd` · `offline`), `UserPanelAction`. |

### Transcript

| Part | What it is |
| --- | --- |
| `MessageList` | The scrolling `log`. Stays pinned to the newest message until the reader scrolls up; a new `scrollKey` snaps back. |
| `ChannelIntro` | "Welcome to #channel" at the top. |
| `DateDivider` / `MessageDivider` | A labelled rule (`variant="date"` or `"subtle"`). |
| `Message` | One row; `user` is read by its parts. `variant="continued"` for follow-ups inside a `MessageGroup`; `appear` rises new rows into place. |
| `MessageAvatar` · `MessageBody` · `MessageHeader` | Avatar (bots get a squircle), the column beside it, and the name line. |
| `MessageAuthor` · `MessageBadge` · `MessageTimestamp` | Name in the role color, a tag ("APP"), the time. |
| `MessageContent` | The text; a string child renders as `RichText`, so `@id` mentions become chips. |
| `MessageReactions` › `MessageReaction` | Reaction toggles: `emoji`, `count`, `mine`. |
| `MessageActions` › `MessageAction` | The floating action bar on hover and keyboard focus; `label` is the name and tooltip. |
| `ThreadPreview` · `ThreadPreviewReply` · `ThreadHeader` | The card that opens a thread, its latest reply, and the title block of an open thread. |
| `TypingIndicator` · `MessageListEmpty` | "… is typing" with three dots; placeholder text. |
| `MemberList` › `MemberGroup` › `MemberItem` | Members by group, with presence dots (`status`) and bot badges. |
| `ChatComposer` | The field: `onSend`, `placeholder`. Compose it from `ChatComposerAction`, `ChatComposerInput` and `ChatComposerSend` when you need more. |

`ChatUsersProvider` gives `RichText` the users that `@id` mentions resolve against.

## Context

Anything inside the shell can call `useChatShell()`:

| Field | Meaning |
| --- | --- |
| `width` | Measured shell width |
| `compact` | `width < breakpoint` |
| `navOpen` / `setNavOpen` | The compact drawer |

## Compositions

### Direct messages

Two columns and no rail: a DM list in `ChatShellSidebar`, avatars as the channel icons.

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

`WorkspaceRail` in Discord's style: a tile is a circle at rest and morphs into a rounded square when hovered or selected, and the pill on its leading edge grows from the unread nub to half height on hover and full height when selected — corners and pill on springs, a small dip on press, one selection tick per change.

{% demo src="chat-shell/workspace-rail" %}

### User panel

{% demo src="chat-shell/user-panel" %}
