import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea
} from 'recharts';

export default function LiveChart({ metricsHistory }) {
  // Map metrics logs for plotting
  const chartData = metricsHistory.map(m => {
    const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    return {
      time: timeStr,
      bpm: m.avg_bpm || 0,
      ear: m.avg_ear || 0
    };
  });

  // Custom tooltips
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#12151c] border border-white/10 rounded-lg p-3 shadow-lg">
          <p className="text-xs text-[#7a8394] mb-1 font-mono-numbers">{payload[0].payload.time}</p>
          <p className="text-sm font-semibold text-tear-film">
            BPM: <span className="font-mono-numbers">{payload[0].value}</span>
          </p>
          {payload[1] && (
            <p className="text-sm font-semibold text-iris-amber mt-1">
              EAR: <span className="font-mono-numbers">{payload[1].value.toFixed(3)}</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card-lens p-5 flex flex-col justify-between h-[360px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-[#e8ecf1]">Blink Rate Oscilloscope</h3>
          <p className="text-xs text-[#7a8394]">Real-time tracking of eye aspect ratios and blink intervals</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-tear-film" />
            <span className="text-xs text-[#7a8394] font-medium">Resting BPM</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-1 border-t-2 border-dashed border-alert-coral" />
            <span className="text-xs text-[#7a8394] font-medium">Risk Zone (&lt; 12)</span>
          </div>
        </div>
      </div>

      <div className="w-full h-full flex-grow">
        <ResponsiveContainer width="100%" height="95%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorBpm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4fd8c4" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4fd8c4" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorEar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e8a33d" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#e8a33d" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            
            <XAxis
              dataKey="time"
              stroke="#7a8394"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            
            <YAxis
              stroke="#7a8394"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={[0, 30]}
              dx={-5}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Shaded risk zone below 12 BPM */}
            <ReferenceArea
              y1={0}
              y2={12}
              fill="rgba(255, 107, 94, 0.04)"
              stroke="none"
            />

            {/* Threshold marker */}
            <ReferenceLine
              y={12}
              stroke="#ff6b5e"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />

            {/* Area traces */}
            <Area
              type="monotone"
              dataKey="bpm"
              stroke="#4fd8c4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorBpm)"
              dot={false}
              activeDot={{
                r: 5,
                stroke: '#0a0c10',
                strokeWidth: 2,
                fill: '#4fd8c4',
                className: 'recharts-reference-dot'
              }}
            />
            
            <Area
              type="monotone"
              dataKey="ear"
              stroke="#e8a33d"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#colorEar)"
              dot={false}
              opacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
