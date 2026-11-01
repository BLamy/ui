// @vitest-environment jsdom
import { MessageChannel } from 'node:worker_threads';
import { runInThisContext } from 'node:vm';
import { afterEach, expect, it } from 'vitest';
import {
  injectOpenCodeBrowserAgent,
  installOpenCodeBrowserAgent,
} from './open-code-browser-agent';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
});

function connect() {
  const pair = new MessageChannel();
  cleanups.push(
    installOpenCodeBrowserAgent({
      session: 'test',
      parentOrigin: window.location.origin,
    }),
  );
  window.dispatchEvent(
    new MessageEvent('message', {
      source: window,
      origin: window.location.origin,
      data: { type: 'bl-opencode-browser:connect', session: 'test' },
      ports: [pair.port1 as unknown as MessagePort],
    }),
  );
  cleanups.push(() => {
    pair.port1.close();
    pair.port2.close();
  });
  let id = 0;
  return (tool: string, args: Record<string, unknown> = {}) =>
    new Promise<{ result?: string; error?: string }>((resolve) => {
      pair.port2.once('message', resolve);
      pair.port2.postMessage({ id: ++id, tool, args });
    });
}

function element<T extends Element>(
  selector: string,
  root: ParentNode = document,
): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error('Missing fixture element: ' + selector);
  return found;
}

it('snapshots real DOM, clicks snapshot refs, fills fields and submits a form', async () => {
  document.body.innerHTML =
    '<h1>Test app</h1><button id="counter">Clicked 0 times</button><div hidden><button>Secret</button></div><form><label>Name<input name="name"></label><button>Save</button><output></output></form>';
  const counter = element<HTMLButtonElement>('#counter');
  let count = 0;
  counter.addEventListener('click', () => {
    counter.textContent = `Clicked ${++count} times`;
  });
  const form = element<HTMLFormElement>('form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    element<HTMLOutputElement>('output', form).textContent =
      element<HTMLInputElement>('input', form).value;
  });
  const call = connect();
  const snapshot = await call('agent_browser_snapshot', { interactive: false });
  expect(snapshot.result).toContain('heading "Test app"');
  expect(snapshot.result).not.toContain('Secret');
  const ref = (snapshot.result ?? '').match(
    /button "Clicked 0 times" \[ref=(e\d+)\]/,
  )?.[1];
  if (!ref) throw new Error('Counter missing from snapshot');
  expect(await call('agent_browser_click', { selector: '@' + ref })).toEqual(
    expect.objectContaining({ result: 'Clicked.' }),
  );
  expect(counter.textContent).toBe('Clicked 1 times');
  expect((await call('agent_browser_snapshot')).result).toContain(
    `button "Clicked 1 times" [ref=${ref}]`,
  );
  await call('agent_browser_fill', { selector: 'input', text: 'Hello' });
  await call('agent_browser_type', { selector: 'input', text: ' iframe' });
  await call('agent_browser_press', { key: 'Enter' });
  expect(element<HTMLOutputElement>('output', form).textContent).toBe(
    'Hello iframe',
  );
  counter.remove();
  expect(
    (await call('agent_browser_click', { selector: '@' + ref })).error,
  ).toContain('new snapshot');
});

it('selects values and waits for detached or visible elements', async () => {
  document.body.innerHTML =
    '<select><option value="a">Alpha</option><option value="b">Beta</option></select><p>Ready</p>';
  const call = connect();
  await call('agent_browser_select', { selector: 'select', values: ['Beta'] });
  expect(element<HTMLSelectElement>('select').value).toBe('b');
  expect(
    (
      await call('agent_browser_wait_for_selector', {
        selector: 'p',
        state: 'visible',
      })
    ).result,
  ).toContain('visible');
  expect(
    (
      await call('agent_browser_wait_for_selector', {
        selector: '#missing',
        state: 'detached',
      })
    ).result,
  ).toContain('detached');
});

it('injects a self-contained script before app scripts and escapes parent configuration', () => {
  const html = injectOpenCodeBrowserAgent(
    '<!doctype html><html><head><script>app()</script></head><body></body></html>',
    'session',
    'https://host.example',
  );
  expect(html.indexOf('data-opencode-browser')).toBeLessThan(
    html.indexOf('app()'),
  );
  const script = html.slice(
    html.indexOf('>', html.indexOf('<script')) + 1,
    html.indexOf('</script>'),
  );
  // The function is serialized into virtual HTTP responses, so closure captures would break production.
  expect(() => runInThisContext(script)).not.toThrow();
  window.dispatchEvent(new Event('pagehide'));
  const escaped = injectOpenCodeBrowserAgent(
    '<p>App</p>',
    '</script>',
    'https://host.example',
  );
  expect(escaped.match(/<\/script>/g)).toHaveLength(1);
  expect(escaped).toContain('\\u003c/script>');
});
