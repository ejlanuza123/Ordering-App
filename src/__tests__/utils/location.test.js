import { 
  detectNearestBarangay, 
  formatAddress, 
  searchPuertoPrincesaPlaces, 
  PUERTO_PRINCESA_BARANGAYS,
  PUERTO_PRINCESA_LANDMARKS 
} from '../../utils/location';

describe('Puerto Princesa Location Utilities', () => {
  it('contains essential Puerto Princesa barangays and landmarks with verified GPS coordinates', () => {
    const names = PUERTO_PRINCESA_BARANGAYS.map(b => b.name);
    expect(names).toContain('San Pedro');
    expect(names).toContain('San Jose');
    expect(names).toContain('Tiniguiban');
    expect(names).toContain('San Miguel');
    expect(names).toContain('Santa Monica');
    expect(names).toContain('Bancao-Bancao');

    const coliseum = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('Coliseum'));
    expect(coliseum).toBeDefined();
    expect(coliseum.lat).toBe(9.75482);
    expect(coliseum.lng).toBe(118.74889);

    const baywalk = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('Baywalk'));
    expect(baywalk).toBeDefined();
    expect(baywalk.lat).toBe(9.74391);
    expect(baywalk.lng).toBe(118.73165);

    const mendozaPark = PUERTO_PRINCESA_LANDMARKS.find(l => l.name === 'Mendoza Park');
    expect(mendozaPark).toBeDefined();
    expect(mendozaPark.lat).toBe(9.74004);
    expect(mendozaPark.lng).toBe(118.73727);

    const plazaCuartel = PUERTO_PRINCESA_LANDMARKS.find(l => l.name === 'Plaza Cuartel');
    expect(plazaCuartel).toBeDefined();
    expect(plazaCuartel.lat).toBe(9.73980);
    expect(plazaCuartel.lng).toBe(118.72955);

    const capitol = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('Capitol'));
    expect(capitol).toBeDefined();
    expect(capitol.lat).toBe(9.73925);
    expect(capitol.lng).toBe(118.74404);

    const crocodileFarm = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('Crocodile Farm'));
    expect(crocodileFarm).toBeDefined();
    expect(crocodileFarm.lat).toBe(9.79923);
    expect(crocodileFarm.lng).toBe(118.69372);
  });

  it('searches and lists matching landmarks and barangays accurately', () => {
    // Search "coliseum"
    const coliseumResults = searchPuertoPrincesaPlaces('coliseum');
    expect(coliseumResults.length).toBeGreaterThan(0);
    expect(coliseumResults[0].name).toContain('Coliseum');

    // Search "hagedorn"
    const hagedornResults = searchPuertoPrincesaPlaces('hagedorn');
    expect(hagedornResults.length).toBeGreaterThan(0);
    expect(hagedornResults[0].name).toContain('Edward S. Hagedorn');

    // Search "crocodile"
    const crocResults = searchPuertoPrincesaPlaces('crocodile');
    expect(crocResults.length).toBeGreaterThan(0);
    expect(crocResults[0].lat).toBe(9.79923);

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
