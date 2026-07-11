import { registerPlugin } from "@capacitor/core";

export interface PhoneCallLog {
  id: string;
  number: string;
  name: string | null;
  date: number;
  duration: number;
  direction: "incoming" | "outgoing" | "missed" | "unknown";
  type: string;
}

export interface CallLogSyncPlugin {
  checkPermissions(): Promise<{ read: string }>;
  requestPermissions(): Promise<{ read: string }>;
  getCallLogs(options: { limit?: number }): Promise<{ logs: PhoneCallLog[] }>;
}

const CallLogSync = registerPlugin<CallLogSyncPlugin>("CallLogSync", {
  web: {
    checkPermissions: async () => ({ read: "denied" }),
    requestPermissions: async () => ({ read: "denied" }),
    getCallLogs: async () => ({ logs: [] }),
  },
});

export default CallLogSync;
