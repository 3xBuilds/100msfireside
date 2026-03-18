'use client';

import React, { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';

interface LogEntry {
  id: number;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  data?: any;
}

interface DebugLoggerContextType {
  logs: LogEntry[];
  addLog: (level: LogEntry['level'], message: string, data?: any) => void;
  clearLogs: () => void;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
}

const DebugLoggerContext = createContext<DebugLoggerContextType | null>(null);

export function useDebugLogger() {
  const context = useContext(DebugLoggerContext);
  if (!context) {
    // Return a no-op version if not within provider
    return {
      logs: [],
      addLog: () => {},
      clearLogs: () => {},
      isEnabled: false,
      setIsEnabled: () => {},
    };
  }
  return context;
}

// Global debug function that can be called from anywhere
let globalAddLog: ((level: LogEntry['level'], message: string, data?: any) => void) | null = null;

export function debugLog(level: LogEntry['level'], message: string, data?: any) {
  // Also log to console
  const consoleMethod = level === 'error' ? console.error : 
                       level === 'warn' ? console.warn : 
                       level === 'info' ? console.info : console.log;
  if (data !== undefined) {
    consoleMethod(`[DEBUG] ${message}`, data);
  } else {
    consoleMethod(`[DEBUG] ${message}`);
  }
  
  // Add to visual logger if available
  if (globalAddLog) {
    globalAddLog(level, message, data);
  }
}

interface DebugLoggerProviderProps {
  children: React.ReactNode;
  defaultEnabled?: boolean;
}

export function DebugLoggerProvider({ children, defaultEnabled = false }: DebugLoggerProviderProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isEnabled, setIsEnabled] = useState(defaultEnabled);
  const idCounter = useRef(0);

  const addLog = useCallback((level: LogEntry['level'], message: string, data?: any) => {
    const entry: LogEntry = {
      id: idCounter.current++,
      level,
      message,
      timestamp: new Date(),
      data,
    };
    
    setLogs(prev => {
      // Keep only last 100 logs to prevent memory issues
      const newLogs = [...prev, entry];
      if (newLogs.length > 100) {
        return newLogs.slice(-100);
      }
      return newLogs;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Set up global reference
  useEffect(() => {
    globalAddLog = addLog;
    return () => {
      globalAddLog = null;
    };
  }, [addLog]);

  // Intercept fetch to log network requests (for debugging CORS issues)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const originalFetch = window.fetch;
    
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';
      
      // Only log RealtimeKit/Cloudflare related requests
      if (url.includes('realtime') || url.includes('cloudflare') || url.includes('dyte') || url.includes('rtk')) {
        addLog('info', `[NET] ${method} ${url.substring(0, 80)}...`);
      }
      
      try {
        const response = await originalFetch.call(window, input, init);
        
        if (url.includes('realtime') || url.includes('cloudflare') || url.includes('dyte') || url.includes('rtk')) {
          if (!response.ok) {
            addLog('error', `[NET] ${method} ${response.status}`, {
              url: url.substring(0, 100),
              status: response.status,
              statusText: response.statusText,
            });
          } else {
            addLog('info', `[NET] ${method} ${response.status} OK`);
          }
        }
        
        return response;
      } catch (error: any) {
        // This catches CORS errors, network errors, etc.
        addLog('error', `[NET ERROR] ${method}`, {
          url: url.substring(0, 100),
          error: error?.message || 'Network error (possible CORS)',
          type: error?.name,
        });
        throw error;
      }
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, [addLog]);

  return (
    <DebugLoggerContext.Provider value={{ logs, addLog, clearLogs, isEnabled, setIsEnabled }}>
      {children}
    </DebugLoggerContext.Provider>
  );
}

interface DebugLoggerDisplayProps {
  className?: string;
}

export function DebugLoggerDisplay({ className = '' }: DebugLoggerDisplayProps) {
  const { logs, clearLogs, isEnabled, setIsEnabled } = useDebugLogger();
  const [isExpanded, setIsExpanded] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isExpanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded]);

  // Don't render if not enabled
  if (!isEnabled) {
    return (
      <button
        onClick={() => setIsEnabled(true)}
        className="absolute top-2 right-2 z-[9999] bg-gray-800 text-white px-3 py-1 rounded-full text-xs opacity-50 hover:opacity-100"
      >
        🐛 Debug
      </button>
    );
  }

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-400 bg-red-900/30';
      case 'warn': return 'text-yellow-400 bg-yellow-900/30';
      case 'info': return 'text-blue-400 bg-blue-900/30';
      default: return 'text-gray-300 bg-gray-800/50';
    }
  };

  const formatTime = (date: Date) => {
    const time = date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  };

  const formatData = (data: any) => {
    if (data === undefined) return null;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div 
      className={`absolute top-0 left-0 right-0 z-[9999] ${className}`}
    >
      {/* Toggle bar */}
      <div className="flex items-center justify-between bg-gray-900 border-b border-gray-700 px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-white text-sm"
        >
          <span>{isExpanded ? '▲' : '▼'}</span>
          <span>🐛 Debug Logs ({logs.length})</span>
        </button>
        <div className="flex gap-2">
          <button
            onClick={clearLogs}
            className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded bg-gray-800"
          >
            Clear
          </button>
          <button
            onClick={() => setIsEnabled(false)}
            className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded bg-gray-800"
          >
            Hide
          </button>
        </div>
      </div>

      {/* Log entries */}
      {isExpanded && (
        <div 
          className="bg-black/95 max-h-64 overflow-y-auto font-mono text-xs"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          {logs.length === 0 ? (
            <div className="text-gray-500 p-4 text-center">No logs yet...</div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                className={`border-b border-gray-800 p-2 ${getLevelColor(log.level)}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 shrink-0">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className="font-bold shrink-0 w-12">
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="break-all">{log.message}</span>
                </div>
                {log.data !== undefined && (
                  <pre className="mt-1 ml-24 text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
                    {formatData(log.data)}
                  </pre>
                )}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}

export default DebugLoggerDisplay;

