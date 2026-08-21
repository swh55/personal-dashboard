import { registerPlugin } from "@capacitor/core";

export interface AppDrawerPlugin {
  openAppDrawer(): Promise<{ success: boolean }>;
  goHome(): Promise<void>;
  openNotifications(): Promise<{ success: boolean }>;
}

const AppDrawer = registerPlugin<AppDrawerPlugin>("AppDrawer", {
  web: {
    openAppDrawer: async () => ({ success: false }),
    goHome: async () => {},
    openNotifications: async () => ({ success: false }),
  },
});

export default AppDrawer;
