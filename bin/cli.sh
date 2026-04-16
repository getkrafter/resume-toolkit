#!/usr/bin/env sh
# Suppress dotenv@17 promotional stdout tips before any module loads

# Resolve symlinks so the path works when npm/npx creates a symlink in .bin/
SCRIPT="$0"
while [ -L "$SCRIPT" ]; do
  DIR="$(cd "$(dirname "$SCRIPT")" && pwd)"
  SCRIPT="$(readlink "$SCRIPT")"
  case "$SCRIPT" in /*) ;; *) SCRIPT="$DIR/$SCRIPT" ;; esac
done
DIR="$(cd "$(dirname "$SCRIPT")" && pwd)"

exec node --import 'data:text/javascript,process.env.DOTENV_CONFIG_QUIET="true"' "$DIR/../dist/bin/cli.js" "$@"
