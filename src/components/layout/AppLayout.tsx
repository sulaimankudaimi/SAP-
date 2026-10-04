import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { useBarcodeScanner } from '../../modules/inventory/hooks/useBarcodeScanner';
import { BarcodeScanDrawer } from '../../modules/inventory/components/BarcodeScanDrawer';

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Barcode Scanner Keyboard Wedge listener (Requirement #10)
  const { lastScanned, isDrawerOpen, setIsDrawerOpen, triggerScan } = useBarcodeScanner();

  // Global shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
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

      {/* Command Palette Global Search */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
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
