# Petron San Pedro Ordering App — Release Notes

## 📱 Release Information
- **Version:** `v1.26.16`
- **Platform:** Android (React Native + Expo 54)
- **APK Download:** [Download Petron San Pedro v1.26.16 APK](https://drive.google.com/file/d/1QTGMMwEWThkiXqBo8lRXVQaXr1ijGu7_/view?usp=drive_link)
- **Direct Link:** `https://drive.google.com/file/d/1QTGMMwEWThkiXqBo8lRXVQaXr1ijGu7_/view?usp=drive_link`

---

## 🚀 What's New in v1.26.16

### 🗺️ Continuous Solid Route Lines & Dynamic HUD Style Switcher
- **Solid Delivery Route Lines:** Delivery path polyline renders as a clean, continuous solid line (`weight: 5`, `opacity: 0.85`, rounded line caps/joins) eliminating confusing dashed/skipping patterns.
- **On-the-Fly HUD Toggle:** Added a 1-tap `Solid` / `Dashed` toggle button directly on the map HUD overlay next to the layer selector.
- **Zero-Flicker Style Injection:** Dynamic Leaflet JavaScript bridge allows switching between solid and dashed paths with 0ms delay without reloading the map or losing cached tiles.

### 🎯 Live GPS Lock & Accurate Re-Centering
- **Fixed Hardcoded Location Lock:** Rider location re-centering now targets the rider's true live coordinates via fast cached location + balanced GPS accuracy rather than defaulting to station hub coordinates.
- **Instant Fix Button:** Tapping the GPS crosshair button immediately snaps the map camera to the rider's current position and refreshes local waypoint metrics.

### 🌙 Dark Mode Rider Cockpit Contrast Fix
- **Order Details Modal Dark Theme:** Resolved white background contrast issue in dark mode when inspecting active delivery order details inside the Rider GPS Cockpit.
- **Dynamic Color Tokens:** Card backgrounds, item lists, and text labels now render using high-contrast dark mode surface and text tokens.

---

## 📜 Previous Releases

### 📱 v1.26.13
- **APK Download:** [Download Petron San Pedro v1.26.13 APK](https://drive.google.com/file/d/1xH9Jl9WoK_6RYqiGv9YGoQO09s-lh6Tl/view?usp=drive_link)
- **Puerto Princesa Geofencing:** Calibrated service area bounding box (`9.68°–9.80° N, 118.68°–118.82° E`) to Puerto Princesa City.
- **Verified Station Hub:** Aligned default store location to National Highway, Brgy. San Pedro (`9.7534772, 118.7478688`).

### 📱 v1.26.12
- **APK Download:** [Download Petron San Pedro v1.26.12 APK](https://drive.google.com/file/d/1zrYMrPsArYqD6J7wnkY3Q3FrH9KoGdyj/view?usp=drive_link)
- **Admin Push Notification Broadcaster:** Interactive detail modal with category badges (`Weather`, `Promo`, `Announcement`, `Emergency`).
- **Cold-Start & Tray Click Routing:** Direct navigation to broadcast details when tapping notifications in the phone shade or lockscreen.
- **1-Tap Social Sharing:** Native OS sharing for station advisories and promos.
- **Dark Mode Polish:** Animated theme toggle transitions, neon status indicators, and themed checkout terms container.
