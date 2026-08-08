import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { LocalModeInitializer } from "@/components/local-mode-initializer";

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
      <body className="font-arabic antialiased bg-background text-foreground">
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
