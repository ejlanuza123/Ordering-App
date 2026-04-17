# Mobile Developer Setup Guide

This guide helps new developers set up the Petron San Pedro mobile app on a Windows machine.

## Overview

The mobile app is a React Native + Expo application for customers and riders. It uses Supabase for authentication, data, offline sync, and notifications.

## Prerequisites

- Node.js 20.x recommended
- npm
- Git
- Android Studio and Android SDK for Android development
- Expo CLI / EAS CLI if you plan to build or publish
- A Supabase project with database access

## Folder Structure

- `src/` - app source code
- `assets/` - images and static resources
- `android/` - Android native project
- `docs/` - manuals and guides
- `database/` - migration files and SQL support files

## Install

```powershell
cd C:\Projects\PetronSanPedroApp
npm install
```

If dependencies are out of sync, remove `node_modules` and reinstall.

## Environment Setup

Copy `.env.example` to `.env.local` and update the values.

Required variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Do not commit `.env.local`.

## Run the App

Start the Expo development server:

```powershell
npm start
```

Android:

```powershell
npm run android
```

Web preview:

```powershell
npm run web
```

## Testing

Run unit tests:

```powershell
npm run test
```

Run coverage:

```powershell
npm run test:coverage
```

Run watch mode:

```powershell
npm run test:watch
```

## Android Build

If native Android files are already present, build with:

```powershell
cd android
gradlew assembleRelease
```

If you need to regenerate native files:

```powershell
npx expo prebuild --platform android --clean
```

## Supabase Setup Notes

- Use the same Supabase project referenced in `.env.local`.
- Database changes live under `database/` and `db/migrations/` where applicable.
- If you restore a database locally, make sure your local app env points to the correct project or local API.

## Common Tasks

### Clear Metro cache

```powershell
npx expo start -c
```

### Reinstall dependencies

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

### Recreate Android native project

```powershell
Remove-Item -Recurse -Force android
npx expo prebuild --platform android --clean
```

## Troubleshooting

### Metro or Expo fails to start

- Check Node version.
- Restart the terminal.
- Run `npx expo start -c`.

### Android build fails

- Confirm Android Studio and SDK are installed.
- Check `android/gradle.properties`.
- Rebuild with a fresh prebuild if native files are stale.

### Login or API calls fail

- Confirm the Supabase URL and anon key in `.env.local`.
- Check whether your device or emulator has internet access.

## Helpful Docs

- `docs/RIDER_USER_MANUAL.md`
- `docs/CUSTOMER_USER_MANUAL.md`
- `docs/DATABASE_BACKUP_GUIDE.md`
- `README.md`
