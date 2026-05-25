#!/usr/bin/env bash
# Quick smoke-test for the Multilingual TTS Platform
# Usage: bash test_api.sh
# Requires: curl, python3

BASE="http://localhost:8000"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# helper: extract a JSON string field using python3
jget() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$2',''))" 2>/dev/null; }
jlen() { echo "$1" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null; }

# ── 1. Health check ────────────────────────────────────────────────────────────
info "1. Health check"
resp=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
[ "$resp" = "200" ] && pass "GET /health → 200" || fail "GET /health → $resp"

# ── 2. List voices ─────────────────────────────────────────────────────────────
info "2. List ElevenLabs voices"
resp=$(curl -s -w "\n%{http_code}" "$BASE/voices/")
code=$(echo "$resp" | tail -1)
body=$(echo "$resp" | head -1)
if [ "$code" = "200" ]; then
  count=$(jlen "$body")
  pass "GET /voices/ → 200 ($count voices)"
else
  fail "GET /voices/ → $code  (ElevenLabs API key may be invalid)"
  echo "  detail: $(jget "$body" 'detail')"
fi

# ── 3. Create a TTS job ────────────────────────────────────────────────────────
info "3. Create a TTS job (en + fr)"
JOB_RESP=$(curl -s -X POST "$BASE/jobs/create" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test of the multilingual TTS platform.",
    "languages": ["en", "fr"],
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "audio_format": "mp3_44100_128"
  }')
echo "  Response: $JOB_RESP"
JOB_ID=$(jget "$JOB_RESP" 'job_id')

if [ -z "$JOB_ID" ]; then
  fail "Job creation failed — no job_id returned"
  exit 1
fi
pass "POST /jobs/create → job_id=$JOB_ID"

# ── 4. Poll job status until done (max 60s) ────────────────────────────────────
info "4. Polling job status..."
for i in {1..12}; do
  sleep 5
  STATUS_RESP=$(curl -s "$BASE/jobs/$JOB_ID")
  STATUS=$(jget "$STATUS_RESP" 'status')
  info "  [$((i*5))s] status=$STATUS"
  if [[ "$STATUS" == "ready" || "$STATUS" == "partial" || "$STATUS" == "failed" ]]; then
    break
  fi
done

if [ "$STATUS" = "ready" ]; then
  pass "Job completed with status=ready"
elif [ "$STATUS" = "partial" ]; then
  fail "Job completed with status=partial (some languages failed — check ElevenLabs key)"
elif [ "$STATUS" = "failed" ]; then
  fail "Job failed — check worker logs: docker compose logs worker"
else
  fail "Job still processing after 60s (status=$STATUS)"
fi

ZIP_OUT="./tts_output_test.zip"

# ── 5. Download ZIP ────────────────────────────────────────────────────────────
if [[ "$STATUS" == "ready" || "$STATUS" == "partial" ]]; then
  info "5. Downloading audio ZIP"
  HTTP_CODE=$(curl -s -o "$ZIP_OUT" -w "%{http_code}" "$BASE/jobs/$JOB_ID/download")
  if [ "$HTTP_CODE" = "200" ]; then
    SIZE=$(wc -c < "$ZIP_OUT")
    pass "GET /jobs/$JOB_ID/download → 200 (${SIZE} bytes) → $ZIP_OUT"
    python3 -c "
import zipfile, sys
path = sys.argv[1]
try:
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            info = z.getinfo(name)
            print(f'  {name}  ({info.file_size:,} bytes)')
except Exception as e:
    print(f'  Could not inspect ZIP: {e}')
" "$ZIP_OUT"
  else
    fail "Download → HTTP $HTTP_CODE"
  fi
fi

echo ""
info "Done."
