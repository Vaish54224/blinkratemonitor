import React, { useState, useEffect } from 'react';
import { Play, Coffee, ShieldCheck } from 'lucide-react';
import Aperture from './Aperture';

export default function BreakTimer({
  pomodoroRemaining,
  breakActive,
  onResolveBreak,
  wsSend
}) {
  const [breakTimer, setBreakTimer] = useState(20); // 20-second active break countdown
  const [breakStage, setBreakStage] = useState('prompt'); // 'prompt' | 'active'

  // Manage break timer when break becomes active
  useEffect(() => {
    let interval = null;
    if (breakActive && breakStage === 'active') {
      interval = setInterval(() => {
        setBreakTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            // Auto resolve break on complete
            handleFinishBreak();
            return 20;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setBreakTimer(20);
    }
    return () => clearInterval(interval);
  }, [breakActive, breakStage]);

  // Restart break state if break becomes inactive
  useEffect(() => {
    if (!breakActive) {
      setBreakStage('prompt');
      setBreakTimer(20);
    }
  }, [breakActive]);

  const handleStartBreak = () => {
    setBreakStage('active');
  };

  const handleSnooze = () => {
    // Snooze by notifying backend to reset/delay alert
    if (wsSend) {
      wsSend({ action: 'take_break_resolved' }); // treats snooze as resolved/dismissed or snooze
    }
    setBreakStage('prompt');
  };

  const handleFinishBreak = () => {
    if (onResolveBreak) {
      onResolveBreak();
    }
    setBreakStage('prompt');
  };

  // Convert seconds to format
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Mini Break Timer Widget in main Dashboard grid */}
      <div className="card-lens p-5 flex flex-col justify-between h-[360px]">
        <div>
          <h3 className="text-lg font-bold text-[#e8ecf1]">Break Interval Manager</h3>
          <p className="text-xs text-[#7a8394] mb-4">Pomodoro 20-20-20 screen rest cycle</p>
        </div>

        <div className="flex flex-col items-center justify-center flex-grow py-4">
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Background ring */}
            <svg viewBox="0 0 100 100" className="absolute w-full h-full transform -rotate-90">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#181c25" strokeWidth="4" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#4fd8c4"
                strokeWidth="4"
                strokeDasharray="282.7"
                strokeDashoffset={282.7 - (pomodoroRemaining / 1200) * 282.7}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
            <div className="flex flex-col items-center z-10">
              <span className="text-3xl font-bold font-mono-numbers text-[#e8ecf1]">
                {formatTime(pomodoroRemaining)}
              </span>
              <span className="text-[10px] text-[#7a8394] uppercase tracking-widest mt-1">Remaining</span>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 mt-2">
          <button
            onClick={() => wsSend({ action: 'take_break_resolved' })}
            className="flex-1 py-2.5 rounded-xl border border-white/5 hover:border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#e8ecf1] flex items-center justify-center space-x-2 transition-all duration-200"
          >
            <ShieldCheck className="w-4 h-4 text-tear-film" />
            <span>Reset Cycle</span>
          </button>
          <button
            onClick={handleStartBreak}
            className="flex-1 py-2.5 rounded-xl bg-tear-film hover:bg-[#43c4b1] text-xs font-bold text-void flex items-center justify-center space-x-2 transition-all duration-200"
          >
            <Coffee className="w-4 h-4" />
            <span>Force Break</span>
          </button>
        </div>
      </div>

      {/* FULL-SCREEN OVERLAY REMINDER */}
      {breakActive && (
        <div className="fixed inset-0 bg-[#0a0c10]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          {breakStage === 'prompt' ? (
            <div className="max-w-md flex flex-col items-center space-y-6">
              <div className="relative w-44 h-44 flex items-center justify-center">
                {/* Visual loop */}
                <Aperture active={true} strainScore={80} size={150} />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-[#e8ecf1] tracking-tight">👁️ Time to Rest Your Eyes</h2>
                <p className="text-sm text-[#7a8394] leading-relaxed">
                  You have been focusing on the screen for 20 minutes. Please take a 20-second break and look at something at least 20 feet away.
                </p>
              </div>

              <div className="flex space-x-4 w-full pt-4">
                <button
                  onClick={handleSnooze}
                  className="flex-1 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold text-[#7a8394] hover:text-[#e8ecf1] transition-all duration-200"
                >
                  Snooze 5 Min
                </button>
                <button
                  onClick={handleStartBreak}
                  className="flex-1 py-3 rounded-xl bg-tear-film hover:bg-[#43c4b1] text-sm font-bold text-void flex items-center justify-center space-x-2 transition-all duration-200"
                >
                  <Play className="w-4 h-4" />
                  <span>Start Break</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-md flex flex-col items-center space-y-8">
              {/* Breathing Guide Ring Animation */}
              <div className="relative w-64 h-64 flex items-center justify-center">
                {/* Expanding guide ring */}
                <div className="absolute inset-0 rounded-full border border-tear-film/30 animate-pulse-ring" />
                <div className="absolute inset-6 rounded-full border border-tear-film/10 animate-pulse-ring-delayed" />
                
                {/* Aperture (closed to indicate eye relaxation) */}
                <Aperture active={true} strainScore={95} size={160} />
              </div>

              <div className="space-y-3">
                <h2 className="text-4xl font-extrabold text-tear-film font-mono-numbers">
                  {breakTimer}s
                </h2>
                <p className="text-lg font-medium text-[#e8ecf1]">Inhale. Exhale. Look at the distance.</p>
                <p className="text-xs text-[#7a8394] italic">Close your eyes or focus 20 feet away</p>
              </div>

              <button
                onClick={handleFinishBreak}
                className="px-6 py-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 text-xs text-[#7a8394] hover:text-[#e8ecf1] transition-all duration-200"
              >
                Skip Break
              </button>
            </div>
          )}

          {/* Core Breathing animations styles */}
          <style>{`
            @keyframes pulseRing {
              0% { transform: scale(0.65); opacity: 0; }
              50% { opacity: 0.5; }
              100% { transform: scale(1.15); opacity: 0; }
            }
            .animate-pulse-ring {
              animation: pulseRing 4s ease-in-out infinite;
            }
            .animate-pulse-ring-delayed {
              animation: pulseRing 4s ease-in-out infinite;
              animation-delay: 2s;
            }
            .animate-fade-in {
              animation: fadeIn 300ms ease-out forwards;
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
