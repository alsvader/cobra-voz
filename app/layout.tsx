import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CobraVoz",
    template: "%s · CobraVoz",
  },
  description: "Cobra fácilmente, sin dejar de atender tu negocio.",
  applicationName: "CobraVoz",
  appleWebApp: {
    capable: true,
    title: "CobraVoz",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#107B75",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${dmSans.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <OfflineBanner />
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
