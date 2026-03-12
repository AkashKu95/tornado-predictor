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

                // Best-effort mobile crash prevention:
                // - Clear heavy client-side state on each full page load
                // - Unregister stale service workers
                // - Catch and log fatal errors instead of letting the app hard-crash.

                try {
                  clearAllClientState();
                } catch (e) {
                  console.warn('Client state clear failed', e);
                }

                // Aggressively unregister any existing service workers for this origin
                try {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function (registrations) {
                      registrations.forEach(function (registration) {
                        registration.unregister();
                      });
                    });
                  }
                } catch (e) {
                  console.warn('Service worker cleanup failed', e);
                }

                // Global safety net: prevent uncaught errors from killing the UI, especially on low-memory phones.
                window.addEventListener('error', function (event) {
                  console.error('Global error handler:', event.error || event.message);
                });
                window.addEventListener('unhandledrejection', function (event) {
                  console.error('Unhandled promise rejection:', event.reason);
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
