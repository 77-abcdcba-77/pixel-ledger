#!/usr/bin/env bash
set -euo pipefail

TEAM_ID="${1:-${DEVELOPMENT_TEAM:-}}"

if [[ -z "${TEAM_ID}" ]]; then
  echo "Usage: ./scripts/build-ios-signed-ipa.sh TEAM_ID"
  echo "Or set DEVELOPMENT_TEAM=TEAM_ID before running this script."
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

ARCHIVE_PATH="${ROOT_DIR}/build/ios-archive/PixelLedger.xcarchive"
EXPORT_PATH="${ROOT_DIR}/build/ipa"
EXPORT_OPTIONS="${ROOT_DIR}/build/ExportOptions.plist"

npm run ios:sync

rm -rf "${ARCHIVE_PATH}" "${EXPORT_PATH}"
mkdir -p "$(dirname "${ARCHIVE_PATH}")" "${EXPORT_PATH}" "${ROOT_DIR}/build"

xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "${ARCHIVE_PATH}" \
  archive \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="${TEAM_ID}"

cat > "${EXPORT_OPTIONS}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>debugging</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>thinning</key>
  <string>&lt;none&gt;</string>
</dict>
</plist>
PLIST

xcodebuild \
  -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportPath "${EXPORT_PATH}" \
  -exportOptionsPlist "${EXPORT_OPTIONS}" \
  -allowProvisioningUpdates

echo
echo "IPA output:"
find "${EXPORT_PATH}" -maxdepth 1 -name '*.ipa' -print
