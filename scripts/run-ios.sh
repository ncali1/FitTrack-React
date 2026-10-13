#!/bin/bash
# Builds the app and runs it on the iOS simulator.
#
#   npm run ios        bundle the current web build into the app and launch it
#   npm run ios:live   launch the app pointed at the Vite dev server, so edits show up
#                      in the simulator as you save (leave it running; Ctrl-C to stop)
#
# Installs and launches with `xcrun simctl` directly rather than `npx cap run ios`, whose
# deploy step looks for a Simulator.app that Xcode 27 no longer ships.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_ID="com.ncali1.fittrack"
DEV_PORT=5173
MODE="${1:-bundle}"

# Use the simulator that's already booted, or boot the first available iPhone.
UDID=$(xcrun simctl list devices booted | grep -Eo '[0-9A-F-]{36}' | head -1 || true)
if [ -z "$UDID" ]; then
  UDID=$(xcrun simctl list devices available | grep iPhone | grep -Eo '[0-9A-F-]{36}' | head -1 || true)
  if [ -z "$UDID" ]; then
    echo "No iPhone simulator found. Install one in Xcode → Settings → Components." >&2
    exit 1
  fi
  echo "Booting simulator $UDID…"
  xcrun simctl boot "$UDID"
fi

# Show the simulator window (Simulator.app on older Xcodes, DeviceHub.app on Xcode 27).
XCODE_DIR=$(dirname "$(dirname "$(xcode-select -p)")")
for viewer in "$XCODE_DIR/Contents/Developer/Applications/Simulator.app" "$XCODE_DIR/Contents/Applications/DeviceHub.app"; do
  if [ -d "$viewer" ]; then
    open "$viewer"
    break
  fi
done

if [ "$MODE" = "live" ]; then
  # The simulator shares this Mac's network, so localhost reaches the dev server.
  export CAP_SERVER_URL="http://localhost:$DEV_PORT"
  # `cap sync` needs a web build to copy even though the app won't load it in this mode.
  [ -d dist ] || npm run build
else
  npm run build
fi

npx cap sync ios

echo "Building the iOS app…"
DERIVED="ios/DerivedData/$UDID"
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -destination "id=$UDID" -derivedDataPath "$DERIVED" -quiet build

xcrun simctl install "$UDID" "$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
xcrun simctl terminate "$UDID" "$APP_ID" >/dev/null 2>&1 || true

if [ "$MODE" = "live" ]; then
  echo "Starting the dev server — the app reloads as you save. Ctrl-C to stop."
  echo "Run 'npm run ios' afterwards to go back to a normal bundled build."
  # Launch once the dev server is accepting connections, then keep the server in the foreground.
  (
    until curl -s -o /dev/null "http://localhost:$DEV_PORT"; do sleep 0.5; done
    xcrun simctl launch "$UDID" "$APP_ID" >/dev/null
  ) &
  exec npx vite --port "$DEV_PORT" --strictPort
else
  xcrun simctl launch "$UDID" "$APP_ID" >/dev/null
  echo "FitTrack is running on the simulator."
fi
