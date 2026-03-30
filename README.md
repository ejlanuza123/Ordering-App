# Petron San Pedro Mobile App

React Native + Expo customer and rider mobile application for order placement, tracking, offline queueing, and delivery workflows.

## Quick Start

### Prerequisites
- Node.js 18+
- npm
- Expo CLI/EAS CLI account setup

### Installation

```bash
cd PetronSanPedroApp
npm install
```

### Run App

```bash
npm start
```

### Testing

```bash
npm run test -- --runInBand
npm run test:coverage -- --runInBand
```

## Environment Variables

Copy `.env.example` and provide values for:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`


## Current Operational Features

- Global error capture pipeline via `errorHandlerService`
- Network reconnect telemetry for offline duration
- Offline order queue and sync processing

