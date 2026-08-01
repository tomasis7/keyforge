interface ChoiceOption<Id extends string> {
  id: Id;
  name: string;
  desc?: string;
  meta?: string;
}

interface Props<Id extends string> {
  legend: string;
  name: string;
  value: Id;
  options: readonly ChoiceOption<Id>[];
  onChange: (id: Id) => void;
}

// Generic over the id union so onChange hands back e.g. LayoutId rather than
// string, and wiring a group to the wrong option list fails to compile.
export function ChoiceGroup<Id extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: Props<Id>) {
  return (
    <fieldset className="option-group">
      <legend className="option-legend">{legend}</legend>
      <div className="choice-row">
        {options.map((option) => (
          <label key={option.id} className="choice-card">
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={option.id === value}
              onChange={() => onChange(option.id)}
              className="sr-radio"
            />
            <span className="choice-card-main">
              <span className="choice-card-name">{option.name}</span>
              {option.meta && <span className="choice-card-meta">{option.meta}</span>}
              {option.desc && <span className="choice-card-desc">{option.desc}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
