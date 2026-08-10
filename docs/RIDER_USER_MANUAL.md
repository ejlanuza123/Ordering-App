# Rider Mobile User Manual — Petron San Pedro Mobile App

Welcome to the Rider Mobile User Manual for the **Petron San Pedro Mobile Application**. This guide will assist delivery riders in managing active assignments, updating delivery statuses, navigating routes, and managing presence.

---

## 1. Before You Start

- Use an official Rider account created by your Admin team.
- Enable device GPS Location Services (High Accuracy recommended).
- Enable Push Notification permissions.
- Turn on Internet connection (Wi-Fi or Mobile Data).

---

## 2. Account Access & Credentials

Rider accounts cannot self-register directly in the mobile app.

1. Contact your Petron Admin dispatcher team.
2. The Admin will create your account in the Admin Web Portal under **Rider Management**.
3. Obtain your assigned Email and Password.
4. Open the Rider Mobile App, enter credentials, and tap **Sign In**.

---

## 3. Rider Dashboard & Online Status Toggle

1. Upon login, the **Rider Dashboard** displays your daily delivery stats:
   - Today's Completed Deliveries
   - Active In-Progress Deliveries
   - Customer Rating Average ⭐
2. **Online / Offline Status Toggle**:
   - Toggle **`Go Online`** (`🟢`) when starting your shift to appear on Admin dispatch lists and Live Fleet Maps.
   - Toggle **`Go Offline`** (`⚪`) when ending your shift or taking a break.

---

## 4. Receiving & Managing Deliveries

1. **Instant New Order Assignment Alert**: When an admin assigns an order, a push notification and audio alert notify you immediately.
2. Tap the notification to jump straight to **Rider Delivery Details**.
3. Open **Deliveries List** to view all assigned orders (`Pending`, `Accepted`, `Picked Up`, `Out for Delivery`).
4. **Update Status Sequence**:
   - Tap **`Accept Delivery`** ➔ Confirm acceptance.
   - Tap **`Picked Up Items`** ➔ Collect products from station hub.
   - Tap **`Out for Delivery`** ➔ Drive to customer drop-off address.
   - Tap **`Mark Delivered`** ➔ Complete delivery fulfillment.

---

## 5. Rider Interactive Delivery Map & Navigation

1. Open **Rider Map** (`🗺️` tab).
2. Default Hub Location: **Petron San Pedro Station** (`9.7533882, 118.745289`).
3. View your live GPS position (`🛵`) moving on Leaflet map in real-time.
4. View customer drop-off pins (`📍`) with customer address and contact details.
5. View Route Distance (km) and estimated travel time.

---

## 6. In-App Customer Communication & Chat Navigation

- **Call / SMS**: Tap **Call Customer** (`📞`) or **SMS** (`💬`) directly on delivery cards to reach the customer.
- **In-App Live Chat**: Tap **Chat** to message customer or admin.
- **Auto-Navigation**: Tapping a chat notification automatically opens the active chat thread for instant communication.

---

## 7. Offline Storage & Auto-Sync Queue

- If network coverage drops while on a delivery route, the app automatically queues your status updates locally in `offlineStorageService`.
- As soon as cellular connection is restored, your queued actions automatically sync to Supabase database without data loss.

---

## 8. Rider Profile & Security

1. Open **Rider Profile** tab.
2. View your Vehicle Type, Vehicle Plate Number, assigned Email, and Phone Number.
3. Tap **Sign Out** when closing your shift.

---

## 9. Quick Troubleshooting

- **Deliveries not appearing**: Tap **Refresh** (`↻`) on Rider Dashboard or ensure your status is set to **Online**.
- **Location not updating on map**: Verify GPS location permissions are granted in phone settings.
- **Cannot update delivery status**: Reconnect internet connection or wait for offline queue sync.
