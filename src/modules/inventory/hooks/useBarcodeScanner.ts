import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '../../../core/db';
import type { Material, StorageLocation, PurchaseOrder, MaterialDocument } from '../../../types/models';

export interface ResolvedBarcode {
  rawCode: string;
  type: 'material' | 'storageLocation' | 'purchaseOrder' | 'materialDoc' | 'unknown';
  item?: Material | StorageLocation | PurchaseOrder | MaterialDocument | null;
  description: string;
}

export function useBarcodeScanner(onScan?: (resolved: ResolvedBarcode) => void) {
  const [lastScanned, setLastScanned] = useState<ResolvedBarcode | null>(null);
  const [isScanningActive, setIsScanningActive] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const keyIntervalsRef = useRef<number[]>([]);

  // Function to resolve a scanned string against DB entities
  const resolveBarcode = useCallback(async (code: string): Promise<ResolvedBarcode> => {
    const cleanCode = code.trim();

    // 1. Check if it's a Material
    const material = await db.materials
      .where('materialCode')
      .equalsIgnoreCase(cleanCode)
      .first();

    if (material) {
      return {
        rawCode: cleanCode,
        type: 'material',
        item: material,
        description: `صنف مخزني: ${material.name} (${material.materialCode})`,
      };
    }

    // 2. Check if it's a Storage Location
    const sloc = await db.storageLocations
      .where('code')
      .equalsIgnoreCase(cleanCode)
      .first();

    if (sloc) {
      return {
        rawCode: cleanCode,
        type: 'storageLocation',
        item: sloc,
        description: `موقع تخزين / مستودع: ${sloc.name} (${sloc.code})`,
      };
    }

    // 3. Check if it's a Purchase Order
    const po = await db.purchaseOrders
      .where('docNumber')
      .equalsIgnoreCase(cleanCode)
      .first();

    if (po) {
      return {
        rawCode: cleanCode,
        type: 'purchaseOrder',
        item: po,
        description: `أمر شراء: ${po.docNumber} - مورد: ${po.vendorName}`,
      };
    }

    // 4. Check if it's a Material Document
    const matdoc = await db.materialDocuments
      .where('docNumber')
      .equalsIgnoreCase(cleanCode)
      .first();

    if (matdoc) {
      return {
        rawCode: cleanCode,
        type: 'materialDoc',
        item: matdoc,
        description: `مستند حركة مواد: ${matdoc.docNumber} (${matdoc.movementType})`,
      };
    }

    return {
      rawCode: cleanCode,
      type: 'unknown',
      description: `باركود غير مسجل في النظام: ${cleanCode}`,
    };
  }, []);

  const triggerScan = useCallback(async (code: string) => {
    const resolved = await resolveBarcode(code);
    setLastScanned(resolved);
    setIsDrawerOpen(true);
    if (onScan) {
      onScan(resolved);
    }
  }, [resolveBarcode, onScan]);

  useEffect(() => {
    if (!isScanningActive) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't intercept when user is typing in standard inputs unless it's an ultra-fast wedge sequence
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      const now = performance.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const buffer = bufferRef.current;
        const intervals = keyIntervalsRef.current;

        // Reset buffers
        bufferRef.current = '';
        keyIntervalsRef.current = [];

        // Check wedge speed heuristics: length >= 3 and avg interval < 60ms
        const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 999;
        const isScannerWedge = (buffer.length >= 3 && avgInterval < 60) || (!isInput && buffer.length >= 3);

        if (isScannerWedge && buffer.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          await triggerScan(buffer);
        }
        return;
      }

      // Ignore modifiers
      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // Record interval
      if (bufferRef.current.length > 0) {
        keyIntervalsRef.current.push(interval);
      }

      // If typing pause is more than 300ms, start fresh buffer
      if (interval > 300) {
        bufferRef.current = e.key;
        keyIntervalsRef.current = [];
      } else {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isScanningActive, triggerScan]);

  return {
    lastScanned,
    isDrawerOpen,
    setIsDrawerOpen,
    isScanningActive,
    setIsScanningActive,
    triggerScan,
    resolveBarcode,
  };
}
