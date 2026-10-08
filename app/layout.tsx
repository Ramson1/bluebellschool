import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import 'bootstrap/dist/css/bootstrap.min.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bluebell International School",
  description: "Bluebell International School Management System",
};

// Mobile viewport hardening so the fixed bottom tab bar is ALWAYS visible:
// - interactive-widget=resizes-content: when the on-screen keyboard opens,
//   the layout viewport shrinks instead of staying full height, so the dock
//   rises above the keyboard instead of hiding behind it.
// - viewport-fit=cover: lets env(safe-area-inset-bottom) report a real value
//   on notched phones, so the dock isn't overlapped by the browser toolbar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {/* Theme init (runs before paint): applies the saved dark/light choice,
            seeding the OS preference when nothing was chosen yet — prevents a
            theme flash on load. Toggled from the sidebar (src/utils/theme.js). */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('jmis-theme');if(t!=='dark'&&t!=='light'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`}
        </Script>
        {/* Mammoth.js powers the .docx import tooling. It is loaded via
            next/script (afterInteractive) instead of a raw <head> tag so it
            never blocks first paint. AdSense is deliberately not installed: a
            clone must never carry another publisher's ad account. */}
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
