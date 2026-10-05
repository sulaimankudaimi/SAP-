import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldAlert,
  ShoppingCart,
  Boxes,
  Truck,
  Landmark,
  Check,
  Filter,
} from 'lucide-react';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { NotificationService } from '../core/services/NotificationService';
import type { Notification } from '../types/models';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error, info } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterRead, setFilterRead] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const list = await NotificationService.getNotifications();
      setNotifications(list);
    } catch (err) {
      console.error(err);
      error('خطأ', 'تعذر تحميل الإشعارات من قاعدة البيانات.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await NotificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      success('تم التحديث', 'تم تعليم كافة الإشعارات كمقروءة.');
    } catch (err) {
      error('خطأ', 'فشل تحديث حالة الإشعارات.');
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await NotificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      success('تم الحذف', 'تم حذف الإشعار.');
    } catch (err) {
      error('خطأ', 'فشل حذف الإشعار.');
    }
  };

  const handleGenerateSystemAlerts = async () => {
    setIsGenerating(true);
    try {
      const count = await NotificationService.generateSystemNotifications();
      await loadNotifications();
      if (count > 0) {
        success('تم فحص وتوليد التنبيهات', `تم توليد ${count} تنبيهات تشغيلية جديدة بنجاح.`);
      } else {
        info('فحص التنبيهات', 'كافة المعاملات والعمليات التشغيلية منتظمة ولا توجد تنبيهات جديدة.');
      }
    } catch (err) {
      console.error(err);
      error('خطأ', 'فشل تشغيل محرك فحص التنبيهات الآلي.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  // Filtered Notifications
  const filteredList = notifications.filter((item) => {
    if (filterType !== 'ALL' && item.type !== filterType) return false;
    if (filterRead === 'UNREAD' && item.isRead) return false;
    if (filterRead === 'READ' && !item.isRead) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchMsg = item.message.toLowerCase().includes(q);
      const matchDoc = item.documentNumber?.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg && !matchDoc) return false;
    }

    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'procurement':
        return <ShoppingCart className="w-4 h-4 text-emerald-600" />;
      case 'inventory':
        return <Boxes className="w-4 h-4 text-blue-600" />;
      case 'fleet':
        return <Truck className="w-4 h-4 text-amber-600" />;
      case 'finance':
        return <Landmark className="w-4 h-4 text-purple-600" />;
      case 'approval':
        return <CheckCircle2 className="w-4 h-4 text-teal-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <Breadcrumbs
          items={[
            { label: 'الرئيسية', path: '/' },
            { label: 'مركز التنبيهات والإشعارات' },
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#0F172A] flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-[#0FA37F]" />
              مركز الإشعارات والتنبيهات التشغيلية (Notifications Hub)
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              متابعة التنبيهات الآلية لانتهاء العقود، هبوط أرصدة الأمان، حظر الفواتير بالمطابقة الثلاثية، صيانة الأسطول، وطلبات الاعتماد.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleGenerateSystemAlerts}
              disabled={isGenerating}
            >
              <RefreshCw className={`w-4 h-4 me-1.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'جارٍ الفحص...' : 'فحص وتوليد التنبيهات الآن'}
            </Button>
            {unreadCount > 0 && (
              <Button variant="primary" onClick={handleMarkAllAsRead}>
                <Check className="w-4 h-4 me-1.5" />
                تعليم الكل كمقروء
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5EAF2] rounded-[16px] p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>إجمالي الإشعارات</span>
            <Bell className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl font-bold text-[#0F172A] font-mono">{notifications.length}</div>
          <div className="text-[11px] text-[#64748B]">سجل التنبيهات النشطة</div>
        </div>

        <div className="bg-white border border-[#E5EAF2] rounded-[16px] p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>إشعارات غير مقروءة</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 font-mono">{unreadCount}</div>
          <div className="text-[11px] text-[#64748B]">تتطلب الاطلاع والإجراء</div>
        </div>

        <div className="bg-white border border-[#E5EAF2] rounded-[16px] p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>طلبات الاعتماد المعلقة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-[#0FA37F] font-mono">
            {notifications.filter((n) => n.type === 'approval').length}
          </div>
          <div className="text-[11px] text-[#64748B]">سلاسل موافقات قيد المراجعة</div>
        </div>

        <div className="bg-white border border-[#E5EAF2] rounded-[16px] p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>تنبيهات المخزون والمالية</span>
            <Boxes className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-600 font-mono">
            {notifications.filter((n) => n.type === 'inventory' || n.type === 'finance').length}
          </div>
          <div className="text-[11px] text-[#64748B]">إعادة طلب ومطابقة فواتير</div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white border border-[#E5EAF2] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'الكل' },
            { id: 'approval', label: 'الاعتمادات' },
            { id: 'inventory', label: 'المخزون' },
            { id: 'procurement', label: 'المشتريات والعقود' },
            { id: 'finance', label: 'المالية والفواتير' },
            { id: 'fleet', label: 'الأسطول' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                filterType === tab.id
                  ? 'bg-[#0FA37F] text-white shadow-xs'
                  : 'bg-[#F4F7FB] text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value as 'ALL' | 'UNREAD' | 'READ')}
            className="text-xs py-1.5 px-2.5 rounded-xl border border-[#E5EAF2] bg-[#F4F7FB] font-medium text-[#0F172A]"
          >
            <option value="ALL">كافة الحالات (مقروء وغير مقروء)</option>
            <option value="UNREAD">غير المقروءة فقط</option>
            <option value="READ">المقروءة فقط</option>
          </select>

          <div className="w-48 sm:w-56">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الإشعارات..."
              startIcon={<Search className="w-3.5 h-3.5 text-[#64748B]" />}
            />
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <Card>
        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#64748B]">جارٍ تحميل الإشعارات...</div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B] space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-semibold text-[#0F172A]">لا توجد إشعارات تطابق معايير التصفية الحالية.</p>
            <p className="text-[11px] text-slate-400">كافة الإشعارات تمت معالجتها أو تصفيتها.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5EAF2]">
            {filteredList.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`p-4 flex items-start justify-between gap-4 transition-colors hover:bg-slate-50 cursor-pointer ${
                  !item.isRead ? 'bg-emerald-50/25' : ''
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-[#F4F7FB] border border-[#E5EAF2] shrink-0 mt-0.5">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="space-y-1 text-start">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[#0F172A]">{item.title}</h4>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#0FA37F] shrink-0" />
                      )}
                      {item.documentNumber && (
                        <Badge variant="neutral">{item.documentNumber}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed">{item.message}</p>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.createdAt.slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.link && (
                    <span className="text-[11px] text-[#0FA37F] hover:underline font-semibold flex items-center gap-1">
                      <span>عرض المستند</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  )}
                  {!item.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(item.id, e)}
                      title="تعليم كمقروء"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    title="حذف الإشعار"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
