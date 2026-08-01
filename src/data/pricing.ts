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

/** Every priced option list shares this shape, which is all pricing needs. */
interface Priced {
  id: string;
  name: string;
  price: number;
}

export function calcPrice(config: Config): { total: number; items: PriceItem[] } {
  const layoutName = LAYOUTS.find((l) => l.id === config.layout)?.name ?? config.layout;
  const items: PriceItem[] = [{ label: `Base · ${layoutName}`, amount: BASE[config.layout] }];

  const push = (options: readonly Priced[], id: string) => {
    const option = options.find((o) => o.id === id);
    if (option && option.price > 0) items.push({ label: option.name, amount: option.price });
  };

  push(CASE_OPTIONS, config.case);
  push(COLORWAYS, config.colorway);
  push(SWITCH_OPTIONS, config.switches);
  push(PLATE_OPTIONS, config.plate);
  push(CABLE_OPTIONS, config.cable);
  push(WRIST_OPTIONS, config.wrist);

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return { total, items };
}
