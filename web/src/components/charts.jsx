import { CHART_COLORS } from "./chartColors";

export function Donut({ data, size = 168, thickness = 22, centerLabel, centerValue }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={thickness}
        />
        {total > 0 &&
          data.map((d) => {
            const length = (d.value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const circle = (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              >
                <title>{`${d.label}: ${d.value}`}</title>
              </circle>
            );
            offset += length;
            return circle;
          })}
      </g>
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        className="fill-slate-900"
        style={{ fontSize: 26, fontWeight: 700 }}
      >
        {centerValue ?? total}
      </text>
      {centerLabel ? (
        <text
          x="50%"
          y="60%"
          textAnchor="middle"
          className="fill-slate-400"
          style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}
        >
          {centerLabel}
        </text>
      ) : null}
    </svg>
  );
}

export function DonutLegend({ data }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
          <span className="flex-1 truncate text-slate-600">{d.label}</span>
          <span className="font-semibold tabular-nums text-slate-800">{d.value}</span>
          <span className="w-9 text-right text-xs tabular-nums text-slate-400">
            {Math.round((d.value / total) * 100)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Bars({ data, height = 150, color = CHART_COLORS.blue }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[10px] font-semibold tabular-nums text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
            {d.value}
          </span>
          <div
            className="w-full rounded-t-md transition-all"
            style={{
              height: `${Math.max(2, (d.value / max) * 100)}%`,
              background: color,
              opacity: d.value === 0 ? 0.15 : 1,
            }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="max-w-full truncate text-[10px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function AreaTrend({ data, height = 170, color = CHART_COLORS.blue }) {
  const width = 640;
  const padding = { top: 16, right: 12, bottom: 26, left: 28 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + innerH - (d.value / max) * innerH;
    return { x, y, ...d };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${padding.left},${padding.top + innerH} ${line} ${padding.left + innerW},${padding.top + innerH}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => (
        <line
          key={t}
          x1={padding.left}
          x2={padding.left + innerW}
          y1={padding.top + innerH * t}
          y2={padding.top + innerH * t}
          stroke="#f1f5f9"
          strokeWidth="1"
        />
      ))}
      <polygon points={area} fill="url(#areaFill)" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r="3" fill={color}>
          <title>{`${p.label}: ${p.value}`}</title>
        </circle>
      ))}
      {data.map((d, i) => {
        if (data.length > 8 && i % 2 !== 0) return null;
        return (
          <text
            key={d.label}
            x={padding.left + i * stepX}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-400"
            style={{ fontSize: 10 }}
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

export function HBarList({ data, color = CHART_COLORS.blue, valueSuffix = "" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between text-sm">
            <span className="truncate text-slate-600">{d.label}</span>
            <span className="font-semibold tabular-nums text-slate-800">
              {d.value}
              {valueSuffix}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
