// app/api/googleCalendar/route.ts
import { NextResponse } from 'next/server';

// Read calendar ID and API key from environment variables.
const CALENDAR_ID = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID || '';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';

// Event metadata provided by Google Calendar API may include:
//   id, summary, description, location, start, end, colorId, htmlLink, attendees, status, organizer, etc.
export async function GET() {
  // Calculate current week's Monday and next Monday
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const timeMin = monday.toISOString();
  const timeMax = nextMonday.toISOString();

  // Build the Google Calendar API URL.
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    CALENDAR_ID
  )}/events?key=${API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=10`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to fetch events.' },
        { status: 500 }
      );
    }
    const data = await response.json();

    // Normalize events: always provide a 'start' ISO string
    const normalizedEvents = (data.items || []).map((item: any) => ({
      ...item,
      start:
        item.start?.dateTime ||
        item.start?.date ||
        '', // fallback to empty string if missing
    }));

    // Log the fetched results for the week
    console.log('Fetched Google Calendar events for the week:', normalizedEvents);

    return NextResponse.json({ events: normalizedEvents });
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}