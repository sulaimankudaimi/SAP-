import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { AssetService } from '../services/AssetService';
import type { Asset } from '../../../types/models';
import { ScanBarcode, ArrowLeft, CheckCircle2, AlertCircle, Building2, User } from 'lucide-react';
import { t } from '../../../i18n/ar';

interface AssetScanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AssetScanDrawer: React.FC<AssetScanDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [matchedAsset, setMatchedAsset] = useState<Asset | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Auto-focus barcode input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setMatchedAsset(null);
      setHasSearched(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const handleSearch = async (codeToSearch: string) => {
    const val = codeToSearch.trim();
    if (!val) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const asset = await AssetService.getAssetByIdOrCode(val);
      setMatchedAsset(asset);
    } catch (err) {
      console.error(err);
      setMatchedAsset(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(query);
    }
  };

  const handleOpenAsset = () => {
    if (matchedAsset) {
      onClose();
      navigate(`/assets/register/${matchedAsset.id}`);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="المسح السريع للباركود (Scan-to-Open)"
      size="md"
    >
      <div className="space-y-6">
        {/* Scanner Banner */}
        <div className="bg-gradient-to-r from-[#0B2545] to-[#13315C] text-white p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
            <ScanBarcode className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm">قارئ الباركود الرقمي المباشر</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              قم بتوجيه ماسح الباركود اليدوي نحو الملصق، أو أدخل رقم الأصل / الباركود يدوياً للفتح الفوري.
            </p>
          </div>
        </div>

        {/* Input box */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">
            رقم الباركود أو رقم الأصل (Code128 / AA-XXXX)
          </label>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (hasSearched) setHasSearched(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder="مثال: BC-AA2026000001 أو AA-2026-000001"
              className="font-mono text-start"
            />
            <Button
              onClick={() => handleSearch(query)}
              disabled={isSearching || !query.trim()}
              className="bg-[#0B2545] hover:bg-[#13315C] shrink-0"
            >
              بحث
            </Button>
          </div>
        </div>

        {/* Search Results Preview */}
        {hasSearched && (
          <div className="pt-2">
            {matchedAsset ? (
              <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{matchedAsset.name}</h4>
                      <p className="text-xs font-mono text-emerald-700 font-semibold">
                        {matchedAsset.assetNumber}
                      </p>
                    </div>
                  </div>
                  <Badge variant={matchedAsset.status === 'Active' ? 'approved' : 'pending'}>
                    {matchedAsset.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>الموقع: {matchedAsset.location || matchedAsset.plantCode}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>العهدة: {matchedAsset.custodian}</span>
                  </div>
                  <div className="col-span-2 text-slate-600">
                    صافي القيمة الدفترية:{' '}
                    <span className="font-bold text-slate-900 font-mono">
                      {matchedAsset.netBookValue.toLocaleString('en-US')} ريال
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleOpenAsset}
                  className="w-full bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 py-2.5 font-bold"
                >
                  <span>فتح بطاقة وتفاصيل الأصل كاملة</span>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="border border-rose-200 bg-rose-50/50 rounded-2xl p-5 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                <h4 className="font-bold text-sm text-slate-800">لم يتم العثور على أصل مطابق</h4>
                <p className="text-xs text-slate-500">
                  تأكد من صحة رقم الباركود أو الرمز المدخل وحاول مرة أخرى.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
};
