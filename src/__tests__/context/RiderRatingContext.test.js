import React, { useEffect, useState } from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockFrom = jest.fn();

const mockAuthState = () => ({
  user: mockAuthState.user,
});

mockAuthState.user = { id: 'user-123', email: 'test@example.com' };

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthState(),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

describe('RiderRatingContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.user = { id: 'user-123', email: 'test@example.com' };
  });

  it('gets rider rating average and count', async () => {
    const ratings = [{ rating: 5 }, { rating: 4 }, { rating: 4 }];

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: ratings, error: null }),
      }),
    });

    const { RiderRatingProvider, useRiderRatings } = require('../../context/RiderRatingContext');
    let result = null;

    const Probe = () => {
      const { getRiderRating } = useRiderRatings();
      const [state, setState] = useState(null);

      useEffect(() => {
        const load = async () => {
          const res = await getRiderRating('rider-1');
          setState(res);
          result = res;
        };
        load();
      }, [getRiderRating]);

      return <></>;
    };

    render(
      <RiderRatingProvider>
        <Probe />
      </RiderRatingProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result).toEqual({ average: 4.3, count: 3 });
  }, 15000);

  it('gets rider ratings with profile data', async () => {
    const rows = [
      {
        id: 'rr-1',
        rating: 5,
        comment: 'Great rider',
        profiles: { full_name: 'Alex Doe' },
      },
      {
        id: 'rr-2',
        rating: 4,
        comment: 'Good service',
        profiles: { full_name: 'Sam Poe' },
      },
    ];

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      }),
    });

    const { RiderRatingProvider, useRiderRatings } = require('../../context/RiderRatingContext');
    let result = null;

    const Probe = () => {
      const { getRiderRatings } = useRiderRatings();

      useEffect(() => {
        const load = async () => {
          result = await getRiderRatings('rider-1', 10);
        };
        load();
      }, [getRiderRatings]);

      return <></>;
    };

    render(
      <RiderRatingProvider>
        <Probe />
      </RiderRatingProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result).toHaveLength(2);
    expect(result[0].profiles.full_name).toBe('Alex Doe');
  }, 15000);

  it('rates rider for authenticated user', async () => {
    const inserted = {
      id: 'rr-new',
      rider_id: 'rider-1',
      user_id: 'user-123',
      delivery_id: 'delivery-1',
      rating: 5,
      comment: 'Excellent',
    };

    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: inserted, error: null }),
        }),
      }),
    });

    const { RiderRatingProvider, useRiderRatings } = require('../../context/RiderRatingContext');
    let result = null;

    const Probe = () => {
      const { rateRider } = useRiderRatings();

      useEffect(() => {
        const run = async () => {
          result = await rateRider('rider-1', 'delivery-1', 5, 'Excellent');
        };
        run();
      }, [rateRider]);

      return <></>;
    };

    render(
      <RiderRatingProvider>
        <Probe />
      </RiderRatingProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('rr-new');
  }, 15000);

  it('rejects rating when unauthenticated', async () => {
    mockAuthState.user = null;

    const { RiderRatingProvider, useRiderRatings } = require('../../context/RiderRatingContext');
    let result = null;

    const Probe = () => {
      const { rateRider } = useRiderRatings();

      useEffect(() => {
        const run = async () => {
          result = await rateRider('rider-1', 'delivery-1', 5, 'Excellent');
        };
        run();
      }, [rateRider]);

      return <></>;
    };

    render(
      <RiderRatingProvider>
        <Probe />
      </RiderRatingProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result).toEqual({ success: false, error: 'Not authenticated' });
  }, 15000);

  it('computes rider stats distribution', async () => {
    const ratings = [
      { rating: 5 },
      { rating: 5 },
      { rating: 4 },
      { rating: 3 },
      { rating: 1 },
    ];

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: ratings, error: null }),
      }),
    });

    const { RiderRatingProvider, useRiderRatings } = require('../../context/RiderRatingContext');
    let result = null;

    const Probe = () => {
      const { getRiderStats } = useRiderRatings();

      useEffect(() => {
        const run = async () => {
          result = await getRiderStats('rider-1');
        };
        run();
      }, [getRiderStats]);

      return <></>;
    };

    render(
      <RiderRatingProvider>
        <Probe />
      </RiderRatingProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result.totalRatings).toBe(5);
    expect(result.averageRating).toBe(3.6);
    expect(result.fiveStars).toBe(2);
    expect(result.fourStars).toBe(1);
    expect(result.threeStars).toBe(1);
    expect(result.twoStars).toBe(0);
    expect(result.oneStar).toBe(1);
  }, 15000);

  it('updates rating for authenticated user', async () => {
    const updated = {
      id: 'rr-1',
      rating: 4,
      comment: 'Updated feedback',
    };

    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: updated, error: null }),
            }),
          }),
        }),
      }),
    });

    const { RiderRatingProvider, useRiderRatings } = require('../../context/RiderRatingContext');
    let result = null;

    const Probe = () => {
      const { updateRating } = useRiderRatings();

      useEffect(() => {
        const run = async () => {
          result = await updateRating('rr-1', 4, 'Updated feedback');
        };
        run();
      }, [updateRating]);

      return <></>;
    };

    render(
      <RiderRatingProvider>
        <Probe />
      </RiderRatingProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result).toEqual({ success: true, data: updated });
  }, 15000);

  it('returns not authenticated for updateRating when user is missing', async () => {
    mockAuthState.user = null;

    const { RiderRatingProvider, useRiderRatings } = require('../../context/RiderRatingContext');
    let result = null;

    const Probe = () => {
      const { updateRating } = useRiderRatings();

      useEffect(() => {
        const run = async () => {
          result = await updateRating('rr-1', 4, 'Updated feedback');
        };
        run();
      }, [updateRating]);

      return <></>;
    };

    render(
      <RiderRatingProvider>
        <Probe />
      </RiderRatingProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result).toEqual({ success: false, error: 'Not authenticated' });
  }, 15000);

  it('checks hasUserRated and fetches getUserRating', async () => {
    let callCount = 0;
    const single = jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.resolve({ data: { id: 'rr-1' }, error: null });
      }

      return Promise.resolve({
        data: { id: 'rr-1', rating: 5, comment: 'Great service' },
        error: null,
      });
    });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ single }),
        }),
      }),
    });

    const { RiderRatingProvider, useRiderRatings } = require('../../context/RiderRatingContext');
    const state = { hasRated: null, rating: undefined };

    const Probe = () => {
      const { hasUserRated, getUserRating } = useRiderRatings();

      useEffect(() => {
        const run = async () => {
          state.hasRated = await hasUserRated('delivery-1');
          state.rating = await getUserRating('delivery-1');
        };
        run();
      }, [hasUserRated, getUserRating]);

      return <></>;
    };

    render(
      <RiderRatingProvider>
        <Probe />
      </RiderRatingProvider>
    );

    await waitFor(() => expect(state.rating).not.toBeUndefined(), { timeout: 15000 });
    expect(state.hasRated).toBe(true);
    expect(state.rating).toEqual({ id: 'rr-1', rating: 5, comment: 'Great service' });
  }, 15000);

  it('returns default values for unauthenticated hasUserRated/getUserRating', async () => {
    mockAuthState.user = null;

    const { RiderRatingProvider, useRiderRatings } = require('../../context/RiderRatingContext');
    const state = { hasRated: null, rating: undefined };

    const Probe = () => {
      const { hasUserRated, getUserRating } = useRiderRatings();

      useEffect(() => {
        const run = async () => {
          state.hasRated = await hasUserRated('delivery-1');
          state.rating = await getUserRating('delivery-1');
        };
        run();
      }, [hasUserRated, getUserRating]);

      return <></>;
    };

    render(
      <RiderRatingProvider>
        <Probe />
      </RiderRatingProvider>
    );

    await waitFor(() => expect(state.rating).not.toBeUndefined(), { timeout: 15000 });
    expect(state.hasRated).toBe(false);
    expect(state.rating).toBeNull();
  }, 15000);

  it('returns empty stats shape when rider has no ratings', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const { RiderRatingProvider, useRiderRatings } = require('../../context/RiderRatingContext');
    let result = null;

    const Probe = () => {
      const { getRiderStats } = useRiderRatings();

      useEffect(() => {
        const run = async () => {
          result = await getRiderStats('rider-empty');
        };
        run();
      }, [getRiderStats]);

      return <></>;
    };

    render(
      <RiderRatingProvider>
        <Probe />
      </RiderRatingProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result).toEqual({
      totalRatings: 0,
      averageRating: 0,
      fiveStars: 0,
      fourStars: 0,
      threeStars: 0,
      twoStars: 0,
      oneStar: 0,
    });
  }, 15000);

  it('throws when hook is used outside provider', () => {
    const { useRiderRatings } = require('../../context/RiderRatingContext');

    const BadProbe = () => {
      useRiderRatings();
      return <></>;
    };

    expect(() => render(<BadProbe />)).toThrow(
      'useRiderRatings must be used within a RiderRatingProvider'
    );
  });
});
