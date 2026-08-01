interface SwatchOption {
  id: string;
  name: string;
  hex?: string | null;
  colors?: [string, string, string];
}

interface Props {
  legend: string;
  name: string;
  value: string;
  options: SwatchOption[];
  onChange: (id: string) => void;
}

export function SwatchGroup({ legend, name, value, options, onChange }: Props) {
  return (
    <fieldset className="option-group">
      <legend className="option-legend">{legend}</legend>
      <div className="swatch-row">
        {options.map((option) => (
          <label key={option.id} className="swatch">
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={option.id === value}
              onChange={() => onChange(option.id)}
              className="sr-radio"
            />
            {option.colors ? (
              <span className="swatch-chip swatch-chip-strip">
                {option.colors.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
            ) : (
              <span
                className={option.hex ? 'swatch-chip' : 'swatch-chip swatch-chip--none'}
                style={option.hex ? { background: option.hex } : undefined}
              />
            )}
            <span className="swatch-name">{option.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
