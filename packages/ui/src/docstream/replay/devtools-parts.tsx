"use client"

/* The replay DevTools' parts: the panel and its resize separator, the Network table, and tabs whose root renders
   no element (the tab bar and the panes are the panel's own children, with nothing to wrap them). */
import { tabs } from "@ui-sdk/core/tabs"
import { createParts } from "@ui-sdk/react/primitive"
import { devtoolsPanel, requestTable } from "./devtools-primitives"

/** @internal */
export const { Root: DevtoolsPanelRoot, Resize: DevtoolsPanelResize } = createParts(devtoolsPanel, { root: "section", resize: "div" })

/** @internal */
export const { Root: RequestTable, Row: RequestRow } = createParts(requestTable, { root: "table", row: "tr" })

/** @internal */
export const { Root: Tabs, List: TabsList, Tab: TabsTab, Panel: TabsPanel } = createParts(tabs, { list: "div", tab: "button", panel: "div" })

