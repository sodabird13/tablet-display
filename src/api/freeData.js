// Free API data fetchers - no API keys required

const WMO_CODES = {
  0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog', 51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
  61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
  71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
  80: 'Light Rain Showers', 81: 'Rain Showers', 82: 'Heavy Rain Showers',
  85: 'Light Snow Showers', 86: 'Snow Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with Hail', 99: 'Thunderstorm with Heavy Hail',
};

const LAT = import.meta.env.VITE_WEATHER_LAT || '47.6062';
const LON = import.meta.env.VITE_WEATHER_LON || '-122.3321';

export async function fetchWeatherSummary() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America/Los_Angeles`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch weather');
  const data = await response.json();
  return {
    temperature: data.current.temperature_2m,
    condition: WMO_CODES[data.current.weather_code] || 'Unknown',
  };
}

export async function fetchWeatherForecast() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&timezone=America/Los_Angeles&forecast_days=5`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch forecast');
  const data = await response.json();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return data.daily.time.map((date, i) => {
    const d = new Date(date + 'T12:00:00');
    return {
      day: days[d.getDay()],
      high: Math.round(data.daily.temperature_2m_max[i]),
      low: Math.round(data.daily.temperature_2m_min[i]),
      condition: WMO_CODES[data.daily.weather_code[i]] || 'Unknown',
    };
  });
}

export async function fetchBTCPrice() {
  try {
    const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD');
    if (!response.ok) throw new Error('Kraken API failed');
    const data = await response.json();
    const ticker = data.result.XXBTZUSD;
    const currentPrice = parseFloat(ticker.c[0]);
    const open24h = parseFloat(ticker.o);
    return {
      price: currentPrice,
      change_24h: ((currentPrice - open24h) / open24h) * 100,
    };
  } catch (e) {
    console.warn('Kraken failed:', e);
    throw new Error('Failed to fetch BTC price');
  }
}

export async function fetchCOINQuote() {
  // Try multiple CORS proxies in order
  const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/COIN?interval=1d&range=2d';
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(yahooUrl)}`,
  ];
  
  for (const proxyUrl of proxies) {
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) continue;
      
      const text = await response.text();
      // Check if response looks like JSON
      if (!text.startsWith('{')) continue;
      
      const data = JSON.parse(text);
      if (!data.chart?.result?.[0]?.meta) continue;
      
      const meta = data.chart.result[0].meta;
      const currentPrice = meta.regularMarketPrice;
      const previousClose = meta.chartPreviousClose || meta.previousClose;
      
      if (!currentPrice || !previousClose) continue;
      
      const change = ((currentPrice - previousClose) / previousClose) * 100;
      
      // Sanity check
      if (Math.abs(change) > 50) {
        console.warn('COIN change unreasonable:', change);
        continue;
      }
      
      return { price: currentPrice, change_24h: change };
    } catch (e) {
      console.warn('Proxy failed:', proxyUrl, e.message);
      continue;
    }
  }
  
  throw new Error('All COIN fetch attempts failed');
}
