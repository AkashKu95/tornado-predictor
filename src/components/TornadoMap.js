'use client';
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Pane } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Helper component to smoothly move the map view to the polygons
function ChangeView({ geojsonData }) {
  const map = useMap();
  useEffect(() => {
    if (geojsonData && geojsonData.features && geojsonData.features.length > 0) {
      const bounds = L.geoJSON(geojsonData).getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
      }
    } else {
      // Default USA view if no active risk polygons and no custom location
      map.flyTo([38, -97], 4, { duration: 1.5 });
    }
  }, [geojsonData, map]);
  return null;
}

// Helper component to fly to a specific user-searched location
function LocationMarker({ location }) {
  const map = useMap();
  const [lastLocCoord, setLastLocCoord] = useState('');

  useEffect(() => {
    if (location) {
      const locKey = `${location.lat},${location.lon}`;

      // Only fly to this location if it's a new coordinate (prevents fighting the bounds during day switch)
      if (locKey !== lastLocCoord) {
        map.flyTo([location.lat, location.lon], location.zoom || 8, { duration: 1.5 });
        setLastLocCoord(locKey);
      }

      // We still want to make sure the marker is rendered, though L.circleMarker will stack if not managed,
      // but assuming the map container handles generic leaf rendering here, we can leave the point.
      // A cleaner way is to use Leaflet's declarative <CircleMarker> component, but doing it imperatively here:
      const marker = L.circleMarker([location.lat, location.lon], {
        radius: 8,
        fillColor: "#34d399",
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map).bindPopup(`<b>${location.name}</b>`);

      // Only open popup if it's a fresh flyTo
      if (locKey !== lastLocCoord) {
        marker.openPopup();
      }

      return () => {
        map.removeLayer(marker);
      };
    }
  }, [location, map, lastLocCoord]);

  return null;
}

// Helper component to zoom to active NWS alert polygons
function AlertView({ alert }) {
  const map = useMap();
  useEffect(() => {
    if (alert && alert.geometry) {
      const geoJsonLayer = L.geoJSON(alert);
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        // Show a wider view of the warning area instead of zooming in too tight.
        map.flyToBounds(bounds, {
          padding: [120, 120],
          maxZoom: 7,
          duration: 1.5,
        });
      }
    }
  }, [alert, map]);
  return null;
}


