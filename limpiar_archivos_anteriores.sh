#!/bin/sh
set -eu
cd "$(dirname "$0")"
rm -f src/cerro-rico.js src/geological-dossier.js tests/cerro-rico.test.mjs
rm -f CHANGELOG_v0.3.md CHANGELOG_v0.4.md CHANGELOG_v0.5.md CHANGELOG_v0.6.md CHANGELOG_v0.7.md CHANGELOG_v0.8.md CHANGELOG_v0.9.md CHANGELOG_v1.0.md
printf 'Limpieza de ejemplos antiguos completada. No se borraron tus areas ni claves.\n'
