import type { Metadata, Viewport } from "next";
import { Cairo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { LocalModeInitializer } from "@/components/local-mode-initializer";
import { startGlobalPomodoroTicker } from "@/store/use-pomodoro";

// Start the global Pomodoro ticker at module load time — it runs independently
// of which panel is active, so the timer keeps ticking in the background.
if (typeof window !== "undefined") {
  startGlobalPomodoroTicker();
}

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "لوحة التحكم الشخصية | Business Dashboard",
  description: "لوحة تحكم متكاملة لرجل الأعمال — تقويم، اتصالات، مهام، مالية، وأكثر",
  keywords: ["dashboard", "business", "calendar", "Aleppo", "prayer times"],
  authors: [{ name: "Personal Dashboard" }],
  icons: {
    icon: "/logo.svg",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); }`,
          }}
        />
      </head>
      <body
        className={`${cairo.variable} ${geistMono.variable} font-arabic antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <LocalModeInitializer />
          {children}
          <Toaster />
          <SonnerToaster position="top-center" richColors closeButton style={{ zIndex: 9999 }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
