// GoogleIntegrationCard.tsx
import React, { useState } from 'react';
import { FloatingModal } from './FloatingModal';
import { GoogleTestWidget, CalendarEvent } from './GoogleTestWidget';

export const GoogleIntegrationCard: React.FC = () => {
  // Connection status: 'none', 'pending', 'error', or 'connected'
  const [status, setStatus] = useState<'none' | 'pending' | 'error' | 'connected'>('none');
  const [showTestWidget, setShowTestWidget] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[] | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // This function calls our API route and returns the events.
  const connectToGoogle = async () => {
    const res = await fetch('/api/googleCalendar');
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to fetch events');
    }
    const data = await res.json();
    return data.events;
  };

  // Called to initiate a connection and fetch events.
  const handleConnect = async () => {
    setStatus('pending');
    setEventsError(null);
    setLoadingEvents(true);
    try {
      const events = await connectToGoogle();
      setGoogleEvents(events);
      setStatus('connected');
      // Log the fetched results for the week
      console.log('Fetched Google Calendar events for the week:', events);
    } catch (err: any) {
      console.error('Connection error:', err);
      setStatus('error');
      setEventsError(err.message || 'Unknown error');
      setGoogleEvents(null);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Determine status indicator.
  let statusColor = 'bg-gray-500';
  let statusTooltip = 'Not connected';
  if (status === 'pending') {
    statusTooltip = 'Connecting...';
  } else if (status === 'error') {
    statusColor = 'bg-orange-500';
    statusTooltip = 'Connection Error';
  } else if (status === 'connected') {
    statusColor = 'bg-green-500';
    statusTooltip = 'Connected';
  }

  return (
    <div className="flex items-center p-4 mb-4 bg-gray-700 rounded shadow border border-gray-600 cursor-pointer relative"
         onClick={() => { setShowTestWidget(true); if (status !== 'connected') handleConnect(); }}>
      <div className="flex items-center flex-1">
        <div className="mr-4 relative">
          {/* Google Calendar icon */}
          <img
            src="/icons/integrations/googleCalendarIcon.svg"
            alt="Google Calendar Icon"
            className="w-8 h-8"
          />
          {status === 'pending' ? (
            <div title={statusTooltip} className="absolute -bottom-1 -right-1">
              <span className="animate-spin text-white text-xs">🔄</span>
            </div>
          ) : (
            <div
              title={statusTooltip}
              className={`w-3 h-3 rounded-full absolute -bottom-1 -right-1 ${statusColor} border border-gray-800`}
            ></div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-white font-bold">Google Calendar</p>
        </div>
      </div>

      {/* Floating Test Widget Modal */}
      {showTestWidget && (
        <FloatingModal onClose={() => setShowTestWidget(false)}>
          <GoogleTestWidget
            onClose={() => setShowTestWidget(false)}
            isConnected={status === 'connected'}
            loading={loadingEvents}
            error={eventsError}
            events={googleEvents}
          />
        </FloatingModal>
      )}
    </div>
  );
};

export default GoogleIntegrationCard;
