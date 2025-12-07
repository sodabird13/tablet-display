
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fetchCOINQuote } from '@/api/freeData';

export default function COINPriceCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper function to check if it's currently quiet hours (1 AM - 6 AM PT)
  const isQuietHours = () => {
    const now = new Date();
    // Use Intl.DateTimeFormat to reliably get the hour in Pacific Time
    const ptHour = parseInt(new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23', // Ensure 24-hour format for parsing
      timeZone: 'America/Los_Angeles'
    }).format(now));

    // Quiet hours are from 1 AM (inclusive) to 6 AM (exclusive) PT
    return ptHour >= 1 && ptHour < 6;
  };

  const fetchPrice = async () => {
    // If it's quiet hours, skip the API call
    if (isQuietHours()) {
      // If no data has been loaded yet, set loading to false
      // to prevent an indefinite 'Loading...' state during quiet hours on initial render.
      // If data already exists, we simply stop updating, and 'loading' will already be false.
      setLoading(false);
      return; // Skip the API call entirely
    }

    try {
      const result = await fetchCOINQuote();
      setData(result);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching COIN price:', error);
      setLoading(false); // Ensure loading is false even on error
    }
  };

  const fetchPriceCallback = useCallback(fetchPrice, []);

  useEffect(() => {
    fetchPriceCallback();
    const interval = setInterval(fetchPriceCallback, 1800000);
    return () => clearInterval(interval);
  }, [fetchPriceCallback]);

  // Determine if the 24-hour change is positive for styling
  const isPositive = data?.change_24h >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="glass-card p-6 h-[126px] flex flex-col justify-between"
    >
      <div className="flex items-center justify-between">
        <div className="text-xl font-light text-white/80">COIN</div>
      </div>
      {loading ? (
        // Show loading state if data is being fetched
        <div className="text-4xl font-light text-white/50 animate-pulse">
          Loading...
        </div>
      ) : (
        // Display data once loaded
        <div className="flex items-baseline gap-5">
          <div className="text-4xl font-light text-white">
            {/* Display price, or '---' if not available */}
            ${data?.price ? data.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '---'}
          </div>
          <div className={`text-lg font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {/* Display 24-hour change, or empty string if not available */}
            {data?.change_24h !== undefined && data.change_24h !== null ? (isPositive ? '+' : '') + data.change_24h.toFixed(2) + '%' : ''}
          </div>
        </div>
      )}
    </motion.div>
  );
}
