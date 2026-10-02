'use client';
import { useEffect, useState, type RefObject } from 'react';
import { useChromeHidden } from '@/lib/theme';

/** Whether floating chrome (a TabBar, a floating sheet or chat) should hide: the shared chrome state says the
 *  bars are hidden, or `scrollRef` was scrolled down (it returns on scroll-up and at the top). Always false when
 *  `hideOnScroll` is off. */
export function useScrollHidden(hideOnScroll: boolean, scrollRef?: RefObject<HTMLElement | null>): boolean {
  const chromeHidden = useChromeHidden();
  const [scrollHidden, setScrollHidden] = useState(false);
  useEffect(() => {
    const scroller = scrollRef?.current;
    if (!scroller || !hideOnScroll) {
      setScrollHidden(false);
      return;
    }
    let previous = scroller.scrollTop;
    const onScroll = () => {
      const next = scroller.scrollTop;
      const delta = next - previous;
      previous = next;
      if (next < 4) setScrollHidden(false);
      else if (delta > 3) setScrollHidden(true);
      else if (delta < -3) setScrollHidden(false);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [scrollRef, hideOnScroll]);
  return hideOnScroll && (chromeHidden || scrollHidden);
}
