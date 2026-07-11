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
  // Allow external API calls to these domains
  allowNavigation: [
    "api.z.ai",
    "api.open-meteo.com",
    "openstreetmap.org",
    "*.openstreetmap.org",
    "tile.openstreetmap.org",
    "unpkg.com",
    "wa.me",
  ],
};

export default config;
