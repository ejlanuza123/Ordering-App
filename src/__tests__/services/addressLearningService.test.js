// src/__tests__/services/addressLearningService.test.js
// Petron San Pedro App

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args) => mockGetItem(...args),
  setItem: (...args) => mockSetItem(...args),
}));

const mockFrom = jest.fn();
const mockLimit = jest.fn();
const mockOrder = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockAuthGetUser = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    auth: {
      getUser: (...args) => mockAuthGetUser(...args),
    },
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AddressLearningService.getLearnedCorrection', () => {
  let service;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    mockGetItem.mockResolvedValue(null);
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    const mod = require('../../services/addressLearningService');
    service = mod.addressLearningService;
    await new Promise((r) => setTimeout(r, 20)); // let init() settle
  });

  it('returns null when cache is empty', () => {
    const result = service.getLearnedCorrection(14.35, 121.03);
    expect(result).toBeNull();
  });

  it('returns null for invalid/null coordinates', () => {
    expect(service.getLearnedCorrection(null, null)).toBeNull();
    expect(service.getLearnedCorrection(NaN, NaN)).toBeNull();
    expect(service.getLearnedCorrection(undefined, undefined)).toBeNull();
  });

  it('returns a matched correction when within threshold (~120m)', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await service.registerCorrection({
      latitude: 14.3500,
      longitude: 121.0300,
      barangay: 'San Vicente',
      street: 'Main',
      landmark: 'Park',
      fullAddress: 'San Vicente, San Pedro',
    });

    const result = service.getLearnedCorrection(14.3501, 121.0301);
    expect(result).not.toBeNull();
    expect(result.barangay).toBe('San Vicente');
  });

  it('registers and retrieves a learned address correction for nearby coordinates', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'test-user' } } });
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const lat = 9.7450;
    const lng = 118.7410;

    await service.registerCorrection({
      latitude: lat,
      longitude: lng,
      barangay: 'Maningning',
      street: 'Burgos Street',
      landmark: 'Beside Market',
      fullAddress: 'Burgos Street, Brgy. Maningning, Puerto Princesa City, Palawan',
    });

    const exact = service.getLearnedCorrection(lat, lng);
    expect(exact).not.toBeNull();
    expect(exact.barangay).toBe('Maningning');
    expect(exact.street).toBe('Burgos Street');

    const nearby = service.getLearnedCorrection(lat + 0.0003, lng + 0.0003);
    expect(nearby).not.toBeNull();
    expect(nearby.barangay).toBe('Maningning');
  });

  it('returns null when the nearest point is beyond the threshold', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await service.registerCorrection({
      latitude: 14.3500,
      longitude: 121.0300,
      barangay: 'San Vicente',
      street: '',
      landmark: '',
      fullAddress: '',
    });

    // 0.5 deg away — way beyond 0.0012 threshold
    const result = service.getLearnedCorrection(14.85, 121.53);
    expect(result).toBeNull();

    // Also test the original far-away case
    const far = service.getLearnedCorrection(9.7750, 118.7480);
    expect(far).toBeNull();
  });
});

describe('AddressLearningService.registerCorrection', () => {
  let service;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    mockInsert.mockResolvedValue({ error: null });

    const mod = require('../../services/addressLearningService');
    service = mod.addressLearningService;
    await new Promise((r) => setTimeout(r, 20));
  });

  it('does nothing when required fields are missing', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    await service.registerCorrection({ latitude: null, longitude: null, barangay: null });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('saves correction to AsyncStorage', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    await service.registerCorrection({
      latitude: 14.35,
      longitude: 121.03,
      barangay: 'Del Remedio',
      street: 'A',
      landmark: 'B',
      fullAddress: 'Del Remedio, San Pedro',
    });
    expect(mockSetItem).toHaveBeenCalled();
  });

  it('inserts correction into Supabase', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    await service.registerCorrection({
      latitude: 14.35,
      longitude: 121.03,
      barangay: 'Cuyab',
      street: 'Rizal St',
      landmark: 'Church',
      fullAddress: 'Cuyab, San Pedro',
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 14.35,
        longitude: 121.03,
        barangay: 'Cuyab',
      })
    );
  });

  it('updates existing correction in cache when within proximity', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });

    await service.registerCorrection({
      latitude: 14.35,
      longitude: 121.03,
      barangay: 'OldBarangay',
      street: '',
      landmark: '',
      fullAddress: '',
    });

    // Same location within 0.0003 deg — should update in-place
    await service.registerCorrection({
      latitude: 14.3501,
      longitude: 121.0301,
      barangay: 'UpdatedBarangay',
      street: '',
      landmark: '',
      fullAddress: '',
    });

    const result = service.getLearnedCorrection(14.35, 121.03);
    expect(result.barangay).toBe('UpdatedBarangay');
  });

  it('continues gracefully when Supabase insert fails', async () => {
    mockFrom.mockReturnValue({ insert: jest.fn().mockRejectedValue(new Error('supabase error')) });
    await expect(
      service.registerCorrection({
        latitude: 14.35, longitude: 121.03, barangay: 'Test',
        street: '', landmark: '', fullAddress: '',
      })
    ).resolves.toBeUndefined();
  });
});
