import { registerPlugin } from "@capacitor/core";

export interface PhoneCalendar {
  id: string;
  name: string;
  accountName: string;
  accountType: string;
  color: number;
}

export interface PhoneCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: number;
  endTime: number;
  allDay: boolean;
  calendarId: string;
  color: number;
}

export interface CalendarSyncPlugin {
  checkPermissions(): Promise<{ read: string; write: string }>;
  requestPermissions(): Promise<{ read: string; write: string }>;
  getCalendars(): Promise<{ calendars: PhoneCalendar[] }>;
  getEvents(options: { startTime?: number; endTime?: number }): Promise<{ events: PhoneCalendarEvent[] }>;
  createEvent(options: {
    title: string;
    description?: string;
    location?: string;
    startTime: number;
    endTime: number;
    allDay?: boolean;
  }): Promise<{ success: boolean; eventId: number }>;
}

const CalendarSync = registerPlugin<CalendarSyncPlugin>("CalendarSync", {
  web: {
    checkPermissions: async () => ({ read: "denied", write: "denied" }),
    requestPermissions: async () => ({ read: "denied", write: "denied" }),
    getCalendars: async () => ({ calendars: [] }),
    getEvents: async () => ({ events: [] }),
    createEvent: async () => ({ success: false, eventId: 0 }),
  },
});

export default CalendarSync;
