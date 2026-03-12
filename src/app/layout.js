import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Tornado Predictor",
  description: "Real-time NOAA/SPC 3-Day Severe Weather Outlook and Live Alerts",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                function clearAllClientState() {
                  try { localStorage.clear(); } catch (e) {}
                  try { sessionStorage.clear(); } catch (e) {}
                  if ('caches' in window) {
                    caches.keys().then(function (keys) {
                      keys.forEach(function (k) { caches.delete(k); });
                    });
                  }
                  if ('indexedDB' in window) {
                    ['tornado-predictor-db', 'app-db', 'offline-cache'].forEach(function (name) {
                      try { indexedDB.deleteDatabase(name); } catch (e) {}
                    });
                  }
                }

                // Always clear client-side state on each full page load
                // so the app starts from a clean slate.
                clearAllClientState();

                // Aggressively unregister any existing service workers for this origin
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function (registrations) {
                    registrations.forEach(function (registration) {
                      registration.unregister();
                    });
                  });
                }
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
