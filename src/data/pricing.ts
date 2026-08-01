import { LAYOUTS } from './layouts';
import type { Config } from './options';
import { CABLE_OPTIONS, CASE_OPTIONS, COLORWAYS, PLATE_OPTIONS, SWITCH_OPTIONS, WRIST_OPTIONS } from './options';

const BASE: Record<Config['layout'], number> = {
  '65': 289,
  '75': 309,
  tkl: 329,
};

export interface PriceItem {
  label: string;
  amount: number;
}

export function calcPrice(config: Config): { total: number; items: PriceItem[] } {
  const layoutName = LAYOUTS.find((l) => l.id === config.layout)?.name ?? config.layout;
  const items: PriceItem[] = [{ label: `Base · ${layoutName}`, amount: BASE[config.layout] }];

  const push = (label: string, amount: number) => {
    if (amount > 0) items.push({ label, amount });
  };

  push(CASE_OPTIONS.find((c) => c.id === config.case)?.name ?? '', CASE_OPTIONS.find((c) => c.id === config.case)?.price ?? 0);
  push(COLORWAYS.find((c) => c.id === config.colorway)?.name ?? '', COLORWAYS.find((c) => c.id === config.colorway)?.price ?? 0);
  push(SWITCH_OPTIONS.find((s) => s.id === config.switches)?.name ?? '', SWITCH_OPTIONS.find((s) => s.id === config.switches)?.price ?? 0);
  push(PLATE_OPTIONS.find((p) => p.id === config.plate)?.name ?? '', PLATE_OPTIONS.find((p) => p.id === config.plate)?.price ?? 0);
  push(CABLE_OPTIONS.find((c) => c.id === config.cable)?.name ?? '', CABLE_OPTIONS.find((c) => c.id === config.cable)?.price ?? 0);
  push(WRIST_OPTIONS.find((w) => w.id === config.wrist)?.name ?? '', WRIST_OPTIONS.find((w) => w.id === config.wrist)?.price ?? 0);

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return { total, items };
}
