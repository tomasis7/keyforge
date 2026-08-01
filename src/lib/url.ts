import { LAYOUTS } from '../data/layouts';
import {
  CABLE_OPTIONS,
  CASE_OPTIONS,
  COLORWAYS,
  DEFAULT_CONFIG,
  PLATE_OPTIONS,
  SWITCH_OPTIONS,
  WRIST_OPTIONS,
  type Config,
} from '../data/options';

const PARAM_MAP: Record<keyof Config, string> = {
  layout: 'l',
  case: 'c',
  colorway: 'k',
  switches: 's',
  plate: 'p',
  cable: 'cab',
  wrist: 'wr',
};

const ID_SETS: Record<keyof Config, readonly string[]> = {
  layout: LAYOUTS.map((l) => l.id),
  case: CASE_OPTIONS.map((o) => o.id),
  colorway: COLORWAYS.map((o) => o.id),
  switches: SWITCH_OPTIONS.map((o) => o.id),
  plate: PLATE_OPTIONS.map((o) => o.id),
  cable: CABLE_OPTIONS.map((o) => o.id),
  wrist: WRIST_OPTIONS.map((o) => o.id),
};

export function parseSearch(search: string): Partial<Config> {
  const params = new URLSearchParams(search);
  const parsed: Partial<Config> = {};
  for (const key of Object.keys(PARAM_MAP) as (keyof Config)[]) {
    const raw = params.get(PARAM_MAP[key]);
    if (raw !== null && ID_SETS[key].includes(raw)) {
      (parsed as Record<string, string>)[key] = raw;
    }
  }
  return parsed;
}

export function serializeParams(config: Config): string {
  const params: string[] = [];
  for (const key of Object.keys(PARAM_MAP) as (keyof Config)[]) {
    if (config[key] !== DEFAULT_CONFIG[key]) {
      params.push(`${PARAM_MAP[key]}=${encodeURIComponent(config[key])}`);
    }
  }
  return params.join('&');
}

/**
 * Changes closer together than this collapse into the existing history entry.
 *
 * Every change used to replaceState, so Back left the site and took the build
 * with it. Pushing on every change is the opposite problem: nudging through
 * five colorways would bury the referring page under five entries. Coalescing
 * by time means deliberate, spaced-out edits are undoable and rapid fiddling
 * is not.
 */
export const HISTORY_COALESCE_MS = 700;

export function historyMethod(msSinceLastWrite: number): 'pushState' | 'replaceState' {
  return msSinceLastWrite < HISTORY_COALESCE_MS ? 'replaceState' : 'pushState';
}

export function configUrl(config: Config): string {
  const query = serializeParams(config);
  return query ? `${window.location.pathname}?${query}` : window.location.pathname;
}

let lastWrite = Number.NEGATIVE_INFINITY;

export function syncUrl(config: Config, now = Date.now()): void {
  const url = configUrl(config);
  // Applying a popstate writes the same URL straight back through the store
  // subscription; without this guard that would push a duplicate entry and
  // make Back appear to do nothing.
  if (url === window.location.pathname + window.location.search) return;

  window.history[historyMethod(now - lastWrite)](null, '', url);
  lastWrite = now;
}
