/**
 * Test uchun haqiqiy Firebase ID token oladi.
 *
 *   npx tsx scripts/get-token.ts <email> <parol>            — mavjud akkaunt bilan kiradi
 *   npx tsx scripts/get-token.ts <email> <parol> --signup    — yangi akkaunt yaratadi
 *
 * Firebase'ning ommaviy REST API'siga murojaat qiladi — frontend brauzerda
 * nima qilsa, shuni qiladi. Maxfiy kalit ishlatilmaydi.
 *
 * DIQQAT: --signup Firebase loyihangizda HAQIQIY foydalanuvchi yaratadi.
 * Keyin uni Firebase Console → Authentication → Users dan o'chirib tashlashingiz mumkin.
 */
import "dotenv/config";

const args = process.argv.slice(2);
const signup = args.includes("--signup");
const [email, password] = args.filter((a) => !a.startsWith("--"));
const apiKey = process.env.FIREBASE_API_KEY;

if (!email || !password) {
  console.error("Ishlatish: npx tsx scripts/get-token.ts <email> <parol> [--signup]");
  process.exit(1);
}
if (!apiKey) {
  console.error(".env dagi FIREBASE_API_KEY to'ldirilmagan");
  process.exit(1);
}

const endpoint = signup ? "accounts:signUp" : "accounts:signInWithPassword";

const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${apiKey}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password, returnSecureToken: true }),
});

const data = (await res.json()) as {
  idToken?: string;
  localId?: string;
  error?: { message?: string };
};

if (!res.ok || !data.idToken) {
  const code = data.error?.message ?? String(res.status);
  // Firebase'ning xato kodlarini o'qishga qulay qilamiz
  const hint: Record<string, string> = {
    EMAIL_EXISTS: "Bu email allaqachon mavjud — --signup ni olib tashlab qayta urinib ko'ring.",
    EMAIL_NOT_FOUND: "Bunday akkaunt yo'q — --signup qo'shib yaratib oling.",
    INVALID_LOGIN_CREDENTIALS: "Email yoki parol noto'g'ri.",
    WEAK_PASSWORD: "Parol kamida 6 belgidan bo'lishi kerak.",
    OPERATION_NOT_ALLOWED:
      "Firebase Console → Authentication → Sign-in method'da Email/Password yoqilmagan.",
  };
  console.error(`✗ ${code}`);
  const found = Object.keys(hint).find((k) => code.startsWith(k));
  if (found) console.error(`  ${hint[found]}`);
  process.exit(1);
}

console.error(`✓ ${signup ? "akkaunt yaratildi" : "kirildi"} — uid: ${data.localId}`);
console.error("  (token 1 soat yaroqli)");
console.log(data.idToken);
