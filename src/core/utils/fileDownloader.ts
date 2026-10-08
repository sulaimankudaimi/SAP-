/**
 * Hybrid File Download & Native Save Manager
 * Automatically routes file saving to Electron's native dialogs (window.erpNative)
 * when running inside Electron desktop, and falls back gracefully to standard browser
 * Blob downloads when accessed via web browser.
 */

export interface FileSaveFilter {
  name: string;
  extensions: string[];
}

export async function saveFileUniversal(
  filename: string,
  data: string | Uint8Array | Blob,
  filters?: FileSaveFilter[]
): Promise<void> {
  // 1. Electron Native Environment Check
  if (typeof window !== 'undefined' && window.erpNative?.saveFile) {
    try {
      let dataToSave: string | Uint8Array;
      if (data instanceof Blob) {
        const buffer = await data.arrayBuffer();
        dataToSave = new Uint8Array(buffer);
      } else {
        dataToSave = data;
      }

      await window.erpNative.saveFile(filename, dataToSave, filters);
      return;
    } catch (err) {
      console.warn('Native save failed, attempting browser fallback:', err);
    }
  }

  // 2. Web Browser Fallback (Blob + ObjectURL)
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Non-browser (Node.js test or SSR) environment: safe no-op for downloader
    return;
  }

  let blob: Blob;
  if (data instanceof Blob) {
    blob = data;
  } else if (typeof data === 'string') {
    blob = new Blob([data], { type: 'text/plain;charset=utf-8;' });
  } else {
    blob = new Blob([data as unknown as BlobPart]);
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Saves CSV content with UTF-8 BOM for Arabic text compatibility.
 */
export async function downloadCsvFile(filename: string, csvContent: string): Promise<void> {
  const cleanName = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const contentWithBom = csvContent.startsWith('\uFEFF') ? csvContent : '\uFEFF' + csvContent;

  await saveFileUniversal(
    cleanName,
    contentWithBom,
    [{ name: 'CSV File (*.csv)', extensions: ['csv'] }]
  );
}

/**
 * Saves JSON content (e.g. database snapshots, system logs, backups).
 */
export async function downloadJsonFile(filename: string, jsonString: string): Promise<void> {
  const cleanName = filename.endsWith('.json') ? filename : `${filename}.json`;

  await saveFileUniversal(
    cleanName,
    jsonString,
    [{ name: 'JSON Backup (*.json)', extensions: ['json'] }]
  );
}
