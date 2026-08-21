// Web-only stub for AppDrawer — no native app drawer on web.
export interface AppDrawerPlugin {
  openAppDrawer(): Promise<{ success: boolean }>;
  goHome(): Promise<void>;
  openNotifications(): Promise<{ success: boolean }>;
}

const AppDrawer: AppDrawerPlugin = {
  openAppDrawer: async () => ({ success: false }),
  goHome: async () => {},
  openNotifications: async () => ({ success: false }),
};

export default AppDrawer;
