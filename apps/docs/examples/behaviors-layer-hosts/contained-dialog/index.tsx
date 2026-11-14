import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/* Two app frames on one page, each a layer host: `data-layer-host` in the markup (so a popup that is open from the
   start already sees it) and `contain: layout` (so the dialog's fixed backdrop and centered card fill the frame,
   not the viewport). Each frame's dialog makes only that frame inert and has its own modal stack, so both can be
   open at once, and the page around them stays usable. The host is also passed as the dialog's `container`, so the
   dialog renders as the frame's direct child. */
function Frame({ name }: { name: string }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [last, setLast] = useState('Closed');
  return (
    <div
      ref={setHost}
      data-layer-host=""
      className="relative grid h-64 content-start gap-3 overflow-clip rounded-sheet bg-background p-4 shadow-hairline [contain:layout]"
    >
      <p className="m-0 text-footnote font-semibold text-foreground">{name}</p>
      <Dialog container={host} onOpenChange={(open, details) => setLast(open ? 'Open' : `Closed by ${details.reason}`)}>
        <DialogTrigger className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Rename…</DialogTrigger>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {name}</DialogTitle>
            <DialogDescription>Only {name} is inert while this is open.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className={buttonVariants({ variant: 'secondary' })}>Done</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="m-0 font-mono text-footnote text-foreground/70">{last}</p>
    </div>
  );
}

export default function ContainedDialogDemo() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Frame name="Left" />
      <Frame name="Right" />
    </div>
  );
}
