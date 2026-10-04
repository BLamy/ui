// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { pushedTitle } from '@/lib/title-flight';

const el = (scrolled = false) => {
  const e = document.createElement('div');
  if (scrolled) e.setAttribute('data-scrolled', '');
  return e;
};

describe('pushedTitle', () => {
  it('flies the large title while it is showing', () => {
    const large = el();
    expect(pushedTitle({ el: el(), large })).toBe(large);
  });
  it('flies nothing once the large title has scrolled under the bar', () => {
    const inline = el();
    inline.style.opacity = '1';
    expect(pushedTitle({ el: el(true), large: el(), inline })).toBeNull();
  });
  it('still flies the inline title of a screen with no large title', () => {
    const inline = el();
    inline.style.opacity = '1';
    document.body.append(inline); // computed style needs it attached
    expect(pushedTitle({ el: el(true), inline })).toBe(inline);
  });
});
