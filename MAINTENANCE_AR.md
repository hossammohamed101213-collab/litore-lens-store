# صيانة سيرفر Litore (لحسام) — 15 دقيقة في الشهر

الأمان الأساسي **تلقائي**: تحديثات أمان النظام، تجديد شهادة https، إعادة تشغيل المتجر لو توقف، نسخة احتياطية يومية الساعة 3:30 صباحًا.

## كل شهر
1. ادخل السيرفر: `ssh root@IP`
2. شغّل فحص الصحة: `bash /var/www/litore/deploy/health-check.sh`
   - الخدمتان `active`، القرص أقل من 80%، آخر نسخة احتياطية حديثة، الشهادة لم تنتهِ، والمتجر يرد `HTTP 200`.
3. **نزّل نسخة احتياطية خارج السيرفر** (مهم): من جهازك في PowerShell:
   ```powershell
   scp -r root@IP:/var/backups/litore C:\Backups\litore-نسخة-الشهر
   ```
4. لو هناك تحديثات للنظام تطلب إعادة تشغيل: `reboot` ثم تأكد أن المتجر عاد (الخدمة تعمل تلقائيًا).

## إن حدث عطل
- المتجر لا يفتح: `systemctl restart litore` ثم `journalctl -u litore -n 50`.
- الموقع كله لا يفتح: `systemctl restart nginx`.
- **استرجاع نسخة احتياطية** (بعد إيقاف الخدمة):
  ```bash
  systemctl stop litore
  cp /var/backups/litore/litore-التاريخ.db /var/lib/litore/litore.db
  tar -xzf /var/backups/litore/uploads-التاريخ.tar.gz -C /var/lib/litore
  chown -R litore:litore /var/lib/litore
  systemctl start litore
  ```

## تحديث نسخة المتجر
ارفع النسخة الجديدة وفكّها ثم `sudo bash deploy/update.sh` (يأخذ نسخة احتياطية أولًا ولا يمس الطلبات).

## تغيير/استعادة كلمة مرور لوحة التحكم
```bash
cd /var/www/litore && sudo -u litore bash -c "set -a; . ./.env.production; set +a; ADMIN_EMAIL='البريد' ADMIN_PASSWORD='كلمة-جديدة-10+' node scripts/create-admin.mjs"
```

## أمان
- فعّل **النسخ الاحتياطي** الخاص بالـ VPS من هوستنجر كطبقة إضافية.
- استخدم مفتاح SSH بدل كلمة مرور root عند الإمكان.

## وضع الدفع (PAYMENT_MODE)
القيمة الافتراضية على السيرفر `cod` (دفع عند الاستلام). لا تضع `mock` على المتجر الحي أبدًا لأنه يسجل الطلبات «مدفوعة» دون تحصيل. بعد تغيير أي متغير: `systemctl restart litore`.

## تثبيت المتجر كتطبيق وواتساب
رقم واتساب خدمة العملاء مكتوب في `src/lib/site.ts` (أو بمتغير `NEXT_PUBLIC_WHATSAPP`). المتجر قابل للتثبيت من المتصفح (PWA) وملفاته: `manifest` والأيقونات في `public/icons` و`public/sw.js` (لا يخزّن صفحات، فلا تظهر أسعار قديمة).

## الإصدار 8: جداول جديدة
`customer_data` (سلة ومفضلة العميلة)، `password_resets`، `notifications`، `admin_log`، وأعمدة جديدة في `customers` (phone, avatar, birthday, city). تُضاف تلقائيًا عند أول تشغيل ولا تمس البيانات الحالية. الصور الشخصية تُحفظ مع صور المنتجات في مجلد الرفع ويشملها النسخ الاحتياطي. اختبار الإصدار: `tests/e2e/v8-features.cjs`.

## ملحق v9/v10 (للمطوّر)

- جداول جديدة تُنشأ تلقائيًا: `product_images`, `referral_codes`, `referrals`, `redemptions`, `affiliates`, `returns`, `page_views`, `site_searches` (+ أعمدة `customers.ref_balance`, `coupons.max_uses/used_count/customer_id`, `products.spin`).
- التتبع: `POST /api/track` (من `components/layout/Beacon.tsx`) بلا IP، ولا يعمل إلا بعد موافقة الكوكيز `litore.cookies.v1 = all`. التجميع في `src/lib/analytics.ts`، والواجهة `admin/(panel)/analytics/Cockpit.tsx` عبر `GET /api/admin/analytics?days=`. يُنصح بحذف سجلات `page_views` الأقدم من 12 شهرًا دوريًا.
- البريد: متغيرات اختيارية `RESEND_API_KEY` و`EMAIL_FROM` في `.env.production`؛ بدونها يعمل الاسترجاع عبر واتساب والإدارة.
- روابط السوشيال في جدول `settings` بالمفاتيح `social_whatsapp|tiktok|snapchat|instagram`.
- الاختبارات: `tests/e2e/v9-features.cjs`, `v10-features.cjs` (تستخدم `_pw.cjs` لتخطي شريط الكوكيز).
