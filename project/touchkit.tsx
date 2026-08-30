/* touchkit.tsx — ESM facade over touchkit.jsx.
   The runtime module is plain JSX with no build step and registers window.TouchKit;
   this file turns that namespace into real named exports:
     import { use, Haptics, Icon } from "./touchkit.tsx"
   Types are intentionally loose — the kit is inline-styled JSX, not a typed API surface. */
import "./touchkit.jsx";

const NS: any = (window as any).TouchKit;
if (!NS) throw new Error("touchkit.jsx did not register window.TouchKit");

export const use = NS.use;
export const Haptics = NS.Haptics;
export const Icon = NS.Icon;
export const Avatar = NS.Avatar;
export const TKSwitch = NS.TKSwitch;
export const Segmented = NS.Segmented;
export const Spinner = NS.Spinner;
export const TKList = NS.TKList;
export const TKSection = NS.TKSection;
export const TKRow = NS.TKRow;
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
