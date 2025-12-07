import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

export default function DateCard() {
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDate(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const getOrdinalSuffix = (day) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const day = date.getDate();
  const formattedDate = `${format(date, 'MMMM')} ${day}${getOrdinalSuffix(day)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="glass-card p-6 text-center h-[140px] flex flex-col items-center justify-center"
    >
      <div className="text-[2.5rem] font-light text-white mb-2">
        {format(date, 'EEEE')}
      </div>
      <div className="text-2xl font-light text-white/80">
        {formattedDate}
      </div>
    </motion.div>
  );
}