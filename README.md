# Nova Backend

`nova frontend` (Next.js 16) uchun REST API. Express 5 + TypeScript + PostgreSQL (Prisma 7).

## Nega bu backend kerak

Frontend ishlab turgan, lekin ishonchli emas edi:

- narx, soliq va yetkazish puli brauzerda hisoblanardi (`lib/card.ts`) — foydalanuvchi o'zgartira olardi;
- savat va wishlist `localStorage`da turardi — boshqa qurilmada yo'q, tahrirlash mumkin;
- zaxira (stock) statik — sotilganda kamaymaydi, ya'ni yo'q mahsulotni sotib olish mumkin;
- buyurtmalar `data/orders.ts`dagi bitta namunadan o'qilardi.

Backend'ning vazifasi — **pul va zaxirani serverda hisoblash**. Frontend yuborgan
raqamlarga hech qachon ishonilmaydi; u faqat "nima xohlayman"ni aytadi, "qancha turadi"ni
server aytadi.

## Autentifikatsiya

Parollar bilan ishlashni **Firebase Auth** qiladi (frontend'da allaqachon shunday).
Backend faqat tokenni tekshiradi:

```
Frontend  ──  Firebase Auth  ──→  ID token (JWT)
                                      │
                                      ▼
Backend  ──  JWKS orqali imzoni tekshirish  ──→  req.user
```

**Service account JSON ishlatilmaydi.** Firebase ID token — RS256 bilan imzolangan
JWT, Google uning ommaviy kalitlarini JWKS sifatida e'lon qiladi. Ya'ni tekshirish
uchun maxfiy kalit kerak emas, va serverda o'g'irlanadigan kalit saqlanmaydi.
Backend'da maxfiy ma'lumot sifatida faqat `DATABASE_URL` bor.

Parol hashlash, brute-force himoyasi, parol tiklash, MFA — bularning hammasi
Firebase tomonida. Parollar bizning serverga umuman kelmaydi, demak DB
o'g'irlansa ham yo'qoladigan parol yo'q.

**Provayder almashtirilsa**, faqat `src/lib/auth-provider.ts` o'zgaradi (~90 qator).
Qolgan kod `req.user` ni ko'radi, uning qayerdan kelganini bilmaydi.

Alohida `register` endpoint yo'q: Firebase'da ro'yxatdan o'tgan odam birinchi
so'rovida DB'da avtomatik yaratiladi (`requireUser`).

## Ishga tushirish

Talablar: Node ≥ 20.9, PostgreSQL ≥ 14.

```bash
# 1) Postgres (macOS / Homebrew)
brew install postgresql@18
brew services start postgresql@18
psql -d postgres -c "CREATE ROLE nova WITH LOGIN PASSWORD 'nova' CREATEDB;"
createdb -O nova nova

# 2) Sozlama
cp .env.example .env     # DATABASE_URL va FIREBASE_PROJECT_ID ni to'ldiring

# 3) Paketlar va jadvallar
npm install
npx prisma migrate dev

# 4) Server
npm run dev              # → http://localhost:4000
```

## Tekshirish

```bash
curl localhost:4000/health          # process tirikmi
curl localhost:4000/health/ready    # DB ham javob beradimi

npm run token -- email@example.com parol    # haqiqiy ID token oladi
./scripts/smoke.sh email@example.com parol  # auth oqimini to'liq sinaydi
```

## Endpointlar

| Method | Yo'l | Nima qiladi |
|---|---|---|
| GET | `/health` | Process holati |
| GET | `/health/ready` | DB bilan birga holat |
| GET | `/api/me` | Profil + buyurtma/wishlist/savat sonlari |
| PATCH | `/api/me` | Ism-familiyani o'zgartirish |
| GET | `/api/me/addresses` | Manzillar ro'yxati |
| POST | `/api/me/addresses` | Yangi manzil |
| PATCH | `/api/me/addresses/:id` | Manzilni o'zgartirish |
| DELETE | `/api/me/addresses/:id` | Manzilni o'chirish |

Hammasi `Authorization: Bearer <firebase-id-token>` talab qiladi (`/health` dan tashqari).

### Xato formati

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Token muddati tugagan" } }
```

Validatsiya xatolarida `details` ham bo'ladi (qaysi maydon, nima sababdan).
Kutilmagan xatolarda batafsilot faqat log'ga tushadi, mijozga umumiy xabar boradi —
stack trace yoki SQL matni tashqariga chiqmaydi.

## Tuzilish

```
prisma/
  schema.prisma        Ma'lumot modeli
  migrations/          SQL migratsiyalar (git'da saqlanadi)
prisma.config.ts       Prisma 7: migration sozlamalari
src/
  env.ts               Muhit o'zgaruvchilari — startda tekshiriladi
  app.ts               Express ilovasi (middleware zanjiri)
  index.ts             Server, graceful shutdown, JWKS tekshiruvi
  lib/
    auth-provider.ts   ◄── ALMASHTIRILADIGAN auth qatlami
    prisma.ts          DB client (pg driver adapter)
    errors.ts          AppError va yordamchilar
    logger.ts          pino
  middleware/
    auth.ts            requireAuth / requireUser / requireRole
    validate.ts        Zod bilan kirish tekshiruvi
    error.ts           Markazlashgan xato ishlovchi
  routes/
    health.ts
    me.ts
scripts/
  get-token.ts         Test uchun haqiqiy ID token
  smoke.sh             Auth oqimini uchdan-uchiga sinash
```

## Qabul qilingan qarorlar

**Pul `Decimal(10,2)`da.** `Float` bilan `0.1 + 0.2 ≠ 0.3` muammosi pul hisobida
tiyin yo'qotishga olib keladi. JSON javobiga chiqarishda `toNumber()` ishlatiladi.

**Buyurtma qatorlarida nusxa maydonlar.** `order_items` mahsulot nomi, rangi,
o'lchami va narxini buyurtma paytidagi holatda saqlaydi. Mahsulot keyin qimmatlashsa
yoki o'chirilsa ham, eski chek o'zgarmaydi.

**Karta raqami saqlanmaydi.** `orders`da faqat brend va oxirgi 4 raqam —
ko'rsatish uchun yetarli, PCI DSS talablari ostiga tushmaydi.

**Bitta asosiy manzil qoidasi tranzaksiyada.** Yangisi asosiy bo'lganda eskisidan
belgi olinadi; ikki yozuv birga o'zgarganligi uchun `$transaction`.

**`trust proxy` yoqilgan.** Rate limiting haqiqiy IP ga tayanadi; proxy ortida
bu bo'lmasa hamma so'rov bitta IP dan ko'rinadi.

**JWKS startup tekshiruvi.** Kalitlar manzilidagi bitta harf xatosi hech qanday
xato bermaydi — shunchaki har bir token 401 bo'ladi. Shuning uchun server ishga
tushganda manba ochilishini tekshirib, log'ga yozadi.

## Keyingi qadamlar

- [ ] Products API + `data/products.ts` dan seed
- [ ] Savat va wishlist (localStorage o'rniga)
- [ ] Checkout: tranzaksiya ichida zaxira kamayishi, serverda narx hisobi
- [ ] Buyurtmalar tarixi va holat kuzatuvi
- [ ] Admin endpointlari (`requireAdmin` tayyor)
- [ ] Testlar (vitest o'rnatilgan) va OpenAPI hujjat
