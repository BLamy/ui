/** Injected into the app document, never the OpenCode/credential document. Keep this function self-contained. */
export function installOpenCodeBrowserAgent(config: {
  session: string;
  parentOrigin: string;
}) {
  const refs = new Map<string, Element>();
  const ids = new WeakMap<Element, string>();
  let next = Math.floor(Math.random() * 1_000_000_000);
  let channel: MessagePort | undefined;
  const text = (value: string | null | undefined) =>
    (value ?? '').replace(/\s+/g, ' ').trim();
  const visible = (element: Element) => {
    if (element.closest('[hidden], [inert], [aria-hidden="true"]'))
      return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  const find = (selector: string) => {
    const element = selector.startsWith('@')
      ? refs.get(selector.slice(1))
      : document.querySelector(selector);
    if (!element?.isConnected)
      throw new Error(
        'Element not found. Take a new snapshot after navigation or DOM changes.',
      );
    return element;
  };
  const role = (element: Element) => {
    const explicit = element.getAttribute('role');
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'a' && element.hasAttribute('href')) return 'link';
    if (tag === 'button' || tag === 'summary') return 'button';
    if (
      tag === 'textarea' ||
      element.getAttribute('contenteditable') === 'true'
    )
      return 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'input') {
      const type = element.getAttribute('type') ?? 'text';
      if (type === 'hidden') return '';
      if (['checkbox', 'radio'].includes(type)) return type;
      if (['button', 'submit', 'reset'].includes(type)) return 'button';
      return 'textbox';
    }
    if (tag === 'img') return 'img';
    if (element.hasAttribute('tabindex')) return 'button';
    return '';
  };
  const name = (element: Element) => {
    const labelled = element.getAttribute('aria-labelledby');
    if (labelled)
      return text(
        labelled
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' '),
      );
    const label =
      element.getAttribute('aria-label') ?? element.getAttribute('alt');
    if (label) return text(label);
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      const labels = Array.from(element.labels ?? [])
        .map((entry) => entry.textContent)
        .join(' ');
      return text(
        labels ||
          element.getAttribute('placeholder') ||
          element.getAttribute('title') ||
          (element instanceof HTMLInputElement &&
          ['submit', 'button'].includes(element.type)
            ? element.value
            : ''),
      );
    }
    return text(element.textContent || element.getAttribute('title')).slice(
      0,
      300,
    );
  };
  const snapshot = (args: Record<string, unknown>) => {
    const root =
      typeof args.selector === 'string' ? find(args.selector) : document.body;
    const lines = [`Page: ${document.title}`, `URL: ${location.href}`];
    let count = 0;
    const visit = (element: Element, depth: number) => {
      if (
        count >= 300 ||
        !visible(element) ||
        /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(element.tagName)
      )
        return;
      if (typeof args.depth === 'number' && depth > args.depth) return;
      const semantic = role(element);
      const interactive = [
        'button',
        'link',
        'textbox',
        'checkbox',
        'radio',
        'combobox',
        'switch',
        'tab',
        'menuitem',
        'slider',
      ].includes(semantic);
      if (semantic && (args.interactive === false || interactive)) {
        let id = ids.get(element);
        if (!id) {
          id = `e${++next}`;
          ids.set(element, id);
          refs.set(id, element);
        }
        const states = [
          element.hasAttribute('disabled') ? 'disabled' : '',
          element.getAttribute('aria-expanded') === 'true' ? 'expanded' : '',
          element instanceof HTMLInputElement && element.checked
            ? 'checked'
            : '',
        ]
          .filter(Boolean)
          .join(', ');
        lines.push(
          `${'  '.repeat(Math.min(depth, 12))}- ${semantic} ${JSON.stringify(name(element))} [ref=${id}]${states ? ` [${states}]` : ''}${args.includeUrls && element instanceof HTMLAnchorElement ? ` ${element.href}` : ''}`,
        );
        count++;
      } else if (
        args.interactive === false &&
        !element.children.length &&
        text(element.textContent)
      ) {
        lines.push(
          `${'  '.repeat(Math.min(depth, 12))}- text ${JSON.stringify(text(element.textContent).slice(0, 500))}`,
        );
        count++;
      }
      for (const child of element.children) visit(child, depth + 1);
    };
    visit(root, 0);
    if (count >= 300)
      lines.push(
        'Snapshot truncated at 300 entries. Scope the next snapshot with selector.',
      );
    for (const [id, element] of refs) if (!element.isConnected) refs.delete(id);
    return lines.join('\n');
  };
  const fill = (element: Element, value: string) => {
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      const prototype =
        element instanceof HTMLInputElement
          ? HTMLInputElement.prototype
          : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(
        element,
        value,
      );
    } else if (element instanceof HTMLElement && element.isContentEditable)
      element.textContent = value;
    else throw new Error('The target is not an editable field.');
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const execute = async (
    tool: string,
    args: Record<string, unknown>,
  ): Promise<unknown> => {
    if (tool === 'agent_browser_snapshot') return snapshot(args);
    if (tool === 'agent_browser_get_url') return location.href;
    if (tool === 'agent_browser_get_text')
      return text(find(String(args.selector)).textContent);
    if (tool === 'agent_browser_wait_for_selector') {
      const state = args.state ?? 'visible';
      const end =
        Date.now() + Math.min(Number(args.waitTimeoutMs ?? 10000), 30000);
      while (true) {
        let element: Element | undefined;
        try {
          element = find(String(args.selector));
        } catch {
          /* Absent is a valid wait state. */
        }
        if (
          state === 'attached'
            ? element
            : state === 'detached'
              ? !element
              : state === 'hidden'
                ? !element || !visible(element)
                : element && visible(element)
        )
          return `Selector is ${state}.`;
        if (Date.now() >= end)
          throw new Error(`Timed out waiting for selector to be ${state}.`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    if (tool === 'agent_browser_press') {
      const parts = String(args.key).split('+');
      const key = parts.pop() ?? '';
      const target = document.activeElement ?? document.body;
      const modifiers = {
        ctrlKey: parts.includes('Control'),
        metaKey: parts.includes('Meta'),
        altKey: parts.includes('Alt'),
        shiftKey: parts.includes('Shift'),
        bubbles: true,
        cancelable: true,
        key,
      };
      const handled = !target.dispatchEvent(
        new KeyboardEvent('keydown', modifiers),
      );
      if (!handled && key === 'Enter') {
        if (
          target instanceof HTMLButtonElement ||
          target instanceof HTMLAnchorElement
        )
          target.click();
        else if (target instanceof HTMLInputElement)
          target.form?.requestSubmit();
        else if (target instanceof HTMLTextAreaElement)
          fill(target, target.value + '\n');
      }
      if (!handled && key === ' ' && target instanceof HTMLButtonElement)
        target.click();
      if (!handled && key === 'Tab') {
        const items = Array.from(
          document.querySelectorAll<HTMLElement>(
            'a[href],button,input,select,textarea,[tabindex]',
          ),
        ).filter(
          (element) =>
            visible(element) &&
            !element.hasAttribute('disabled') &&
            element.tabIndex >= 0,
        );
        items[
          (items.indexOf(target as HTMLElement) +
            (modifiers.shiftKey ? -1 : 1) +
            items.length) %
            items.length
        ]?.focus();
      }
      if (
        !handled &&
        key.toLowerCase() === 'a' &&
        (modifiers.ctrlKey || modifiers.metaKey) &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement)
      )
        target.select();
      target.dispatchEvent(new KeyboardEvent('keyup', modifiers));
      return `Pressed ${args.key}.`;
    }
    const element = find(String(args.selector));
    if (element.hasAttribute('disabled'))
      throw new Error('The target is disabled.');
    if (tool === 'agent_browser_click') {
      if (!(element instanceof HTMLElement))
        throw new Error('The target is not an HTML element.');
      element.focus();
      element.click();
      return 'Clicked.';
    }
    if (tool === 'agent_browser_fill' || tool === 'agent_browser_type') {
      if (element instanceof HTMLElement) element.focus();
      const previous =
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
          ? element.value
          : (element.textContent ?? '');
      fill(
        element,
        tool === 'agent_browser_type'
          ? previous + String(args.text)
          : String(args.text),
      );
      return 'Field updated.';
    }
    if (tool === 'agent_browser_select') {
      if (!(element instanceof HTMLSelectElement))
        throw new Error('The target is not a select.');
      const values = args.values as string[];
      const matches = Array.from(element.options).filter(
        (option) =>
          values.includes(option.value) || values.includes(option.label),
      );
      if (!matches.length) throw new Error('No matching option.');
      for (const option of element.options)
        option.selected = matches.includes(option);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return 'Selection updated.';
    }
    throw new Error(`Unsupported iframe tool: ${tool}`);
  };
  const receive = (event: MessageEvent) => {
    if (
      channel ||
      event.source !== parent ||
      event.origin !== config.parentOrigin ||
      event.data?.type !== 'bl-opencode-browser:connect' ||
      event.data.session !== config.session ||
      !event.ports[0]
    )
      return;
    channel = event.ports[0];
    channel.onmessage = (request: MessageEvent) => {
      const { id, tool, args } = request.data;
      void execute(tool, args).then(
        (result) => channel?.postMessage({ id, result }),
        (error: unknown) =>
          channel?.postMessage({
            id,
            error: error instanceof Error ? error.message : String(error),
          }),
      );
    };
    channel.start();
  };
  addEventListener('message', receive);
  const dispose = () => {
    removeEventListener('message', receive);
    channel?.close();
  };
  addEventListener('pagehide', dispose, { once: true });
  const ready = () =>
    parent.postMessage(
      {
        type: 'bl-opencode-browser:ready',
        session: config.session,
        url: location.href,
      },
      config.parentOrigin,
    );
  if (document.readyState === 'loading')
    addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
  return dispose;
}

export function injectOpenCodeBrowserAgent(
  html: string,
  session: string,
  parentOrigin: string,
): string {
  const config = JSON.stringify({ session, parentOrigin }).replaceAll(
    '<',
    '\\u003c',
  );
  const script = `<script data-opencode-browser>(${installOpenCodeBrowserAgent.toString()})(${config});</script>`;
  // Install before the app's own scripts without changing the AlmostNode worker.
  const head = /<head(?:\s[^>]*)?>/i.exec(html);
  if (head)
    return (
      html.slice(0, head.index + head[0].length) +
      script +
      html.slice(head.index + head[0].length)
    );
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  const offset = doctype?.[0].length ?? 0;
  return html.slice(0, offset) + script + html.slice(offset);
}
