import type { ListItemNode, TaskState } from "./ast"

export const TASK_STATES: ReadonlyArray<{ id: TaskState; marker: string; label: string }> = [
  { id: "pending", marker: " ", label: "Pending" },
  { id: "in-progress", marker: "~", label: "In progress" },
  { id: "implemented", marker: "?", label: "Implemented · evidence needed" },
  { id: "blocked", marker: "b", label: "Blocked" },
  { id: "parked", marker: "d", label: "Parked · verification debt" },
  { id: "refuted", marker: "!", label: "Refuted" },
  { id: "verified", marker: "x", label: "Verified" },
  { id: "cancelled", marker: "-", label: "Cancelled" },
]

export function taskStateFromMarker(marker: string): TaskState | undefined {
  return TASK_STATES.find((state) => state.marker === (marker === "X" ? "x" : marker))?.id
}

export function getTaskState(item: Pick<ListItemNode, "state" | "checked">): TaskState {
  return item.state ?? (item.checked ? "verified" : "pending")
}

/** Explicit state wins; untouched uppercase `[X]` tasks retain their spelling. */
export function taskMarker(item: Pick<ListItemNode, "state" | "checked" | "checkMark">): string {
  return item.state ? TASK_STATES.find((state) => state.id === item.state)?.marker ?? " " : item.checked ? item.checkMark ?? "x" : " "
}
