#!/usr/bin/env sh
# Replica los pasos del pipeline de CI antes de cada push.
# Si cualquier paso falla, el push se cancela.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { printf "\n${YELLOW}▶ %s${NC}\n" "$1"; }
ok()   { printf "${GREEN}✓ %s${NC}\n" "$1"; }
fail() { printf "${RED}✗ %s${NC}\n" "$1"; exit 1; }

step "Verificando lockfile (npm ci)"
npm ci --prefer-offline --silent || fail "npm ci falló — package-lock.json desincronizado"
ok "Dependencias OK"

step "Type check"
npm run typecheck || fail "typecheck falló"
ok "TypeScript OK"

step "Build (desde dist/ limpio, como CI)"
rm -rf dist
npm run build || fail "Build falló"
ok "Build OK"

step "Tests"
npm test || fail "Tests fallaron"
ok "Tests OK"

printf "\n${GREEN}Pipeline local completo — push permitido.${NC}\n\n"
