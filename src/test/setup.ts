import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * jsdom has no matchMedia, and every animation entry point checks
 * prefers-reduced-motion at call time. Reporting "reduce" makes the animation
 * layer short-circuit, which is what we want here: jsdom has no layout engine,
 * so GSAP's measurements would be meaningless anyway. The animations
 * themselves are verified against a real browser.
 */
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
