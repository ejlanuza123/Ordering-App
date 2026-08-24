# Rider Mobile User Manual — Petron San Pedro Mobile App

Welcome to the Rider Mobile User Manual for the **Petron San Pedro Mobile Application**. This guide will assist delivery riders in managing auto-dispatch assignments, updating delivery milestones, navigating routes with GPS, communicating with customers, and working offline.

---

## 1. Before You Start

- Use an official Rider account created by your Admin dispatch team.
- **Enable High-Accuracy GPS Location Services** in your phone settings.
- **Enable Push Notification permissions** to receive instant sound alerts for incoming delivery assignments.
- Ensure an active mobile data connection and a sufficiently charged phone battery.

---

## 2. Account Access & Credentials

Rider accounts cannot self-register directly in the mobile app.

1. Contact your Petron Admin dispatcher team.
2. The Admin will create your account in the Admin Web Portal under **Rider Management**.
3. Obtain your assigned Email and Password.
4. Open the Rider Mobile App, enter your credentials, and tap **Sign In**.

---

## 3. Rider Dashboard & Online Duty Status Toggle

1. Upon login, the **Rider Dashboard** displays your daily delivery statistics:
   - **Today's Completed Deliveries**
   - **Active In-Progress Deliveries**
   - **Customer Rating Average ⭐**
2. **Online / Offline Status Toggle**:
   - Tap **`Go Online`** (`🟢`) when starting your shift. Your status immediately updates on Admin dispatch screens and the Live Fleet Map.
   - Tap **`Go Offline`** (`⚪`) when ending your shift or taking a break to pause incoming auto-dispatch assignments.

---

## 4. Receiving Deliveries & Auto-Dispatch Alerts

1. **Instant Sound & Push Alerts**: When an order is assigned to you (either manually by an admin or automatically via the **Smart Auto-Dispatch Engine**), your phone plays an audible alert and displays a push notification.
2. **Acceptance Window**: Tap the notification immediately to review the delivery destination, total amount, and items.
3. Tap **`Accept Delivery`** to confirm and lock the assignment.
4. **4-Stage Delivery Milestone Sequence**:
   - Step 1: **`Accept Delivery`** ➔ Locks order to your active queue.
   - Step 2: **`Picked Up Items`** ➔ Collect fuel/lubricant products from the station hub.
   - Step 3: **`Out for Delivery`** ➔ Begin transit to the customer's drop-off address.
   - Step 4: **`Mark Delivered`** ➔ Complete fulfillment upon handing items to the customer.

---

## 5. Rider Interactive GPS Map & Turn Navigation

1. Open the **Rider Map** (`🗺️` tab).
2. Station Hub Location: **Petron San Pedro Station** (`9.7533882, 118.745289`).
3. View your live GPS position (`🛵`) moving on the interactive Leaflet map in real time.
4. View customer drop-off pins (`📍`) with street address, phone number, and landmarks.
5. Check route distance (km) and estimated travel time.
6. Tap **Navigate** to launch external Google Maps / Waze turn-by-turn driving directions.

---

## 6. Customer Communication & Live Chat

- **1-Tap Phone Call**: Tap **Call Customer** (`📞`) on the active delivery card to dial the customer directly.
- **SMS Shortcut**: Tap **SMS** (`💬`) to send a text message.
- **In-App Live Chat**: Tap **Chat** to message the customer or station dispatcher in real time.
- **Direct Notification Routing**: Tapping any chat notification navigates you directly into the conversation thread without searching through lists.

---

## 7. Offline Storage Queue & Network Resilience

- If cellular data or network signal drops while on a delivery route, the app automatically records your status changes locally in `offlineStorageService`.
- You can continue marking orders as **Picked Up** or **Delivered** even in zero-reception areas.
- As soon as your internet connection is restored, the queue automatically syncs all pending updates to the Supabase database without losing timestamps.

---

## 8. Rider Profile, Earnings & Shift Close

1. Open the **Rider Profile** tab.
2. View your Vehicle Type, Plate Number, Contact Info, and cumulative delivery earnings.
3. Check your settlement status (`Settled` vs `Pending Settlement`).
4. Toggle **`Go Offline`** and tap **Sign Out** when closing your shift.

---

## 9. Quick Troubleshooting & FAQ

- **No orders being assigned**: Verify your status is set to **`Go Online` (🟢 On Duty)** and check if your GPS location is active.
- **Map pin not tracking movement**: Check that your device Location permission is set to "Allow all the time" or "While using the app" with High Accuracy enabled.
- **Offline sync pending**: Move to an area with mobile data or Wi-Fi coverage; the app will automatically sync in the background.
