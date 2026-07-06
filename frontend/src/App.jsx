import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor, Play, Square, Settings, RefreshCw, Volume2, VolumeX, Shield,
  Wifi, WifiOff, Bell, BellOff, ChevronLeft, ChevronRight, BarChart3, LayoutDashboard,
  Moon, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle
} from 'lucide-react';

// Component imports
import StatsGrid from './components/StatsGrid';
import LiveChart from './components/LiveChart';
import BreakTimer from './components/BreakTimer';
import AlertLog from './components/AlertLog';
import TrendsView from './components/TrendsView';
import Aperture from './components/Aperture';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'trends'
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Live WebSocket State
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationSeconds, setCalibrationSeconds] = useState(0);
  const [blinkTrigger, setBlinkTrigger] = useState(false);
  const [cameraFrame, setCameraFrame] = useState(null);

  // Real-time Streaming Metrics (derived from WS)
  const [metrics, setMetrics] = useState({
    bpm: 15,
    totalBlinks: 0,
    ear: 0.24,
    perclos: 0.05,
    strainScore: 10,
    faceDetected: false,
    alertActive: false,
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    closeness: 1.0,
    brightness: 120,
    dndActive: false,
    activeApp: 'None',
    pomodoroRemaining: 1200,
    breakActive: false
  });

  // Logs & History Sync
  const [alerts, setAlerts] = useState([]);
  const [metricsHistory, setMetricsHistory] = useState([]);

  // Toast Management
  const [toasts, setToasts] = useState([]);

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bpmThreshold, setBpmThreshold] = useState(12);
  const [alertCooldown, setAlertCooldown] = useState(10); // minutes
  const [dndWindowTracking, setDndWindowTracking] = useState(true);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(true);
  const [icsPath, setIcsPath] = useState('');

  // WebSocket reference
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  // Connection management (reconnect with backoff)
  const connectWebSocket = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

    console.log("Attempting WebSocket connection...");
    wsRef.current = new WebSocket('ws://localhost:8765');

    wsRef.current.onopen = () => {
      console.log("WebSocket connected.");
      setIsConnected(true);
      setReconnectAttempt(0);
      addToast('System Connected', 'Established contact with background processing service.', 'success');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle stream data (metric packets do not have an event type)
        if (data.timestamp && !data.event) {
          setMetrics(data);
          
          // Append to local graph series (limit history to 60 data points in memory)
          setMetricsHistory(prev => {
            const next = [...prev, {
              timestamp: data.timestamp,
              avg_bpm: data.bpm,
              avg_ear: data.ear,
              avg_perclos: data.perclos,
              avg_posture_score: 100 - Math.abs(data.headPose?.pitch || 0) - Math.abs(data.headPose?.yaw || 0)
            }];
            if (next.length > 60) next.shift();
            return next;
          });
        }
        
        // Handle events
        else if (data.event === 'history_sync') {
          setAlerts(data.alerts || []);
          setMetricsHistory(data.metricsHistory || []);
        }
        
        else if (data.event === 'frame') {
          setCameraFrame(data.image);
        }
        
        else if (data.event === 'blink') {
          // Trigger flutter
          setBlinkTrigger(prev => !prev);
        }
        
        else if (data.event === 'calibration_progress') {
          setIsCalibrating(true);
          setCalibrationSeconds(data.secondsLeft);
        }
        
        else if (data.event === 'calibration_complete') {
          setIsCalibrating(false);
          addToast('Calibration Complete', `EAR Threshold adapted to: ${data.earThreshold.toFixed(3)}`, 'success');
        }
        
        else if (data.event === 'alert') {
          // Record local log
          setAlerts(prev => [data, ...prev]);
          // Trigger visual toast
          addToast(
            data.type === 'critical_bpm' ? '⚠️ CRITICAL STRAIN ALERT' : '⏰ BREAK ADVISORY',
            data.message,
            data.type === 'critical_bpm' ? 'error' : 'warning'
          );
          
          // Trigger native OS-level desktop notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(
                data.type === 'critical_bpm' ? 'CRITICAL: Extreme Eye Strain Risk' : 'Time to Rest Your Eyes',
                {
                  body: data.message,
                  tag: data.type,
                  renotify: true
                }
              );
            } catch (e) {
              console.error("Failed to display native Web Notification:", e);
            }
          }
        }
        
        else if (data.event === 'break_resolved') {
          addToast('Cycle Restarted', 'Break successfully completed. Live monitoring resumed.', 'success');
        }
        
        else if (data.event === 'logs_cleared') {
          setAlerts([]);
          setMetricsHistory([]);
          addToast('Database Cleared', 'All logs and alert histories deleted.', 'success');
        }

        else if (data.event === 'session_reset') {
          setAlerts([]);
          setMetricsHistory([]);
          setMetrics(prev => ({
            ...prev,
            bpm: 15,
            totalBlinks: 0,
            ear: 0.24,
            perclos: 0.05,
            strainScore: 0,
            pomodoroRemaining: 1200,
            breakActive: false
          }));
          addToast('Session Restarted', 'All statistics, timers, and logs have been reset.', 'success');
        }
        
        else if (data.event === 'export_complete') {
          addToast('Data Exported', `Diagnostic log written to: ${data.fileName}`, 'success');
        }

      } catch (err) {
        console.error("Error parsing WS packet:", err);
      }
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket disconnected.");
      
      setReconnectAttempt(prev => {
        const nextAttempt = prev + 1;
        const nextDelay = Math.min(1000 * Math.pow(2, prev), 16000);
        console.log(`Scheduling reconnect attempt in ${nextDelay / 1000}s`);
        
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocket();
        }, nextDelay);
        
        return nextAttempt;
      });
    };

    wsRef.current.onerror = (err) => {
      console.error("WebSocket socket error:", err);
    };
  };

  useEffect(() => {
    connectWebSocket();
    
    // Request desktop notification permissions
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log("Notification permission state:", permission);
      });
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  // Dispatch WebSocket Action Helper
  const sendWsAction = (payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  };

  // Toast actions
  const addToast = (title, text, severity = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, text, severity }]);
    
    // Auto remove after 6s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Toggle monitoring
  const toggleMonitoring = () => {
    const nextState = !isMonitoring;
    setIsMonitoring(nextState);
    sendWsAction({ action: nextState ? 'start_monitoring' : 'stop_monitoring' });
  };

  // Trigger calibration
  const startCalibration = () => {
    setIsCalibrating(true);
    sendWsAction({ action: 'calibrate' });
  };

  // Restart the entire session
  const handleRestartSession = () => {
    sendWsAction({ action: 'reset_session' });
    setAlerts([]);
    setMetricsHistory([]);
    setMetrics(prev => ({
      ...prev,
      bpm: 15,
      totalBlinks: 0,
      ear: 0.24,
      perclos: 0.05,
      strainScore: 0,
      pomodoroRemaining: 1200,
      breakActive: false
    }));
  };

  // Sync settings back to backend
  useEffect(() => {
    sendWsAction({ action: 'set_threshold', threshold: bpmThreshold === 12 ? 0.21 : 0.18 });
  }, [bpmThreshold]);

  useEffect(() => {
    sendWsAction({ action: 'toggle_dnd', dnd: !dndWindowTracking });
  }, [dndWindowTracking]);

  useEffect(() => {
    sendWsAction({ action: 'set_cooldown', cooldown: alertCooldown * 60 });
  }, [alertCooldown]);

  // Update calendar settings
  const handleIcsPathSubmit = (e) => {
    e.preventDefault();
    sendWsAction({ action: 'set_ics_path', ics_path: icsPath });
    addToast('Calendar Synced', 'ICS subscription updated in background.', 'success');
  };

  return (
    <div className="min-h-screen bg-void flex text-[#e8ecf1]">
      
      {/* 1. LEFT SIDEBAR */}
      <aside
        className={`bg-lens border-r border-white/5 transition-all duration-300 flex flex-col z-20 shrink-0 ${
          sidebarOpen ? 'w-[280px]' : 'w-0 overflow-hidden border-none'
        }`}
      >
        {/* Top Header Logo */}
        <div className="p-6 border-b border-white/5 flex items-center space-x-3">
          <Aperture active={isConnected && isMonitoring} strainScore={metrics.strainScore} blinkTrigger={blinkTrigger} size={36} />
          <div>
            <h1 className="text-md font-bold tracking-tight text-[#e8ecf1]">OPTIC EYE</h1>
            <span className="text-[9px] text-[#7a8394] uppercase tracking-widest font-mono-numbers">Diagnostics v1.0</span>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="flex-grow p-5 space-y-6 overflow-y-auto">
          {/* Connection Status Indicator */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#7a8394] tracking-wider">Device Connection</span>
            <div className="flex items-center justify-between p-3 rounded-xl bg-void/50 border border-white/5">
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-tear-film animate-pulse" />
                    <span className="text-xs font-semibold text-[#e8ecf1]">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-alert-coral" />
                    <span className="text-xs font-semibold text-alert-coral">Offline (reconnecting)</span>
                  </>
                )}
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-tear-film shadow-[0_0_8px_rgba(79,216,196,0.5)]" />
            </div>
          </div>

          {/* Camera controls */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-[#7a8394] tracking-wider">Webcam Monitor</span>
            
            {/* Camera Preview Thumbnail */}
            <div className="relative w-full aspect-video rounded-xl bg-void/70 border border-white/5 overflow-hidden flex items-center justify-center">
              {isMonitoring && cameraFrame ? (
                <img
                  src={`data:image/jpeg;base64,${cameraFrame}`}
                  alt="Camera Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-white/5 border-dashed" />
                    <Moon className="w-4.5 h-4.5 text-gray-700" />
                  </div>
                  <span className="text-[10px] text-gray-500 mt-2">
                    {!isMonitoring ? "Camera Paused" : "Waiting for feed..."}
                  </span>
                </div>
              )}
              {isMonitoring && (
                <div className="absolute top-2.5 right-2.5 flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-lens/90 border border-white/5 text-[9px] font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full ${metrics.faceDetected ? 'bg-tear-film shadow-[0_0_4px_#4fd8c4]' : 'bg-alert-coral'}`} />
                  <span className="text-[#e8ecf1]">
                    {metrics.faceDetected ? "FACE OK" : "NO FACE"}
                  </span>
                </div>
              )}
            </div>

            {/* Start/Stop Toggle */}
            <button
              onClick={toggleMonitoring}
              disabled={!isConnected}
              className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all duration-200 ${
                isMonitoring 
                  ? 'bg-alert-coral/10 hover:bg-alert-coral/20 text-alert-coral border border-alert-coral/20' 
                  : 'bg-tear-film text-void hover:bg-[#43c4b1]'
              }`}
            >
              {isMonitoring ? (
                <>
                  <Square className="w-4 h-4" />
                  <span>Stop Capture</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Start Capture</span>
                </>
              )}
            </button>

            {/* Calibration sequence */}
            <button
              onClick={startCalibration}
              disabled={!isConnected || !isMonitoring || isCalibrating}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-xs font-bold text-[#e8ecf1] flex items-center justify-center space-x-2 transition-all duration-200"
            >
              <RefreshCw className={`w-4 h-4 ${isCalibrating ? 'animate-spin' : ''}`} />
              <span>{isCalibrating ? `Calibrating (${calibrationSeconds}s)` : 'Run Calibration'}</span>
            </button>
          </div>

          {/* Alert Threshold Adjusters */}
          <div className="space-y-3 pt-3 border-t border-white/5">
            <span className="text-[10px] uppercase font-bold text-[#7a8394] tracking-wider">Parameters</span>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#7a8394]">
                <span>BPM Threshold</span>
                <span className="font-mono-numbers text-[#e8ecf1]">{bpmThreshold} min</span>
              </div>
              <input
                type="range"
                min="8"
                max="18"
                value={bpmThreshold}
                onChange={(e) => setBpmThreshold(Number(e.target.value))}
                className="w-full h-1 bg-[#181c25] rounded-lg appearance-none cursor-pointer accent-tear-film"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#7a8394]">
                <span>Cooldown Time</span>
                <span className="font-mono-numbers text-[#e8ecf1]">
                  {alertCooldown === 0 ? "No Cooldown" : `${alertCooldown} min`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={alertCooldown}
                onChange={(e) => setAlertCooldown(Number(e.target.value))}
                className="w-full h-1 bg-[#181c25] rounded-lg appearance-none cursor-pointer accent-tear-film"
              />
            </div>
          </div>

          {/* Calendar Subscription URL Entry */}
          <form onSubmit={handleIcsPathSubmit} className="space-y-2 pt-3 border-t border-white/5">
            <span className="text-[10px] uppercase font-bold text-[#7a8394] tracking-wider">Calendar Suppress</span>
            <input
              type="text"
              placeholder="Local ICS file path..."
              value={icsPath}
              onChange={(e) => setIcsPath(e.target.value)}
              className="w-full bg-void/50 border border-white/5 rounded-xl px-3 py-2 text-xs text-[#e8ecf1] placeholder-gray-600 focus:outline-none focus:border-tear-film/30"
            />
            <button
              type="submit"
              className="w-full py-1.5 bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase rounded-lg border border-white/5"
            >
              Sync Calendar
            </button>
          </form>
        </div>

        {/* User Sound State Mute */}
        <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs text-[#7a8394]">
          <span className="flex items-center space-x-1.5">
            <Shield className="w-4 h-4 text-tear-film" />
            <span>Local Processing Only</span>
          </span>
          <button onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? (
              <Volume2 className="w-4.5 h-4.5 text-[#e8ecf1]" />
            ) : (
              <VolumeX className="w-4.5 h-4.5 text-[#7a8394]" />
            )}
          </button>
        </div>
      </aside>

      {/* 2. MAIN SYSTEM AREA */}
      <main className="flex-grow flex flex-col min-w-0">
        
        {/* Navigation Topbar Header */}
        <header className="h-[73px] border-b border-white/5 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5"
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {/* Title */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-[#e8ecf1]">Dashboard Console</span>
              {metrics.dndActive && (
                <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-iris-amber/10 text-iris-amber border border-iris-amber/20 animate-pulse">
                  <Moon className="w-3 h-3" />
                  <span>DND Muted</span>
                </span>
              )}
            </div>
          </div>

          {/* Controls & Navigation Tabs */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRestartSession}
              className="px-3.5 py-1.5 rounded-xl border border-alert-coral/20 bg-alert-coral/5 hover:bg-alert-coral/10 text-alert-coral text-xs font-semibold flex items-center space-x-2 transition-all duration-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restart Session</span>
            </button>

            <nav className="flex space-x-1 bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all duration-200 ${
                activeTab === 'dashboard' ? 'bg-[#181c25] text-[#e8ecf1] shadow-sm' : 'text-[#7a8394] hover:text-[#e8ecf1]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Diagnostic Center</span>
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all duration-200 ${
                activeTab === 'trends' ? 'bg-[#181c25] text-[#e8ecf1] shadow-sm' : 'text-[#7a8394] hover:text-[#e8ecf1]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Trends & Privacy</span>
            </button>
          </nav>
        </div>
      </header>

        {/* Tab Contents View */}
        <div className="flex-grow p-6 overflow-y-auto space-y-6">
          {activeTab === 'dashboard' ? (
            <>
              {/* Stats Cards */}
              <StatsGrid
                bpm={metrics.bpm}
                totalBlinks={metrics.totalBlinks || 0}
                strainScore={metrics.strainScore}
                pomodoroRemaining={metrics.pomodoroRemaining}
                alertsToday={alerts.length}
                faceDetected={metrics.faceDetected}
                dndActive={metrics.dndActive}
                metricsHistory={metricsHistory}
              />

              {/* Central Graph & Break timer layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <LiveChart metricsHistory={metricsHistory} />
                </div>
                <div>
                  <BreakTimer
                    pomodoroRemaining={metrics.pomodoroRemaining}
                    breakActive={metrics.breakActive}
                    onResolveBreak={() => sendWsAction({ action: 'take_break_resolved' })}
                    wsSend={sendWsAction}
                  />
                </div>
              </div>

              {/* Alert Journal */}
              <AlertLog
                alerts={alerts}
                onClearLogs={() => sendWsAction({ action: 'clear_logs' })}
              />
            </>
          ) : (
            <TrendsView
              metricsHistory={metricsHistory}
              alerts={alerts}
              wsSend={sendWsAction}
              onExportCsv={() => sendWsAction({ action: 'export_csv' })}
              dndWindowTracking={dndWindowTracking}
              setDndWindowTracking={setDndWindowTracking}
              calendarSyncEnabled={calendarSyncEnabled}
              setCalendarSyncEnabled={setCalendarSyncEnabled}
            />
          )}
        </div>
      </main>

      {/* 3. IN-APP TOAST NOTIFICATIONS STACK */}
      <div className="fixed top-5 right-5 z-50 space-y-3 pointer-events-none w-80">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className="pointer-events-auto w-full p-4 rounded-xl bg-lens/95 border border-white/10 shadow-2xl flex items-start space-x-3 cursor-pointer hover:bg-lens-raised transition-all duration-200 animate-slide-in"
          >
            {/* Drawing Icon based on Severity */}
            <div className="mt-0.5 shrink-0">
              {toast.severity === 'success' && <CheckCircle2 className="w-5 h-5 text-tear-film animate-draw" />}
              {toast.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-iris-amber animate-draw" />}
              {toast.severity === 'error' && <AlertCircle className="w-5 h-5 text-alert-coral animate-draw" />}
              {toast.severity === 'info' && <HelpCircle className="w-5 h-5 text-[#8b7cf6] animate-draw" />}
            </div>
            
            <div className="flex-grow min-w-0">
              <h4 className="text-xs font-bold text-[#e8ecf1] tracking-tight">{toast.title}</h4>
              <p className="text-[11px] text-[#7a8394] mt-0.5 leading-relaxed">{toast.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Styles for Toast/Icons */}
      <style>{`
        .animate-slide-in {
          animation: slideIn 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideIn {
          from { transform: translateX(110%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-draw {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: draw 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
