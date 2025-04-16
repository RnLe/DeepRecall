// TwelveWeekSelector.tsx
"use client";

import React, { useState } from "react";

// Helper: Compute the start of the week (assuming Monday as the start)
function getStartOfWeek(date: Date): Date {
  const day = date.getDay();
  // If it's Sunday (0), go back 6 days; otherwise, subtract (day - 1)
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const TwelveWeekSelector: React.FC = () => {
  // Offset in weeks (can be negative or positive)
  const [offset, setOffset] = useState<number>(0);

  // Get today's date and compute current week start (Monday)
  const today = new Date();
  const currentWeekStart = getStartOfWeek(today);

  // Compute the base date for display using the current offset.
  // When offset=0, week 0 is the current week (starting on Monday).
  const baseDate = new Date(currentWeekStart.getTime() + offset * 7 * 24 * 60 * 60 * 1000);

  // Create an array (of length 12) of week objects with start and end dates.
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const weekStart = new Date(baseDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    return { start: weekStart, end: weekEnd };
  });

  // Helper: Returns true if today's date falls within the given week.
  const isCurrentWeek = (week: { start: Date; end: Date }): boolean =>
    week.start.getTime() <= today.getTime() && today.getTime() <= week.end.getTime();

  // Create month groups from the weeks (to display the months row).
  interface MonthGroup {
    month: string;
    count: number;
  }
  const monthGroups: MonthGroup[] = [];
  weeks.forEach((week, i) => {
    // Get full month name, e.g., "January"
    const monthName = week.start.toLocaleString("default", { month: "long" });
    if (i === 0) {
      monthGroups.push({ month: monthName, count: 1 });
    } else {
      const lastGroup = monthGroups[monthGroups.length - 1];
      if (lastGroup.month === monthName) {
        lastGroup.count += 1;
      } else {
        monthGroups.push({ month: monthName, count: 1 });
      }
    }
  });

  // Compute year display. If the first and last week fall in the same year, display that year,
  // otherwise display a range.
  const startYear = weeks[0].start.getFullYear();
  const endYear = weeks[weeks.length - 1].end.getFullYear();
  const yearLabel = startYear === endYear ? startYear.toString() : `${startYear} - ${endYear}`;

  // Shift weeks by one.
  const shiftWeeks = (direction: number) => {
    setOffset((prev) => prev + direction);
  };

  return (
    <div className="min-w-[800px] p-4 bg-gray-100 text-gray-900 border rounded shadow-md">
      {/* Now Button */}
      <div className="flex justify-start mb-2">
        <button
          onMouseDown={(e) => e.stopPropagation()} // prevent canvas dragging
          onClick={() => setOffset(0)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Now
        </button>
      </div>
      <div className="text-center font-bold text-xl mb-2">{yearLabel}</div>
      <div className="flex border-t border-b border-gray-300">
        {monthGroups.map((group, idx) => {
          const groupWidth = `${(group.count / 12) * 100}%`;
          return (
            <div
              key={idx}
              className="border-r border-gray-300 flex items-center justify-center"
              style={{ width: groupWidth }}
            >
              <span className="text-sm font-medium">{group.month}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center mt-4">
        {/* Left Arrow */}
        <button
          onMouseDown={(e) => e.stopPropagation()} // prevent canvas dragging
          onClick={() => shiftWeeks(-1)}
          className="px-2 py-1 bg-blue-500 text-white rounded mr-2"
        >
          &#8592;
        </button>
        {/* Week cards container (no fade animation) */}
        <div className="flex space-x-2">
          {weeks.map((week, idx) => {
            // Format the start and end dates (e.g., "Feb 12 - Feb 18")
            const startStr = week.start.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });
            const endStr = week.end.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });
            const current = isCurrentWeek(week);
            return (
              <div
                key={idx}
                className={`flex flex-col items-center justify-start border rounded p-2 w-24 ${
                  current ? "bg-green-300" : "bg-white"
                }`}
              >
                <div className="font-bold">Week {idx + 1}</div>
                <div className="text-xs">
                  {startStr} &ndash;<br />{endStr}
                </div>
              </div>
            );
          })}
        </div>
        {/* Right Arrow */}
        <button
          onMouseDown={(e) => e.stopPropagation()} // prevent canvas dragging
          onClick={() => shiftWeeks(1)}
          className="px-2 py-1 bg-blue-500 text-white rounded ml-2"
        >
          &#8594;
        </button>
      </div>
    </div>
  );
};

export default TwelveWeekSelector;
