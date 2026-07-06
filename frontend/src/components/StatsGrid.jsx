import React from 'react';
import { Eye, Activity, Bell, ShieldAlert } from 'lucide-react';

export default function StatsGrid({
  bpm,
  totalBlinks,
  strainScore,
  pomodoroRemaining,
  alertsToday,
  faceDetected,
  dndActive,
  metricsHistory
}) {
  // Extract recent 15 points of BPM for the sparkline
  const sparklineData = metricsHistory.slice(-15).map(m => m.avg_bpm || 0);
  
  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Sparkline path generator
  const getSparklinePath = () => {
    if (sparklineData.length < 2) return '';
    const width = 120;
    const height = 30;
    const minVal = Math.min(...sparklineData, 5);
    const maxVal = Math.max(...sparklineData, 20);
    const valRange = maxVal - minVal || 1;
    
    const points = sparklineData.map((val, index) => {
      const x = (index / (sparklineData.length - 1)) * width;
      const y = height - ((val - minVal) / valRange) * height;
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  };

  // Status/Color mappings
  const getStrainColor = (score) => {
    if (score > 75) return 'text-alert-coral';
    if (score > 35) return 'text-iris-amber';
    return 'text-tear-film';
  };

  const getBpmColor = (rate) => {
    if (!faceDetected) return 'text-gray-500';
    if (rate < 12) return 'text-iris-amber';
    return 'text-tear-film';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
      {/* 1. Blink Rate Card */}
      <div className={`card-lens p-5 flex flex-col justify-between h-[150px] ${faceDetected && bpm < 12 ? 'glow-iris-amber' : ''}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#7a8394] uppercase tracking-wider">Blink Rate</span>
          <Activity className={`w-5 h-5 ${faceDetected && bpm < 12 ? 'text-iris-amber animate-pulse' : 'text-tear-film'}`} />
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <div>
            <div className="flex items-baseline">
              <span className={`text-4xl font-bold font-mono-numbers tracking-tight ${getBpmColor(bpm)}`}>
                {faceDetected ? bpm : '--'}
              </span>
              <span className="text-xs text-[#7a8394] ml-2 font-medium">BPM</span>
            </div>
          </div>
          {faceDetected && (
            <div className="flex flex-col items-end">
              <span className={`text-xs font-semibold ${bpm >= 15 ? 'text-tear-film' : bpm >= 12 ? 'text-[#7a8394]' : 'text-iris-amber'}`}>
                {bpm >= 15 ? 'Healthy' : bpm >= 12 ? 'Moderate' : 'Low Blinking'}
              </span>
              {/* Mini Sparkline */}
              {sparklineData.length >= 2 && (
                <svg className="w-[120px] h-[30px] mt-1" viewBox="0 0 120 30">
                  <path
                    d={getSparklinePath()}
                    fill="none"
                    stroke={bpm < 12 ? '#e8a33d' : '#4fd8c4'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          )}
        </div>
        <div className="text-[11px] text-[#7a8394] mt-2">
          {faceDetected ? 'Active face tracking' : 'Camera is checking for face...'}
        </div>
      </div>

      {/* 2. Total Blinks Card */}
      <div className="card-lens p-5 flex flex-col justify-between h-[150px]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#7a8394] uppercase tracking-wider">Total Blinks</span>
          <Eye className="w-5 h-5 text-tear-film" />
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <div>
            <span className="text-4xl font-bold font-mono-numbers tracking-tight text-tear-film">
              {faceDetected ? totalBlinks : '--'}
            </span>
            <span className="text-xs text-[#7a8394] ml-2 font-medium">Blinks</span>
          </div>
        </div>
        <div className="text-[11px] text-[#7a8394] mt-2">
          {faceDetected ? 'Cumulative blink count' : 'Camera is checking for face...'}
        </div>
      </div>

      {/* 2. Eye Strain Score Card */}
      <div className={`card-lens p-5 flex flex-col justify-between h-[150px] ${strainScore > 75 ? 'glow-alert-coral' : strainScore > 35 ? 'glow-iris-amber' : ''}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#7a8394] uppercase tracking-wider">Eye Strain</span>
          <ShieldAlert className={`w-5 h-5 ${strainScore > 75 ? 'text-alert-coral' : strainScore > 35 ? 'text-iris-amber' : 'text-[#7a8394]'}`} />
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <div>
            <span className={`text-4xl font-bold font-mono-numbers tracking-tight ${getStrainColor(strainScore)}`}>
              {strainScore}
            </span>
            <span className="text-xs text-[#7a8394] ml-2 font-medium">/ 100</span>
          </div>
          <div className="w-16 h-2 bg-[#181c25] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500`}
              style={{
                width: `${strainScore}%`,
                backgroundColor: strainScore > 75 ? '#ff6b5e' : strainScore > 35 ? '#e8a33d' : '#4fd8c4'
              }}
            />
          </div>
        </div>
        <div className="text-[11px] text-[#7a8394] mt-2">
          {strainScore > 75 ? 'Extreme strain risk! Rest now' : strainScore > 35 ? 'Moderate strain. Keep alert' : 'Tear film is normal'}
        </div>
      </div>

      {/* 3. Break Timer Card */}
      <div className="card-lens p-5 flex flex-col justify-between h-[150px]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#7a8394] uppercase tracking-wider">Next Break</span>
          <Eye className="w-5 h-5 text-tear-film" />
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <div>
            <span className="text-4xl font-bold font-mono-numbers tracking-tight text-[#e8ecf1]">
              {formatTime(pomodoroRemaining)}
            </span>
            <span className="text-xs text-[#7a8394] ml-2 font-medium">m:s</span>
          </div>
          {/* Mini progress arc fallback */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-8 h-8 transform -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#181c25"
                strokeWidth="3.5"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#4fd8c4"
                strokeWidth="3.5"
                strokeDasharray={`${(pomodoroRemaining / 1200) * 100}, 100`}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
          </div>
        </div>
        <div className="text-[11px] text-[#7a8394] mt-2">
          {dndActive ? 'Muted (DND Mode active)' : '20-20-20 Rule tracker active'}
        </div>
      </div>

      {/* 4. Alerts Today Card */}
      <div className="card-lens p-5 flex flex-col justify-between h-[150px]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#7a8394] uppercase tracking-wider">Alerts Today</span>
          <Bell className="w-5 h-5 text-tear-film" />
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <div>
            <span className="text-4xl font-bold font-mono-numbers tracking-tight text-[#e8ecf1]">
              {alertsToday}
            </span>
            <span className="text-xs text-[#7a8394] ml-2 font-medium">Alerts</span>
          </div>
        </div>
        <div className="text-[11px] text-[#7a8394] mt-2">
          {alertsToday === 0 ? 'Excellent work, no strain!' : 'Alerts triggered by eye strain'}
        </div>
      </div>
    </div>
  );
}
