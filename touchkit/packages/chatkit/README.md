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

## Other exports

The package also includes `WorkspaceRail`, `ChannelList`, `Message`, `Composer`, `ThreadPreview`, `RichText`, and `ChatUsersProvider`. Exported props and data types are available from the package root.

## Workspace development

```sh
pnpm nx build @touchkit/chatkit
pnpm nx lint @touchkit/chatkit
```
