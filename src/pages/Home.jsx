
import React, { useState, useEffect } from 'react';
import { fetchSettings, saveSettings } from '@/api/dataClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TimeCard from '../components/display/TimeCard';
import DateCard from '../components/display/DateCard';
import WeatherCard from '../components/display/WeatherCard';
import BTCPriceCard from '../components/display/BTCPriceCard';
import COINPriceCard from '../components/display/COINPriceCard';
import CalendarCard from '../components/display/CalendarCard';

const BACKGROUND_OPTIONS = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=3432&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=3432&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=3432&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=3432&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=3432&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1518623001395-125242310d0c?q=80&w=3432&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=3432&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1426604966848-d7adac402bff?q=80&w=3432&auto=format&fit=crop'
];

export default function Home() {
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    initialData: null,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => saveSettings({ ...(settings ?? {}), ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  // Preload all background images
  useEffect(() => {
    BACKGROUND_OPTIONS.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  // Daily refresh at 12:01 AM
  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // If it's 12:01 AM, refresh the calendar
      if (hours === 0 && minutes === 1) {
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      }
    };

    // Check every minute
    const interval = setInterval(checkMidnight, 60000);
    
    return () => clearInterval(interval);
  }, [queryClient]);

  useEffect(() => {
    if (settings?.background_image_url) {
      const index = BACKGROUND_OPTIONS.indexOf(settings.background_image_url);
      if (index !== -1) {
        setBackgroundIndex(index);
      }
    }
  }, [settings]);

  const handleBackgroundChange = () => {
    const newIndex = (backgroundIndex + 1) % BACKGROUND_OPTIONS.length;
    setBackgroundIndex(newIndex);
    updateSettingsMutation.mutate({
      ...settings,
      background_image_url: BACKGROUND_OPTIONS[newIndex]
    });
  };

  const backgroundUrl = BACKGROUND_OPTIONS[backgroundIndex];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000"
        style={{
          backgroundImage: `url(${backgroundUrl})`,
        }}
      />

      {/* Overlay for better contrast */}
      <div className="fixed inset-0 bg-black/20" />

      {/* Content */}
      <div className="relative z-10 min-h-screen p-6 sm:p-8 lg:p-12 pt-[calc(1.1475rem+2.295vh)] sm:pt-[calc(1.53rem+2.295vh)] lg:pt-[calc(2.295rem+2.295vh)]">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Row 1: Time Card */}
          <div>
            <TimeCard onBackgroundChange={handleBackgroundChange} />
          </div>

          {/* Row 2: Day and Weather */}
          <div className="grid grid-cols-2 gap-6">
            <DateCard />
            <WeatherCard />
          </div>

          {/* Row 3: Calendar */}
          <div>
            <CalendarCard />
          </div>

          {/* Row 4: BTC and COIN */}
          <div className="grid grid-cols-2 gap-6">
            <BTCPriceCard />
            <COINPriceCard />
          </div>
        </div>
      </div>

      <style>{`
        .glass-card {
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
      `}</style>
    </div>
  );
}
