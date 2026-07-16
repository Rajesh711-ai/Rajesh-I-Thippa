import React, { useState, useEffect } from 'react';

export default function ElectionCountdown() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    // Set target date to 5 days from current date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 5);
    targetDate.setHours(18, 0, 0, 0); // Closes at 6 PM in 5 days

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = targetDate.getTime() - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  const timeSegments = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ];

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-950 dark:to-indigo-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12"></div>
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            General Election Polls Open
          </h3>
          <p className="text-sm text-blue-100 mt-1">Cast your vote securely before the countdown ends. Your vote matters!</p>
        </div>

        <div className="flex gap-2 sm:gap-4">
          {timeSegments.map((seg, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div className="bg-white/15 backdrop-blur-md rounded-xl px-3 py-2 sm:px-4 sm:py-3 min-w-[60px] sm:min-w-[72px] text-center shadow-inner border border-white/10">
                <span className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight">
                  {seg.value.toString().padStart(2, '0')}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-blue-200 mt-1.5">
                {seg.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
