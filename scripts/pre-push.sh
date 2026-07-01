#!/usr/bin/env sh
# Guardas de flujo de trabajo (ver docs/RAMAS.md).
# Defensa en profundidad en local; GitHub branch protection es la barrera dura.
#   1. Rechaza empujar A la rama main (push directo a main).
#   2. Valida que la rama local empujada cumpla feat|fix|infra|docs|chore|archive/<slug>.
# Se invoca desde .git/hooks/pre-push, que le pasa el mismo stdin que recibe git:
#   <local ref> <local sha> <remote ref> <remote sha>   (una línea por ref empujada)
# Empujar/borrar otras ramas remotas mientras estás parado en main SÍ se permite.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
fail() { printf "${RED}✗ %s${NC}\n" "$1"; exit 1; }

Z40="0000000000000000000000000000000000000000"
checked=""

while read -r local_ref local_sha remote_ref remote_sha; do
  [ -z "$remote_ref" ] && continue

  # 1. Nunca empujar a main (crear o actualizar). Borrar main tampoco.
  if [ "$remote_ref" = "refs/heads/main" ]; then
    fail "Push directo a main bloqueado. Abre un PR. Ver docs/RAMAS.md"
  fi

  # 2. Validar nombre de la rama LOCAL que se empuja (solo al crear/actualizar,
  #    no al borrar, que llega con local_sha a ceros).
  [ "$local_sha" = "$Z40" ] && continue
  case "$local_ref" in
    refs/heads/*)
      name="${local_ref#refs/heads/}"
      case "$name" in
        feat/?*|fix/?*|infra/?*|docs/?*|chore/?*|archive/?*)
          checked="$checked $name" ;;
        *)
          fail "Nombre de rama inválido: '$name'. Usa feat|fix|infra|docs|chore|archive/<slug>. Ver docs/RAMAS.md" ;;
      esac
      ;;
  esac
done

[ -n "$checked" ] && printf "${GREEN}✓ Ramas empujadas cumplen el nombrado:%s${NC}\n" "$checked"
exit 0
