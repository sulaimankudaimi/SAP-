import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { ValueHelpModal } from './ValueHelpModal';
import { useBarcodeScanner } from '../../modules/inventory/hooks/useBarcodeScanner';
import { BarcodeScanDrawer } from '../../modules/inventory/components/BarcodeScanDrawer';
import { useToast } from '../ui/Toast';

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const { info } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Value Help Modal (F4)
  const [valueHelpOpen, setValueHelpOpen] = useState(false);
  const [valueHelpCategory, setValueHelpCategory] = useState<
    'materials' | 'vendors' | 'costCenters' | 'plants' | 'glAccounts'
  >('materials');

  // Global Barcode Scanner Keyboard Wedge listener (Requirement #10)
  const { lastScanned, isDrawerOpen, setIsDrawerOpen, triggerScan } = useBarcodeScanner();

  // Global shortcut listeners: Ctrl+K, Ctrl+N, Ctrl+S, F4
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ctrl+K / Cmd+K: Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // 2. Ctrl+N / Cmd+N: New on current list page
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('erp:shortcut:new'));

        // Look for primary "New / Create" button in the active view
        const newBtn = document.querySelector<HTMLButtonElement>(
          'button[data-shortcut="new"], button:has(svg.lucide-plus), main button:has(.lucide-plus)'
        );
        if (newBtn && !newBtn.disabled) {
          newBtn.click();
        } else {
          // Alternative text match
          const allButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('main button'));
          const createBtn = allButtons.find((b) => {
            const text = b.textContent?.trim() || '';
            return (
              (text.includes('إنشاء') || text.includes('إضافة') || text.includes('جديد')) &&
              !b.disabled &&
              b.offsetParent !== null
            );
          });
          if (createBtn) {
            createBtn.click();
          }
        }
        return;
      }

      // 3. Ctrl+S / Cmd+S: Save in open form/modal
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('erp:shortcut:save'));

        // Find active submit button in an open modal or active form
        const modalSubmit = document.querySelector<HTMLButtonElement>(
          '[role="dialog"] button[type="submit"], [role="dialog"] button:has(svg.lucide-save), form button[type="submit"]'
        );
        if (modalSubmit && !modalSubmit.disabled) {
          modalSubmit.click();
        } else {
          const allButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
          const saveBtn = allButtons.find((b) => {
            const text = b.textContent?.trim() || '';
            return (
              (text.includes('حفظ') || text.includes('Save') || text.includes('تأكيد')) &&
              !b.disabled &&
              b.offsetParent !== null
            );
          });
          if (saveBtn) {
            saveBtn.click();
          }
        }
        return;
      }

      // 4. F4: Value Help in lookup fields
      if (e.key === 'F4') {
        e.preventDefault();

        // Determine category based on focused element attributes
        const activeEl = document.activeElement as HTMLElement | null;
        const lookupType = activeEl?.getAttribute('data-lookup')?.toLowerCase();

        if (lookupType?.includes('vendor')) {
          setValueHelpCategory('vendors');
        } else if (lookupType?.includes('cost') || lookupType?.includes('cc')) {
          setValueHelpCategory('costCenters');
        } else if (lookupType?.includes('plant') || lookupType?.includes('loc')) {
          setValueHelpCategory('plants');
        } else if (lookupType?.includes('gl') || lookupType?.includes('acc')) {
          setValueHelpCategory('glAccounts');
        } else {
          setValueHelpCategory('materials');
        }

        setValueHelpOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBarcodeAction = (action: 'view_stock' | 'gr' | 'gi', targetCode: string) => {
    setIsDrawerOpen(false);
    if (action === 'view_stock') {
      navigate('/inventory/stock');
    } else if (action === 'gr' || action === 'gi') {
      navigate('/inventory');
    }
  };

  const handleValueHelpSelect = (code: string) => {
    // If active element is an input, set its value
    const activeEl = document.activeElement;
    if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
      activeEl.value = code;
      activeEl.dispatchEvent(new Event('input', { bubbles: true }));
      activeEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setValueHelpOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex" dir="rtl">
      {/* Right-side RTL Sidebar */}
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Command Palette Global Search (Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Value Help Modal (F4) */}
      <ValueHelpModal
        isOpen={valueHelpOpen}
        onClose={() => setValueHelpOpen(false)}
        initialCategory={valueHelpCategory}
        onSelect={handleValueHelpSelect}
      />

      {/* Global Barcode Scanner Drawer */}
      <BarcodeScanDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        scanned={lastScanned}
        onManualScan={triggerScan}
        onSelectAction={handleBarcodeAction}
      />
    </div>
  );
};
