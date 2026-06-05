import { describe, expect, it } from 'vitest';
import { BarSmoothAnimator } from '../../cdn-webgl/src/stubs/renderer-lite-stub.js';

describe('cdn-webgl renderer-lite stub', () => {
  it('BarSmoothAnimator is a no-op (setSmoothPriceUpdate safe on webgl CDN)', () => {
    const frames: unknown[] = [];
    const animator = new BarSmoothAnimator(150, (bar) => frames.push(bar));
    expect(() => {
      animator.setDuration(200);
      animator.animateTo({ t: 1, o: 1, h: 2, l: 0.5, c: 1.5 });
      animator.cancel();
    }).not.toThrow();
    expect(frames).toHaveLength(0);
  });
});