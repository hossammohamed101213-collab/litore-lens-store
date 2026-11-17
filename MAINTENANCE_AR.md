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
الدفع عند الاستلام أُلغي نهائيًا (v29): اتركي المتغير فارغًا على السيرفر الحي، والدفع بالبطاقة يُفعَّل من لوحة التحكم (Telr). لا تضع `mock` على المتجر الحي أبدًا لأنه يسجل الطلبات «مدفوعة» دون تحصيل. بعد تغيير أي متغير: `systemctl restart litore`.

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

## النسخ الاحتياطي خارج السيرفر (تلقائي كل ليلة)

النسخة اليومية على نفس السيرفر لا تكفي: لو تعطل القرص تضيع هي والأصل. السكربت `deploy/backup.sh` يرسل كل ليلة ملفًا واحدًا **مشفّرًا** (قاعدة البيانات + الصور + مفتاح `secret.key`) إلى تخزين خارجي، بشرط إعداده مرة واحدة:

1. المكان المختار: **Google Drive**. أنشئي في Drive مجلدًا خاصًا باسم `Litore Backups` (لا تشاركيه مع أحد).
2. على السيرفر: `apt-get install -y rclone` ثم `rclone config`:
   - `n` (جديد) ← الاسم `offsite` ← النوع `drive` ← اتركي client_id و client_secret فارغين.
   - الصلاحية (scope): اختاري `drive.file` (rclone يرى الملفات التي يرفعها هو فقط، لا باقي ملفات Drive).
   - عند السؤال "Use auto config?" أجيبي `n` (السيرفر بلا متصفح)؛ سيعرض أمرًا يبدأ بـ `rclone authorize`. شغّليه على جهازك (بعد تثبيت rclone عليه)، سجّلي الدخول بحساب Google صاحب المجلد، ثم الصقي الرمز الناتج في السيرفر.
   - تحقق: `rclone mkdir offsite:"Litore Backups"` ثم `rclone lsd offsite:` يجب أن يُظهر المجلد.
3. أنشئي الملف `/etc/litore-backup.conf` (للـ root فقط: `chmod 600`):
   ```bash
   OFFSITE_REMOTE="offsite:Litore Backups"
   BACKUP_PASSPHRASE="جملة-سرية-طويلة-20-حرف-على-الأقل"
   OFFSITE_KEEP_DAYS=30
   ```
4. جرّبي: `/usr/local/bin/litore-backup` — يجب أن يطبع `off-site backup ok`.

- حجم Drive المجاني 15GB: السكربت يحذف النسخ الأقدم من 30 يومًا تلقائيًا. (ملاحظة: مع الصلاحية `drive.file` استخدمي المجلد الذي أنشأه rclone بالأمر أعلاه.)
- **احفظي الجملة السرية خارج السيرفر** (مدير كلمات مرور). بدونها لا يمكن فتح النسخة.
- لو فشل الرفع يظهر تنبيه في مركز الإشعارات بلوحة التحكم، والنسخة المحلية تبقى سليمة.
- بدون الملف `/etc/litore-backup.conf` يعمل النسخ المحلي فقط كما كان.

**استرجاع نسخة خارجية** (على سيرفر جديد أو بعد عطل):
```bash
rclone copy "offsite:Litore Backups/litore-التاريخ.tar.gz.enc" /root/   # أو نزّلي الملف من موقع Google Drive مباشرة
export BACKUP_PASSPHRASE='الجملة السرية'
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in /root/litore-التاريخ.tar.gz.enc | tar -xzf - -C /root/restore
systemctl stop litore
cp /root/restore/litore.db /var/lib/litore/litore.db
cp /root/restore/secret.key /var/lib/litore/secret.key
tar -xzf /root/restore/uploads.tar.gz -C /var/lib/litore
chown -R litore:litore /var/lib/litore && systemctl start litore
```

## الطلبات غير المدفوعة والفحص التلقائي (من إصدار الفحص الأمني)

- المتجر يسأل Telr كل 10 دقائق عن الطلبات التي ما زالت «بانتظار الدفع»، حتى لو لم يفتح أحد لوحة التحكم.
- الطلب الذي يبقى غير مدفوع أكثر من **60 دقيقة** يُلغى تلقائيًا ويرجع مخزونه (فقط بعد أن يؤكد Telr أنه غير مدفوع). لتغيير المدة: القيمة `pay_pending_timeout_min` في جدول `settings` (0 = إيقاف).
- الطلب المدفوع أو المسترد لا يُحذف من لوحة التحكم (سجل مالي) — يُلغى فقط.

## بريد تأكيد الطلب للعميلة (تلقائي)

- بعد تأكيد الدفع يرسل المتجر للعميلة بريدًا واحدًا فيه رقم الطلب والمنتجات والإجمالي ورابط المتابعة، بلغة الطلب (عربي أو إنجليزي).
- يعمل فقط إذا كان `RESEND_API_KEY` موجودًا في `.env.production`. بدون المفتاح لا يُرسل شيء ولا يتأثر أي طلب.
- لو خدمة البريد واقفة، الطلب يكتمل عادي والبريد يُعاد إرساله تلقائيًا كل 10 دقائق لمدة يومين.
- الطلبات القديمة (قبل تفعيل الخاصية) والطلبات الملغاة أو غير المدفوعة لا يوصلها بريد.
- عند تغيير حالة الطلب إلى «تم الشحن» (يدويًا أو من زر الشحن مع Aramex / Quiqup) يوصل للعميلة بريد واحد «تم شحن طلبك» فيه شركة الشحن ورقم التتبع ورابط التتبع إن وُجد. اكتبي رقم التتبع قبل الحفظ، لأن البريد يُرسل مرة واحدة فقط.
- كل بريد ينتهي بتوقيع المتجر: الشعار ورابط المتجر ورقم الواتساب (الرقم من `src/lib/site.ts`).

### التفعيل (مرة واحدة)
1. افتحي حسابًا مجانيًا في resend.com بنفس بريد المتجر.
2. من Domains أضيفي `litore.store` وانسخي سجلات DNS التي يعرضها الموقع إلى لوحة الدومين، ثم اضغطي Verify.
3. من API Keys أنشئي مفتاحًا (صلاحية Sending فقط).
4. على السيرفر أضيفي السطرين التاليين في `/var/www/litore/.env.production` ثم `sudo systemctl restart litore`:
   ```
   RESEND_API_KEY=المفتاح
   EMAIL_FROM="Litore <no-reply@litore.store>"
   ```
5. اعملي طلبًا تجريبيًا ببريدك وتأكدي من وصول الرسالة.
