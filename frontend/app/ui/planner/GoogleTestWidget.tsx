// GoogleTestWidget.tsx
import React from 'react';

export interface CalendarEvent {
  summary: string;
  start: string | { dateTime?: string; date?: string };
  colorId?: string;
  _parsedDate?: Date;
}

interface GoogleTestWidgetProps {
  onClose: () => void;
  isConnected: boolean;
  loading: boolean;
  error: string | null;
  events: CalendarEvent[] | null;
}

export const GoogleTestWidget: React.FC<GoogleTestWidgetProps> = ({
  onClose,
  isConnected,
  loading,
  error,
  events,
}) => {
  // Helper: Get Monday of current week
  const getWeekDays = (): Date[] => {
    const today = new Date();
    // Calculate Monday (assumes week starts on Monday)
    const day = today.getDay(); // Sunday = 0, Monday = 1, etc.
    const diff = (day === 0 ? -6 : 1 - day); 
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDays();

  // Group events by date (formatted as 'YYYY-MM-DD')
  const eventsByDay = weekDays.reduce((acc, day) => {
    const key = day.toISOString().slice(0, 10);
    acc[key] = [];
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  if (events) {
    events.forEach((event) => {
      // Accept both date and dateTime, fallback to event.start
      let dateStr = '';
      if (typeof event.start === 'string') {
        dateStr = event.start;
      } else if (event.start && typeof event.start === 'object') {
        dateStr = event.start.dateTime || event.start.date || '';
      }
      const dateObj = new Date(dateStr);
      // Only add if the date is valid
      if (!isNaN(dateObj.getTime())) {
        const key = dateObj.toISOString().slice(0, 10);
        if (eventsByDay[key]) {
          eventsByDay[key].push({ ...event, _parsedDate: dateObj });
        }
      }
    });
    // Sort events for each day by time
    Object.keys(eventsByDay).forEach((key) => {
      eventsByDay[key].sort((a, b) => {
        const aDate = (a as any)._parsedDate as Date;
        const bDate = (b as any)._parsedDate as Date;
        return aDate.getTime() - bDate.getTime();
      });
    });
  }

  // Mapping colorId (from Google Calendar) to CSS colors.
  const colorMap: Record<string, string> = {
    "1": "#a4bdfc",
    "2": "#7ae7bf",
    "3": "#dbadff",
    "4": "#ff887c",
    "5": "#fbd75b",
    "6": "#ffb878",
    "7": "#46d6db",
    "8": "#e1e1e1",
    "9": "#5484ed",
    "10": "#51b749",
    "11": "#dc2127"
  };

  return (
    <div className="bg-gray-800 p-4 rounded shadow-lg w-full relative">
      <button onClick={onClose} className="absolute top-2 right-2 text-white">
        Cancel
      </button>
      <h3 className="text-lg font-bold text-white mb-4">Google Calendar - This Week</h3>
      {!isConnected && (
        <p className="text-yellow-300">Not connected. Please check your credentials.</p>
      )}
      {isConnected && loading && <p className="text-white">Loading events...</p>}
      {isConnected && error && <p className="text-red-500">{error}</p>}
      
      {isConnected && !loading && !error && events && (
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const dayKey = day.toISOString().slice(0, 10);
            return (
              <div
                key={dayKey}
                className="border p-2 rounded bg-gray-700 min-w-[110px] max-w-[140px] flex flex-col"
              >
                <div className="font-bold text-center text-white mb-2">
                  {/* Format the header to show day name and date */}
                  {day.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                {eventsByDay[dayKey].length > 0 ? (
                  <ul className="text-white text-sm">
                    {eventsByDay[dayKey].map((event, index) => {
                      // Show time if available
                      let timeStr = '';
                      let dateObj = (event as any)._parsedDate as Date;
                      if (dateObj && !isNaN(dateObj.getTime())) {
                        // Only show time if it's not an all-day event (has time component)
                        if (
                          typeof event.start === 'string'
                            ? event.start.length > 10
                            : !!event.start?.dateTime
                        ) {
                          timeStr = dateObj
                            .toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            .replace(/^0/, '');
                        }
                      }
                      // Determine the event color if provided.
                      const eventColor = event.colorId ? colorMap[event.colorId] : undefined;
                      return (
                        <li key={index} className="mb-1">
                          {timeStr && (
                            <span className="text-blue-300 mr-1">{timeStr}</span>
                          )}
                          <span style={eventColor ? { color: eventColor } : {}}>
                            {event.summary}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-gray-400 text-xs text-center">No events</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isConnected && !loading && !error && events && events.length === 0 && (
        <p className="text-white">No events found for this week.</p>
      )}
    </div>
  );
};
