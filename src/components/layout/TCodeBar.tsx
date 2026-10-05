import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TCodeService, SAPTransactionCode } from '../../core/services/TCodeService';
import { useAuthStore } from '../../core/auth/useAuthStore';
import { useToast } from '../ui/Toast';
import { CornerDownLeft, Terminal, AlertTriangle, ShieldAlert } from 'lucide-react';

export const TCodeBar: React.FC = () => {
  const navigate = useNavigate();
  const { error, info } = useToast();
  const { role } = useAuthStore();

  const [inputVal, setInputVal] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SAPTransactionCode[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const results = TCodeService.searchCodes(inputVal, role);
      setSuggestions(results);
      setSelectedIndex(0);
    }
  }, [inputVal, isOpen, role]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExecute = (codeStr: string) => {
    const res = TCodeService.resolveCode(codeStr, role);
    if (!res.success) {
      error('خطأ رمز المعاملة (T-Code)', res.error || 'تعذر تشغيل المعاملة المطلوبة.');
      return;
    }

    if (res.targetPath) {
      setIsOpen(false);
      setInputVal('');
      info(`تشغيل المعاملة [${res.code?.code}]`, res.code?.descriptionArabic || '');
      navigate(res.targetPath);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && suggestions.length > 0 && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleExecute(suggestions[selectedIndex].code);
      } else {
        handleExecute(inputVal);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-48 sm:w-60 md:w-72" dir="ltr">
      <div className="flex items-center rounded-xl border border-[#E5EAF2] bg-[#F4F7FB] focus-within:bg-white focus-within:border-[#0FA37F] focus-within:ring-2 focus-within:ring-[#0FA37F]/10 transition-all overflow-hidden shadow-xs">
        <div className="ps-2.5 pe-1 text-[#64748B]">
          <Terminal className="w-3.5 h-3.5" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => {
            setInputVal(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="T-Code (ME21N, MIGO...)"
          className="w-full py-1.5 px-1 bg-transparent text-xs font-mono font-bold text-[#0B2545] placeholder:text-[#94A3B8] placeholder:font-normal focus:outline-hidden uppercase"
        />
        <button
          type="button"
          onClick={() => handleExecute(inputVal)}
          title="تنفيذ الأمر (Enter)"
          className="px-2 py-1.5 hover:bg-[#E5EAF2] text-[#64748B] hover:text-[#0FA37F] transition-colors cursor-pointer"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div
          className="absolute start-0 top-full mt-1.5 w-80 sm:w-96 bg-white border border-[#E5EAF2] rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-[#E5EAF2] max-h-80 overflow-y-auto text-start"
          dir="rtl"
        >
          <div className="p-2.5 bg-[#F4F7FB] text-[11px] font-bold text-[#64748B] flex items-center justify-between">
            <span>أوامر ومعاملات SAP المتاحة</span>
            <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-[#E5EAF2]">
              {suggestions.length} معاملة
            </span>
          </div>

          {suggestions.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#64748B] space-y-1">
              <AlertTriangle className="w-4 h-4 mx-auto text-amber-500" />
              <p>لا يوجد كود معاملة يطابق &quot;{inputVal}&quot;</p>
              <p className="text-[10px] text-slate-400">مثال: ME21N, MIGO, FB50, AS01, AFAB, KSU5</p>
            </div>
          ) : (
            suggestions.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.code}
                  onClick={() => handleExecute(item.code)}
                  className={`p-2.5 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-emerald-50/80 border-s-4 border-[#0FA37F]' : 'hover:bg-[#F4F7FB]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#0B2545] bg-[#F4F7FB] px-1.5 py-0.5 rounded border border-[#E5EAF2]">
                        {item.code}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                        {item.module}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#0F172A] leading-tight">
                      {item.descriptionArabic}
                    </p>
                    <p className="text-[10px] text-[#64748B] font-mono">{item.descriptionEnglish}</p>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-mono mt-1 shrink-0">Enter ↵</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
