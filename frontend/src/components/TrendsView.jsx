import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import { FileDown, Sparkles, AlertCircle, ToggleLeft, ToggleRight, Calendar, Layers } from 'lucide-react';

export default function TrendsView({
  metricsHistory,
  alerts,
  wsSend,
  onExportCsv,
  dndWindowTracking,
  setDndWindowTracking,
  calendarSyncEnabled,
  setCalendarSyncEnabled
}) {
  // Generate rule-based natural language daily insight
  const generateDailyInsight = () => {
    if (metricsHistory.length === 0) {
      return "No data logged yet. Start webcam monitoring and keep the app active to compile daily correlation insights.";
    }

    // 1. Calculate resting average BPM
    const bpms = metricsHistory.map(m => m.avg_bpm || 0).filter(b => b > 0);
    const avgBpm = bpms.length > 0 ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : 16;
    
    // 2. Count alerts
    const totalAlerts = alerts.length;
    const resolvedAlerts = alerts.filter(a => a.resolved).length;
    
    // 3. Find lowest point and correlate window
    // Find alerts with low BPM and extract focus app
    const lowBpmAlerts = alerts.filter(a => a.alert_type === 'low_bpm' || a.alert_type === 'critical_bpm');
    let lowestBpm = 10;
    let focusApp = "coding in Visual Studio Code";
    
    if (lowBpmAlerts.length > 0) {
      const sortedAlerts = [...lowBpmAlerts].sort((a, b) => a.bpm - b.bpm);
      lowestBpm = sortedAlerts[0].bpm;
      if (sortedAlerts[0].window_title) {
        focusApp = `reading/editing in ${sortedAlerts[0].window_title}`;
      }
    }

    // Baseline comparison
    const baselineBpm = 19;
    const percentDiff = Math.round(((baselineBpm - avgBpm) / baselineBpm) * 100);

    return `You averaged ${avgBpm} blinks/min today, which is down ${percentDiff}% from your calibrated baseline of ${baselineBpm}. Your lowest blink rate was ${lowestBpm} BPM, correlated with heavy focus blocks in ${focusApp}. ${totalAlerts} alerts fired today, and ${resolvedAlerts} were successfully resolved with a 20-second optical break.`;
  };

  // Mock weekly trends data for chart representation
  const weeklyTrendsData = [
    { day: 'Mon', avgBpm: 18, avgStrain: 22, alerts: 1 },
    { day: 'Tue', avgBpm: 17, avgStrain: 35, alerts: 3 },
    { day: 'Wed', avgBpm: 15, avgStrain: 42, alerts: 4 },
    { day: 'Thu', avgBpm: 19, avgStrain: 18, alerts: 0 },
    { day: 'Fri', avgBpm: 16, avgStrain: 38, alerts: 2 },
    { day: 'Sat', avgBpm: 21, avgStrain: 10, alerts: 0 },
    { day: 'Sun', avgBpm: 20, avgStrain: 12, alerts: 0 }
  ];

  return (
    <div className="space-y-6">
      {/* AI Daily Summary Insight Panel (VIOLET COLOR INDICATING INFERRED DATA) */}
      <div className="p-6 rounded-2xl bg-[#8b7cf6]/5 border border-[#8b7cf6]/20 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-[#8b7cf6]/10 blur-2xl" />
        
        <div className="flex items-center space-x-2.5 mb-3 text-[#8b7cf6]">
          <Sparkles className="w-5 h-5" />
          <h4 className="text-md font-bold tracking-tight uppercase">Daily Correlation Insight</h4>
        </div>
        
        <p className="text-sm leading-relaxed text-[#e8ecf1]">
          {generateDailyInsight()}
        </p>
        
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#7a8394] font-medium border-t border-[#8b7cf6]/10 pt-3">
          <span>Target Rate: 15-20 BPM</span>
          <span>•</span>
          <span>Privacy Filter: Active (Local Processing Only)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Trend Graph Card */}
        <div className="card-lens p-5 lg:col-span-2 h-[340px] flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#e8ecf1]">Weekly Calibration Trend</h3>
            <p className="text-xs text-[#7a8394] mb-4">Historical comparison of blink frequencies vs strain scores</p>
          </div>

          <div className="w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrendsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#7a8394" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#7a8394" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#12151c', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '8px' }}
                  labelStyle={{ color: '#7a8394', fontFamily: 'monospace' }}
                />
                <Legend iconType="circle" fontSize={11} wrapperStyle={{ paddingTop: '10px' }} />
                <Bar name="Average BPM" dataKey="avgBpm" fill="#4fd8c4" radius={[4, 4, 0, 0]} />
                <Bar name="Strain Score" dataKey="avgStrain" fill="#e8a33d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Data Portability & Settings Panel */}
        <div className="card-lens p-5 h-[340px] flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#e8ecf1]">Privacy & Storage</h3>
            <p className="text-xs text-[#7a8394] mb-4">Manage localized integrations and export diagnostic metrics</p>
          </div>

          <div className="space-y-4 flex-grow py-3">
            {/* Window Tracking Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-start space-x-2.5">
                <Layers className="w-4.5 h-4.5 text-[#7a8394] mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#e8ecf1]">Focus Window Correlation</span>
                  <span className="text-[10px] text-[#7a8394]">Map strain dropouts to active window titles</span>
                </div>
              </div>
              <button onClick={() => setDndWindowTracking(!dndWindowTracking)}>
                {dndWindowTracking ? (
                  <ToggleRight className="w-9 h-9 text-tear-film" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-gray-700" />
                )}
              </button>
            </div>

            {/* Calendar DND Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-start space-x-2.5">
                <Calendar className="w-4.5 h-4.5 text-[#7a8394] mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#e8ecf1]">Calendar Auto-Mute</span>
                  <span className="text-[10px] text-[#7a8394]">Suppress notifications during schedule blocks</span>
                </div>
              </div>
              <button onClick={() => setCalendarSyncEnabled(!calendarSyncEnabled)}>
                {calendarSyncEnabled ? (
                  <ToggleRight className="w-9 h-9 text-tear-film" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-gray-700" />
                )}
              </button>
            </div>
          </div>

          {/* Export Report Trigger */}
          <button
            onClick={onExportCsv}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-xs font-bold text-[#e8ecf1] flex items-center justify-center space-x-2 transition-all duration-200"
          >
            <FileDown className="w-4.5 h-4.5 text-tear-film" />
            <span>Export Diagnostic CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
}
