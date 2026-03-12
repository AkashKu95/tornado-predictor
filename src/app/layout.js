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
                const APP_VERSION = '1.0.0';
                const VERSION_KEY = 'tp_app_version';
                const CRASH_FLAG_KEY = 'tp_app_crashed';

                function approximateLocalStorageSize() {
                  try {
                    let total = 0;
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      const value = localStorage.getItem(key);
                      total += (key ? key.length : 0) + (value ? value.length : 0);
                    }
                    return total;
                  } catch (e) {
                    return 0;
                  }
                }

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

                var storedVersion = null;
                try {
                  storedVersion = localStorage.getItem(VERSION_KEY);
                } catch (e) {}

                var hadCrash = false;
                try {
                  hadCrash = localStorage.getItem(CRASH_FLAG_KEY) === '1';
                } catch (e) {}

                var lsSize = approximateLocalStorageSize();
                var isHeavySession = lsSize > 200 * 1024; // ~200KB of localStorage text

                var shouldNuke =
                  !storedVersion ||
                  storedVersion !== APP_VERSION ||
                  hadCrash ||
                  isHeavySession;

                if (shouldNuke) {
                  clearAllClientState();
                  try {
                    localStorage.setItem(VERSION_KEY, APP_VERSION);
                    localStorage.removeItem(CRASH_FLAG_KEY);
                  } catch (e) {}
                  window.location.reload();
                }

                window.addEventListener('error', function () {
                  try { localStorage.setItem(CRASH_FLAG_KEY, '1'); } catch (e) {}
                });
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
