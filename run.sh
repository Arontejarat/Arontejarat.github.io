#!/usr/bin/env bash
# Run the سامانه نیرو frontend.
#
#   ./run.sh            start the dev server (default) — http://localhost:5173
#   ./run.sh prod       build for production and serve the build — http://localhost:4173
#   ./run.sh build      build only (output in dist/)
#   ./run.sh check      type-check only
#
# Options (environment variables):
#   PORT=8080 ./run.sh        use another port
#   HOST=0.0.0.0 ./run.sh     expose on the local network (e.g. to test on a phone)

set -euo pipefail

cd "$(dirname "$0")"

MODE="${1:-dev}"
HOST="${HOST:-localhost}"

# --- Node.js check -----------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "خطا: Node.js نصب نیست. نسخه ۲۲ یا بالاتر را از https://nodejs.org نصب کنید." >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "خطا: نسخه Node.js باید ۲۲ یا بالاتر باشد (نسخه فعلی: $(node -v))." >&2
  exit 1
fi

# --- Dependencies (installed only when missing or when the lockfile changed) ---
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "› نصب وابستگی‌ها..."
  npm ci --no-audit --no-fund
fi

# --- Run ---------------------------------------------------------------------
case "$MODE" in
  dev)
    PORT="${PORT:-5173}"
    echo "› اجرای سرور توسعه: http://$HOST:$PORT"
    exec npx vite --host "$HOST" --port "$PORT"
    ;;
  prod)
    PORT="${PORT:-4173}"
    echo "› ساخت نسخه نهایی..."
    npm run build
    echo "› اجرای نسخه نهایی: http://$HOST:$PORT"
    exec npx vite preview --host "$HOST" --port "$PORT"
    ;;
  build)
    npm run build
    echo "› خروجی در پوشه dist/ ساخته شد."
    ;;
  check)
    npm run typecheck
    echo "› بررسی نوع‌ها بدون خطا انجام شد."
    ;;
  *)
    echo "استفاده: ./run.sh [dev|prod|build|check]" >&2
    exit 1
    ;;
esac
