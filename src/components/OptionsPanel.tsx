import { captureLayoutFlip } from '../animations/keyboard';
import { LAYOUTS } from '../data/layouts';
import {
  CASE_OPTIONS,
  COLORWAYS,
  PLATE_OPTIONS,
  SWITCH_OPTIONS,
} from '../data/options';
import { useConfigurator } from '../store/configurator';
import { ChoiceGroup } from './ChoiceGroup';
import { ExtrasGroup } from './ExtrasGroup';
import { SwatchGroup } from './SwatchGroup';

const COLORWAY_SWATCHES = COLORWAYS.map((c) => ({
  id: c.id,
  name: c.name,
  colors: [c.alpha, c.mod, c.accent] as [string, string, string],
}));

const SWITCH_CHOICES = SWITCH_OPTIONS.map((s) => ({
  id: s.id,
  name: s.name,
  desc: s.desc,
  meta: `${s.type} · ${s.force}`,
}));

export function OptionsPanel() {
  const layout = useConfigurator((s) => s.layout);
  const caseId = useConfigurator((s) => s.case);
  const colorway = useConfigurator((s) => s.colorway);
  const switches = useConfigurator((s) => s.switches);
  const plate = useConfigurator((s) => s.plate);
  const set = useConfigurator((s) => s.set);
  const randomize = useConfigurator((s) => s.randomize);
  const reset = useConfigurator((s) => s.reset);

  const handleRandomize = () => {
    captureLayoutFlip();
    randomize();
  };

  const handleReset = () => {
    captureLayoutFlip();
    reset();
  };

  return (
    <aside className="options-panel" aria-label="Build options" data-reveal>
      <header className="options-header">
        <h3 className="options-title">Options</h3>
        <button type="button" className="btn btn-ghost" onClick={handleRandomize}>
          Surprise me
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleReset}>
          Reset
        </button>
      </header>
      <ChoiceGroup
        legend="Layout"
        name="layout"
        value={layout}
        options={LAYOUTS}
        onChange={(id) => {
          captureLayoutFlip();
          set('layout', id);
        }}
      />
      <SwatchGroup
        legend="Case finish"
        name="case"
        value={caseId}
        options={CASE_OPTIONS}
        onChange={(id) => set('case', id)}
      />
      <SwatchGroup
        legend="Keycaps"
        name="colorway"
        value={colorway}
        options={COLORWAY_SWATCHES}
        onChange={(id) => set('colorway', id)}
      />
      <ChoiceGroup
        legend="Switches"
        name="switches"
        value={switches}
        options={SWITCH_CHOICES}
        onChange={(id) => set('switches', id)}
      />
      <ChoiceGroup
        legend="Plate"
        name="plate"
        value={plate}
        options={PLATE_OPTIONS}
        onChange={(id) => set('plate', id)}
      />
      <ExtrasGroup />
    </aside>
  );
}
