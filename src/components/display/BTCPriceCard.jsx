
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fetchBTCPrice } from '@/api/freeData';

export default function BTCPriceCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const isQuietHours = () => {
    const now = new Date();
    const ptTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const hour = ptTime.getHours();
    // Quiet hours are between 1 AM (inclusive) and 6 AM (exclusive) PT
    return hour >= 1 && hour < 6;
  };

  const fetchPrice = useCallback(async () => {
    if (isQuietHours()) {
      setLoading(false);
      return;
    }

    try {
      const result = await fetchBTCPrice();
      setData(result);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching BTC price:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 1800000); // 30 minutes
    return () => clearInterval(interval);
  }, [fetchPrice]);

  const isPositive = data?.change_24h >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="glass-card p-6 h-[126px] flex flex-col justify-between"
    >
      <div className="flex items-center justify-between">
        <div className="text-xl font-light text-white/80">BTC</div>
      </div>
      {loading ? (
        <div className="text-4xl font-light text-white/50 animate-pulse">
          Loading...
        </div>
      ) : (
        <div className="flex items-baseline gap-5">
          <div className="text-4xl font-light text-white">
            ${data?.price ? data.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '---'}
          </div>
          <div className={`text-lg font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{data?.change_24h?.toFixed(2)}%
          </div>
        </div>
      )}
    </motion.div>
  );
}
