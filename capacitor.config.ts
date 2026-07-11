import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.abdullah.dashboard",
  appName: "لوحة التحكم الشخصية",
  webDir: "out",
  android: {
    allowMixedContent: true,
    backgroundColor: "#0a0e1a",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
