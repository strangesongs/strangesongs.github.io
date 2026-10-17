#!/bin/bash
# Builds "cleve add.app", a double-clickable launcher for the add-entry form.
#   bash tools/add-entry/make-app.sh [destination folder]   (default: this folder)
# The app has this repo's location baked in; rebuild it if the repo moves.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
REPO_ON_MAC="${CLEVE_REPO:-$REPO}"
DEST="${1:-$HERE}"
APP="$DEST/cleve add.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$HERE/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>cleve add</string>
    <key>CFBundleDisplayName</key><string>cleve add</string>
    <key>CFBundleIdentifier</key><string>io.github.strangesongs.cleve-add</string>
    <key>CFBundleVersion</key><string>1.0</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleExecutable</key><string>run</string>
    <key>CFBundleIconFile</key><string>AppIcon</string>
    <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
PLIST

cat > "$APP/Contents/MacOS/run" <<RUN
#!/bin/zsh
# Finder starts apps with a bare PATH, so load the login shell setup
# (Homebrew, nvm, etc.) to find node and git, then start the form.
REPO="$REPO_ON_MAC"
source ~/.zprofile >/dev/null 2>&1
source ~/.zshrc >/dev/null 2>&1
export PATH="\$PATH:/opt/homebrew/bin:/usr/local/bin"
fail() { osascript -e "display alert \"cleve add\" message \"\$1\" as critical" >/dev/null; exit 1; }
command -v node >/dev/null || fail "Couldn't find Node. Install it (e.g. brew install node), then try again."
cd "\$REPO" 2>/dev/null || fail "Couldn't find the site folder at \$REPO. If it moved, rebuild this app: bash tools/add-entry/make-app.sh"
exec node tools/add-entry/server.js --open
RUN
chmod +x "$APP/Contents/MacOS/run"
echo "Built: $APP"
