#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

export ANDROID_HOME="${ANDROID_HOME:-${HOME}/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME}}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/build-tools/35.0.1:/opt/homebrew/bin:/usr/local/bin:${PATH}"

npm run android:sync

(cd android && ./gradlew --no-daemon --max-workers=2 assembleDebug)

mkdir -p build/android
cp android/app/build/outputs/apk/debug/app-debug.apk build/PixelLedger-android-debug.apk

echo
echo "APK output:"
ls -lh build/PixelLedger-android-debug.apk
shasum -a 256 build/PixelLedger-android-debug.apk
