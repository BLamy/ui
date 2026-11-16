import { createContext } from "react"
import type { TuiPreviewOptions } from "./TuiPreview"

export const TuiContext = createContext<{ options?: TuiPreviewOptions | false; streaming?: boolean }>({})
