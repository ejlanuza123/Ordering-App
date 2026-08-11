// src/services/navigationService.js
import { Linking, Platform, Alert } from 'react-native';

export const navigationService = {
  /**
   * Opens Google Maps for Turn-by-Turn Navigation
   * @param {{ lat?: number, lng?: number, address?: string }} destination
   */
  openGoogleMaps({ lat, lng, address }) {
    let url = '';
    const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat) !== 0;

    if (hasCoords) {
      url = Platform.select({
        ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
        android: `google.navigation:q=${lat},${lng}`
      });
    } else if (address) {
      const encoded = encodeURIComponent(address);
      url = Platform.select({
        ios: `comgooglemaps://?daddr=${encoded}&directionsmode=driving`,
        android: `google.navigation:q=${encoded}`
      });
    }

    const fallbackUrl = hasCoords 
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || '')}&travelmode=driving`;

    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(fallbackUrl);
        }
      }).catch(() => Linking.openURL(fallbackUrl));
    } else {
      Linking.openURL(fallbackUrl);
    }
  },

  /**
   * Opens Waze for Turn-by-Turn Navigation
   * @param {{ lat?: number, lng?: number, address?: string }} destination
   */
  openWaze({ lat, lng, address }) {
    let url = '';
    const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat) !== 0;

    if (hasCoords) {
      url = `waze://?ll=${lat},${lng}&navigate=yes`;
    } else if (address) {
      const encoded = encodeURIComponent(address);
      url = `waze://?q=${encoded}&navigate=yes`;
    }

    const fallbackUrl = hasCoords
      ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(address || '')}&navigate=yes`;

    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(fallbackUrl);
        }
      }).catch(() => Linking.openURL(fallbackUrl));
    } else {
      Linking.openURL(fallbackUrl);
    }
  },

  /**
   * Opens Apple Maps (iOS Native)
   * @param {{ lat?: number, lng?: number, address?: string }} destination
   */
  openAppleMaps({ lat, lng, address }) {
    const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat) !== 0;
    const url = hasCoords
      ? `maps:?daddr=${lat},${lng}&dirflg=d`
      : `maps:?daddr=${encodeURIComponent(address || '')}&dirflg=d`;

    Linking.openURL(url).catch((err) => {
      console.error('Could not open Apple Maps:', err);
      Alert.alert('Error', 'Unable to open Apple Maps on this device.');
    });
  }
};
