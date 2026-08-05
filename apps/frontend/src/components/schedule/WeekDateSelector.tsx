import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const shortDayLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function WeekDateSelector({
  weekDates,
  selectedIndex,
  todayKey,
  weekOffset,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  onResetWeek,
  formatDateKey,
}: {
  weekDates: Date[];
  selectedIndex: number;
  todayKey: string;
  weekOffset: number;
  onSelectDay: (index: number) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onResetWeek: () => void;
  formatDateKey: (date: Date) => string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={onPrevWeek}
          aria-label="Previous week"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px solid #2a2a2a",
            background: "#141414",
            color: "#f5f5f5",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={16} />
        </button>

        {weekOffset !== 0 ? (
          <button
            type="button"
            onClick={onResetWeek}
            style={{
              border: "none",
              background: "transparent",
              color: "#ff7a1a",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            Back to this week
          </button>
        ) : (
          <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
            This week
          </span>
        )}

        <button
          type="button"
          onClick={onNextWeek}
          aria-label="Next week"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px solid #2a2a2a",
            background: "#141414",
            color: "#f5f5f5",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 6,
          width: "100%",
        }}
      >
        {weekDates.map((date, index) => {
          const isSelected = index === selectedIndex;
          const isToday = formatDateKey(date) === todayKey;

          return (
            <button
              key={shortDayLabels[index]}
              type="button"
              onClick={() => onSelectDay(index)}
              style={{
                width: "100%",
                minWidth: 0,
                minHeight: 68,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 16,
                border: isToday && !isSelected ? "1px solid rgba(255,122,26,0.4)" : "1px solid transparent",
                background: isSelected ? "linear-gradient(180deg, #ff9a3d, #ff7a00)" : "#141414",
                color: isSelected ? "#111111" : "#9ca3af",
                cursor: "pointer",
                padding: "10px 2px",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.02em" }}>
                {shortDayLabels[index]}
              </span>
              <span style={{ fontSize: 17, fontWeight: 900, color: isSelected ? "#111111" : "#ffffff" }}>
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
