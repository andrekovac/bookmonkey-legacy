import React from 'react';

// Small bar chart drawn by hand in SVG (2024). No chart library, we only need bars.
//
//   <BarChart
//     data={[{ label: '2024-03', values: { Hamburg: 9, Berlin: 3 } }]}
//     series={['Hamburg', 'Berlin']}
//     formatValue={v => v + ' €'}
//   />
//
// With one series the bars are simple, with more they are stacked.
const COLORS = ['#7a3e1d', '#c27c4a', '#e3b98f', '#5d7a8c', '#9bb3c1'];
const WIDTH = 720;
const PAD = { top: 16, right: 12, bottom: 42, left: 54 };

// 0, 5, 10, 15 ... a max that looks good on the axis
function niceMax(value) {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function total(values, series) {
  return series.reduce((sum, s) => sum + (Number(values[s]) || 0), 0);
}

export default function BarChart({ data, series, height, formatValue, formatLabel, title }) {
  const h = height || 240;
  const keys = series && series.length ? series : ['value'];
  const rows = (data || []).map(d => ({
    label: d.label,
    values: d.values || { value: d.value }
  }));
  const fmt = formatValue || (v => String(v));
  const fmtLabel = formatLabel || (l => l);

  if (!rows.length) return <div className="c-chart c-chart--empty">-</div>;

  const max = niceMax(Math.max.apply(null, rows.map(r => total(r.values, keys))));
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = h - PAD.top - PAD.bottom;
  const slot = innerW / rows.length;
  const barW = Math.max(4, Math.min(48, slot * 0.7));
  const y = v => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => max * f);
  // only every 2nd/3rd label when there are many bars
  const every = rows.length > 18 ? 3 : rows.length > 9 ? 2 : 1;

  return (
    <figure className="c-chart">
      <svg
        viewBox={'0 0 ' + WIDTH + ' ' + h}
        className="c-chart__svg"
        role="img"
        aria-label={title || ''}
        preserveAspectRatio="xMidYMid meet"
      >
        {ticks.map(t => (
          <g key={t} className="c-chart__tick">
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end">{fmt(Math.round(t * 100) / 100)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          let base = 0;
          return (
            <g key={r.label} className="c-chart__bar">
              {keys.map((k, idx) => {
                const v = Number(r.values[k]) || 0;
                if (!v) return null;
                const top = y(base + v);
                const rect = (
                  <rect
                    key={k}
                    x={x}
                    y={top}
                    width={barW}
                    height={Math.max(0, y(base) - top)}
                    fill={COLORS[idx % COLORS.length]}
                  >
                    <title>{fmtLabel(r.label) + (keys.length > 1 ? ', ' + k : '') + ': ' + fmt(v)}</title>
                  </rect>
                );
                base += v;
                return rect;
              })}
              {i % every === 0 && (
                <text className="c-chart__label" x={x + barW / 2} y={h - PAD.bottom + 16} textAnchor="middle">
                  {fmtLabel(r.label)}
                </text>
              )}
            </g>
          );
        })}
        <line className="c-chart__axis" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} />
      </svg>
      {keys.length > 1 && (
        <figcaption className="c-chart__legend">
          {keys.map((k, idx) => (
            <span key={k} className="c-chart__legend-item">
              <span className="c-chart__swatch" style={{ background: COLORS[idx % COLORS.length] }} />
              {k}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
