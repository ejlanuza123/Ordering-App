describe('mobile supabase client config', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('throws when required env credentials are missing', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(),
    }));

    jest.doMock('@react-native-async-storage/async-storage', () => ({}));

    expect(() => {
      jest.isolateModules(() => {
        require('./supabase');
      });
    }).toThrow('Missing Supabase credentials');
  });

  it('creates a supabase client when env credentials are present', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    const createClient = jest.fn(() => ({ auth: {} }));

    jest.doMock('@supabase/supabase-js', () => ({ createClient }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({ name: 'AsyncStorageMock' }));

    jest.isolateModules(() => {
      const mod = require('./supabase');
      expect(mod.supabase).toBeTruthy();
    });

    expect(createClient).toHaveBeenCalledWith(
      'https://demo.supabase.co',
      'anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        }),
      })
    );
  });
});
