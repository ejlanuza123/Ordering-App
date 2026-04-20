# Android CLI-Only Setup Guide (No Android Studio)

This guide shows how to run this app on Android without installing Android Studio.

It covers setup for:

- `npx expo prebuild --platform android --clean`
- `npm run android`

Target environment: Windows (PowerShell and Command Prompt).

## 1. What you need

- Node.js 20.x
- npm
- Git (optional, but recommended)
- Java JDK 17
- Android SDK Command-line Tools
- Android Platform Tools (`adb`)
- Android Build Tools
- Android platform SDK for API 34 (or project-required API)

## 2. Install base tools

Open PowerShell as Administrator and run:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id EclipseAdoptium.Temurin.17.JDK -e
```

Verify:

```powershell
node -v
npm -v
java -version
```

## 3. Install Android SDK Command-line Tools

1. Download the Windows Command-line Tools zip from the official Android developer site:
- https://developer.android.com/studio#command-tools

2. Create SDK folder structure:

```powershell
New-Item -ItemType Directory -Force -Path "C:\Android\cmdline-tools"
```

3. Extract the downloaded zip into:

```text
C:\Android\cmdline-tools\latest
```

Important final expected file path:

```text
C:\Android\cmdline-tools\latest\bin\sdkmanager.bat
```

## 4. Set required environment variables

Set permanent user variables (recommended):

- `ANDROID_SDK_ROOT = C:\Android`
- `ANDROID_HOME = C:\Android`
- `JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17*` (use your exact installed folder)

Add these to `Path`:

```text
C:\Android\platform-tools
C:\Android\cmdline-tools\latest\bin
C:\Android\emulator
%JAVA_HOME%\bin
```

After saving variables, close and reopen terminal.

Quick check:

```powershell
echo $env:ANDROID_SDK_ROOT
echo $env:JAVA_HOME
sdkmanager --version
adb version
```

## 5. Install required Android SDK packages

Run:

```powershell
sdkmanager --licenses
sdkmanager "platform-tools" "cmdline-tools;latest" "build-tools;34.0.0" "platforms;android-34"
```

If your project later requires a different API/build-tools version, install that version too.

## 6. Device setup (without Android Studio)

Option A: Real Android device (recommended)

1. Enable Developer Options.
2. Enable USB debugging.
3. Connect via USB.
4. Verify device:

```powershell
adb devices
```

You should see your device listed as `device`.

Option B: Emulator from CLI only (advanced)

Install packages:

```powershell
sdkmanager "emulator" "system-images;android-34;google_apis;x86_64"
```

Create AVD:

```powershell
avdmanager create avd -n Pixel_7_API_34 -k "system-images;android-34;google_apis;x86_64"
```

Start emulator:

```powershell
emulator -avd Pixel_7_API_34
```

## 7. Project setup and clean prebuild

From project root:

```powershell
cd C:\Projects\PetronSanPedroApp
npm install
npx expo prebuild --platform android --clean
```

What this does:

- Regenerates the `android/` native project from Expo config
- Applies native dependencies and plugin configuration

## 8. Run on Android

From project root:

```powershell
npm run android
```

Alternative:

```powershell
npx expo run:android
```

## 9. Build release APK from CLI

```powershell
cd android
.\gradlew assembleRelease
```

Output APK location:

```text
android\app\build\outputs\apk\release\app-release.apk
```

## 10. Troubleshooting

### `sdkmanager` not recognized

- Confirm `C:\Android\cmdline-tools\latest\bin` is in `Path`.
- Confirm this file exists: `C:\Android\cmdline-tools\latest\bin\sdkmanager.bat`.

### `adb` not recognized

- Confirm `C:\Android\platform-tools` is in `Path`.

### `JAVA_HOME` issues or Gradle Java errors

- Use JDK 17.
- Verify:

```powershell
java -version
echo $env:JAVA_HOME
```

### `No connected devices`

- Run `adb devices`.
- Reconnect USB and accept debugging prompt on phone.
- Ensure device is not shown as `unauthorized`.

### Expo prebuild fails

- Clear modules and reinstall:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npx expo prebuild --platform android --clean
```

## 11. Quick validation checklist

- `node -v` works
- `java -version` shows JDK 17
- `sdkmanager --version` works
- `adb devices` shows at least one target device/emulator
- `npx expo prebuild --platform android --clean` succeeds
- `npm run android` launches app

## Related docs

- `Project_Setup_Guide.md`
- `docs/MOBILE_DEVELOPER_SETUP_GUIDE.md`
- `docs/EXPO_TROUBLESHOOTING.md`
