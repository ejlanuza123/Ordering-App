# Petron San Pedro Mobile App

React Native + Expo application for customer ordering, rider delivery workflows, offline queueing, tracking, and mobile notifications.

## Documentation

- Developer setup: [docs/MOBILE_DEVELOPER_SETUP_GUIDE.md](docs/MOBILE_DEVELOPER_SETUP_GUIDE.md)
- Local infra + DB tools setup: [docs/LOCAL_INFRA_AND_DB_TOOLS_SETUP_GUIDE.md](docs/LOCAL_INFRA_AND_DB_TOOLS_SETUP_GUIDE.md)
- Rider manual: [docs/RIDER_USER_MANUAL.md](docs/RIDER_USER_MANUAL.md)
- Customer manual: [docs/CUSTOMER_USER_MANUAL.md](docs/CUSTOMER_USER_MANUAL.md)
- Database backup guide: [docs/DATABASE_BACKUP_GUIDE.md](docs/DATABASE_BACKUP_GUIDE.md)

## What This App Does

- Lets customers browse products, build carts, place orders, and track deliveries.
- Lets riders view assignments, update delivery status, capture proof, and manage delivery notes.
- Supports offline order queueing and reconnect-based sync.
- Uses Supabase for auth, profile, orders, notifications, and storage-backed workflows.

## Project Layout

- `src/` - application source code
- `assets/` - images and static resources
- `android/` - native Android project
- `database/` and `db/` - SQL migrations and related database files
- `docs/` - manuals, guides, and troubleshooting notes
- `supabase/` - Supabase-related local config and helpers

## Requirements

- Node.js 20.x recommended
- npm
- Android Studio and Android SDK for Android builds
- A Supabase project with the correct URL and anon key

## Environment Variables

Create or update `.env.local` at the project root.

Required values:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Optional local behavior flags used during development:

- `EXPO_NO_DEPENDENCY_VALIDATION`
- `EXPO_NO_DOCTOR`

Keep `.env.local` out of source control.

## Install

```bash
cd PetronSanPedroApp
npm install
```

## Common Commands

### Start development server

```bash
npm start
```

### Start with cache cleared

```bash
npm run start:safe
```

### Run Android app

```bash
npm run android
```

### Run web preview

```bash
npm run web
```

### Run tests

```bash
npm run test
```

### Run tests with coverage

```bash
npm run test:coverage
```

### Run tests in watch mode

```bash
npm run test:watch
```

## Native Android Notes

- If native files are already present, use `cd android && gradlew assembleRelease` to build a release APK.
- If Android native files become stale, regenerate them with `npx expo prebuild --platform android --clean`.
- If Gradle or native clean steps fail, clear generated folders before retrying.

## Mobile Architecture

- `src/screens/` contains customer, rider, auth, and shared screens.
- `src/components/` contains reusable UI pieces such as cards, alerts, avatars, and modal content.
- `src/context/` manages shared app state like auth, cart, delivery proof, notifications, and rider ratings.
- `src/services/` contains Supabase and business-logic helpers.
- `src/utils/` contains formatters and other shared helpers.

## Operational Features

- Global error capture pipeline via `errorHandlerService`
- Network reconnect telemetry for offline duration
- Offline order queue and sync processing
- Delivery proof capture and status workflow
- Customer and rider notification handling
- Role-aware auth and profile flow

## Working with Supabase

- Use the same Supabase project referenced in `.env.local`.
- Keep database migrations under version control and apply them in order.
- Use the backup guide when you need a local copy of the database.

## Troubleshooting

### Metro or Expo fails to start

- Confirm the Node version is compatible.
- Run `npm run start:safe`.
- Clear the Expo cache with `npx expo start -c`.

### Android build fails

- Confirm Android SDK and emulator/device setup.
- Rebuild native files if the Android project is stale.
- Review Gradle output for resource or native codegen issues.

### Auth or API calls fail

- Confirm Supabase URL and anon key in `.env.local`.
- Check internet access on the emulator or device.
- Verify the target role is allowed to use the app.

## Related Docs

- [docs/MOBILE_DEVELOPER_SETUP_GUIDE.md](docs/MOBILE_DEVELOPER_SETUP_GUIDE.md)
- [docs/LOCAL_INFRA_AND_DB_TOOLS_SETUP_GUIDE.md](docs/LOCAL_INFRA_AND_DB_TOOLS_SETUP_GUIDE.md)
- [docs/DATABASE_BACKUP_GUIDE.md](docs/DATABASE_BACKUP_GUIDE.md)
- [docs/RIDER_USER_MANUAL.md](docs/RIDER_USER_MANUAL.md)
- [docs/CUSTOMER_USER_MANUAL.md](docs/CUSTOMER_USER_MANUAL.md)

