import { useId, useMemo } from 'react';
import type { LayoutId } from '../data/layouts';
import type { CaseOption, ColorwayOption } from '../data/options';
import { keyBaseColor } from '../lib/color';
import { buildBoard, KEY_R, TOP_R } from '../lib/keyboard';

interface Props {
  layout: LayoutId;
  caseOption: CaseOption;
  colorway: ColorwayOption;
}

export function KeyboardSVG({ layout, caseOption, colorway }: Props) {
  const board = useMemo(() => buildBoard(layout), [layout]);
  const sheenId = `sheen-${useId().replace(/:/g, '')}`;

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
      <defs>
        <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.08" />
          <stop offset="0.45" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
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
              style={{ fill: keyBaseColor(fill) }}
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
            <rect
              className="key-sheen"
              x={key.tx}
              y={key.ty}
              width={key.tw}
              height={key.th}
              rx={TOP_R}
              fill={`url(#${sheenId})`}
              pointerEvents="none"
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
