jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { isWithinServiceArea, DEFAULT_STORE_LOCATION } from '../../utils/riderLocation';

describe('Petron riderLocation utilities', () => {
  describe('DEFAULT_STORE_LOCATION', () => {
    it('is configured with exact Petron San Pedro Hub coordinates in Puerto Princesa', () => {
      expect(DEFAULT_STORE_LOCATION.latitude).toBeCloseTo(9.753477, 4);
      expect(DEFAULT_STORE_LOCATION.longitude).toBeCloseTo(118.747868, 4);
      expect(DEFAULT_STORE_LOCATION.name).toBe('Petron San Pedro Hub');
    });
  });

  describe('isWithinServiceArea', () => {
    it('returns true for locations within Puerto Princesa City service area', () => {
      // Petron San Pedro station
      expect(isWithinServiceArea(9.7534772, 118.7478688)).toBe(true);
      // Brgy Tagumpay / Downtown
      expect(isWithinServiceArea(9.739197, 118.741160)).toBe(true);
      // Brgy Bancao-Bancao
      expect(isWithinServiceArea(9.732000, 118.745000)).toBe(true);
      // SM City Puerto Princesa
      expect(isWithinServiceArea(9.743330, 118.739730)).toBe(true);
    });

    it('returns false for locations outside Puerto Princesa service area (e.g. Laguna / Manila)', () => {
      // San Pedro, Laguna
      expect(isWithinServiceArea(14.36, 121.03)).toBe(false);
      // Manila
      expect(isWithinServiceArea(14.5995, 120.9842)).toBe(false);
      // Cebu
      expect(isWithinServiceArea(10.3157, 123.8854)).toBe(false);
    });
  });
});
