// Web-only stub for CallLogSync — no native call log on web.
export interface CallLogSyncPlugin {
  getCallLogs(opts: { limit?: number }): Promise<any[]>;
}

const CallLogSync: CallLogSyncPlugin = {
  getCallLogs: async () => [],
};

export default CallLogSync;
