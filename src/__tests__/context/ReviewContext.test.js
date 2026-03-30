jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

import React, { useEffect, useState } from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockFrom = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

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
    channel: (...args) => mockChannel(...args),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}));

describe('ReviewContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.user = { id: 'user-123', email: 'test@example.com' };
  });

  it('should get product rating with count', async () => {
    const mockRatings = [
      { rating: 5 },
      { rating: 4 },
      { rating: 4 }
    ];

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: mockRatings, error: null })
      })
    });

    const { ReviewProvider, useReviews } = require('../../context/ReviewContext');
    let result = null;

    const TestComponent = () => {
      const { getProductRating } = useReviews();
      const [rating, setRating] = useState(null);

      useEffect(() => {
        const fetch = async () => {
          const res = await getProductRating('product-1');
          setRating(res);
          result = res;
        };
        fetch();
      }, [getProductRating]);

      return <></>;
    };

    render(
      <ReviewProvider>
        <TestComponent />
      </ReviewProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result.average).toBe(4.3);
    expect(result.count).toBe(3);
  }, 15000);

  it('should get product reviews with profile info', async () => {
    const mockReviews = [
      {
        id: 'review-1',
        rating: 5,
        comment: 'Great product',
        created_at: '2026-03-30T00:00:00Z',
        profiles: { full_name: 'John Doe' }
      },
      {
        id: 'review-2',
        rating: 4,
        comment: 'Good quality',
        created_at: '2026-03-29T00:00:00Z',
        profiles: { full_name: 'Jane Smith' }
      }
    ];

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: mockReviews, error: null })
          })
        })
      })
    });

    const { ReviewProvider, useReviews } = require('../../context/ReviewContext');
    let reviews = null;

    const TestComponent = () => {
      const { getProductReviews } = useReviews();
      const [result, setResult] = useState(null);

      useEffect(() => {
        const fetch = async () => {
          const res = await getProductReviews('product-1', 10);
          setResult(res);
          reviews = res;
        };
        fetch();
      }, [getProductReviews]);

      return <></>;
    };

    render(
      <ReviewProvider>
        <TestComponent />
      </ReviewProvider>
    );

    await waitFor(() => expect(reviews).not.toBeNull(), { timeout: 15000 });
    expect(reviews).toHaveLength(2);
    expect(reviews[0].profiles.full_name).toBe('John Doe');
    expect(reviews[0].rating).toBe(5);
  }, 15000);

  it('should add review for authenticated user', async () => {
    const mockNewReview = {
      id: 'review-new',
      product_id: 'product-1',
      user_id: 'user-123',
      rating: 5,
      comment: 'Excellent quality'
    };

    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockNewReview, error: null })
        })
      })
    });

    const { ReviewProvider, useReviews } = require('../../context/ReviewContext');
    let result = null;

    const TestComponent = () => {
      const { addReview } = useReviews();
      const [res, setRes] = useState(null);

      useEffect(() => {
        const add = async () => {
          const response = await addReview('product-1', 5, 'Excellent quality');
          setRes(response);
          result = response;
        };
        add();
      }, [addReview]);

      return <></>;
    };

    render(
      <ReviewProvider>
        <TestComponent />
      </ReviewProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result.success).toBe(true);
    expect(result.data.rating).toBe(5);
  }, 15000);

  it('should reject add review for unauthenticated user', async () => {
    mockAuthState.user = null;

    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: {}, error: null })
        })
      })
    });

    const { ReviewProvider, useReviews } = require('../../context/ReviewContext');
    let result = null;

    const TestComponent = () => {
      const { addReview } = useReviews();
      const [res, setRes] = useState(null);

      useEffect(() => {
        const add = async () => {
          const response = await addReview('product-1', 5, 'Comment');
          setRes(response);
          result = response;
        };
        add();
      }, [addReview]);

      return <></>;
    };

    render(
      <ReviewProvider>
        <TestComponent />
      </ReviewProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  }, 15000);

  it('should update review for authenticated user', async () => {
    const updatedReview = {
      id: 'review-1',
      rating: 4,
      comment: 'Updated comment'
    };

    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: updatedReview, error: null })
            })
          })
        })
      })
    });

    const { ReviewProvider, useReviews } = require('../../context/ReviewContext');
    let result = null;

    const TestComponent = () => {
      const { updateReview } = useReviews();

      useEffect(() => {
        const run = async () => {
          result = await updateReview('review-1', 4, 'Updated comment');
        };
        run();
      }, [updateReview]);

      return <></>;
    };

    render(
      <ReviewProvider>
        <TestComponent />
      </ReviewProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result.success).toBe(true);
    expect(result.data.rating).toBe(4);
  }, 15000);

  it('should delete review for authenticated user', async () => {
    const eqUser = jest.fn().mockResolvedValue({ error: null });
    const eqId = jest.fn().mockReturnValue({ eq: eqUser });
    const del = jest.fn().mockReturnValue({ eq: eqId });

    mockFrom.mockReturnValue({ delete: del });

    const { ReviewProvider, useReviews } = require('../../context/ReviewContext');
    let result = null;

    const TestComponent = () => {
      const { deleteReview } = useReviews();

      useEffect(() => {
        const run = async () => {
          result = await deleteReview('review-1');
        };
        run();
      }, [deleteReview]);

      return <></>;
    };

    render(
      <ReviewProvider>
        <TestComponent />
      </ReviewProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result).toEqual({ success: true });
    expect(eqId).toHaveBeenCalledWith('id', 'review-1');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-123');
  }, 15000);

  it('should check if user reviewed product and return user review', async () => {
    let singleCall = 0;
    const single = jest.fn().mockImplementation(() => {
      singleCall += 1;
      if (singleCall === 1) {
        return Promise.resolve({ data: { id: 'review-1' }, error: null });
      }
      return Promise.resolve({
        data: { id: 'review-1', rating: 5, comment: 'Great' },
        error: null,
      });
    });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single,
          })
        })
      })
    });

    const { ReviewProvider, useReviews } = require('../../context/ReviewContext');
    const state = { hasReviewed: null, review: undefined };

    const TestComponent = () => {
      const { hasUserReviewed, getUserReview } = useReviews();

      useEffect(() => {
        const run = async () => {
          state.hasReviewed = await hasUserReviewed('product-1');
          state.review = await getUserReview('product-1');
        };
        run();
      }, [hasUserReviewed, getUserReview]);

      return <></>;
    };

    render(
      <ReviewProvider>
        <TestComponent />
      </ReviewProvider>
    );

    await waitFor(() => expect(state.review).not.toBeUndefined(), { timeout: 15000 });
    expect(state.hasReviewed).toBe(true);
    expect(state.review).toEqual({ id: 'review-1', rating: 5, comment: 'Great' });
  }, 15000);

  it('should return empty list when unauthenticated user requests user reviews', async () => {
    mockAuthState.user = null;

    const { ReviewProvider, useReviews } = require('../../context/ReviewContext');
    let result;

    const TestComponent = () => {
      const { getUserReviews } = useReviews();

      useEffect(() => {
        const run = async () => {
          result = await getUserReviews();
        };
        run();
      }, [getUserReviews]);

      return <></>;
    };

    render(
      <ReviewProvider>
        <TestComponent />
      </ReviewProvider>
    );

    await waitFor(() => expect(result).toBeDefined(), { timeout: 15000 });
    expect(result).toEqual([]);
  }, 15000);

  it('should load user reviews for authenticated user', async () => {
    const rows = [
      { id: 'review-1', rating: 5, products: { name: 'Diesel', image_url: 'img1.jpg' } },
      { id: 'review-2', rating: 4, products: { name: 'Oil', image_url: 'img2.jpg' } }
    ];

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: rows, error: null })
        })
      })
    });

    const { ReviewProvider, useReviews } = require('../../context/ReviewContext');
    let result;

    const TestComponent = () => {
      const { getUserReviews } = useReviews();

      useEffect(() => {
        const run = async () => {
          result = await getUserReviews();
        };
        run();
      }, [getUserReviews]);

      return <></>;
    };

    render(
      <ReviewProvider>
        <TestComponent />
      </ReviewProvider>
    );

    await waitFor(() => expect(result).toBeDefined(), { timeout: 15000 });
    expect(result).toHaveLength(2);
    expect(result[0].products.name).toBe('Diesel');
  }, 15000);

  it('should throw error when useReviews used outside provider', () => {
    const { useReviews } = require('../../context/ReviewContext');

    const TestComponent = () => {
      useReviews();
      return <></>;
    };

    expect(() => render(<TestComponent />)).toThrow(
      'useReviews must be used within a ReviewProvider'
    );
  });
});
