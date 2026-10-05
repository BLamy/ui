import { describe, expect, it } from 'vitest';
import {
  codeOf, describe as describeSpec, fromPeak, physicsOf, physicsSpec, sample, springPeak, springSpec, syncSpring, timeOf, toFramer, tweenSpec,
} from './easing';

describe('springs', () => {
  it('converts between time and physics the way framer-motion does, both ways', () => {
    const p = physicsOf(0.5, 0.25);
    const t = timeOf(p.stiffness, p.damping, p.mass);
    expect(t.duration).toBeCloseTo(0.5, 6);
    expect(t.bounce).toBeCloseTo(0.25, 6);
  });

  it('treats mass like framer-motion: the same motion as stiffness and damping divided by it', () => {
    const a = timeOf(400, 30, 2);
    const b = timeOf(200, 15, 1);
    expect(a.duration).toBeCloseTo(b.duration, 6);
    expect(a.bounce).toBeCloseTo(b.bounce, 6);
  });

  it('keeps both forms in step', () => {
    const s = syncSpring({ ...springSpec(0.4, 0.2), mode: 'physics', stiffness: 380, damping: 40 });
    expect(s.duration).toBeCloseTo(timeOf(380, 40, 1).duration, 2);
  });

  it('samples a spring with framer-motion and settles where the kit says it does', () => {
    // lib/motion.ts `springs.smooth` (380 / 40) is sampled to 550ms in tokens.css.
    const s = sample(physicsSpec(380, 40));
    expect(s.at(0)).toBe(0);
    expect(s.duration).toBeGreaterThan(450);
    expect(s.duration).toBeLessThan(700);
    expect(s.at(s.duration)).toBe(1);
  });

  it('finds the first peak, and finds the spring back from it', () => {
    const peak = springPeak(0.6, 0.4);
    expect(peak).not.toBeNull();
    const s = sample(springSpec(0.6, 0.4));
    const at = s.at(peak!.t * 1000);
    expect(at).toBeCloseTo(1 + peak!.over, 2);
    const back = fromPeak(peak!.t, peak!.over);
    expect(back.duration).toBeCloseTo(0.6, 3);
    expect(back.bounce).toBeCloseTo(0.4, 3);
    expect(springPeak(0.6, 0)).toBeNull();
  });
});

describe('to framer-motion', () => {
  it('writes time springs as visualDuration and bounce', () => {
    expect(toFramer(springSpec(0.4, 0.2, 0.1))).toEqual({ type: 'spring', visualDuration: 0.4, bounce: 0.2, delay: 0.1 });
    expect(codeOf(springSpec(0.4, 0.2))).toBe("{ type: 'spring', visualDuration: 0.4, bounce: 0.2 }");
  });

  it('slows a spring down by scaling its physics, keeping its shape', () => {
    const f = toFramer(springSpec(0.4, 0.2), 0.5);
    const p = physicsOf(0.4, 0.2);
    expect(f.stiffness).toBeCloseTo(p.stiffness / 4, 6);
    expect(f.damping).toBeCloseTo(p.damping / 2, 6);
  });

  it('writes tweens with their easing, repeat and delay', () => {
    const t = { ...tweenSpec(0.3, [0.32, 0.72, 0, 1], 0.05), repeat: -1, repeatType: 'mirror' as const };
    expect(toFramer(t)).toEqual({ type: 'tween', duration: 0.3, ease: [0.32, 0.72, 0, 1], delay: 0.05, repeat: Infinity, repeatType: 'mirror', repeatDelay: 0 });
    expect(codeOf(t)).toBe("{ duration: 0.3, ease: [0.32, 0.72, 0, 1], delay: 0.05, repeat: Infinity, repeatType: 'mirror' }");
    expect(describeSpec(t)).toBe('iOS · 0.3s · after 0.05s');
  });

  it('samples tweens with framer-motion easings', () => {
    const s = sample(tweenSpec(0.5, 'easeInOut'));
    expect(s.duration).toBe(500);
    expect(s.at(250)).toBeCloseTo(0.5, 3);
    expect(sample(tweenSpec(0.5, 'backOut')).at(400)).toBeGreaterThan(1);
  });
});
