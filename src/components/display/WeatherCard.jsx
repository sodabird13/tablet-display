
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cloud, CloudRain, CloudSnow, Sun, CloudDrizzle, Wind, CloudFog } from 'lucide-react';
import { fetchWeatherSummary, fetchWeatherForecast } from '@/api/freeData';
import WeatherModal from './WeatherModal';

export default function WeatherCard() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [forecast, setForecast] = useState(null);

  const isQuietHours = () => {
    const now = new Date();
    // Get the current hour in Pacific Time (PT)
    const ptTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const hour = ptTime.getHours();
    // Quiet hours are between 1 AM (inclusive) and 6 AM (exclusive) PT
    return hour >= 1 && hour < 6;
  };

  const fetchWeather = useCallback(async () => {
    if (isQuietHours()) {
      if (loading) setLoading(false);
      return;
    }

    try {
      const result = await fetchWeatherSummary();
      setWeather(result);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching weather:', error);
      setLoading(false);
    }
  }, [loading]);

  const fetchForecast = useCallback(async () => {
    if (isQuietHours()) {
      return;
    }

    try {
      const days = await fetchWeatherForecast();
      setForecast(days);
    } catch (error) {
      console.error('Error fetching forecast:', error);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 900000); // 15 minutes
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const handleClick = async () => {
    setModalOpen(true);
    if (!forecast) {
      await fetchForecast();
    }
  };

  const getWeatherIcon = (condition) => {
    if (!condition) return <Cloud className="w-16 h-16 text-white" />;
    const cond = condition.toLowerCase();
    if (cond.includes('rain')) return <CloudRain className="w-16 h-16 text-white" />;
    if (cond.includes('drizzle')) return <CloudDrizzle className="w-16 h-16 text-white" />;
    if (cond.includes('snow')) return <CloudSnow className="w-16 h-16 text-white" />;
    if (cond.includes('sunny') || cond.includes('clear')) return <Sun className="w-16 h-16 text-white" />;
    if (cond.includes('wind')) return <Wind className="w-16 h-16 text-white" />;
    if (cond.includes('fog')) return <CloudFog className="w-16 h-16 text-white" />;
    return <Cloud className="w-16 h-16 text-white" />;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        onClick={handleClick}
        className="glass-card p-6 flex items-center justify-center gap-6 h-[140px] cursor-pointer hover:bg-white/5 transition-colors"
      >
        {loading ? (
          <>
            <div className="animate-pulse">
              <Cloud className="w-16 h-16 text-white/50" />
            </div>
            <div className="text-5xl font-light text-white/50">--<span className="text-2xl align-super">°F</span></div>
          </>
        ) : (
          <>
            <div className="text-white/90">
              {getWeatherIcon(weather?.condition)}
            </div>
            <div className="text-6xl font-light text-white">
              {Math.round(weather?.temperature || 0)}<span className="text-2xl align-super">°F</span>
            </div>
          </>
        )}
      </motion.div>

      <WeatherModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        forecast={forecast}
      />
    </>
  );
}
