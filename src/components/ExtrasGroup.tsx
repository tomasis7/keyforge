import { CABLE_OPTIONS, WRIST_OPTIONS } from '../data/options';
import { useConfigurator } from '../store/configurator';
import { ChoiceGroup } from './ChoiceGroup';
import { SwatchGroup } from './SwatchGroup';

export function ExtrasGroup() {
  const cable = useConfigurator((s) => s.cable);
  const wrist = useConfigurator((s) => s.wrist);
  const set = useConfigurator((s) => s.set);

  return (
    <div className="extras">
      <SwatchGroup
        legend="Cable"
        name="cable"
        value={cable}
        options={CABLE_OPTIONS}
        onChange={(id) => set('cable', id)}
      />
      <ChoiceGroup
        legend="Wrist rest"
        name="wrist"
        value={wrist}
        options={WRIST_OPTIONS}
        onChange={(id) => set('wrist', id)}
      />
    </div>
  );
}
