import { useMemo } from 'react';
import type { LayoutId } from '../data/layouts';
import type { CaseOption, ColorwayOption } from '../data/options';
import { buildBoard, KEY_R, TOP_R } from '../lib/keyboard';

interface Props {
  layout: LayoutId;
  caseOption: CaseOption;
  colorway: ColorwayOption;
}

export function KeyboardSVG({ layout, caseOption, colorway }: Props) {
  const board = useMemo(() => buildBoard(layout), [layout]);

  const labelColor = (zone: 'alpha' | 'mod' | 'accent') =>
    zone === 'alpha' ? colorway.onAlpha : zone === 'mod' ? colorway.onMod : colorway.onAccent;

  const zoneColor = (zone: 'alpha' | 'mod' | 'accent') =>
    zone === 'alpha' ? colorway.alpha : zone === 'mod' ? colorway.mod : colorway.accent;

  return (
    <svg
      className="board"
      viewBox={`0 0 ${board.widthPx} ${board.heightPx}`}
      width="100%"
      role="img"
      aria-label={`${board.name} keyboard, ${caseOption.name.toLowerCase()} case, ${colorway.name.toLowerCase()} keycaps`}
    >
      <rect
        className="board-case"
        x={0}
        y={0}
        width={board.widthPx}
        height={board.heightPx}
        rx={18}
        fill={caseOption.hex}
        stroke="var(--line-strong)"
      />
      {board.keys.map((key) => {
        const fill = zoneColor(key.zone);
        return (
          <g key={key.keyId} className="key" data-key-id={key.keyId} data-zone={key.zone}>
            <rect
              className="key-base"
              x={key.bx}
              y={key.by}
              width={key.bw}
              height={key.bh}
              rx={KEY_R}
              style={{ fill: `color-mix(in srgb, ${fill} 68%, black)` }}
            />
            <rect
              className="key-top"
              x={key.tx}
              y={key.ty}
              width={key.tw}
              height={key.th}
              rx={TOP_R}
              style={{ fill }}
            />
            {key.label !== '' && (
              <text
                className="key-label"
                x={key.tx + key.tw / 2}
                y={key.ty + key.th / 2}
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fill: labelColor(key.zone), fontFamily: 'var(--font-mono)', fontSize: 13 }}
              >
                {key.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
