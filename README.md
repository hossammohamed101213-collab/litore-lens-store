# Litore — متجر مستقل

متجر Next.js + TypeScript + Tailwind بعربي RTL وإنجليزي LTR، بقاعدة بيانات SQLite ولوحة تحكم خاصة.

## التشغيل محليًا
```bash
npm install
cp .env.example .env.local        # للعرض التجريبي ضع SEED_SAMPLE=true
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='كلمة-مرور-طويلة-10+' node scripts/create-admin.mjs
npm run dev                       # المتجر: http://localhost:3000  |  لوحة التحكم: /admin
```

## لوحة التحكم (`/admin`)
المنتجات والصور والمخزون، الطلبات وتغيير حالتها ورقم التتبع (الإلغاء يعيد المخزون)، الكوبونات، مناطق الشحن وأسعارها، نسبة الضريبة.

## ما هو حقيقي وما هو تجريبي
- حقيقي: قاعدة البيانات، المنتجات، المخزون (يُخصم داخل معاملة ولا يسمح بالبيع الزائد)، الطلبات، حسابات العملاء (كلمات مرور مشفّرة بـ scrypt وجلسات httpOnly)، الكوبونات، الشحن حسب المناطق، الضريبة.
- تجريبي إلى أن تتوفر الرخصة والمفاتيح: **بوابة الدفع** (`src/lib/payment`) و**ربط شركات الشحن بالـ API** (`src/lib/shipping`). تُضاف كمزوّدين جدد بنفس الواجهة دون تغيير الصفحات.
- لا تضع `SEED_SAMPLE=true` على المتجر الحقيقي.

## الاختبارات
```bash
npm run typecheck && npm run lint && npm test      # وحدات
# E2E (يحتاج Playwright وخادم يعمل على قاعدة بيانات نظيفة SEED_SAMPLE=true): tests/e2e/*.cjs
```

## النسخ الاحتياطي
انسخ مجلد `data/` (قاعدة البيانات + الصور) بشكل دوري.

## النشر
راجع `DEPLOY_HOSTINGER_AR.md` (Hostinger VPS) والسكربتات في `deploy/`.
