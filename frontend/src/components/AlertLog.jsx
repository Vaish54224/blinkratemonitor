import React, { useState } from 'react';
import { Trash2, Filter, AlertTriangle, Info, Coffee } from 'lucide-react';

export default function AlertLog({ alerts, onClearLogs }) {
  const [filterType, setFilterType] = useState('all');

  const getAlertBadge = (type) => {
    switch (type) {
      case 'critical_bpm':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-alert-coral/10 text-alert-coral border border-alert-coral/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Critical</span>
          </span>
        );
      case 'low_bpm':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-iris-amber/10 text-iris-amber border border-iris-amber/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low BPM</span>
          </span>
        );
      case 'break_reminder':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-tear-film/10 text-tear-film border border-tear-film/20">
            <Coffee className="w-3.5 h-3.5" />
            <span>Break Reminder</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/5 text-[#7a8394] border border-white/10">
            <Info className="w-3.5 h-3.5" />
            <span>Info</span>
          </span>
        );
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filterType === 'all') return true;
    return a.alert_type === filterType;
  });

  const formatTimestamp = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="card-lens p-5 flex flex-col h-[400px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-[#e8ecf1]">Event Journal</h3>
          <p className="text-xs text-[#7a8394]">Chronological history of eye strain alerts and metrics</p>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Filter Dropdown */}
          <div className="relative flex items-center bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-[#7a8394]">
            <Filter className="w-3.5 h-3.5 mr-2" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent border-none text-[#e8ecf1] outline-none cursor-pointer text-xs"
            >
              <option value="all">All Events</option>
              <option value="low_bpm">Low BPM</option>
              <option value="critical_bpm">Critical</option>
              <option value="break_reminder">Breaks</option>
            </select>
          </div>

          {/* Clear Logs Button */}
          <button
            onClick={onClearLogs}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-xs font-medium text-alert-coral transition-all duration-200"
            title="Clear Log History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log list */}
      <div className="flex-grow overflow-y-auto space-y-2.5 pr-1">
        {filteredAlerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10">
            <p className="text-sm text-[#7a8394]">No logged alerts in session</p>
            <p className="text-xs text-[#7a8394]/50 mt-1">Metrics look completely healthy</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id || alert.timestamp}
              className="p-3.5 rounded-xl bg-[#0a0c10]/40 border border-white/5 hover:border-white/10 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center space-x-3">
                {getAlertBadge(alert.alert_type)}
                <div className="flex flex-col">
                  <span className="text-xs font-mono-numbers text-[#7a8394]">
                    {formatTimestamp(alert.timestamp)}
                  </span>
                  <span className="text-sm text-[#e8ecf1] font-medium mt-0.5">
                    {alert.alert_type === 'break_reminder' 
                      ? '20-20-20 screen rest prompt' 
                      : `Drop to ${alert.bpm} BPM during intense screen focus`}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-4 text-xs">
                {alert.window_title && (
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 text-[#7a8394] font-medium max-w-[150px] truncate">
                    {alert.window_title}
                  </span>
                )}
                <span className={`font-semibold ${alert.resolved ? 'text-tear-film' : 'text-[#7a8394]'}`}>
                  {alert.resolved ? '✓ Acknowledged' : '• Pending'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
