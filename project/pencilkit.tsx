/* pencilkit.tsx — ESM facade over pencilkit.jsx.
   The runtime module is plain JSX with no build step and registers window.TouchKitPencil;
   this file turns that namespace into real named exports:
     import { PencilKitDemo, PencilCanvas, PKIcon } from "./pencilkit.tsx"
   Types are intentionally loose — the kit is inline-styled JSX, not a typed API surface. */
import "./pencilkit.jsx";

const NS: any = (window as any).TouchKitPencil;
if (!NS) throw new Error("pencilkit.jsx did not register window.TouchKitPencil");

export const PencilKitDemo = NS.PencilKitDemo;
export const PencilCanvas = NS.PencilCanvas;
export const PKIcon = NS.PKIcon;

export default NS;
