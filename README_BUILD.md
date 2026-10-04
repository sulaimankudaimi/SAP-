# دليل بناء وتجهيز تطبيق سطح المكتب لنظام طاقة الخليج
# Gulf Energy ERP - Windows Desktop Packaging Guide (Electron + electron-builder)

نظام **طاقة الخليج (Gulf Energy ERP)** مُهيأ بالكامل للحزم كتطبيق مكتبي مستقل لأنظمة Windows (64-bit) بنسبة **100% بدون اتصال بالإنترنت (Offline-First)**، بالاعتماد على **Electron** و **electron-builder**.

---

## 1. المتطلبات الأساسية على بيئة Windows (Prerequisites)

1. **نظام التشغيل**: Windows 10 أو Windows 11 (64-bit).
2. **Node.js**: الإصدار 20.x أو 22.x LTS ([تحميل Node.js](https://nodejs.org/)).
3. **مدير الحزم**: npm (مرفق تلقائياً مع Node.js).
4. **Git**: اختياري لاستنساخ المستودع.

---

## 2. أوامر التثبيت والتشغيل في وضع التطوير (Development Mode)

افتح موجه الأوامر (`cmd.exe` أو `PowerShell`) في المجلد الرئيسي للمشروع:

```bash
# 1. تثبيت كافة التبعيات
npm install

# 2. تشغيل التطبيق في وضع التطوير المكتبي (Vite + Electron)
npm run dev:electron
```

> **ملاحظة**: يقوم أمر `npm run dev:electron` بتشغيل خادم Vite محلياً ثم فتح نافذة Electron مباشرة مع دعم أدوات المطور (DevTools) وإعادة التحميل الفوري.

---

## 3. أوامر التجميع والحزم النهائي لـ Windows (Production Packaging)

لإنشاء ملف التثبيت الرسمي `NSIS Installer (.exe)` والنسخة المحمولة `Portable (.exe)`:

### أ) إنشاء الحزمتين معاً (Installer + Portable)

```bash
# بناء ملفات الويب أولاً ثم حزم التطبيق
npm run dist
```

### ب) إنشاء مثبت Windows فقط (NSIS Setup Installer)

```bash
npm run dist:nsis
```

### ج) إنشاء النسخة المحمولة بدون تثبيت (Single Executable Portable)

```bash
npm run dist:portable
```

### د) فحص حزمة التطبيق غير المضغوطة (Unpacked Testing)

```bash
npm run pack
```

---

## 4. مخرجات الحزم (Output Artifacts)

بعد اكتمال عملية البناء بنجاح، ستجد الملفات التنفيذية داخل مجلد `release/`:

| الملف الناتج | الوصف | المزايا |
|---|---|---|
| `Gulf Energy ERP Setup 2.4.0.exe` | مثبت Windows القياسي (NSIS) | واجهة عربية (Language 1025)، تخصيص مسار التثبيت، إنشاء اختصارات سطح المكتب وقائمة ابدأ |
| `Gulf Energy ERP 2.4.0.exe` | النسخة المحمولة (Portable) | تعمل بنقرة واحدة من أي وحدة تخزين (USB) دون الحاجة لصلاحيات مدير النظام (Admin) |

---

## 5. إدارة أيقونة التطبيق (App Icon Instructions)

- **الملف المصدري**: متوفر بصيغة متجهة في `build/icon.svg`.
- **الملف التنفيذي المطلوب لـ Windows**: `build/icon.ico` (256x256 بكسل، متعدد الطبقات).

### إعادة توليد الأيقونة محلياً عبر Node.js:
تم تضمين سكربت تحويل مباشر لا يتطلب أي برامج خارجية:
```bash
node scripts/generate-icon.cjs
```

### تحويل مخصص عبر ImageMagick:
إذا كنت ترغب في تعديل `icon.svg` وإعادة تصديره عبر أداة `ImageMagick`:
```bash
magick convert -background none build/icon.svg -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

---

## 6. التحقق من سلامة معمارية عدم الاتصال (Offline & Security Architecture)

1. **المسارات النسبية**: تم ضبط `base: './'` في `vite.config.ts` لضمان قراءة ملفات `CSS/JS` عبر بروتوكول `file://` داخل حزمة Electron دون شاشة بيضاء.
2. **التوجيه المحلي**: الاعتماد على `HashRouter` لضمان عدم حدوث أخطاء 404 عند تحديث الشاشة أو التنقل داخل تطبيق سطح المكتب.
3. **أمان Electron (Sandbox & Context Isolation)**:
   - `contextIsolation: true`
   - `nodeIntegration: false`
   - `sandbox: true`
   - عزل كامل للعمليات مع واجهة آمنة محددة (`window.erpNative`) لحوارات الحفظ والفتح المكتبي.
4. **مسار حفظ قاعدة البيانات المحلية**:
   - يتم تخزين قاعدة بيانات Dexie (IndexedDB) محلياً داخل مجلد بيانات المستخدم في Windows:
     `%APPDATA%\gulf-energy-erp\IndexedDB`
   - يتم تذكر أبعاد وموضع النافذة في:
     `%APPDATA%\gulf-energy-erp\window-bounds.json`

---

## 7. حل المشكلات الشائعة (Troubleshooting)

### المشكلة 1: ظهور شاشة بيضاء عند فتح ملف .exe
- **السبب**: عدم بناء مجلد `dist` قبل تشغيل `electron-builder`.
- **الحل**: نفذ أمر `npm run build` وتأكد من وجود مجلد `dist/index.html`، ثم أعد تنفيذ `npm run dist`.

### المشكلة 2: خطأ في مسار الأيقونة (icon.ico not found)
- **الحل**: تأكد من وجود ملف `build/icon.ico`، أو قم بتشغيل `node scripts/generate-icon.cjs` لإنشائه فوراً.

### المشكلة 3: حظر تنزيل الملفات أو الحفظ في سطح المكتب
- **الحل**: يستخدم التطبيق واجهة `window.erpNative.saveFile` التي تفتح حوار الحفظ المكتبي لـ Windows مباشرة مع دعم كامل للتراجع التلقائي لحفظ المتصفح (Fallback).

### المشكلة 4: تنظيف مخلفات البناء السابقة
```bash
npm run clean
npm run build
npm run dist
```
