export interface ElectronAPI {
  config: {
    read: () => Promise<any>;
    write: (config: any) => Promise<any>;
    validate: (config: any) => Promise<any>;
  };
  worldBook: {
    list: () => Promise<any[]>;
    read: (path: string) => Promise<any>;
    write: (path: string, data: any) => Promise<any>;
    delete: (path: string) => Promise<any>;
    optimize: (path: string) => Promise<any>;
  };
  character: {
    list: () => Promise<any[]>;
    read: (path: string) => Promise<any>;
    write: (path: string, data: any) => Promise<any>;
    delete: (path: string) => Promise<any>;
    optimize: (path: string) => Promise<any>;
  };
  file: {
    selectDirectory: () => Promise<string | null>;
    selectFile: (filters: any[]) => Promise<string | null>;
    exists: (path: string) => Promise<boolean>;
    read: (path: string) => Promise<string>;
    write: (path: string, content: string) => Promise<void>;
    openFolder: (path: string) => Promise<{ success: boolean; message?: string }>;
  };
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    openPath: (path: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
