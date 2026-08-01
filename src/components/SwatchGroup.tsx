interface SwatchOption<Id extends string> {
  id: Id;
  name: string;
  hex?: string | null;
  colors?: [string, string, string];
}

interface Props<Id extends string> {
  legend: string;
  name: string;
  value: Id;
  options: readonly SwatchOption<Id>[];
  onChange: (id: Id) => void;
}

export function SwatchGroup<Id extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: Props<Id>) {
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
                {/* Keyed by position: the three zones are a fixed-length tuple,
                    and a colorway may legitimately repeat a colour across them. */}
                {option.colors.map((color, i) => (
                  <span key={i} style={{ background: color }} />
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
