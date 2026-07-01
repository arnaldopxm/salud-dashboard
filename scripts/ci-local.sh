#!/usr/bin/env sh
# Replica el pipeline de CI (deploy.yml, job `build`) en local, antes de pushear.
# Mismo orden que el CI de main: npm ci → typecheck → test → build (dist/ limpio).
# Si cualquier paso falla, sale con código ≠ 0 y el push se cancela.
#
# El build.js de main NO inyecta hash en el SW ni usa build-utils.mjs (eso llega en
# Fase 4). Este script refleja el build.js real de main: solo bundle + copia estática.
#
# Saltarlo puntualmente (WIP): SKIP_PIPELINE=1 git push …
#   Las guardas de flujo (scripts/pre-push.sh) NO se saltan con esto; corren siempre.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { printf "\n${YELLOW}▶ %s${NC}\n" "$1"; }
ok()   { printf "${GREEN}✓ %s${NC}\n" "$1"; }
fail() { printf "${RED}✗ %s${NC}\n" "$1"; exit 1; }

if [ "$SKIP_PIPELINE" = "1" ]; then
  printf "${YELLOW}⚠ SKIP_PIPELINE=1 — pipeline local omitido. CI en el PR sigue siendo obligatorio.${NC}\n"
  exit 0
fi

step "Verificando lockfile (npm ci)"
npm ci --prefer-offline --silent || fail "npm ci falló — package-lock.json desincronizado"
ok "Dependencias OK"

step "Type check"
npm run typecheck || fail "typecheck falló"
ok "TypeScript OK"

step "Tests"
npm test || fail "Tests fallaron"
ok "Tests OK"

step "Build (desde dist/ limpio, como CI)"
rm -rf dist
npm run build || fail "Build falló"
ok "Build OK"

printf "\n${GREEN}Pipeline local completo — push permitido.${NC}\n\n"
