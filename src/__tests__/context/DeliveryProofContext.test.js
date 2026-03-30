jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}), { virtual: true });

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn(),
}));

import React, { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockFrom = jest.fn();
const mockStorageFrom = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

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
    storage: {
      from: (...args) => mockStorageFrom(...args),
    },
  },
}));

describe('DeliveryProofContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.user = { id: 'user-123', email: 'test@example.com' };

    mockStorageFrom.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });

    mockUpload.mockResolvedValue({ data: { path: 'delivery_proofs/1.jpg' }, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/proof.jpg' } });
  });

  it('uploads delivery proof photo and returns public URL', async () => {
    const FileSystem = require('expo-file-system/legacy');
    const { decode } = require('base64-arraybuffer');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    FileSystem.readAsStringAsync.mockResolvedValue('BASE64_DATA');
    decode.mockReturnValue('BUFFER_DATA');

    const { DeliveryProofProvider, useDeliveryProof } = require('../../context/DeliveryProofContext');
    let result = null;

    const Probe = () => {
      const { uploadProofPhoto } = useDeliveryProof();

      useEffect(() => {
        const run = async () => {
          result = await uploadProofPhoto('file:///tmp/proof.jpg', 'delivery-1');
        };
        run();
      }, [uploadProofPhoto]);

      return <></>;
    };

    render(
      <DeliveryProofProvider>
        <Probe />
      </DeliveryProofProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });

    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('file:///tmp/proof.jpg', {
      encoding: 'base64',
    });
    expect(decode).toHaveBeenCalledWith('BASE64_DATA');
    expect(mockUpload).toHaveBeenCalledWith(
      'delivery_proofs/delivery-1_1700000000000.jpg',
      'BUFFER_DATA',
      {
        contentType: 'image/jpeg',
        upsert: false,
      }
    );
    expect(result).toEqual({ success: true, photoUrl: 'https://cdn.test/proof.jpg' });

    nowSpy.mockRestore();
  }, 15000);

  it('saves delivery proof after delivery/order lookup', async () => {
    const deliverySingle = jest.fn().mockResolvedValue({
      data: { id: 'delivery-1', rider_id: 'rider-1', order_id: 'order-1' },
      error: null,
    });
    const orderSingle = jest.fn().mockResolvedValue({
      data: { id: 'order-1', rider_id: 'rider-1' },
      error: null,
    });
    const insertSingle = jest.fn().mockResolvedValue({
      data: { id: 'proof-1', delivery_id: 'delivery-1' },
      error: null,
    });

    mockFrom.mockImplementation((table) => {
      if (table === 'deliveries') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ single: deliverySingle }),
          }),
        };
      }

      if (table === 'orders') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ single: orderSingle }),
          }),
        };
      }

      if (table === 'delivery_proofs') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ single: insertSingle }),
          }),
        };
      }

      return {};
    });

    const { DeliveryProofProvider, useDeliveryProof } = require('../../context/DeliveryProofContext');
    let result = null;

    const Probe = () => {
      const { saveDeliveryProof } = useDeliveryProof();

      useEffect(() => {
        const run = async () => {
          result = await saveDeliveryProof({
            delivery_id: 'delivery-1',
            photo_url: 'https://cdn.test/proof.jpg',
            signature_data: 'sig-data',
            recipient_name: 'John Receiver',
            notes: 'Left at gate',
          });
        };
        run();
      }, [saveDeliveryProof]);

      return <></>;
    };

    render(
      <DeliveryProofProvider>
        <Probe />
      </DeliveryProofProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('proof-1');
  }, 15000);

  it('returns null when proof is not found', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    });

    const { DeliveryProofProvider, useDeliveryProof } = require('../../context/DeliveryProofContext');
    let result = undefined;

    const Probe = () => {
      const { getProofByDeliveryId } = useDeliveryProof();

      useEffect(() => {
        const run = async () => {
          result = await getProofByDeliveryId('delivery-404');
        };
        run();
      }, [getProofByDeliveryId]);

      return <></>;
    };

    render(
      <DeliveryProofProvider>
        <Probe />
      </DeliveryProofProvider>
    );

    await waitFor(() => expect(result).not.toBeUndefined(), { timeout: 15000 });
    expect(result).toBeNull();
  }, 15000);

  it('updates delivery proof for authenticated user', async () => {
    const updated = { id: 'proof-1', recipient_name: 'Updated Receiver' };

    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: updated, error: null }),
          }),
        }),
      }),
    });

    const { DeliveryProofProvider, useDeliveryProof } = require('../../context/DeliveryProofContext');
    let result = null;

    const Probe = () => {
      const { updateDeliveryProof } = useDeliveryProof();

      useEffect(() => {
        const run = async () => {
          result = await updateDeliveryProof('proof-1', {
            photo_url: 'https://cdn.test/new-proof.jpg',
            signature_data: 'new-signature',
            recipient_name: 'Updated Receiver',
            notes: 'Handled personally',
          });
        };
        run();
      }, [updateDeliveryProof]);

      return <></>;
    };

    render(
      <DeliveryProofProvider>
        <Probe />
      </DeliveryProofProvider>
    );

    await waitFor(() => expect(result).not.toBeNull(), { timeout: 15000 });
    expect(result).toEqual({ success: true, data: updated });
  }, 15000);

  it('rejects upload/update/save when unauthenticated', async () => {
    mockAuthState.user = null;

    const { DeliveryProofProvider, useDeliveryProof } = require('../../context/DeliveryProofContext');
    const state = { upload: null, save: null, update: null };

    const Probe = () => {
      const { uploadProofPhoto, saveDeliveryProof, updateDeliveryProof } = useDeliveryProof();

      useEffect(() => {
        const run = async () => {
          state.upload = await uploadProofPhoto('file:///tmp/p.jpg', 'delivery-1');
          state.save = await saveDeliveryProof({ delivery_id: 'delivery-1' });
          state.update = await updateDeliveryProof('proof-1', {});
        };
        run();
      }, [uploadProofPhoto, saveDeliveryProof, updateDeliveryProof]);

      return <></>;
    };

    render(
      <DeliveryProofProvider>
        <Probe />
      </DeliveryProofProvider>
    );

    await waitFor(() => expect(state.update).not.toBeNull(), { timeout: 15000 });
    expect(state.upload).toEqual({ success: false, error: 'Not authenticated' });
    expect(state.save).toEqual({ success: false, error: 'Not authenticated' });
    expect(state.update).toEqual({ success: false, error: 'Not authenticated' });
  }, 15000);

  it('throws when hook is used outside provider', () => {
    const { useDeliveryProof } = require('../../context/DeliveryProofContext');

    const BadProbe = () => {
      useDeliveryProof();
      return <></>;
    };

    expect(() => render(<BadProbe />)).toThrow(
      'useDeliveryProof must be used within a DeliveryProofProvider'
    );
  });
});
