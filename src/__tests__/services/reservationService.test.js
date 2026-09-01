// src/__tests__/services/reservationService.test.js

const mockScheduleReminder = jest.fn().mockResolvedValue(undefined);
const mockCancelReminder = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/mobileNotificationService', () => ({
  mobileNotificationService: {
    scheduleReservationReminder: (...args) => mockScheduleReminder(...args),
    cancelReservationReminder: (...args) => mockCancelReminder(...args),
  },
}));

const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockGte = jest.fn();
const mockLte = jest.fn();
const mockOrder = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

describe('reservationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── getReservedSlotsForDate ──────────────────────────────────────────────

  describe('getReservedSlotsForDate', () => {
    beforeEach(() => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });
    });

    it('queries the reservations table with status=reserved', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.getReservedSlotsForDate('2026-09-15');
      expect(mockFrom).toHaveBeenCalledWith('reservations');
      expect(mockEq).toHaveBeenCalledWith('status', 'reserved');
    });

    it('applies day-range gte/lte for the given date', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.getReservedSlotsForDate('2026-09-15');
      // Construct expected values the same way the service does (local-time → ISO)
      const expectedGte = new Date('2026-09-15T00:00:00').toISOString();
      const expectedLte = new Date('2026-09-15T23:59:59.999').toISOString();
      expect(mockGte.mock.calls[0][0]).toBe('scheduled_at');
      expect(mockGte.mock.calls[0][1]).toBe(expectedGte);
      expect(mockLte.mock.calls[0][0]).toBe('scheduled_at');
      expect(mockLte.mock.calls[0][1]).toBe(expectedLte);
    });

    it('returns data on success', async () => {
      const rows = [{ id: 'slot-1', scheduled_at: '2026-09-15T10:00:00Z' }];
      mockOrder.mockResolvedValue({ data: rows, error: null });
      const { reservationService } = require('../../services/reservationService');
      const result = await reservationService.getReservedSlotsForDate('2026-09-15');
      expect(result).toEqual(rows);
    });

    it('returns empty array when data is null', async () => {
      mockOrder.mockResolvedValue({ data: null, error: null });
      const { reservationService } = require('../../services/reservationService');
      const result = await reservationService.getReservedSlotsForDate('2026-09-15');
      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      mockOrder.mockResolvedValue({ data: null, error: new Error('slot query failed') });
      const { reservationService } = require('../../services/reservationService');
      await expect(reservationService.getReservedSlotsForDate('2026-09-15')).rejects.toThrow('slot query failed');
    });
  });

  // ─── getReservationsByMonth ────────────────────────────────────────────────

  describe('getReservationsByMonth', () => {
    beforeEach(() => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockLte.mockReturnValue({ order: mockOrder });
      mockGte.mockReturnValue({ lte: mockLte });
      mockEq.mockReturnValue({ gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });
    });

    it('applies month-start gte', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.getReservationsByMonth(new Date('2026-09-10'));
      const expectedStart = new Date(2026, 8, 1, 0, 0, 0, 0).toISOString();
      expect(mockGte.mock.calls[0][0]).toBe('scheduled_at');
      expect(mockGte.mock.calls[0][1]).toBe(expectedStart);
    });

    it('applies month-end lte', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.getReservationsByMonth(new Date('2026-09-10'));
      const expectedEnd = new Date(2026, 9, 0, 23, 59, 59, 999).toISOString(); // last day of Sep
      expect(mockLte.mock.calls[0][0]).toBe('scheduled_at');
      expect(mockLte.mock.calls[0][1]).toBe(expectedEnd);
    });

    it('throws on Supabase error', async () => {
      mockOrder.mockResolvedValue({ data: null, error: new Error('month failed') });
      const { reservationService } = require('../../services/reservationService');
      await expect(
        reservationService.getReservationsByMonth(new Date('2026-09-01'))
      ).rejects.toThrow('month failed');
    });
  });

  // ─── createReservation ─────────────────────────────────────────────────────

  describe('createReservation', () => {
    beforeEach(() => {
      mockSingle.mockResolvedValue({
        data: { id: 'res-1', scheduled_at: '2026-09-20T09:00:00Z', customer_name: 'Juan' },
        error: null,
      });
      mockSelect.mockReturnValue({ single: mockSingle });
      mockInsert.mockReturnValue({ select: mockSelect });
      mockFrom.mockReturnValue({ insert: mockInsert });
    });

    it('inserts a new reservation row', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.createReservation({
        userId: 'u-1',
        scheduledAt: '2026-09-20T09:00:00Z',
        customerName: 'Juan',
        customerPhone: '09171234567',
        notes: 'Bring receipt',
      });
      expect(mockFrom).toHaveBeenCalledWith('reservations');
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          user_id: 'u-1',
          scheduled_at: '2026-09-20T09:00:00Z',
          customer_name: 'Juan',
        }),
      ]);
    });

    it('trims notes before inserting', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.createReservation({
        userId: 'u-1',
        scheduledAt: '2026-09-20T09:00:00Z',
        notes: '  Bring receipt  ',
      });
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({ notes: 'Bring receipt' }),
      ]);
    });

    it('stores null notes when empty string provided', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.createReservation({
        userId: 'u-1',
        scheduledAt: '2026-09-20T09:00:00Z',
        notes: '',
      });
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({ notes: null }),
      ]);
    });

    it('schedules a reminder notification after insert', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.createReservation({
        userId: 'u-1',
        scheduledAt: '2026-09-20T09:00:00Z',
        customerName: 'Juan',
      });
      expect(mockScheduleReminder).toHaveBeenCalledWith(
        expect.objectContaining({ reservationId: 'res-1' })
      );
    });

    it('returns the created reservation data', async () => {
      const { reservationService } = require('../../services/reservationService');
      const result = await reservationService.createReservation({
        userId: 'u-1',
        scheduledAt: '2026-09-20T09:00:00Z',
      });
      expect(result.id).toBe('res-1');
    });

    it('throws when insert fails', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('insert failed') });
      const { reservationService } = require('../../services/reservationService');
      await expect(
        reservationService.createReservation({ userId: 'u-1', scheduledAt: '2026-09-20T09:00:00Z' })
      ).rejects.toThrow('insert failed');
    });
  });

  // ─── getMyUpcomingReservations ─────────────────────────────────────────────

  describe('getMyUpcomingReservations', () => {
    beforeEach(() => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockGte.mockReturnValue({ order: mockOrder });
      mockEq.mockReturnValue({ eq: mockEq, gte: mockGte });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });
    });

    it('returns empty array immediately when userId is falsy', async () => {
      const { reservationService } = require('../../services/reservationService');
      const result = await reservationService.getMyUpcomingReservations(null);
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('queries reservations for the given userId', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.getMyUpcomingReservations('u-abc');
      expect(mockFrom).toHaveBeenCalledWith('reservations');
    });

    it('returns data on success', async () => {
      const rows = [{ id: 'r-1', scheduled_at: '2026-10-01T09:00:00Z' }];
      mockOrder.mockResolvedValue({ data: rows, error: null });
      const { reservationService } = require('../../services/reservationService');
      const result = await reservationService.getMyUpcomingReservations('u-abc');
      expect(result).toEqual(rows);
    });

    it('throws when query fails', async () => {
      mockOrder.mockResolvedValue({ data: null, error: new Error('upcoming failed') });
      const { reservationService } = require('../../services/reservationService');
      await expect(
        reservationService.getMyUpcomingReservations('u-abc')
      ).rejects.toThrow('upcoming failed');
    });
  });

  // ─── cancelReservation ─────────────────────────────────────────────────────

  describe('cancelReservation', () => {
    beforeEach(() => {
      mockSingle.mockResolvedValue({ data: { id: 'res-2' }, error: null });
      mockSelect.mockReturnValue({ single: mockSingle });
      mockEq.mockReturnValue({ eq: mockEq, select: mockSelect });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });
    });

    it('updates reservation status to cancelled', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.cancelReservation({ reservationId: 'res-2', userId: 'u-1' });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled' })
      );
    });

    it('calls cancelReservationReminder after cancellation', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.cancelReservation({ reservationId: 'res-2', userId: 'u-1' });
      expect(mockCancelReminder).toHaveBeenCalledWith('res-2');
    });

    it('throws when cancel update fails', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('cancel failed') });
      const { reservationService } = require('../../services/reservationService');
      await expect(
        reservationService.cancelReservation({ reservationId: 'res-2', userId: 'u-1' })
      ).rejects.toThrow('cancel failed');
    });
  });

  // ─── updateReservation ─────────────────────────────────────────────────────

  describe('updateReservation', () => {
    beforeEach(() => {
      mockSingle.mockResolvedValue({
        data: { id: 'res-3', scheduled_at: '2026-10-01T10:00:00Z', customer_name: 'Maria' },
        error: null,
      });
      mockSelect.mockReturnValue({ single: mockSingle });
      mockEq.mockReturnValue({ eq: mockEq, select: mockSelect });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });
    });

    it('updates scheduled_at and notes', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.updateReservation({
        reservationId: 'res-3',
        userId: 'u-1',
        scheduledAt: '2026-10-01T10:00:00Z',
        notes: 'Updated note',
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduled_at: '2026-10-01T10:00:00Z',
          notes: 'Updated note',
        })
      );
    });

    it('reschedules reminder after update', async () => {
      const { reservationService } = require('../../services/reservationService');
      await reservationService.updateReservation({
        reservationId: 'res-3',
        userId: 'u-1',
        scheduledAt: '2026-10-01T10:00:00Z',
      });
      expect(mockScheduleReminder).toHaveBeenCalledWith(
        expect.objectContaining({ reservationId: 'res-3' })
      );
    });

    it('throws when update query fails', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('update failed') });
      const { reservationService } = require('../../services/reservationService');
      await expect(
        reservationService.updateReservation({
          reservationId: 'res-3',
          userId: 'u-1',
          scheduledAt: '2026-10-01T10:00:00Z',
        })
      ).rejects.toThrow('update failed');
    });
  });
});
