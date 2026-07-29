import React from "react";

export type ChartPoint = {
  label: string;
  value: number;
};

export function FitnessMetricsChart({
  points,
  unit,
  accent = "#ff7a1a",
}: {
  points: ChartPoint[];
  unit: string;
  accent?: string;
}) {
  if (points.length < 2) {
    return (
      <div style={{ color: "#8d98a7", fontSize: 14, padding: "24px 0" }}>
        Log at least two measurements to see a trend chart.
      </div>
    );
  }

  const width = 640;
  const height = 200;
  const paddingX = 12;
  const paddingY = 20;

  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const stepX = (width - paddingX * 2) / (points.length - 1);

  const coords = points.map((point, index) => {
    const x = paddingX + stepX * index;
    const normalized = (point.value - minValue) / valueRange;
    const y = height - paddingY - normalized * (height - paddingY * 2);
    return { x, y, point };
  });

  const linePath = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height - paddingY} L ${coords[0].x.toFixed(1)} ${height - paddingY} Z`;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: 200, minWidth: 320, display: "block" }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="fitness-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#fitness-chart-fill)" stroke="none" />
        <path d={linePath} fill="none" stroke={accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {coords.map((coord, index) => (
          <circle key={index} cx={coord.x} cy={coord.y} r={3.5} fill={accent} stroke="#111111" strokeWidth={1.5} />
        ))}
      </svg>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
          gap: 4,
          marginTop: 6,
        }}
      >
        {points.map((point, index) => (
          <div
            key={index}
            style={{
              textAlign: index === 0 ? "left" : index === points.length - 1 ? "right" : "center",
              color: "#8d98a7",
              fontSize: 11,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {point.label}
          </div>
        ))}
      </div>

      <div style={{ color: "#d3dae5", fontSize: 12, marginTop: 4 }}>
        Range: {minValue.toFixed(1)}
        {unit} – {maxValue.toFixed(1)}
        {unit}
      </div>
    </div>
  );
}
