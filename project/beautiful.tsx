/* beautiful.tsx — ESM facade over beautiful.jsx.
   The runtime module is plain JSX with no build step and registers window.BUI;
   this file turns that namespace into real named exports:
     import { LoadingState, Thinking, StreamingText } from "./beautiful.tsx"
   Types are intentionally loose — the kit is inline-styled JSX, not a typed API surface. */
import "./beautiful.jsx";

const NS: any = (window as any).BUI;
if (!NS) throw new Error("beautiful.jsx did not register window.BUI");

export const LoadingState = NS.LoadingState;
export const Thinking = NS.Thinking;
export const StreamingText = NS.StreamingText;
export const ApprovalCard = NS.ApprovalCard;
export const ToolChips = NS.ToolChips;
export const TaskRows = NS.TaskRows;
export const RecommendationCard = NS.RecommendationCard;
export const ContextCards = NS.ContextCards;
export const DiffTable = NS.DiffTable;
export const RecordsTable = NS.RecordsTable;
export const FilterTable = NS.FilterTable;
export const SidebarProvider = NS.SidebarProvider;
export const Sidebar = NS.Sidebar;
export const SidebarTrigger = NS.SidebarTrigger;
export const SidebarInset = NS.SidebarInset;
export const SidebarNav = NS.SidebarNav;
export const SearchPalette = NS.SearchPalette;
export const InsightCards = NS.InsightCards;
export const CodeBlockStream = NS.CodeBlockStream;
export const FineTuneCard = NS.FineTuneCard;
export const SelectionActions = NS.SelectionActions;
export const Kbd = NS.Kbd;
export const Skeleton = NS.Skeleton;
export const Popover = NS.Popover;
export const Dropdown = NS.Dropdown;
export const ToastProvider = NS.ToastProvider;
export const useToast = NS.useToast;
export const Cite = NS.Cite;
export const PlanReview = NS.PlanReview;
export const MemoryPills = NS.MemoryPills;
export const AgentBoard = NS.AgentBoard;
export const CommandMenu = NS.CommandMenu;
export const DatePicker = NS.DatePicker;
export const Combobox = NS.Combobox;
export const ModelPicker = NS.ModelPicker;

export default NS;
