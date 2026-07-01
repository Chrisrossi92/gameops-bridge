#!/usr/bin/env bash
set -euo pipefail

echo "GameOps Bridge VPS deployment checklist"
echo
echo "1. Pull latest source"
echo "   git pull"
echo
echo "2. Install dependencies"
echo "   npm install"
echo
echo "3. Build dashboard"
npm --workspace apps/web run build
echo
echo "4. Restart services manually"
echo "   sudo systemctl restart gameops-api.service"
echo "   sudo systemctl restart gameops-dashboard.service"
echo
echo "5. Health checks"
echo "   curl -fsS http://127.0.0.1:3001/health"
echo "   curl -fsS -H \"x-gameops-operator-key: \$GAMEOPS_OPERATOR_KEY\" http://127.0.0.1:3001/api/operator/brief"
echo
echo "6. Confirm clean checkout"
echo "   git status --short"
