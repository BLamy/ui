import { useState, type FocusEvent } from 'react'
import { FocusRing, mergeProps, useFocus, useFocusRing, useFocusVisible, useFocusWithin } from 'react-aria'

function Flag({ name, on }: { name: string; on: boolean }) {
  return (
    <span
      data-on={on || undefined}
      className="rounded-full bg-muted px-2.5 py-1 font-mono text-caption text-foreground data-on:bg-foreground data-on:text-background"
    >
      {name}
    </span>
  )
}

// One group, five ways to ask "is it focused?".
//   useFocus        the element itself, however focus got there
//   useFocusRing    the element itself, but "visible" only for keyboard focus
//   useFocusWithin  the element or anything inside it
//   FocusRing       useFocusRing as a wrapper that adds class names
//   useFocusVisible the page-wide modality: did the last interaction use the keyboard?
// The text field also shows the browser's own :focus-visible, which differs.
export default function FocusStates() {
  const [focused, setFocused] = useState(false)
  const [within, setWithin] = useState(false)
  const [cssVisible, setCssVisible] = useState(false)
  const { focusProps } = useFocus({ onFocusChange: setFocused })
  const { focusProps: ringProps, isFocusVisible } = useFocusRing()
  const { focusProps: inputRingProps, isFocusVisible: inputVisible } = useFocusRing()
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setWithin })
  const { isFocusVisible: keyboardModality } = useFocusVisible()

  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      <div
        role="group"
        aria-label="Focus group"
        {...focusWithinProps}
        data-focus-within={within || undefined}
        className="grid gap-3 rounded-panel bg-card p-4 shadow-hairline data-focus-within:ring-2 data-focus-within:ring-ring"
      >
        <label className="grid gap-1.5 text-footnote text-foreground">
          Text field
          <input
            type="text"
            defaultValue="Click or Tab into me"
            {...mergeProps(inputRingProps, {
              onFocus: (e: FocusEvent<HTMLInputElement>) => setCssVisible(e.currentTarget.matches(':focus-visible')),
              onBlur: () => setCssVisible(false),
            })}
            data-focus-visible={inputVisible || undefined}
            className="box-border w-full rounded-ctl border-0 bg-muted px-3 py-2 text-body text-foreground outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            {...mergeProps(focusProps, ringProps)}
            data-focus-visible={isFocusVisible || undefined}
            className="cursor-pointer rounded-ctl border-0 bg-secondary px-4 py-2 text-body text-secondary-foreground outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
          >
            Button
          </button>
          <FocusRing focusRingClass="ring-[3px] ring-ring/45" within>
            <div className="flex items-center gap-2 rounded-ctl bg-muted px-3 py-2 text-footnote text-foreground outline-none">
              <span>FocusRing within</span>
              <button type="button" className="cursor-pointer rounded-ctl border-0 bg-card px-2 py-1 text-footnote text-foreground outline-none">
                Inner
              </button>
            </div>
          </FocusRing>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Focus state">
        <Flag name="button isFocused" on={focused} />
        <Flag name="button isFocusVisible" on={isFocusVisible} />
        <Flag name="input isFocusVisible" on={inputVisible} />
        <Flag name="input :focus-visible (CSS)" on={cssVisible} />
        <Flag name="group focus-within" on={within} />
        <Flag name="useFocusVisible()" on={keyboardModality} />
      </div>
    </div>
  )
}
