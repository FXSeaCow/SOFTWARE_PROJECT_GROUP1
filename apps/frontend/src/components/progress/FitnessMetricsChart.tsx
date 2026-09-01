import React, { useId } from "react";

export type ChartPoint = {
  label: string;
  value: number;
  date?: string;
};

function parseChartPointTime(date: string): number | null {
  const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function FitnessMetricsChart({
  points,
  unit,
  accent = "#ff7a1a",
  emptyMessage = "Not enough data to show a trend yet.",
}: {
  points: ChartPoint[];
  unit: string;
  accent?: string;
  emptyMessage?: string;
}) {
  const gradientId = `fitness-chart-fill-${useId()}`;
  void emptyMessage;

  const width = 640;
  const height = 200;
  const paddingX = 12;
  const paddingY = 20;

  const values = points.map((point) => point.value);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const valueRange = maxValue - minValue || 1;

  const plotWidth = width - paddingX * 2;
  const parsedTimes = points.map((point) => (point.date ? parseChartPointTime(point.date) : null));
  const validTimes = parsedTimes.filter((time): time is number => time !== null);
  const minTime = validTimes.length === points.length ? Math.min(...validTimes) : null;
  const maxTime = validTimes.length === points.length ? Math.max(...validTimes) : null;
  const timeRange = minTime !== null && maxTime !== null ? maxTime - minTime : 0;
  const shouldScaleByTime = timeRange > 0;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = points.map((point, index) => {
    let x = paddingX + stepX * index;

    if (points.length === 1) {
      x = paddingX + plotWidth / 2;
    } else if (shouldScaleByTime && parsedTimes[index] !== null && minTime !== null) {
      x = paddingX + ((parsedTimes[index] - minTime) / timeRange) * plotWidth;
    }

    const normalized = maxValue === minValue ? 0.32 : (point.value - minValue) / valueRange;
    const y = height - paddingY - normalized * (height - paddingY * 2);
    return { x, y, point };
  });

  const emptyLineY = height - paddingY - 0.18 * (height - paddingY * 2);
  const lineCoords =
    coords.length === 0
      ? [
          { x: paddingX, y: emptyLineY },
          { x: width - paddingX, y: emptyLineY },
        ]
      : coords.length === 1
      ? [
          { ...coords[0], x: paddingX },
          { ...coords[0], x: width - paddingX },
        ]
      : coords;

  const linePath = lineCoords
    .map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${lineCoords[lineCoords.length - 1].x.toFixed(1)} ${height - paddingY} L ${lineCoords[0].x.toFixed(1)} ${height - paddingY} Z`;
  const hasData = coords.length > 0;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: 200, minWidth: 320, display: "block" }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {hasData ? <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" /> : null}
        <path
          d={linePath}
          fill="none"
          stroke={hasData ? accent : "rgba(141,152,167,0.42)"}
          strokeWidth={hasData ? 2.5 : 2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coords.map((coord, index) => (
          <circle key={index} cx={coord.x} cy={coord.y} r={3.5} fill={accent} stroke="#111111" strokeWidth={1.5} />
        ))}
      </svg>

      <div
        style={{
          position: "relative",
          height: 20,
          marginTop: 6,
        }}
      >
        {coords.map((coord, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${(coord.x / width) * 100}%`,
              transform:
                index === 0
                  ? "translateX(0)"
                  : index === points.length - 1
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
              textAlign: index === 0 ? "left" : index === points.length - 1 ? "right" : "center",
              color: "#8d98a7",
              fontSize: 11,
              fontWeight: 700,
              maxWidth: 86,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {coord.point.label}
          </div>
        ))}
      </div>
    </div>
  );
}
