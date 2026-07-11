import { registerPlugin } from "@capacitor/core";

export interface AppDrawerPlugin {
  openAppDrawer(): Promise<{ success: boolean }>;
  goHome(): Promise<void>;
}

const AppDrawer = registerPlugin<AppDrawerPlugin>("AppDrawer", {
  web: {
    openAppDrawer: async () => ({ success: false }),
    goHome: async () => {},
  },
});

export default AppDrawer;
