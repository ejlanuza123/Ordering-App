import { 
  detectNearestBarangay, 
  formatAddress, 
  searchPuertoPrincesaPlaces, 
  PUERTO_PRINCESA_BARANGAYS,
  PUERTO_PRINCESA_LANDMARKS 
} from '../../utils/location';

describe('Puerto Princesa Location Utilities - Verified Landmarks & Barangays', () => {
  it('contains all 16 user-specified landmarks with verified barangays and coordinates', () => {
    // 1. SM City Puerto Princesa -> San Miguel
    const sm = PUERTO_PRINCESA_LANDMARKS.find(l => l.name === 'SM City Puerto Princesa');
    expect(sm).toBeDefined();
    expect(sm.barangay).toBe('San Miguel');
    expect(sm.address).toContain('Malvar');
    expect(sm.lat).toBe(9.743330);
    expect(sm.lng).toBe(118.739730);

    // 2. Robinsons Place Palawan -> San Manuel
    const rob = PUERTO_PRINCESA_LANDMARKS.find(l => l.name === 'Robinsons Place Palawan');
    expect(rob).toBeDefined();
    expect(rob.barangay).toBe('San Manuel');
    expect(rob.lat).toBe(9.767098);
    expect(rob.lng).toBe(118.748170);

    // 3. NCCC Mall Palawan -> Tagumpay
    const nccc = PUERTO_PRINCESA_LANDMARKS.find(l => l.name === 'NCCC Mall Palawan');
    expect(nccc).toBeDefined();
    expect(nccc.barangay).toBe('Tagumpay');
    expect(nccc.address).toContain('Lacao');
    expect(nccc.lat).toBe(9.739197);
    expect(nccc.lng).toBe(118.741160);

    // 4. MCA Market Mall -> Tagumpay
    const mca = PUERTO_PRINCESA_LANDMARKS.find(l => l.name === 'MCA Market Mall');
    expect(mca).toBeDefined();
    expect(mca.barangay).toBe('Tagumpay');
    expect(mca.lat).toBe(9.746150);
    expect(mca.lng).toBe(118.746870);

    // 5. Edward S. Hagedorn Coliseum -> San Pedro
    const coliseum = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('Hagedorn'));
    expect(coliseum).toBeDefined();
    expect(coliseum.barangay).toBe('San Pedro');
    expect(coliseum.lat).toBe(9.754820);
    expect(coliseum.lng).toBe(118.748890);

    // 6. Mendoza Park -> Model
    const mendoza = PUERTO_PRINCESA_LANDMARKS.find(l => l.name === 'Mendoza Park');
    expect(mendoza).toBeDefined();
    expect(mendoza.barangay).toBe('Model');
    expect(mendoza.lat).toBe(9.740040);
    expect(mendoza.lng).toBe(118.737270);

    // 7. Plaza Cuartel -> Mabuhay
    const cuartel = PUERTO_PRINCESA_LANDMARKS.find(l => l.name === 'Plaza Cuartel');
    expect(cuartel).toBeDefined();
    expect(cuartel.barangay).toBe('Mabuhay');
    expect(cuartel.lat).toBe(9.739924);
    expect(cuartel.lng).toBe(118.729580);

    // 8. Puerto Princesa City Baywalk Park -> Matiyaga
    const baywalk = PUERTO_PRINCESA_LANDMARKS.find(l => l.name === 'Puerto Princesa City Baywalk Park');
    expect(baywalk).toBeDefined();
    expect(baywalk.barangay).toBe('Matiyaga');
    expect(baywalk.lat).toBe(9.743914);
    expect(baywalk.lng).toBe(118.731650);

    // 9. Palawan Provincial Capitol -> Santa Monica
    const capitol = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('Capitol'));
    expect(capitol).toBeDefined();
    expect(capitol.barangay).toBe('Santa Monica');
    expect(capitol.lat).toBe(9.739250);
    expect(capitol.lng).toBe(118.744040);

    // 10. Palawan Museum -> Tanglaw
    const museum = PUERTO_PRINCESA_LANDMARKS.find(l => l.name === 'Palawan Museum');
    expect(museum).toBeDefined();
    expect(museum.barangay).toBe('Tanglaw');
    expect(museum.lat).toBe(9.739670);
    expect(museum.lng).toBe(118.736970);

    // 11. Puerto Princesa International Airport -> San Miguel
    const airport = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('Airport'));
    expect(airport).toBeDefined();
    expect(airport.barangay).toBe('San Miguel');
    expect(airport.lat).toBe(9.742220);
    expect(airport.lng).toBe(118.758610);

    // 12. Palawan Wildlife Rescue & Conservation Center -> Irawan
    const croc = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('Wildlife Rescue'));
    expect(croc).toBeDefined();
    expect(croc.barangay).toBe('Irawan');
    expect(croc.lat).toBe(9.799230);
    expect(croc.lng).toBe(118.693720);

    // 13. Princess Eulalia Park -> Liwanag
    const eulalia = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('Eulalia'));
    expect(eulalia).toBeDefined();
    expect(eulalia.barangay).toBe('Liwanag');

    // 14. Immaculate Conception Cathedral -> Maligaya
    const cathedral = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('Cathedral'));
    expect(cathedral).toBeDefined();
    expect(cathedral.barangay).toBe('Maligaya');

    // 15. Special Battalion WWII Memorial Museum -> Model
    const wwii = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('WWII'));
    expect(wwii).toBeDefined();
    expect(wwii.barangay).toBe('Model');
    expect(wwii.lat).toBe(9.739040);
    expect(wwii.lng).toBe(118.736550);

    // 16. Puerto Princesa Old Public Market -> Tagumpay
    const market = PUERTO_PRINCESA_LANDMARKS.find(l => l.name.includes('Old Public Market'));
    expect(market).toBeDefined();
    expect(market.barangay).toBe('Tagumpay');
    expect(market.lat).toBe(9.7422666);
    expect(market.lng).toBe(118.7333285);
  });

  it('accurately detects barangay when pin-pointing at exact landmark coordinates', () => {
    // SM City -> San Miguel
    expect(detectNearestBarangay(9.743330, 118.739730)).toBe('San Miguel');

    // Robinsons -> San Manuel
    expect(detectNearestBarangay(9.767098, 118.748170)).toBe('San Manuel');

    // NCCC Mall Lacao -> Tagumpay
    expect(detectNearestBarangay(9.739197, 118.741160)).toBe('Tagumpay');

    // MCA Market Mall -> Tagumpay
    expect(detectNearestBarangay(9.746150, 118.746870)).toBe('Tagumpay');

    // Coliseum -> San Pedro
    expect(detectNearestBarangay(9.754820, 118.748890)).toBe('San Pedro');

    // Mendoza Park -> Model
    expect(detectNearestBarangay(9.740040, 118.737270)).toBe('Model');

    // Plaza Cuartel -> Mabuhay
    expect(detectNearestBarangay(9.739924, 118.729580)).toBe('Mabuhay');

    // Baywalk -> Matiyaga
    expect(detectNearestBarangay(9.743914, 118.731650)).toBe('Matiyaga');

    // Capitol -> Santa Monica
    expect(detectNearestBarangay(9.739250, 118.744040)).toBe('Santa Monica');

    // Palawan Museum -> Tanglaw
    expect(detectNearestBarangay(9.739670, 118.736970)).toBe('Tanglaw');

    // Airport -> San Miguel
    expect(detectNearestBarangay(9.742220, 118.758610)).toBe('San Miguel');

    // Crocodile Farm -> Irawan
    expect(detectNearestBarangay(9.799230, 118.693720)).toBe('Irawan');

    // WWII Museum -> Model
    expect(detectNearestBarangay(9.739040, 118.736550)).toBe('Model');
  });

  it('searches places by name, address, category, and aliases', () => {
    // Search by address
    const lacaoSearch = searchPuertoPrincesaPlaces('Lacao');
    expect(lacaoSearch.length).toBeGreaterThan(0);
    expect(lacaoSearch.some(r => r.name.includes('NCCC Mall') || r.name.includes('SM City'))).toBe(true);

    // Search by name
    const mendozaSearch = searchPuertoPrincesaPlaces('Mendoza');
    expect(mendozaSearch.some(r => r.barangay === 'Model')).toBe(true);

    // Search by alias
    const crocSearch = searchPuertoPrincesaPlaces('croc farm');
    expect(crocSearch.length).toBeGreaterThan(0);
    expect(crocSearch[0].barangay).toBe('Irawan');
  });

  it('formats clean address with accurate barangay detection', () => {
    const mockAddr = {
      name: 'SM City Mall',
      street: 'Malvar St.',
      district: '',
    };

    const formatted = formatAddress(mockAddr, 9.743330, 118.739730);
    expect(formatted).toContain('SM City Mall');
    expect(formatted).toContain('Malvar St.');
    expect(formatted).toContain('Brgy. San Miguel');
    expect(formatted).toContain('Puerto Princesa City');
    expect(formatted).toContain('Palawan');
  });
});
