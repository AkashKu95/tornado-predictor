import { useState } from 'react';
import { LocateFixed, Search } from 'lucide-react';

export default function LocationControls({ onLocationSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setIsLocating(false);
          let locName = "My Location";
          try {
            // Free reverse geocoding to get the actual city/town name instead of generic "My Location"
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=10`);
            const data = await res.json();
            if (data && data.name) {
              locName = data.name;
            }
          } catch (e) {
            console.error("Reverse geocoding failed", e);
          }

          onLocationSelect({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            name: locName,
            zoom: 8
          });
        },
        (error) => {
          console.error("Native geolocation error/blocked:", error);
          // Fallback to a more permissive IP-based geolocation service
          fetch('https://get.geojs.io/v1/ip/geo.json')
            .then(res => res.json())
            .then(data => {
              if (data.latitude && data.longitude) {
                onLocationSelect({
                  lat: data.latitude,
                  lon: data.longitude,
                  name: data.city || "Approx. Location",
                  zoom: 8
                });
              } else {
                alert("Unable to retrieve location via IP fallback.");
              }
            })
            .catch(ipErr => {
              console.error("IP Geolocation fallback failed:", ipErr);
              alert("Unable to retrieve location securely.");
            })
            .finally(() => {
              setIsLocating(false);
            });
        }
      );
    } catch (e) {
      setIsLocating(false);
      alert("Location services error.");
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Use OpenStreetMap Nominatim for free geocoding
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`, {
        headers: {
          'Accept-Language': 'en'
        }
      });
      const data = await res.json();

      if (data && data.length > 0) {
        onLocationSelect({
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          name: data[0].display_name.split(',')[0], // Get just the city/primary name
          zoom: 8
        });
        setSearchQuery('');
      } else {
        alert("Location not found. Try a different search term.");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      alert("Error searching for location.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button
        onClick={handleGeolocation}
        className="btn"
        title="My Location"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}
        disabled={isLocating}
      >
        <LocateFixed size={20} color={isLocating ? "#34d399" : "currentColor"} />
      </button>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '4px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search city, state..."
          className="w-[140px] md:w-[200px]"
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid var(--border)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '8px',
            outline: 'none',
            fontFamily: 'inherit'
          }}
        />
        <button
          type="submit"
          className="btn"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}
          disabled={isSearching}
        >
          <Search size={20} opacity={isSearching ? 0.5 : 1} />
        </button>
      </form>
    </div>
  );
}
