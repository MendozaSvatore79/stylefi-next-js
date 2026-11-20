#!/usr/bin/env bash
# Revisa que el front y el API respondan. Sale con 1 si alguno falla después de 3 intentos.
# Uso: disponibilidad.sh <url-del-front> <url-del-api>
set -uo pipefail
FRONT="${1:?falta la URL del front}"
API="${2:?falta la URL del API}"

revisar() { # nombre, comando que debe salir con 0
  local nombre="$1"; shift
  for intento in 1 2 3; do
    if "$@"; then echo "OK    $nombre"; return 0; fi
    [ "$intento" -lt 3 ] && sleep "${ESPERA_ENTRE_INTENTOS:-20}"
  done
  echo "FALLA $nombre (3 intentos)"; return 1
}

front() { [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$FRONT/")" = 200 ]; }
api() {
  local cuerpo
  cuerpo="$(curl -sf --max-time 15 "${API%/}/health")" || return 1
  echo "$cuerpo" | grep -q '"estado":"ok"' && echo "$cuerpo" | grep -q '"base":"ok"'
}

fallas=0
revisar "front $FRONT" front || fallas=1
revisar "API ${API%/}/health (estado y base)" api || fallas=1
exit "$fallas"
