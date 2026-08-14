import { detectNearestBarangay, formatAddress, PUERTO_PRINCESA_BARANGAYS } from '../../utils/location';

describe('Puerto Princesa Location Utilities', () => {
  it('contains essential Puerto Princesa barangays', () => {
    const names = PUERTO_PRINCESA_BARANGAYS.map(b => b.name);
    expect(names).toContain('San Pedro');
    expect(names).toContain('San Jose');
    expect(names).toContain('Tiniguiban');
    expect(names).toContain('San Miguel');
    expect(names).toContain('Santa Monica');
    expect(names).toContain('Bancao-Bancao');
  });

  it('detects barangay by text alias', () => {
    expect(detectNearestBarangay(null, null, 'National Highway near Petron San Pedro')).toBe('San Pedro');
    expect(detectNearestBarangay(null, null, 'Palawan State University Tiniguiban')).toBe('Tiniguiban');
    expect(detectNearestBarangay(null, null, 'New Market San Jose Terminal')).toBe('San Jose');
  });

  it('detects barangay by spatial proximity coordinates', () => {
    // Exact San Pedro coordinates
    expect(detectNearestBarangay(9.7535, 118.7479)).toBe('San Pedro');
    // Near San Miguel Airport
    expect(detectNearestBarangay(9.7460, 118.7520)).toBe('San Miguel');
    // Near Santa Monica / City Hall
    expect(detectNearestBarangay(9.7890, 118.7360)).toBe('Santa Monica');
  });

  it('formats clean Philippine address with verified Barangay', () => {
    const mockAddr = {
      name: 'Petron Station',
      street: 'National Highway',
      district: 'San Pedro',
      postalCode: '5300'
    };

    const formatted = formatAddress(mockAddr, 9.7535, 118.7479);
    expect(formatted).toContain('Petron Station');
    expect(formatted).toContain('National Highway');
    expect(formatted).toContain('Brgy. San Pedro');
    expect(formatted).toContain('Puerto Princesa City');
    expect(formatted).toContain('Palawan');
  });
});
