import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: LogLevel;
}

interface LogState {
  logs: LogEntry[];
  isLogPanelOpen: boolean;
  unreadCount: number;
  addLog: (message: string, type?: LogLevel) => void;
  clearLogs: () => void;
  toggleLogPanel: () => void;
  setLogPanelOpen: (open: boolean) => void;
  markAsRead: () => void;
}

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => ({
      logs: [],
      isLogPanelOpen: false,
      unreadCount: 0,
      
      addLog: (message, type = 'info') => {
        const newLog: LogEntry = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          message,
          type
        };
        
        set((state) => {
          const newLogs = [...state.logs, newLog];
          // 限制日志数量，最多保留1000条
          if (newLogs.length > 1000) {
            newLogs.shift();
          }
          return {
            logs: newLogs,
            unreadCount: state.isLogPanelOpen ? 0 : state.unreadCount + 1
          };
        });
      },
      
      clearLogs: () => set({ logs: [], unreadCount: 0 }),
      
      toggleLogPanel: () => set((state) => ({ 
        isLogPanelOpen: !state.isLogPanelOpen,
        unreadCount: !state.isLogPanelOpen ? 0 : state.unreadCount
      })),
      
      setLogPanelOpen: (open) => set({ 
        isLogPanelOpen: open,
        unreadCount: open ? 0 : get().unreadCount
      }),
      
      markAsRead: () => set({ unreadCount: 0 })
    }),
    {
      name: 'log-storage',
      partialize: (state) => ({ logs: state.logs }) // 只持久化日志数据
    }
  )
);
