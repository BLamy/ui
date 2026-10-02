import { isTextDropItem, useDragAndDrop, useListData, type DropItem } from 'react-aria-components'
import { ListBox, ListBoxItem } from '@/components/ui/list-box'
import { Icon } from '@/lib/icon'

interface Task {
  id: string
  name: string
}

const TASK = 'application/x-bl-task'

const parse = (items: DropItem[]) =>
  Promise.all(items.filter(isTextDropItem).map(async (i) => JSON.parse(await i.getText(TASK)) as Task))

// One board column: it accepts tasks dragged from either column (`onInsert`,
// `onRootDrop`), reorders its own (`onReorder`), and removes a task from its
// source when the drop was a move into the other column (`onDragEnd`).
function Column({ title, initial }: { title: string; initial: Task[] }) {
  const list = useListData({ initialItems: initial })
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((key) => {
        const task = list.getItem(key) as Task
        return { 'text/plain': task.name, [TASK]: JSON.stringify(task) }
      }),
    acceptedDragTypes: [TASK],
    getDropOperation: () => 'move',
    async onInsert(e) {
      const tasks = await parse(e.items)
      if (e.target.dropPosition === 'before') list.insertBefore(e.target.key, ...tasks)
      else list.insertAfter(e.target.key, ...tasks)
    },
    async onRootDrop(e) {
      list.append(...(await parse(e.items)))
    },
    onReorder(e) {
      if (e.target.dropPosition === 'before') list.moveBefore(e.target.key, e.keys)
      else list.moveAfter(e.target.key, e.keys)
    },
    onDragEnd(e) {
      // isInternal: the drop landed in the same list, which onReorder handled.
      if (e.dropOperation === 'move' && !e.isInternal) list.remove(...e.keys)
    },
  })

  return (
    <section aria-label={title} className="grid content-start gap-2">
      <h3 className="m-0 text-footnote font-semibold text-foreground">
        {title} ({list.items.length})
      </h3>
      <ListBox
        aria-label={title}
        items={list.items}
        selectionMode="multiple"
        dragAndDropHooks={dragAndDropHooks}
        renderEmptyState={() => <div className="p-4 text-center text-footnote text-foreground">Drop tasks here</div>}
        className="min-h-24 data-drop-target:ring-2 data-drop-target:ring-primary"
      >
        {(task) => (
          <ListBoxItem id={task.id} textValue={task.name}>
            <span className="flex items-center gap-3">
              <Icon name="menu" size={18} className="text-foreground" />
              {task.name}
            </span>
          </ListBoxItem>
        )}
      </ListBox>
    </section>
  )
}

export default function MoveBetween() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <Column
          title="To do"
          initial={[
            { id: 'a', name: 'Write the docs' },
            { id: 'b', name: 'Review the PR' },
            { id: 'c', name: 'Ship it' },
          ]}
        />
        <Column title="Done" initial={[{ id: 'd', name: 'Plan the release' }]} />
      </div>
      <p className="m-0 text-footnote text-foreground">
        Drag a task into the other column, or reorder within one. Keyboard: focus a row, press Enter, use the arrow keys for a position (Tab for the other list), then Enter.
      </p>
    </div>
  )
}
