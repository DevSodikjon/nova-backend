import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from "jose";
import { env } from "../env.js";
import { unauthorized } from "./errors.js";

/**
 * Autentifikatsiya provayderi — ALMASHTIRILADIGAN QATLAM.
 *
 * Qolgan backend faqat `verifyAccessToken()` ni va `AuthIdentity` tipini biladi.
 * Firebase'dan voz kechilsa (o'z JWT, Auth0, Cognito...), faqat shu fayl o'zgaradi.
 *
 * Nega firebase-admin va service account JSON ishlatilmaydi:
 * Firebase ID token — RS256 bilan imzolangan oddiy JWT. Google uning ommaviy
 * kalitlarini JWKS sifatida e'lon qiladi, ya'ni tekshirish uchun MAXFIY KALIT KERAK EMAS.
 * Serverda saqlanmagan kalit — o'g'irlanishi mumkin bo'lmagan kalit.
 */

export type AuthIdentity = {
  /** Provayderdagi barqaror identifikator (Firebase'da `sub` = uid) */
  uid: string;
  email: string;
  /** Provayder bergan to'liq ism — bizda faqat birinchi marta ishlatiladi */
  displayName: string | null;
  emailVerified: boolean;
};

// DIQQAT: manzil `/jwk/` — ko'plik `/jwks/` emas. Oxiriga "s" qo'shilsa Google 404
// qaytaradi, natijada HAMMA token "yaroqsiz" bo'lib qoladi — jimgina buziladigan xato.
// Rasmiy manba: https://securetoken.google.com/<projectId>/.well-known/openid-configuration
const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

// jose kalitlarni o'zi kesh qiladi va rotatsiyada qayta yuklaydi
const jwks = createRemoteJWKSet(new URL(JWKS_URL), {
  cacheMaxAge: 6 * 60 * 60 * 1000, // 6 soat
  timeoutDuration: 5_000,
});

const ISSUER = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`;

export async function verifyAccessToken(token: string): Promise<AuthIdentity> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      audience: env.FIREBASE_PROJECT_ID,
      algorithms: ["RS256"],
      clockTolerance: 5, // soat farqi uchun 5 soniya
    }));
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw unauthorized("Token muddati tugagan");
    }
    throw unauthorized("Token yaroqsiz");
  }

  const uid = typeof payload.sub === "string" ? payload.sub : "";
  if (!uid) throw unauthorized("Tokenda foydalanuvchi identifikatori yo'q");

  // Firebase `auth_time`ni har doim qo'yadi. Yo'q bo'lsa — bu bizning kutgan tokenimiz emas.
  if (typeof payload.auth_time !== "number") {
    throw unauthorized("Token tuzilishi kutilganidan farq qiladi");
  }

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!email) throw unauthorized("Tokenda email yo'q");

  return {
    uid,
    email,
    displayName: typeof payload.name === "string" && payload.name.trim() ? payload.name : null,
    emailVerified: payload.email_verified === true,
  };
}

/**
 * Ishga tushishda kalitlar manbasi haqiqatan ochiladimi — shuni tekshiradi.
 *
 * Buning sababi bor: JWKS manzilidagi bitta harf xatosi hech qanday xato
 * bermaydi, shunchaki har bir token 401 bo'lib qoladi. Bunday nosozlikni
 * "login ishlamayapti" shikoyatidan oldin bilish kerak.
 */
export async function checkAuthProviderReachable(): Promise<boolean> {
  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`JWKS manzili ${res.status} qaytardi: ${JWKS_URL}`);
  const body = (await res.json()) as { keys?: unknown[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error("JWKS javobida kalitlar yo'q");
  }
  return true;
}
