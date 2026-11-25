#!/usr/bin/env bash
# Auth oqimini uchdan-uchiga sinaydi.
#
#   ./scripts/smoke.sh <email> <parol>            — mavjud akkaunt
#   ./scripts/smoke.sh <email> <parol> --signup   — yangi akkaunt yaratadi
#
set -uo pipefail

BASE="${BASE:-http://localhost:4000}"
EMAIL="${1:?email kerak}"
PASSWORD="${2:?parol kerak}"
SIGNUP="${3:-}"

pass=0
fail=0

# kutilgan_kod  izoh  curl_argumentlari...
check() {
  local want="$1" label="$2"; shift 2
  local body code
  body=$(curl -s -m 10 -w $'\n%{http_code}' "$@")
  code="${body##*$'\n'}"
  body="${body%$'\n'*}"

  if [ "$code" = "$want" ]; then
    printf '  \033[32m✓\033[0m %-44s %s\n' "$label" "$code"
    pass=$((pass + 1))
  else
    printf '  \033[31m✗\033[0m %-44s %s (kutilgan %s)\n' "$label" "$code" "$want"
    printf '      %s\n' "$body"
    fail=$((fail + 1))
  fi
  LAST_BODY="$body"
}

printf '\n\033[1mNova auth sinovi\033[0m — %s\n\n' "$BASE"

# ── 1. Server ──────────────────────────────────────────────────────
echo "Server:"
check 200 "GET /health" "$BASE/health"
check 200 "GET /health/ready (DB)" "$BASE/health/ready"

# ── 2. Token yo'q yoki yaroqsiz → kirish yo'q ──────────────────────
echo
echo "Himoya (token yo'q / yaroqsiz):"
check 401 "GET /api/me  tokensiz" "$BASE/api/me"
check 401 "GET /api/me  axlat token" -H "Authorization: Bearer axlat" "$BASE/api/me"
check 401 "GET /api/me  Bearer prefiksisiz" -H "Authorization: abc.def.ghi" "$BASE/api/me"
check 404 "GET /nosuch" "$BASE/nosuch"

# ── 3. Haqiqiy token olamiz ────────────────────────────────────────
echo
echo "Firebase'dan token:"
if ! TOKEN=$(npx tsx scripts/get-token.ts "$EMAIL" "$PASSWORD" $SIGNUP); then
  printf $'  \033[31m✗\033[0m token olinmadi — yuqoridagi xabarni o\'qing\n'
  exit 1
fi
printf '  \033[32m✓\033[0m token olindi (%s belgi)\n' "${#TOKEN}"

AUTH=(-H "Authorization: Bearer $TOKEN")
JSON=(-H "content-type: application/json")

# ── 4. Haqiqiy token bilan ─────────────────────────────────────────
echo
echo "Haqiqiy token bilan:"
check 200 "GET /api/me" "${AUTH[@]}" "$BASE/api/me"
echo "      $LAST_BODY"

check 200 "PATCH /api/me (ism o'zgartirish)" -X PATCH "${AUTH[@]}" "${JSON[@]}" \
  -d '{"firstName":"Smoke","lastName":"Test"}' "$BASE/api/me"

check 422 "PATCH /api/me (bo'sh ism → rad)" -X PATCH "${AUTH[@]}" "${JSON[@]}" \
  -d '{"firstName":""}' "$BASE/api/me"

check 200 "PATCH /api/me (role o'zgartirishga urinish)" -X PATCH "${AUTH[@]}" "${JSON[@]}" \
  -d '{"firstName":"Smoke","role":"ADMIN"}' "$BASE/api/me"
case "$LAST_BODY" in
  *'"role":"ADMIN"'*) printf $'      \033[31m✗ XAVF: role o\'zgartirildi!\033[0m\n'; fail=$((fail+1));;
  *) printf $'      \033[32m✓\033[0m role o\'zgarmadi (CUSTOMER)\n'; pass=$((pass+1));;
esac

# ── 5. Manzillar ───────────────────────────────────────────────────
echo
echo "Manzillar:"
check 201 "POST /api/me/addresses" -X POST "${AUTH[@]}" "${JSON[@]}" \
  -d '{"name":"Smoke Test","street":"42 Mercer Street","city":"New York","state":"NY","zip":"10013"}' \
  "$BASE/api/me/addresses"

ADDR_ID=$(printf '%s' "$LAST_BODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
case "$LAST_BODY" in
  *'"isDefault":true'*) printf $'      \033[32m✓\033[0m birinchi manzil avtomatik asosiy bo\'ldi\n'; pass=$((pass+1));;
  *) printf $'      \033[31m✗\033[0m birinchi manzil asosiy bo\'lmadi\n'; fail=$((fail+1));;
esac

check 422 "POST /api/me/addresses (bo'sh street → rad)" -X POST "${AUTH[@]}" "${JSON[@]}" \
  -d '{"name":"X","street":"","city":"NY","state":"NY","zip":"10013"}' "$BASE/api/me/addresses"

check 200 "GET /api/me/addresses" "${AUTH[@]}" "$BASE/api/me/addresses"

if [ -n "$ADDR_ID" ]; then
  check 404 "PATCH boshqa odamning manzili (soxta id)" -X PATCH "${AUTH[@]}" "${JSON[@]}" \
    -d '{"city":"Hacked"}' "$BASE/api/me/addresses/soxta-id-12345"
  check 200 "PATCH o'z manzilim" -X PATCH "${AUTH[@]}" "${JSON[@]}" \
    -d '{"city":"Brooklyn"}' "$BASE/api/me/addresses/$ADDR_ID"
  check 204 "DELETE o'z manzilim (tozalash)" -X DELETE "${AUTH[@]}" "$BASE/api/me/addresses/$ADDR_ID"
fi

# ── Natija ─────────────────────────────────────────────────────────
printf '\n─────────────────────────────\n'
if [ "$fail" -eq 0 ]; then
  printf $'\033[32m%d o\'tdi\033[0m, %d yiqildi\n\n' "$pass" "$fail"
else
  printf $'%d o\'tdi, \033[31m%d yiqildi\033[0m\n\n' "$pass" "$fail"
  exit 1
fi
