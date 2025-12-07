import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cloud, CloudRain, CloudSnow, Sun, CloudDrizzle, Wind, CloudFog } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WeatherModal({ isOpen, onClose, forecast }) {
  const getWeatherIcon = (condition, size = 'w-12 h-12') => {
    if (!condition) return <Cloud className={`${size} text-white`} />;
    const cond = condition.toLowerCase();
    if (cond.includes('rain')) return <CloudRain className={`${size} text-white`} />;
    if (cond.includes('drizzle')) return <CloudDrizzle className={`${size} text-white`} />;
    if (cond.includes('snow')) return <CloudSnow className={`${size} text-white`} />;
    if (cond.includes('sunny') || cond.includes('clear')) return <Sun className={`${size} text-white`} />;
    if (cond.includes('wind')) return <Wind className={`${size} text-white`} />;
    if (cond.includes('fog')) return <CloudFog className={`${size} text-white`} />;
    return <Cloud className={`${size} text-white`} />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-2xl"
            >
              <div className="glass-card p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-3xl font-light text-white">5 Day Forecast</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-white hover:bg-white/10"
                  >
                    <X className="w-6 h-6" />
                  </Button>
                </div>

                {forecast ? (
                  <div className="space-y-4">
                    {forecast.map((day, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 backdrop-blur-sm"
                      >
                        <div className="text-xl text-white font-light w-32">
                          {day.day}
                        </div>
                        <div className="flex items-center gap-4">
                          {getWeatherIcon(day.condition)}
                          <div className="text-white/80 text-lg w-32">
                            {day.condition}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-light text-white">
                            {day.high}°
                          </div>
                          <div className="text-xl font-light text-white/60">
                            {day.low}°
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}