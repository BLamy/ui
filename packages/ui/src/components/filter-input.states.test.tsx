// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FilterBar } from '@/components/ui/filter';
import { FilterInput } from '@/components/ui/filter-input';
import type { FilterField } from '@/lib/filter-model';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

/* The model's two in-between states, with gpu-query's loader held: still downloading, and failed to load. */
const model = vi.hoisted(() => ({ load: vi.fn<() => Promise<never>>() }));
vi.mock('@/lib/gpu-query', async (original) => ({ ...(await original<typeof import('@/lib/gpu-query')>()), loadModel: () => model.load() }));

afterEach(cleanup);

const fields: FilterField[] = [{ id: 'status', label: 'Status', kind: 'select', options: [{ value: 'open', label: 'Open' }] }];
const type = (text: string) => fireEvent.input(screen.getByRole('searchbox', { name: 'Describe the filters you want' }), { target: { value: text } });
const preview = () => document.querySelector('[data-slot=filter-input-preview]');

describe('FilterInput while the model is not ready', () => {
  it('says the model is loading, and keeps Apply off', async () => {
    model.load.mockImplementation(() => new Promise<never>(() => undefined));
    render(<FilterBar fields={fields}><FilterInput parse={{ debounceMs: 0 }} /></FilterBar>);
    type('open');
    await waitFor(() => expect(preview()?.textContent).toContain('Loading the language model'));
    expect(screen.getByRole('button', { name: 'Apply' }).hasAttribute('data-disabled')).toBe(true);
  });

  it('says the model could not be loaded, with an icon, and points to the Filter menu', async () => {
    model.load.mockImplementation(() => Promise.reject(new Error('offline')));
    render(<FilterBar fields={fields}><FilterInput parse={{ debounceMs: 0 }} /></FilterBar>);
    type('open');
    await waitFor(() => expect(preview()?.textContent).toContain('could not be loaded'));
    expect(preview()?.querySelector('svg')).toBeTruthy();
  });

  it('hides the description, and its aria-describedby, with description={false}', () => {
    model.load.mockImplementation(() => new Promise<never>(() => undefined));
    render(<FilterBar fields={fields}><FilterInput description={false} /></FilterBar>);
    expect(screen.getByRole('searchbox').hasAttribute('aria-describedby')).toBe(false);
    expect(screen.getByRole('searchbox').getAttribute('maxlength')).toBe('240');
  });
});
