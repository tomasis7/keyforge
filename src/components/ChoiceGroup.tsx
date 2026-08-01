interface ChoiceOption {
  id: string;
  name: string;
  desc?: string;
  meta?: string;
}

interface Props {
  legend: string;
  name: string;
  value: string;
  options: ChoiceOption[];
  onChange: (id: string) => void;
}

export function ChoiceGroup({ legend, name, value, options, onChange }: Props) {
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
