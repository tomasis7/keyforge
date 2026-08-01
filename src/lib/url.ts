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

export function syncUrl(config: Config): void {
  const query = serializeParams(config);
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}
