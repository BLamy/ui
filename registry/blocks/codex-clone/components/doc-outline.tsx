import { IndexBar } from '@brett_lamy/ui';

export interface OutlineItem {
  text: string;
  level: 2 | 3;
}

/** The `##` and `###` headings of a Markdown document, skipping code fences. */
export function outlineOf(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    const m = !fenced && /^(#{2,3})\s+(.+?)\s*#*$/.exec(line);
    if (m) items.push({ text: m[2], level: m[1].length as 2 | 3 });
  }
  return items;
}

/**
 * The document's outline: a wave IndexBar in its left margin — a dash per heading, the current section marked —
 * whose panel opens on hover as a card of the headings (sections nested under their parents). Picking one scrolls
 * there. It needs room: it only shows once the document column is at least 768px wide.
 */
export function DocOutline({
  title,
  items,
  active,
  onPick,
}: {
  title: string;
  items: OutlineItem[];
  active: number;
  onPick: (index: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    // The wrapper (no display of its own) is what the container query hides.
    <div className="@max-[767px]:hidden">
      <IndexBar
        variant="wave"
        side="left"
        panel
        panelTitle={title}
        label="Outline"
        items={items.map((it, i) => ({
          key: i,
          caption: it.text,
          level: it.level - 1,
        }))}
        value={active}
        onJump={(i) => onPick(i)}
        className="top-1/2 left-1 -translate-y-1/2"
      />
    </div>
  );
}