const TornadoMap = ({ data, day, centerLocation, selectedAlert, activeAlerts }) => {
  const [radarData, setRadarData] = useState(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile devices (best-effort) to soften heavy features.
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      setIsMobile(mobile);
    }
  }, []);

  // Fetch rainviewer data and animate when an alert is selected.
  // On mobile, keep this lighter by trimming frames and skipping animation if needed.
  useEffect(() => {
    if (!selectedAlert) {
      setRadarData(null);
      return;
    }

    let isCancelled = false;

    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(res => res.json())
      .then(data => {
        if (isCancelled || !data || !data.radar || !Array.isArray(data.radar.past)) return;

        let frames = data.radar.past;
        // On mobile, keep only the last few frames to reduce memory/CPU pressure.
        if (isMobile && frames.length > 6) {
          frames = frames.slice(-6);
        }

        setRadarData({
          host: data.host,
          frames
        });
      })
      .catch(err => console.error("Radar load failed", err));

    return () => {
      isCancelled = true;
    };
  }, [selectedAlert, isMobile]);

  // Handle Animation Loop
  useEffect(() => {
    if (!radarData || !radarData.frames || radarData.frames.length === 0) return;

    // On very constrained mobile devices, skip animation and just show the latest frame.
    if (isMobile) {
      setFrameIndex(radarData.frames.length - 1);
      return;
    }

    const interval = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % radarData.frames.length);
    }, 650);

    return () => clearInterval(interval);
  }, [radarData, isMobile]);

  // Return style based on SPC probability labels
  const getStyle = (feature) => {
    // Days 1-3 use LABEL string or lowercase label. Days 4-8 strictly use dn integer.
    // If dn is 0, it means "Predictability Too Low".
    let rawProb = feature.properties.LABEL !== undefined && feature.properties.LABEL !== null
      ? feature.properties.LABEL
      : (feature.properties.label !== undefined && feature.properties.label !== null
        ? feature.properties.label
        : feature.properties.dn);

    // Some NOAA layers use decimals like "0.02" for 2%, "0.15" for 15%. 
    // Convert them to their percentage integers.
    if (typeof rawProb === 'string' && rawProb.startsWith('0.') && !isNaN(rawProb)) {
      rawProb = String(parseFloat(rawProb) * 100);
    }

    let prob = String(rawProb);
    let color = 'white';

    if (day === 1 || day === 2) {
      // Official SPC Tornado probability colors (Days 1 & 2)
      if (prob === '2%' || prob === '2') color = 'var(--prob-2, #008000)';
      else if (prob === '5%' || prob === '5') color = 'var(--prob-5, #8b4513)';
      else if (prob === '10%' || prob === '10') color = 'var(--prob-10, #ffcf00)';
      else if (prob === '15%' || prob === '15') color = 'var(--prob-15, #ff0000)';
      else if (prob === '30%' || prob === '30') color = 'var(--prob-30, #ff00ff)';
      else if (prob === '45%' || prob === '45') color = 'var(--prob-45, #800080)';
      else if (prob === '60%' || prob === '60') color = 'var(--prob-60, #0000ff)';
      else if (prob === '0' || prob.toLowerCase().includes('low')) color = 'rgba(150, 150, 150, 0.6)';
    } else {
      // Days 3-8 are total probabilistic severe.
      // Day 3 values: 5%, 15%, 30%, 45%, 60%
      // Day 4-8 values: 15%, 30%
      if (prob === '5%' || prob === '5') color = 'var(--prob-5, #8b4513)';
      else if (prob === '15%' || prob === '15') color = 'var(--prob-10, #ffcf00)';
      else if (prob === '30%' || prob === '30') color = 'var(--prob-15, #ff0000)';
      else if (prob === '45%' || prob === '45') color = 'var(--prob-30, #ff00ff)';
      else if (prob === '60%' || prob === '60') color = 'var(--prob-45, #800080)';
      else if (prob === '0' || prob.toLowerCase().includes('low')) color = 'rgba(150, 150, 150, 0.6)'; // Predictability Too Low
    }

    return {
      fillColor: color,
      weight: 2,
      opacity: 1,
      color: color,
      fillOpacity: 0.45,
      interactive: true
    };
  };

  const onEachFeature = (feature, layer) => {
    let rawProb = feature.properties.LABEL !== undefined && feature.properties.LABEL !== null
      ? feature.properties.LABEL
      : (feature.properties.label !== undefined && feature.properties.label !== null
        ? feature.properties.label
        : feature.properties.dn);

    // Convert decimal probabilities ("0.15" -> "15")
    if (typeof rawProb === 'string' && rawProb.startsWith('0.') && !isNaN(rawProb)) {
      rawProb = String(parseFloat(rawProb) * 100);
    }

    let label = String(rawProb);

    // Format label
    if (label === '0' || label.toLowerCase().includes('low')) {
      label = "Predictability Too Low";
    } else if (!label.includes('%')) {
      // Sometimes NOAA uses "30" instead of "30%" in label or dn for probability
      // If it's pure numbers, append %. If it's a D (categorical), leave it.
      if (!isNaN(label)) {
        label = label + "%";
      }
    }

    const type = (day === 1 || day === 2) ? "Tornado" : "Severe Weather";

    // Create a beautiful custom popup
    const popupContent = `
      <div style="font-family: inherit; color: #333;">
        <strong style="font-size: 1.1em;">${type} Risk</strong><br/>
        Probability: <span style="font-weight: bold; font-size: 1.2em;">${label}</span>
      </div>
    `;
    layer.bindPopup(popupContent);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
      {/* We use a dark base layer from Carto without labels so polygons can overlay cleanly */}
      <MapContainer
        center={[38, -97]}
        zoom={4}
        minZoom={3}
        maxZoom={18}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        tap={false}
        touchZoom={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxNativeZoom={19}
        />

        {/* Custom pane to render City/State Labels on TOP of the colorful weather polygons */}
        <Pane name="labels" style={{ zIndex: 450, pointerEvents: 'none' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            maxNativeZoom={19}
          />
        </Pane>

        {/* Custom pane for Active NWS Alerts to ensure they render ON TOP of base NOAA polygons */}
        <Pane name="alertsPane" style={{ zIndex: 460 }} />

        {/* Only auto-fly to storm polygons if we haven't manually searched a location */}
        {!centerLocation && data && <ChangeView geojsonData={data} />}

        {/* Fly to custom location if one exists */}
        {centerLocation && <LocationMarker location={centerLocation} />}

        {(() => {
          if (!data || !data.features) return null;
          
          const visibleFeatures = data.features.filter(f => {
            let v = String(f.properties.LABEL || f.properties.label || f.properties.dn);
            return !(v === 'SIG' || v.includes('CIG') || v.includes('SIGN'));
          });

          if (visibleFeatures.length > 0) {
            return (
              <GeoJSON
                key={`${day}-${visibleFeatures.length}`}
                data={{
                  ...data,
                  features: visibleFeatures.sort((a, b) => {
                    const getVal = (f) => {
                      let v = f.properties.LABEL || f.properties.label || f.properties.dn;
                      if (typeof v === 'string') {
                        if (v.startsWith('0.')) return parseFloat(v) * 100;
                        return parseInt(v) || 0;
                      }
                      return v || 0;
                    };
                    return getVal(a) - getVal(b);
                  })
                }}
                style={getStyle}
                onEachFeature={onEachFeature}
              />
            );
          } else {
            return (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(52, 211, 153, 0.2)',
                padding: '16px 32px',
                borderRadius: '24px',
                backdropFilter: 'blur(8px)',
                color: '#34d399',
                fontWeight: 600,
                letterSpacing: '0.5px',
                fontSize: '1.1rem',
                pointerEvents: 'none',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
                No severe weather expected, enjoy your day :)
              </div>
            );
          }
        })()}

        {/* Fly to active NWS Alert */}
        {selectedAlert && <AlertView alert={selectedAlert} />}

        {/* Draw all active NWS warning and watch polygons on their own pane ONLY for Day 1 */}
        {day === 1 && activeAlerts && activeAlerts.length > 0 && activeAlerts.map(alert => {
          if (!alert.geometry) return null;
          const isWarning = alert.properties.event === 'Tornado Warning';
          const isSelected = selectedAlert && selectedAlert.properties.id === alert.properties.id;
          
          let alertColor = isWarning ? '#ef4444' : '#c084fc'; // red for warning, bright purple for watch
          
          return (
            <GeoJSON
              key={`active-alert-poly-${alert.properties.id}`}
              data={alert}
              style={{
                color: alertColor,
                weight: isSelected ? 5 : 2,
                fillColor: alertColor,
                fillOpacity: isSelected ? 0.45 : 0.15,
                dashArray: isWarning ? '5, 5' : null
              }}
              pane="alertsPane"
              onEachFeature={(feature, layer) => {
                const basePopup = `
                  <div style="font-family: inherit; color: #333;">
                    <strong style="font-size: 1.1em; color: ${alertColor};">${alert.properties.event}</strong><br/>
                    <span style="font-size: 0.9em;">${alert.properties.areaDesc}</span>
                  </div>
                `;

                const popupContent = isWarning
                  ? `
                    <div style="font-family: inherit; color: #333;">
                      <strong style="font-size: 1.1em; color: ${alertColor};">${alert.properties.event}</strong><br/>
                      <span style="font-size: 0.9em; font-weight: 700; color: #b91c1c;">15% Tornado Probability</span><br/>
                      <span style="font-size: 0.9em;">${alert.properties.areaDesc}</span>
                    </div>
                  `
                  : basePopup;

                layer.bindPopup(popupContent);

                // Show "15% Tornado" tooltip on hover anywhere over the red warning polygon
                if (isWarning) {
                  layer.bindTooltip('15% Tornado', {
                    permanent: false,
                    sticky: true,
                    direction: 'top',
                    offset: [0, -8],
                    className: 'tornado-prob-tooltip',
                  });
                }
              }}
            />
          );
        })}

        {/* Animated Radar Layers - Render all to cache them, but only show the active frame index */}
        {selectedAlert && radarData && radarData.frames.map((frame, index) => (
          <TileLayer
            key={frame.time}
            url={`${radarData.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`}
            opacity={index === frameIndex ? 0.65 : 0}
            zIndex={400}
            className="radar-layer"
            maxNativeZoom={12}
          />
        ))}

      </MapContainer>

    </div>
  );
};

export default React.memo(TornadoMap);
