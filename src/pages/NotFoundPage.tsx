import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, Home, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6" dir="rtl">
      <div className="w-20 h-20 rounded-3xl bg-[#F4F7FB] border border-[#E5EAF2] flex items-center justify-center text-[#64748B] mb-4">
        <FileQuestion className="w-10 h-10 text-[#64748B]" />
      </div>
      <h1 className="text-4xl font-extrabold text-[#0B2545] font-sans">404</h1>
      <h2 className="text-lg font-bold text-[#0F172A] mt-2">الصفحة المطلوبة غير موجودة</h2>
      <p className="text-xs text-[#64748B] max-w-sm mt-1.5 leading-relaxed">
        يبدو أن المسار الذي تحاول الوصول إليه غير مسجل في شجرة مستندات ووحدات النظام أو تم نقله.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link to="/">
          <Button variant="primary" size="md" icon={<Home className="w-4 h-4" />}>
            العودة للوحة التحكم
          </Button>
        </Link>
      </div>
    </div>
  );
};
