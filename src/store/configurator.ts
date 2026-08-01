import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
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
import { calcPrice } from '../data/pricing';
import { parseSearch, syncUrl } from '../lib/url';

interface ConfigStore extends Config {
  set: <K extends keyof Config>(key: K, value: Config[K]) => void;
  randomize: () => void;
  reset: () => void;
}

const pick = <T,>(options: readonly T[]): T =>
  options[Math.floor(Math.random() * options.length)];

const randomConfig = (): Config => ({
  layout: pick(LAYOUTS.map((l) => l.id)),
  case: pick(CASE_OPTIONS.map((o) => o.id)),
  colorway: pick(COLORWAYS.map((o) => o.id)),
  switches: pick(SWITCH_OPTIONS.map((o) => o.id)),
  plate: pick(PLATE_OPTIONS.map((o) => o.id)),
  cable: pick(CABLE_OPTIONS.map((o) => o.id)),
  wrist: pick(WRIST_OPTIONS.map((o) => o.id)),
});

export const useConfigurator = create<ConfigStore>()((set) => ({
  ...DEFAULT_CONFIG,
  ...parseSearch(window.location.search),
  set: (key, value) => set({ [key]: value } as Partial<Config>),
  randomize: () => set(randomConfig()),
  reset: () => set({ ...DEFAULT_CONFIG }),
}));

useConfigurator.subscribe((state) => syncUrl(state));

// useShallow keeps the identity of the returned object stable while the config
// fields are unchanged. Without it every store write produces a new object,
// which under zustand 4 costs a needless render and under zustand 5 — where the
// selector runs inside useSyncExternalStore directly — is a render loop.
export function useConfig(): Config {
  return useConfigurator(
    useShallow((state) => ({
      layout: state.layout,
      case: state.case,
      colorway: state.colorway,
      switches: state.switches,
      plate: state.plate,
      cable: state.cable,
      wrist: state.wrist,
    })),
  );
}

export function usePrice(): ReturnType<typeof calcPrice> {
  const config = useConfig();
  return useMemo(() => calcPrice(config), [config]);
}
