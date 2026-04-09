import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type TabType = 'dashboard' | 'config' | 'prompt-optimizer' | 'worldbook' | 'avatar' | 'character' | 'plugin' | 'memory' | 'settings';
type ThemeType = 'light' | 'dark';

interface UIState {
  activeTab: TabType;
  theme: ThemeType;
  sidebarCollapsed: boolean;
  animationEnabled: boolean;
  compactMode: boolean;
  setActiveTab: (tab: TabType) => void;
  setTheme: (theme: ThemeType) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAnimationEnabled: (enabled: boolean) => void;
  setCompactMode: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: 'dashboard',
      theme: 'light',
      sidebarCollapsed: false,
      animationEnabled: true,
      compactMode: false,
      setActiveTab: (tab) => set({ activeTab: tab }),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setAnimationEnabled: (enabled) => set({ animationEnabled: enabled }),
      setCompactMode: (enabled) => set({ compactMode: enabled })
    }),
    {
      name: 'ui-storage'
    }
  )
);
