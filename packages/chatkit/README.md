# @touchkit/chatkit

A compositional team-chat scaffold for React. `ChatShell` provides an adaptive workspace rail, channel navigation, and main-content region without prescribing application data or routing.

## Install

```sh
pnpm add @touchkit/chatkit @touchkit/ui react react-dom
```

```tsx
import '@touchkit/ui/styles.css';
import '@touchkit/chatkit/styles.css';
import { ChatShell, useChatShell } from '@touchkit/chatkit';

function ChannelNav() {
  const { compact, setNavOpen } = useChatShell();
  return (
    <MyChannelList
      onClose={compact ? () => setNavOpen(false) : undefined}
      onPick={() => setNavOpen(false)}
    />
  );
}

export function Chat() {
  return (
    <ChatShell breakpoint={880}>
      <ChatShell.Rail><MyWorkspaceRail /></ChatShell.Rail>
      <ChatShell.Nav><ChannelNav /></ChatShell.Nav>
      <ChatShell.Main><Conversation /></ChatShell.Main>
    </ChatShell>
  );
}
```

Slots take ordinary React elements. A component inside the shell reads layout state through `useChatShell()`; it does not receive a render-prop context argument.

## Shell context

`useChatShell()` returns:

| Field | Meaning |
| --- | --- |
| `w` | Measured shell width, independent of viewport width |
| `compact` | Whether `w` is below `breakpoint` |
| `navOpen` | Compact navigation-drawer state |
| `setNavOpen(open)` | Opens or closes that drawer |

The hook throws a clear error when called outside `ChatShell`.

## Artifact chat

`ArtifactChatContainer` keeps a conversation beside an artifact when space permits. Below its container breakpoint, the artifact keeps the full canvas and the composer becomes a dark translucent overlay floating over it, with the page still visible underneath. A grabber cap fused to the overlay's top edge grows the full conversation upward out of itself — tap to toggle, or drag the cap and the surface follows the pointer.

```tsx
<ArtifactChatContainer working={isWorking} onAdd={() => setIsWorking(false)}>
  <ArtifactChatContainer.Chat><Conversation /></ArtifactChatContainer.Chat>
  <ArtifactChatContainer.Composer><Composer /></ArtifactChatContainer.Composer>
  <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>
</ArtifactChatContainer>
```

The compact working state is tappable to reveal the composer for another request. By default the collapsed overlay subscribes to TouchKit's shared scroll-chrome state, so it hides and returns with a `NavigationStack` header and `TabBar`.

## Other exports

The package also includes `ArtifactChatContainer`, `WorkspaceRail`, `ChannelList`, `Message`, `Composer`, `ThreadPreview`, `RichText`, and `ChatUsersProvider`. Exported props and data types are available from the package root.

## Workspace development

```sh
pnpm nx build @touchkit/chatkit
pnpm nx lint @touchkit/chatkit
```
