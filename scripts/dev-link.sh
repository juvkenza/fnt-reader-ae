#!/bin/bash
# Development helper (macOS): symlinks ../src into the CEP extensions folder and enables
# PlayerDebugMode so After Effects loads the unsigned panel straight from the repository.
# For normal use, install the signed .zxp from the Releases page instead.
#   bash scripts/dev-link.sh            link + enable debug mode
#   bash scripts/dev-link.sh --remove   remove the link (and turn debug mode off)
set -e
ID="com.juvkenza.fntreader"
HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/Library/Application Support/Adobe/CEP/extensions/$ID"

if [ "$1" = "--remove" ]; then
  rm -rf "$TARGET"
  for v in 9 10 11 12 13; do defaults delete "com.adobe.CSXS.$v" PlayerDebugMode 2>/dev/null || true; done
  echo "Removed $TARGET"
  exit 0
fi

mkdir -p "$(dirname "$TARGET")"
rm -rf "$TARGET"
ln -s "$(cd "$HERE/../src" && pwd)" "$TARGET"
for v in 9 10 11 12 13; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done
killall -u "$USER" cfprefsd 2>/dev/null || true
echo "Linked $TARGET"
echo "Restart After Effects and open Window > Extensions > FNT Reader."
