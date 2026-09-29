import { createContext, use } from 'react';

/** The id of the element that names the controls inside it — ListRow publishes its title's id, so a Switch or
    Slider anywhere in the row (even wrapped in the caller's own component) is labelled by the row title. */
export const RowLabelContext = createContext<string | undefined>(undefined);

/** `aria-labelledby` for a control: its own label wins; else the enclosing row's title. */
export function useRowLabel(props: { 'aria-label'?: string; 'aria-labelledby'?: string }) {
  const rowTitle = use(RowLabelContext);
  if (props['aria-label'] || props['aria-labelledby']) return props['aria-labelledby'];
  return rowTitle;
}
