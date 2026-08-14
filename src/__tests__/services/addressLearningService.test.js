import { addressLearningService } from '../../services/addressLearningService';

describe('AddressLearningService (Self-Learning Geocoding Memory)', () => {
  it('registers and retrieves a learned address correction for nearby coordinates', async () => {
    const lat = 9.7450;
    const lng = 118.7410;

    await addressLearningService.registerCorrection({
      latitude: lat,
      longitude: lng,
      barangay: 'Maningning',
      street: 'Burgos Street',
      landmark: 'Beside Market',
      fullAddress: 'Burgos Street, Brgy. Maningning, Puerto Princesa City, Palawan'
    });

    // Exact coordinate query
    const exact = addressLearningService.getLearnedCorrection(lat, lng);
    expect(exact).not.toBeNull();
    expect(exact.barangay).toBe('Maningning');
    expect(exact.street).toBe('Burgos Street');

    // Nearby coordinate within ~50 meters (0.0004 deg)
    const nearby = addressLearningService.getLearnedCorrection(lat + 0.0003, lng + 0.0003);
    expect(nearby).not.toBeNull();
    expect(nearby.barangay).toBe('Maningning');
  });

  it('does not match coordinates far outside the threshold radius', () => {
    // 5 km away in San Jose
    const far = addressLearningService.getLearnedCorrection(9.7750, 118.7480);
    expect(far).toBeNull();
  });
});
