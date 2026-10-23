#!/bin/sh
set -eu

if [ ! -f .env ]; then
  echo 'Crie .env a partir de .env.example antes de publicar.' >&2
  exit 1
fi

docker compose -f compose.yaml -f compose.prod.yaml config --quiet
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
docker compose -f compose.yaml -f compose.prod.yaml ps
printf '\nConfira https://SEU_DOMINIO/api/health e teste os fluxos na internet.\n'
