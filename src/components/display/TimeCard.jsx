import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function TimeCard({ onBackgroundChange }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return { time: `${hours}:${minutesStr}`, ampm };
  };

  const { time: timeStr, ampm } = formatTime(time);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      onClick={onBackgroundChange}
      className="glass-card p-8 text-center h-[154px] flex items-center justify-center cursor-pointer hover:bg-white/5 active:bg-white/10 active:scale-[0.99] transition-all select-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="flex items-baseline">
        <div className="text-[6.27rem] md:text-[8.36rem] font-semibold text-white tracking-tight">
          {timeStr}
        </div>
        <div className="text-[2.75rem] font-light text-white/80 ml-4">
          {ampm}
        </div>
      </div>
    </motion.div>
  );
}