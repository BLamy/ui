/* blui.tsx — ESM facade over blui.jsx.
   The runtime module is plain JSX with no build step and registers window.BLUI;
   this file turns that namespace into real named exports:
     import { use, Haptics, Icon } from "./blui.tsx"
   Types are intentionally loose — the kit is inline-styled JSX, not a typed API surface. */
import "./blui.jsx";

const NS: any = (window as any).BLUI;
if (!NS) throw new Error("blui.jsx did not register window.BLUI");

export const use = NS.use;
export const Haptics = NS.Haptics;
export const Icon = NS.Icon;
export const Avatar = NS.Avatar;
export const BLSwitch = NS.BLSwitch;
export const Segmented = NS.Segmented;
export const Spinner = NS.Spinner;
export const BLList = NS.BLList;
export const BLSection = NS.BLSection;
export const BLRow = NS.BLRow;
export const IndexBar = NS.IndexBar;
export const TabBar = NS.TabBar;
export const NavigationStack = NS.NavigationStack;
export const SplitView = NS.SplitView;
export const Sidebar = NS.Sidebar;
export const Credenza = NS.Credenza;
export const SideDrawer = NS.SideDrawer;
export const ActivityView = NS.ActivityView;
export const HapticsPlayground = NS.HapticsPlayground;
export const App = NS.App;

export default NS;
