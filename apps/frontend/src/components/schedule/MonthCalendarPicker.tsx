import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const weekDayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const monthLabelFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

const navButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "1px solid #2a2a2a",
  background: "#1a1a1a",
  color: "#f5f5f5",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

export function MonthCalendarPicker({
  initialMonth,
  selectedDate,
  todayKey,
  formatDateKey,
  onSelectDate,
  onClose,
}: {
  initialMonth: Date;
  selectedDate: Date;
  todayKey: string;
  formatDateKey: (date: Date) => string;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(initialMonth));

  const firstDayOffset = mondayIndex(visibleMonth);
  const totalDays = daysInMonth(visibleMonth);
  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstDayOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
  }

  const selectedKey = formatDateKey(selectedDate);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 340,
          borderRadius: 20,
          background: "#141414",
          border: "1px solid #2a2a2a",
          padding: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            aria-label="Previous month"
            style={navButtonStyle}
          >
            <ChevronLeft size={16} />
          </button>
          <div style={{ color: "#ffffff", fontWeight: 800, fontSize: 15 }}>
            {monthLabelFormatter.format(visibleMonth)}
          </div>
          <button
            type="button"
            onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            aria-label="Next month"
            style={navButtonStyle}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: 4,
            marginBottom: 6,
          }}
        >
          {weekDayLabels.map((label) => (
            <div key={label} style={{ textAlign: "center", color: "#6b7280", fontSize: 11, fontWeight: 700 }}>
              {label}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: 4,
          }}
        >
          {cells.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} />;
            }

            const key = formatDateKey(date);
            const isSelected = key === selectedKey;
            const isToday = key === todayKey;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(date)}
                style={{
                  minHeight: 36,
                  borderRadius: 10,
                  border: isToday && !isSelected ? "1px solid rgba(255,122,26,0.5)" : "1px solid transparent",
                  background: isSelected ? "linear-gradient(180deg, #ff9a3d, #ff7a00)" : "transparent",
                  color: isSelected ? "#111111" : "#f5f5f5",
                  fontSize: 13,
                  fontWeight: isSelected ? 900 : 600,
                  cursor: "pointer",
                }}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
