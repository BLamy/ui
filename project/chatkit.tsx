/* chatkit.tsx — ESM facade over chatkit.jsx.
   The runtime module is plain JSX with no build step and registers window.TouchKitChat;
   this file turns that namespace into real named exports:
     import { ChatDemo, ChatShell, useChatShell } from "./chatkit.tsx"
   Types are intentionally loose — the kit is inline-styled JSX, not a typed API surface. */
import "./chatkit.jsx";

const NS: any = (window as any).TouchKitChat;
if (!NS) throw new Error("chatkit.jsx did not register window.TouchKitChat");

export const ChatDemo = NS.ChatDemo;
export const ChatShell = NS.ChatShell;
export const useChatShell = NS.useChatShell;
export const use = NS.use;

export default NS;
