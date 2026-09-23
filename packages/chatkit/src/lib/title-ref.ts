/** react-aria's Button drops `title`, so tooltips go on through a ref: `<Button ref={titleRef('Add')}>`. */
export const titleRef = (title: string) => (el: HTMLElement | null) => {
  if (el) el.title = title;
};
