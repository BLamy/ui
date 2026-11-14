import { createChange, createInlineEdit, definePrimitive, type ChangeDetails, type InlineEditReason } from '@ui-sdk/core';

/* ══ inlineEdit — rename something where its name shows: UI SDK's `createInlineEdit` as a primitive ══
   The root goes around the things that can be renamed (a tree, a list, a row of tabs); the input goes where the name
   shows, while that id is being edited. Each thing marks its element with `data-edit-id`: F2 on it starts an edit.
   Return saves, and so does leaving the field; Escape puts the name back. Focus then goes back to where it was.
   `editing` is the controlled key: every start and end is asked for through `createChange` first, so
   `onEditingChange` can refuse it with `details.cancel()`. `draft` is the session `createInlineEdit` runs, and it
   follows `editing`. No React in here: render it with `createParts(inlineEdit, { root: 'div', input: 'input' })`. ══ */

/** Why a rename was saved, and the event behind it. */
export interface InlineEditDetails {
  reason: InlineEditReason;
  event?: Event;
}

/** What `onEditingChange` receives: why an edit started or ended, the event, who caused it, and `cancel()`. */
export type InlineEditChangeDetails = ChangeDetails<InlineEditReason>;

export interface InlineEditOptions {
  /** The id being edited, or `null`. Pass it to say which: a menu's Rename sets it. */
  editing?: string | null;
  /** The id edited at first, when `editing` is left out. */
  defaultEditing?: string | null;
  /** An edit started (an id) or ended (`null`). `details.reason` says how: `edit-key`, `enter-key`, `escape-key`…;
   *  `details.cancel()` refuses it (a read-only file stays closed, a field stays open). */
  onEditingChange?: (editing: string | null, details: InlineEditChangeDetails) => void;
  /** The text an id shows now, which the field starts with. */
  textOf?: (id: string) => string;
  /** Saves the new text. Return `false` to keep the field open, when the text isn't valid. Unchanged text never gets
   *  here. */
  onCommit?: (id: string, text: string, details: InlineEditDetails) => boolean | void;
  /** Whether an id can be edited. Default: all can. */
  editable?: (id: string) => boolean;
}

interface InlineEditState {
  /** The id asked for: the owner's `editing`, or the primitive's own. */
  editing: string | null;
  /** The id `createInlineEdit` is editing now: the field shows for it. */
  draft: string | null;
}

/** The reason an input key ends an edit with, when it does. */
const KEY_REASON: Partial<Record<string, InlineEditReason>> = { Enter: 'enter-key', Escape: 'escape-key', Tab: 'tab-key' };

export const inlineEdit = definePrimitive({
  name: 'inline-edit',
  options: {
    editing: 'value',
    defaultEditing: 'value',
    onEditingChange: 'callback',
    textOf: 'action',
    onCommit: 'action',
    editable: 'action',
  },
  controlled: ['editing'],
  state: (options: InlineEditOptions): InlineEditState => ({ editing: options.defaultEditing ?? null, draft: null }),
  sync: (options) => (options.editing === undefined ? {} : { editing: options.editing }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const controlled = () => context.options().editing !== undefined;

    const edit = createInlineEdit<InlineEditState>(context, {
      key: 'draft',
      value: (id) => context.options().textOf?.(id) ?? '',
      commit: (id, text, details) => context.options().onCommit?.(id, text, details) !== false,
      disabled: (id) => context.options().editable?.(id) === false,
    });

    /** Brings the session in line with `editing`: opens the field for it, or closes the field without saving. */
    function follow(target: string | null, details: InlineEditDetails = { reason: 'imperative' }) {
      if (target === store.get().draft) return;
      if (target === null) edit.cancel();
      else edit.start(target, details);
    }

    /** Asks for `editing` to become `next`. An uncontrolled edit follows at once; a controlled one when the owner
     *  passes the value back. A refused end opens the field again. */
    function request(next: string | null, details: InlineEditDetails) {
      const accepted = change('editing', next, { reason: details.reason, event: details.event });
      if (!controlled()) follow(store.get().editing, details);
      return accepted;
    }

    /** The session closed on its own (saved, put back, or left): report it. */
    function settle(was: string | null, details: InlineEditDetails) {
      if (was !== null && store.get().draft === null) request(null, details);
    }

    // The owner's `editing`, as it arrives: an id it sets opens the field, `null` closes it without saving.
    context.onOptions((_options, synced) => {
      if (synced && 'editing' in synced) follow(synced.editing ?? null);
    });

    // Something edited from the start opens once its input renders.
    if (store.get().editing !== null) follow(store.get().editing);

    return {
      edit,
      /** Starts editing an id. */
      start(id: string, details: InlineEditDetails = { reason: 'imperative' }) {
        if (context.options().editable?.(id) === false || store.get().draft === id) return false;
        return request(id, details);
      },
      /** Saves a new name for an id, as if it had been typed. Returns false for an id that can't be edited, or when
       *  the owner refuses the text. */
      rename(id: string, text: string) {
        const { editable, onCommit } = context.options();
        if (editable?.(id) === false || !onCommit) return false;
        return onCommit(id, text, { reason: 'imperative' }) !== false;
      },
      /** Stops editing without saving. */
      cancel() {
        const was = store.get().draft;
        edit.cancel();
        settle(was, { reason: 'imperative' });
      },
      keydown(event: KeyboardEvent) {
        if (event.key !== 'F2' || event.defaultPrevented || !(event.target instanceof Element)) return;
        const id = event.target.closest('[data-edit-id]')?.getAttribute('data-edit-id');
        if (id == null || context.options().editable?.(id) === false) return;
        event.preventDefault();
        if (store.get().draft !== id) request(id, { reason: 'edit-key', event });
      },
      inputKeydown(event: KeyboardEvent) {
        const was = store.get().draft;
        edit.inputKeydown(event);
        const reason = KEY_REASON[event.key];
        if (reason) settle(was, { reason, event });
      },
      inputBlur(event: FocusEvent) {
        const was = store.get().draft;
        if (was === null) return;
        edit.end('focus-out', event);
        settle(was, { reason: 'focus-out', event });
      },
    };
  },
  slots: (slot) => ({
    // Children render the field for `editing`: the id whose session is open. A group, so the name it is given (what
    // it holds, like "Files") names it for people and agents.
    root: slot<object, { editing: string | null }>({
      role: 'group',
      state: (state) => ({ editing: state.draft }),
      on: { keydown: (event, { api }) => api.keydown(event) },
    }),
    input: slot({
      attrs: () => ({ type: 'text', autocomplete: 'off', spellcheck: 'false' }),
      on: {
        keydown: (event, { api }) => api.inputKeydown(event),
        focusout: (event, { api }) => api.inputBlur(event),
      },
      bind: (el, { api }) => api.edit.bindInput(el as HTMLInputElement),
    }),
  }),
  // Listed whenever it can edit, named by its root: an agent can open a rename, or rename without the field.
  agent: { actions: ['start', 'rename', 'cancel'] },
});
