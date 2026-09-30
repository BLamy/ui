import { PencilKitDemo } from './pencilkit-demo';
import { demoStrokes } from './demo-strokes';

/** The PencilKit prototype: paper, canvas and the floating toolbar. */
export default function PencilKitSketch() {
  return <PencilKitDemo defaultStrokes={demoStrokes()} />;
}
