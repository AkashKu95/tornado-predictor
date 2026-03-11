'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, Tornado, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchTornadoData, fetchLocalWeather, fetchDetailedForecast } from '@/lib/noaaApi';
import * as turf from '@turf/turf';
import LocationControls from '@/components/LocationControls';
import AlertDashboard from '@/components/AlertDashboard';
import { parseOutlookSummary } from '@/lib/alertParser';

// Dynamically import the map because Leaflet requires the window object
const TornadoMap = dynamic(() => import('@/components/TornadoMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0f19' }}>
      <p style={{ fontSize: '1.2rem', color: '#94a3b8' }}>Initializing Premium Map Engine...</p>
    </div>
  )
});

export default function Home() {
  const [selectedDay, setSelectedDay] = useState(1);
  const [geoData, setGeoData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [centerLocation, setCenterLocation] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [localTornadoRisk, setLocalTornadoRisk] = useState(null);
  const [localForecast, setLocalForecast] = useState([]);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [isDiscussionCollapsed, setIsDiscussionCollapsed] = useState(false);
  const [isForecastCollapsed, setIsForecastCollapsed] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Collapse discussion by default on mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDiscussionCollapsed(window.innerWidth < 768);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const data = await fetchTornadoData(selectedDay);
      setGeoData(data);
      setIsLoading(false);
    }
    loadData();
  }, [selectedDay]);

  // Load the detailed textual forecast when the location changes
  useEffect(() => {
    async function loadForecast() {
      if (centerLocation) {
        setIsForecastLoading(true);
        setLocalForecast([]);
        const periods = await fetchDetailedForecast(centerLocation.lat, centerLocation.lon);
        setLocalForecast(periods);
        setIsForecastLoading(false);
      }
    }
    loadForecast();
  }, [centerLocation]);

  // Request the user's location on initial load so the banner shows by default
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenterLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            name: "My Location",
            zoom: 8
          });
        },
        (error) => {
          console.log("Geolocation permission denied or failed on load, skipping default location.", error);
        }
      );
    }
  }, []);

  useEffect(() => {
    async function loadWeather() {
      if (centerLocation) {
        setIsWeatherLoading(true);
        setCurrentWeather(null);
        const weather = await fetchLocalWeather(centerLocation.lat, centerLocation.lon);
        setCurrentWeather(weather);
        setIsWeatherLoading(false);
      } else {
        setCurrentWeather(null);
      }
    }
    loadWeather();
  }, [centerLocation]);

  // Calculate local tornado risk EXACTLY for Day 1 (Today) only
  useEffect(() => {
    async function evaluateTodayRisk() {
      if (centerLocation) {
        try {
          // Explicitly evaluate against Day 1 data regardless of selectedDay state
          let dataToEvaluate = geoData;
          if (selectedDay !== 1 || !geoData) {
            const data = await fetchTornadoData(1);
            dataToEvaluate = data;
          }

          if (!dataToEvaluate || !dataToEvaluate.features) {
            setLocalTornadoRisk(null);
            return;
          }

          const pt = turf.point([centerLocation.lon, centerLocation.lat]);
          let highestRisk = null;
          let highestRiskValue = -1;

          dataToEvaluate.features.forEach(feature => {
            if (turf.booleanPointInPolygon(pt, feature)) {
              let rawProb = feature.properties.LABEL !== undefined && feature.properties.LABEL !== null
                ? feature.properties.LABEL
                : (feature.properties.label !== undefined && feature.properties.label !== null
                  ? feature.properties.label
                  : feature.properties.dn);

              if (typeof rawProb === 'string' && rawProb.startsWith('0.') && !isNaN(rawProb)) {
                rawProb = String(parseFloat(rawProb) * 100);
              }

              let rawProbStr = String(rawProb);
              if (rawProbStr.includes('CIG') || rawProbStr === 'SIGN') return;
              let val = parseInt(rawProbStr.replace('%', '')) || 0;

              if (val > highestRiskValue) {
                highestRiskValue = val;

                let formattedLabel = rawProbStr;
                if (formattedLabel === '0' || formattedLabel.toLowerCase().includes('low')) {
                  formattedLabel = "Predictability Too Low";
                } else if (!formattedLabel.includes('%') && !isNaN(formattedLabel)) {
                  formattedLabel = formattedLabel + "%";
                }

                highestRisk = {
                  label: formattedLabel,
                  type: selectedDay >= 3 ? "Severe" : "Tornado"
                };
              }
            }
          });

          if (highestRisk) {
            setLocalTornadoRisk(highestRisk);
          } else {
            setLocalTornadoRisk({ label: "None Expected", type: selectedDay >= 3 ? "Severe" : "Tornado" });
          }
        } catch (e) {
          console.error("Error evaluating local risk:", e);
          setLocalTornadoRisk(null);
        }
      } else {
        setLocalTornadoRisk(null);
      }
    }
    evaluateTodayRisk();
  }, [centerLocation]);

  // Reusable Risk Legend mapping for Desktop and Mobile
  const renderMapLegend = () => {
    if (!geoData || !geoData.features || geoData.features.length === 0) return null;
    return (
      <div className="glass-panel p-2 md:p-6 origin-top-right scale-75 md:origin-bottom-right md:scale-100 pointer-events-none md:pointer-events-auto opacity-90 md:opacity-100">
        <h3 style={{ marginBottom: '8px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8' }}>
          {selectedAlert ? "Warning & Radar" : (selectedDay === 1 || selectedDay === 2 ? "Tornado Risk" : "Probabilistic Severe")}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
          {selectedAlert ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: '#ef4444', border: '1px solid rgba(255,255,255,0.7)', borderRadius: '2px', opacity: 0.5, borderStyle: 'dashed' }}></div>
                <span style={{ color: '#e2e8f0' }}>Warning Polygon</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'linear-gradient(90deg, #00f, #0f0, #ff0, #f00)', borderRadius: '2px', opacity: 0.8 }}></div>
                <span style={{ color: '#e2e8f0' }}>RainViewer Radar</span>
              </div>
            </>
          ) : selectedDay === 1 || selectedDay === 2 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--prob-2)', borderRadius: '2px' }}></div>
                <span style={{ color: '#e2e8f0' }}>2% Prob</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--prob-5)', borderRadius: '2px' }}></div>
                <span style={{ color: '#e2e8f0' }}>5% Prob</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--prob-10)', borderRadius: '2px' }}></div>
                <span style={{ color: '#e2e8f0' }}>10% Prob</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--prob-15)', borderRadius: '2px' }}></div>
                <span style={{ color: '#e2e8f0' }}>15% Prob</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--prob-30)', borderRadius: '2px' }}></div>
                <span style={{ color: '#e2e8f0' }}>30% Prob</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--prob-45)', borderRadius: '2px' }}></div>
                <span style={{ color: '#e2e8f0' }}>45% Prob</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--prob-60)', borderRadius: '2px' }}></div>
                <span style={{ color: '#e2e8f0' }}>60% Prob</span>
              </div>
            </>
          ) : (
            <>
              {selectedDay === 3 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', background: 'var(--prob-5)', borderRadius: '2px' }}></div>
                  <span style={{ color: '#e2e8f0' }}>5% Prob</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--prob-10)', borderRadius: '2px' }}></div>
                <span style={{ color: '#e2e8f0' }}>15% Prob</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--prob-15)', borderRadius: '2px' }}></div>
                <span style={{ color: '#e2e8f0' }}>30% Prob</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--prob-30)', borderRadius: '2px' }}></div>
                <span style={{ color: '#e2e8f0' }}>45% Prob</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--prob-45)', borderRadius: '2px' }}></div>
                <span style={{ color: '#e2e8f0' }}>60% Prob</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="main-layout">
      {/* Background Map layer */}
      <TornadoMap data={geoData} day={selectedDay} centerLocation={centerLocation} selectedAlert={selectedAlert} activeAlerts={activeAlerts} />

      {/* Overlay UI - Top Weather Banner */}
      {centerLocation && (
        <div className="overlay-ui absolute bottom-[130px] md:bottom-auto md:top-6 left-1/2 -translate-x-1/2 z-[600] w-[95vw] md:w-auto opacity-95 md:opacity-100">
          <div className="glass-panel" style={{
            display: 'flex', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between',
            padding: '2px 6px', gap: '4px', width: '100%',
            background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(52, 211, 153, 0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', borderRadius: '16px',
            overflow: 'hidden'
          }}>
            {isWeatherLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '8px', color: '#94a3b8' }}>
                <RefreshCw size={12} className="animate-spin" />
                <span style={{ fontSize: '11px', fontWeight: 500 }}>Fetching weather...</span>
              </div>
            ) : currentWeather ? (
              <>
                {/* Location and condition compressed horizontally */}
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', minWidth: 0, flex: 1, gap: '6px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {centerLocation.name}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentWeather.shortForecast}
                  </span>
                </div>

                <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

                {/* Temperature block */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>
                    {currentWeather.temperature}&deg;
                  </div>
                  <div className="hidden sm:flex" style={{ flexDirection: 'column', color: '#cbd5e1', fontSize: '10px' }}>
                    <span>Wind: {currentWeather.windSpeed}</span>
                    <span>RH: {currentWeather.relativeHumidity?.value ? Math.round(currentWeather.relativeHumidity.value) + '%' : 'N/A'}</span>
                  </div>
                </div>

                {/* Tornado Risk block */}
                {localTornadoRisk && (
                  <>
                    <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                        background: localTornadoRisk.label === 'None Expected' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Tornado size={10} color={localTornadoRisk.label === 'None Expected' ? '#34d399' : '#ef4444'} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'white', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                          {localTornadoRisk.label}
                        </span>
                        <span style={{ fontSize: '8px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                          {localTornadoRisk.type} Risk
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
                <span style={{ fontSize: '11px', fontWeight: 500 }}>Unavailable</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay UI - Header & Location */}
      <div className="overlay-ui absolute top-2 md:top-6 left-2 md:left-6 right-2 md:right-6 flex flex-col md:flex-row justify-between items-start gap-3 md:gap-4 z-[1000] pointer-events-none">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
          <div className="glass-panel" style={{ padding: '8px 12px', background: 'rgba(15, 23, 42, 0.85)' }}>
            <h1 style={{ fontSize: 'clamp(1rem, 5vw, 2.25rem)', fontWeight: 800, margin: 0, lineHeight: 1.2, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>Tornado Predictor</h1>
            <p className="hidden sm:block" style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px', margin: 0 }}>NOAA SPC 3-Day Severe Weather Outlook</p>
          </div>
          <LocationControls onLocationSelect={setCenterLocation} />

          <div style={{ marginTop: '16px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <AlertDashboard onAlertSelect={setSelectedAlert} onAlertsLoaded={setActiveAlerts} />

            {/* Forecast Discussion Panel - Mobile Positioned Here */}
            <div className={`glass-panel flex md:hidden transition-all duration-300 ease-in-out ${isDiscussionCollapsed ? 'w-fit' : 'w-[calc(100vw-48px)]'} max-h-[40vh]`} style={{
              flexDirection: 'column',
              pointerEvents: 'auto',
              overflow: 'hidden',
              padding: '0'
            }}>
              <div
                style={{ padding: isDiscussionCollapsed ? '10px 16px' : '16px 20px', borderBottom: isDiscussionCollapsed ? 'none' : '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: 'pointer' }}
                onClick={() => setIsDiscussionCollapsed(!isDiscussionCollapsed)}
              >
                <h2 style={{ fontSize: isDiscussionCollapsed ? '0.9rem' : '1rem', margin: 0, color: '#e0f2fe', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }}></span>
                  <span className={isDiscussionCollapsed ? "hidden sm:inline" : ""}>Day {selectedDay}</span> Forecast
                </h2>
              </div>

              {!isDiscussionCollapsed && (
                <div style={{
                  flex: 1,
                  padding: '20px',
                  overflowY: 'auto',
                  fontSize: '0.85rem',
                  color: '#cbd5e1',
                  fontFamily: 'monospace',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap'
                }}>
                  {renderForecastContent(isForecastLoading, localForecast, selectedDay)}
                </div>
              )}
            </div>

            {/* Mobile Risk Legend positioned directly under the forecast tab */}
            <div className="flex md:hidden z-[500] pointer-events-auto w-[calc(100vw-48px)]">
              {renderMapLegend()}
            </div>

          </div>
        </div>

        {/* Reset Button and Loading Indicator */}
        <div className="absolute top-0 right-0 md:static flex flex-col gap-2 md:gap-4 items-end z-[900]" style={{ pointerEvents: 'none' }}>
          <button
            onClick={() => window.location.reload()}
            className="btn glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: 'rgba(52, 211, 153, 0.2)',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              color: '#34d399',
              fontWeight: 600,
              fontSize: '0.9rem',
              pointerEvents: 'auto'
            }}
          >
            <RefreshCw size={16} /> <span className="hidden sm:inline">Reset App</span>
          </button>

          <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', opacity: isLoading ? 1 : 0, transition: 'opacity 0.3s ease', pointerEvents: 'none' }}>
            <p style={{ fontWeight: 600, color: '#34d399' }}>Fetching latest NOAA telemetry...</p>
          </div>

          {/* Forecast Discussion Panel - Desktop Right Side */}
          <div className="glass-panel hidden md:flex transition-all duration-300 ease-in-out" style={{
            width: isForecastCollapsed ? 'auto' : '350px',
            height: isForecastCollapsed ? 'auto' : 'calc(100vh - 280px)',
            flexDirection: 'column',
            pointerEvents: 'auto',
            overflow: 'hidden',
            borderRight: '1px solid rgba(147, 197, 253, 0.2)',
            borderLeft: '4px solid rgba(56, 189, 248, 0.6)'
          }}>
            <div 
              style={{ padding: isForecastCollapsed ? '10px 16px' : '16px 20px', background: 'rgba(15, 23, 42, 0.6)', borderBottom: isForecastCollapsed ? 'transparent' : '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => setIsForecastCollapsed(!isForecastCollapsed)}
            >
              <h2 style={{ fontSize: isForecastCollapsed ? '0.9rem' : '1.05rem', margin: 0, color: '#e0f2fe', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }}></span>
                Day {selectedDay} Local Forecast
              </h2>
              <div style={{ color: '#94a3b8' }}>
                {isForecastCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={20} />}
              </div>
            </div>

            {!isForecastCollapsed && (
              <div style={{
                flex: 1,
                padding: '20px',
                overflowY: 'auto',
                fontSize: '0.85rem',
                color: '#cbd5e1',
                fontFamily: 'monospace',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
                {renderForecastContent(isForecastLoading, localForecast, selectedDay)}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Overlay UI - Timeline Scrubber */}
      <div className="overlay-ui absolute bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 w-[95vw] md:w-auto">
        <div className="glass-panel overflow-x-auto" style={{ padding: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ padding: '0 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Forecast
          </div>
          {[1, 2, 3].map(day => {
            let dateString = '';
            if (isClient) {
              // Calculate the actual date for the forecast day (Day 1 is today)
              const forecastDate = new Date();
              forecastDate.setDate(forecastDate.getDate() + (day - 1));

              // Format to "Mon, Mar 10"
              dateString = forecastDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              });
            }

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`btn ${day === selectedDay ? 'active' : ''}`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 12px', minWidth: '95px' }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  {day === 1 ? 'Today' : `Day ${day}`}
                </span>
                <span style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', minHeight: '18px' }}>
                  {dateString}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Map Legend - Desktop Only (Mobile is rendered inside the left columns) */}
      <div className="hidden md:block absolute bottom-10 right-[390px] z-[500] pointer-events-auto transition-all duration-300">
        {renderMapLegend()}
      </div>
    </main>
  );
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: color, border: '1px solid var(--border)' }} />
      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function renderForecastContent(isLoading, periods, selectedDay) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', opacity: 0.5 }}>
        <div style={{ height: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', width: '40%' }}></div>
        <div style={{ height: '40px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', width: '100%' }}></div>
        <div style={{ height: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', width: '40%' }}></div>
        <div style={{ height: '40px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', width: '90%' }}></div>
      </div>
    );
  }

  if (!periods || periods.length === 0) {
    return <div style={{ opacity: 0.8 }}>No detailed forecast available for this location.</div>;
  }

  // Find the periods corresponding to the selected day.
  // Day 1 => periods 0 and 1 (Today, Tonight)
  // Day 2 => periods 2 and 3 (Tomorrow, Tomorrow Night)
  // Day 3 => periods 4 and 5
  // We determine this logically by finding the first period that drops into the target 24h block,
  // or simply slicing since NWS periods are consistently every 12 hours.
  // Sometimes period 0 is "Tonight" if fetched late in the day.
  const isNightStart = !periods[0].isDaytime;

  let startIndex = 0;
  if (selectedDay === 1) {
    startIndex = 0;
  } else if (selectedDay === 2) {
    startIndex = isNightStart ? 1 : 2;
  } else if (selectedDay === 3) {
    startIndex = isNightStart ? 3 : 4;
  }

  const targetPeriods = periods.slice(startIndex, startIndex + 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {targetPeriods.map((period, idx) => (
        <div key={idx} style={{
          background: period.isDaytime ? 'rgba(56, 189, 248, 0.05)' : 'rgba(15, 23, 42, 0.4)',
          borderLeft: period.isDaytime ? '3px solid rgba(56, 189, 248, 0.5)' : '3px solid rgba(99, 102, 241, 0.5)',
          padding: '12px 16px',
          borderRadius: '0 8px 8px 0'
        }}>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '1rem',
            color: period.isDaytime ? '#bae6fd' : '#c7d2fe',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {period.name}
            <span style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{period.temperature}&deg;{period.temperatureUnit}</span>
          </h3>
          <p style={{
            margin: 0,
            color: '#e2e8f0',
            fontFamily: 'sans-serif',
            lineHeight: '1.6',
            fontSize: '0.9rem'
          }}>
            {period.detailedForecast}
          </p>
          <div style={{ marginTop: '10px', display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
            <span>Wind: {period.windSpeed} {period.windDirection}</span>
            {period.probabilityOfPrecipitation?.value && (
              <span style={{ color: '#38bdf8' }}>Precip: {period.probabilityOfPrecipitation.value}%</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
