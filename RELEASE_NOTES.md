# Petron San Pedro Ordering App — Release Notes

## 📱 Release Information
- **Version:** `v1.26.13`
- **Platform:** Android / iOS (React Native + Expo 54)
- **APK Download:** [Download Petron San Pedro v1.26.13 APK](https://drive.google.com/file/d/1xH9Jl9WoK_6RYqiGv9YGoQO09s-lh6Tl/view?usp=drive_link)
- **Direct Link:** `https://drive.google.com/file/d/1xH9Jl9WoK_6RYqiGv9YGoQO09s-lh6Tl/view?usp=drive_link`

---

## 🚀 What's New in v1.26.13

### 🌐 Puerto Princesa City Geofencing & Service Area Alignment
- **Corrected Service Area Bounds:** Resolved critical geofencing error where `isWithinServiceArea()` checked coordinates against San Pedro, Laguna (`14.35°–14.38° N`). Bounding box is now accurately calibrated for **Puerto Princesa City, Palawan** (`9.68°–9.80° N, 118.68°–118.82° E`), ensuring customer delivery availability and rider GPS tracking properly recognize the operating territory.
- **Store Station Location Ground Truth:** Updated `DEFAULT_STORE_LOCATION` fallback coordinates from Coliseum (`9.754820, 118.748890`) to the verified **Petron San Pedro Station Hub** (`9.7534772, 118.7478688`) on National Highway, Brgy. San Pedro, Puerto Princesa City.
- **OpenStreetMap Picker Store Pin Sync:** Fixed coordinate rounding in the customer map picker from `[9.7535, 118.7479]` to exact station coordinates `[9.7534772, 118.7478688]`.
- **Automated Geofencing Test Suite:** Added unit tests in `src/__tests__/utils/riderLocation.test.js` verifying service area validation and store coordinates within Puerto Princesa City.

---

## 📜 Previous Releases

### 📱 v1.26.12
- **APK Download:** [Download Petron San Pedro v1.26.12 APK](https://drive.google.com/file/d/1zrYMrPsArYqD6J7wnkY3Q3FrH9KoGdyj/view?usp=drive_link)
- **Admin Push Notification Broadcaster:** Interactive detail modal with category badges (`Weather`, `Promo`, `Announcement`, `Emergency`).
- **Cold-Start & Tray Click Routing:** Direct navigation to broadcast details when tapping notifications in the phone shade or lockscreen.
- **1-Tap Social Sharing:** Native OS sharing for station advisories and promos.
- **Dark Mode Polish:** Animated theme toggle transitions, neon status indicators, and themed checkout terms container.
