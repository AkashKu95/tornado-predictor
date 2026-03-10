export const TORNADO_LAYERS = {
  1: 3,  // Day 1 Probabilistic Tornado Outlook
  2: 11, // Day 2 Probabilistic Tornado Outlook
  3: 19, // Day 3 Probabilistic Outlook (Combined Severe)
};

const BASE_URL = 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer';

/**
 * Fetches the probabilistic outlook GeoJSON from NOAA SPC.
 */
export async function fetchTornadoData(day) {
  const layerId = TORNADO_LAYERS[day];
  if (layerId === undefined) throw new Error(`No forecast layer for day ${day}`);

  const url = `${BASE_URL}/${layerId}/query?f=geojson&where=1=1&outFields=*&returnGeometry=true`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API fetch failed with status ${res.status}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error(`Error fetching NOAA geoJSON data for day ${day}:`, error);
    return null;
  }
}

/**
 * Fetches Active Tornado Warnings and Watches from the National Weather Service API
 */
export async function fetchActiveWarnings() {
  // Querying specifically for Tornado Watches and Warnings across the US
  const url = `https://api.weather.gov/alerts/active?event=Tornado%20Warning,Tornado%20Watch`;

  try {
    // The NWS API requires a User-Agent identifying the app
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/geo+json'
      }
    });

    if (!res.ok) throw new Error(`NWS API fetch failed with status ${res.status}`);
    const data = await res.json();

    // Return just the features array (the alerts themselves)
    return data.features || [];
  } catch (error) {
    console.error("Error fetching NWS active alerts:", error);
    return [];
  }
}

/**
 * Fetches Tornado Warnings and Watches history from the NWS API for the current day
 */
export async function fetchTodayWarningsHistory() {
  const d = new Date();
  d.setHours(0, 0, 0, 0); // Start of today

  const url = `https://api.weather.gov/alerts?event=Tornado%20Warning,Tornado%20Watch&start=${d.toISOString()}`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/geo+json'
      }
    });

    if (!res.ok) throw new Error(`NWS API history fetch failed with status ${res.status}`);
    const data = await res.json();

    return data.features || [];
  } catch (error) {
    console.error("Error fetching NWS daily history:", error);
    return [];
  }
}

/**
 * Fetches the current weather for a specific lat/lon from the NWS API
 */
export async function fetchLocalWeather(lat, lon) {
  try {
    // Step 1: Get the grid endpoint from the coordinate
    const pointUrl = `https://api.weather.gov/points/${lat},${lon}`;
    const pointRes = await fetch(pointUrl, {
      headers: {
        'Accept': 'application/geo+json'
      }
    });

    if (!pointRes.ok) throw new Error(`NWS Points API failed with status ${pointRes.status}`);
    const pointData = await pointRes.json();

    // Step 2: Fetch the hourly forecast from the provided grid endpoint
    const forecastUrl = pointData.properties.forecastHourly;
    const forecastRes = await fetch(forecastUrl, {
      headers: {
        'Accept': 'application/geo+json'
      }
    });

    if (!forecastRes.ok) throw new Error(`NWS Forecast API failed with status ${forecastRes.status}`);
    const forecastData = await forecastRes.json();

    // Return the current hour's forecast (the first item in the periods array)
    if (forecastData.properties && forecastData.properties.periods && forecastData.properties.periods.length > 0) {
      return forecastData.properties.periods[0];
    }

    return null;
  } catch (error) {
    console.error("Error fetching local weather:", error);
    return null;
  }
}

/**
 * Fetches the detailed daily textual forecast (Day/Night periods) for a specific lat/lon
 */
export async function fetchDetailedForecast(lat, lon) {
  try {
    // Step 1: Get the grid endpoint from the coordinate
    const pointUrl = `https://api.weather.gov/points/${lat},${lon}`;
    const pointRes = await fetch(pointUrl, {
      headers: {
        'Accept': 'application/geo+json'
      }
    });

    if (!pointRes.ok) throw new Error(`NWS Points API failed with status ${pointRes.status}`);
    const pointData = await pointRes.json();

    // Step 2: Fetch the daily forecast from the provided grid endpoint
    const forecastUrl = pointData.properties.forecast;
    const forecastRes = await fetch(forecastUrl, {
      headers: {
        'Accept': 'application/geo+json'
      }
    });

    if (!forecastRes.ok) throw new Error(`NWS Detailed Forecast API failed with status ${forecastRes.status}`);
    const forecastData = await forecastRes.json();

    if (forecastData.properties && forecastData.properties.periods) {
      return forecastData.properties.periods;
    }

    return [];
  } catch (error) {
    console.error("Error fetching detailed forecast:", error);
    return [];
  }
}

/**
 * Fetches the textual Forecast Discussion (Severe Weather Outlook) for a given day
 * 1 = ACUS01 (Day 1)
 * 2 = ACUS02 (Day 2)
 * 3 = ACUS03 (Day 3)
 */
export async function fetchOutlookText(day) {
  // ACUS01, 02, 03 mapped to Days 1, 2, 3
  const wmoId = `ACUS0${day}`;

  // NWS Products API: Get the latest product matching the SWO (Severe Weather Outlook) type and specific WMO ID
  const url = `https://api.weather.gov/products?type=SWO&limit=10`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/geo+json'
      }
    });

    if (!res.ok) throw new Error(`NWS Products API failed with status ${res.status}`);
    const data = await res.json();

    if (data && data['@graph']) {
      // Find the most recent product that matches our day's WMO collective ID
      const productSummary = data['@graph'].find(p => p.wmoCollectiveId.includes(wmoId));

      if (productSummary) {
        // Fetch the actual text content using the product ID
        const textRes = await fetch(`https://api.weather.gov/products/${productSummary.id}`, {
          headers: {
            'Accept': 'application/geo+json'
          }
        });

        if (textRes.ok) {
          const textData = await textRes.json();
          return textData.productText || "No discussion text found in product.";
        }
      }
    }

    return "No forecast discussion currently available for this outlook period.";
  } catch (error) {
    console.error(`Error fetching outlook text for day ${day}:`, error);
    return "Error loading forecast discussion.";
  }
}
