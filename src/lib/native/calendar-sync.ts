// Web-only stub for CalendarSync — no native calendar on web.
export interface CalendarSyncPlugin {
  getCalendars(): Promise<any[]>;
  getEvents(opts: { startTime: number; endTime: number }): Promise<any[]>;
  createEvent(opts: { title: string; startDate: number; endDate?: number; location?: string; notes?: string }): Promise<{ id: string } | null>;
}

const CalendarSync: CalendarSyncPlugin = {
  getCalendars: async () => [],
  getEvents: async () => [],
  createEvent: async () => null,
};

export default CalendarSync;
