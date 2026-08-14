import { 
  detectNearestBarangay, 
  formatAddress, 
  searchPuertoPrincesaPlaces, 
  PUERTO_PRINCESA_BARANGAYS,
  PUERTO_PRINCESA_LANDMARKS 
} from '../../utils/location';

describe('Puerto Princesa Location Utilities', () => {
  it('contains essential Puerto Princesa barangays and landmarks', () => {
    const names = PUERTO_PRINCESA_BARANGAYS.map(b => b.name);
    expect(names).toContain('San Pedro');
    expect(names).toContain('San Jose');
    expect(names).toContain('Tiniguiban');
    expect(names).toContain('San Miguel');
    expect(names).toContain('Santa Monica');
    expect(names).toContain('Bancao-Bancao');

    const landmarkNames = PUERTO_PRINCESA_LANDMARKS.map(l => l.name);
    expect(landmarkNames).toContain('Puerto Princesa City Coliseum');
    expect(landmarkNames).toContain('SM City Puerto Princesa');
    expect(landmarkNames).toContain('NCCC Mall Palawan');
    expect(landmarkNames).toContain('Robinsons Place Palawan');
  });

  it('searches and lists matching landmarks and barangays accurately', () => {
    // Search "coliseum"
    const coliseumResults = searchPuertoPrincesaPlaces('coliseum');
    expect(coliseumResults.length).toBeGreaterThan(0);
    expect(coliseumResults[0].name).toContain('City Coliseum');
    expect(coliseumResults[0].barangay).toBe('Tiniguiban');

    // Search "NCCC"
    const ncccResults = searchPuertoPrincesaPlaces('nccc');
    expect(ncccResults.some(r => r.name.includes('NCCC Mall'))).toBe(true);

    // Search "SM"
    const smResults = searchPuertoPrincesaPlaces('sm');
    expect(smResults.some(r => r.name.includes('SM City'))).toBe(true);

    // Search "hospital"
    const hospitalResults = searchPuertoPrincesaPlaces('hospital');
    expect(hospitalResults.length).toBeGreaterThan(0);

    // Search "san miguel"
    const sanMiguelResults = searchPuertoPrincesaPlaces('san miguel');
    expect(sanMiguelResults.some(r => r.barangay === 'San Miguel')).toBe(true);
  });

  it('detects barangay by text alias', () => {
    expect(detectNearestBarangay(null, null, 'National Highway near Petron San Pedro')).toBe('San Pedro');
    expect(detectNearestBarangay(null, null, 'Palawan State University Tiniguiban')).toBe('Tiniguiban');
    expect(detectNearestBarangay(null, null, 'New Market San Jose Terminal')).toBe('San Jose');
  });

  it('detects barangay by spatial proximity coordinates', () => {
    expect(detectNearestBarangay(9.7535, 118.7479)).toBe('San Pedro');
    expect(detectNearestBarangay(9.7460, 118.7520)).toBe('San Miguel');
    expect(detectNearestBarangay(9.7450, 118.7410)).toBe('Maningning');
    expect(detectNearestBarangay(9.7890, 118.7360)).toBe('Santa Monica');
  });

  it('correctly identifies Barangay Maningning even when street is Rizal Ave', () => {
    expect(detectNearestBarangay(9.7450, 118.7410, 'Rizal Avenue')).toBe('Maningning');
    expect(detectNearestBarangay(9.7460, 118.7520, 'Rizal Avenue')).toBe('San Miguel');
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
