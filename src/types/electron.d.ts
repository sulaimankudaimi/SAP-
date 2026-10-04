export interface ErpNativeFileFilter {
  name: string;
  extensions: string[];
}

export interface ErpNativeSaveResult {
  canceled: boolean;
  filePath?: string;
}

export interface ErpNativeOpenResult {
  canceled: boolean;
  filePath?: string;
  data?: string;
}

export interface ErpNativeApi {
  isElectron: boolean;
  getAppVersion: () => Promise<string>;
  saveFile: (
    defaultName: string,
    data: string | Uint8Array | number[],
    filters?: ErpNativeFileFilter[]
  ) => Promise<ErpNativeSaveResult>;
  openFile: (filters?: ErpNativeFileFilter[]) => Promise<ErpNativeOpenResult>;
  printToPDF: (defaultName?: string) => Promise<ErpNativeSaveResult>;
}

declare global {
  interface Window {
    erpNative?: ErpNativeApi;
  }
}
