import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "pro.datascoop.sela",
  appName: "صلة سكوب",
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
    "personal-dashboard-mu-lyart.vercel.app",
  ],
};

export default config;
