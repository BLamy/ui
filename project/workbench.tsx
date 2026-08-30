/* workbench.tsx — ESM facade over workbench.jsx.
   The runtime module is plain JSX with no build step and registers window.TouchKitWB;
   this file turns that namespace into real named exports:
     import { Workbench, WorkbenchShell, useWorkbenchShell } from "./workbench.tsx"
   Types are intentionally loose — the kit is inline-styled JSX, not a typed API surface. */
import "./workbench.jsx";

const NS: any = (window as any).TouchKitWB;
if (!NS) throw new Error("workbench.jsx did not register window.TouchKitWB");

export const Workbench = NS.Workbench;
export const WorkbenchShell = NS.WorkbenchShell;
export const useWorkbenchShell = NS.useWorkbenchShell;
export const WBSidebar = NS.WBSidebar;
export const MessageScroller = NS.MessageScroller;
export const MdView = NS.MdView;
export const FbMd = NS.FbMd;
export const DocsLive = NS.DocsLive;
export const Composer = NS.Composer;
export const EmptyThread = NS.EmptyThread;
export const TerminalDock = NS.TerminalDock;
export const TermBody = NS.TermBody;
export const SnapSheet = NS.SnapSheet;
export const SurfacePanel = NS.SurfacePanel;
export const SurfaceTabBar = NS.SurfaceTabBar;
export const WIcon = NS.WIcon;
export const dsLoad = NS.dsLoad;
export const dsPlayground = NS.dsPlayground;

export default NS;
