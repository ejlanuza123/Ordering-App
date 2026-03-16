# Project Setup Fix Guide

## Pre-requisites

1.  Delete `node_modules`
2.  Delete `./expo` folder
3.  Delete `android` folder
4.  Delete `package-lock.json`

------------------------------------------------------------------------

## Commands

1.  Run the Expo prebuild command:

``` bash
npx expo prebuild --platform android --clean
```

2.  Run the Android project:

``` bash
npm run android
```

``` bash
npx expo run:android
```

------------------------------------------------------------------------

## Generate APK

1.  Go to the android directory:

``` bash
cd android
```

2.  Build the release APK:

For Mac/Linux:

``` bash
./gradlew assembleRelease
```

For Windows:

``` bash
gradlew assembleRelease
```

------------------------------------------------------------------------

## Hot Fix

1.  Check Expo project issues:

``` bash
npx expo-doctor
```

2.  Run Gradle doctor:

``` bash
./gradlew doctor
```

3.  Check and fix Expo dependencies:

``` bash
npx expo install --check
```

------------------------------------------------------------------------

## Error Handling

1.  Add specific error troubleshooting steps here.
