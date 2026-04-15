import { supabase } from '../lib/supabase';

const RESERVATION_STATUS = {
  RESERVED: 'reserved',
  CANCELLED: 'cancelled',
};

async function getReservedSlotsForDate(dateIso) {
  const start = new Date(`${dateIso}T00:00:00`);
  const end = new Date(`${dateIso}T23:59:59.999`);

  const { data, error } = await supabase
    .from('reservations')
    .select('id, scheduled_at')
    .eq('status', RESERVATION_STATUS.RESERVED)
    .gte('scheduled_at', start.toISOString())
    .lte('scheduled_at', end.toISOString())
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getReservationsByMonth(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const { data, error } = await supabase
    .from('reservations')
    .select('id, scheduled_at, status')
    .eq('status', RESERVATION_STATUS.RESERVED)
    .gte('scheduled_at', monthStart.toISOString())
    .lte('scheduled_at', monthEnd.toISOString())
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function createReservation({ userId, scheduledAt, customerName, customerPhone, notes = '' }) {
  const { data, error } = await supabase
    .from('reservations')
    .insert([
      {
        user_id: userId,
        scheduled_at: scheduledAt,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        notes: notes?.trim() || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getMyUpcomingReservations(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('reservations')
    .select('id, scheduled_at, notes, status, created_at')
    .eq('user_id', userId)
    .eq('status', RESERVATION_STATUS.RESERVED)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function cancelReservation({ reservationId, userId }) {
  const { data, error } = await supabase
    .from('reservations')
    .update({
      status: RESERVATION_STATUS.CANCELLED,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reservationId)
    .eq('user_id', userId)
    .eq('status', RESERVATION_STATUS.RESERVED)
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

async function updateReservation({ reservationId, userId, scheduledAt, notes = '' }) {
  const { data, error } = await supabase
    .from('reservations')
    .update({
      scheduled_at: scheduledAt,
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reservationId)
    .eq('user_id', userId)
    .eq('status', RESERVATION_STATUS.RESERVED)
    .select('id, scheduled_at')
    .single();

  if (error) throw error;
  return data;
}

export const reservationService = {
  RESERVATION_STATUS,
  getReservedSlotsForDate,
  getReservationsByMonth,
  createReservation,
  getMyUpcomingReservations,
  cancelReservation,
  updateReservation,
};
