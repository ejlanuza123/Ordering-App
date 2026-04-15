import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { reservationService } from '../../services/reservationService';

const SLOT_INTERVAL_MINUTES = 10;
const START_HOUR = 6;
const END_HOUR = 22;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toTimeKey(date) {
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildTimeSlots() {
  const slots = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_INTERVAL_MINUTES) {
      slots.push(`${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`);
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

export default function ReservationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [mode, setMode] = useState('overview');
  const [step, setStep] = useState(1);

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);
  const [reservedTimeKeys, setReservedTimeKeys] = useState(new Set());
  const [daysWithReservations, setDaysWithReservations] = useState(new Set());
  const [myReservations, setMyReservations] = useState([]);

  const [editingReservation, setEditingReservation] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [dialog, setDialog] = useState({
    visible: false,
    title: '',
    message: '',
    actions: [],
  });
  const stepTransitionAnim = useRef(new Animated.Value(1)).current;

  const monthLabel = useMemo(
    () => currentMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
    [currentMonth]
  );

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDay; i += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day));
    }

    return cells;
  }, [currentMonth]);

  const isPastDate = (dateKey) => {
    const day = fromDateKey(dateKey);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return day < now;
  };

  const isPastDateTime = (dateKey, timeKey) => {
    const day = fromDateKey(dateKey);
    const [hour, minute] = timeKey.split(':').map(Number);
    day.setHours(hour, minute, 0, 0);
    return day < new Date();
  };

  const refreshMonthIndicators = useCallback(async () => {
    setLoadingMonth(true);
    try {
      const monthRows = await reservationService.getReservationsByMonth(currentMonth);
      const keys = new Set(
        monthRows.map((row) => {
          const dt = new Date(row.scheduled_at);
          return toDateKey(dt);
        })
      );
      setDaysWithReservations(keys);
    } catch (error) {
      console.error('Failed to load reservation month data:', error);
    } finally {
      setLoadingMonth(false);
    }
  }, [currentMonth]);

  const refreshSelectedDaySlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      const rows = await reservationService.getReservedSlotsForDate(selectedDateKey);
      const keys = new Set(rows.map((row) => toTimeKey(new Date(row.scheduled_at))));
      setReservedTimeKeys(keys);
      if (selectedTime && keys.has(selectedTime) && !editingReservation) {
        setSelectedTime('');
      }
    } catch (error) {
      console.error('Failed to load reservation slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDateKey, selectedTime, editingReservation]);

  const refreshMyReservations = useCallback(async () => {
    if (!user?.id) {
      setMyReservations([]);
      setLoadingMine(false);
      return;
    }

    setLoadingMine(true);
    try {
      const rows = await reservationService.getMyUpcomingReservations(user.id);
      setMyReservations(rows);
    } catch (error) {
      console.error('Failed to load my reservations:', error);
    } finally {
      setLoadingMine(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshMonthIndicators();
  }, [refreshMonthIndicators]);

  useEffect(() => {
    refreshSelectedDaySlots();
  }, [refreshSelectedDaySlots]);

  useEffect(() => {
    refreshMyReservations();
  }, [refreshMyReservations]);

  useEffect(() => {
    if (mode !== 'new') return;

    stepTransitionAnim.setValue(0);
    Animated.timing(stepTransitionAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [mode, step, stepTransitionAnim]);

  const showDialog = (title, message, actions = [{ label: 'OK', type: 'primary' }]) => {
    setDialog({ visible: true, title, message, actions });
  };

  const closeDialog = () => {
    setDialog((prev) => ({ ...prev, visible: false }));
  };

  const goToMonth = (offset) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const startNewReservation = () => {
    setEditingReservation(null);
    setSelectedDateKey(toDateKey(new Date()));
    setSelectedTime('');
    setNotes('');
    setMode('new');
    setStep(1);
  };

  const startChangeReservation = (reservation) => {
    const dt = new Date(reservation.scheduled_at);
    setEditingReservation(reservation);
    setSelectedDateKey(toDateKey(dt));
    setSelectedTime(toTimeKey(dt));
    setNotes(reservation.notes || '');
    setCurrentMonth(new Date(dt.getFullYear(), dt.getMonth(), 1));
    setManageModalVisible(false);
    setMode('new');
    setStep(1);
  };

  const formatReservationDateTime = (iso) => {
    const dt = new Date(iso);
    return dt.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const confirmCancelReservation = (reservation) => {
    showDialog('Cancel reservation?', 'This slot will be released and can be booked by others.', [
      { label: 'Keep', type: 'secondary' },
      {
        label: 'Cancel Reservation',
        type: 'danger',
        onPress: async () => {
          closeDialog();
          setCancellingId(reservation.id);
          try {
            await reservationService.cancelReservation({ reservationId: reservation.id, userId: user?.id });
            await Promise.all([refreshMyReservations(), refreshSelectedDaySlots(), refreshMonthIndicators()]);
            showDialog('Reservation cancelled', 'Your reservation has been cancelled.');
          } catch (error) {
            showDialog('Cancellation failed', error?.message || 'Unable to cancel reservation.');
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  const validateStepAndProceed = () => {
    if (step === 1) {
      if (isPastDate(selectedDateKey)) {
        showDialog('Invalid date', 'Please pick today or a future date.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!selectedTime) {
        showDialog('Select a time', 'Please choose a reservation time slot.');
        return;
      }
      if (isPastDateTime(selectedDateKey, selectedTime)) {
        showDialog('Invalid time', 'Please choose a future time.');
        return;
      }
      setStep(3);
    }
  };

  const submitReservation = async () => {
    if (!selectedTime) {
      showDialog('Select a time', 'Please choose a reservation time slot.');
      return;
    }

    const [year, month, day] = selectedDateKey.split('-').map(Number);
    const [hour, minute] = selectedTime.split(':').map(Number);
    const scheduled = new Date(year, month - 1, day, hour, minute, 0, 0);

    if (scheduled < new Date()) {
      showDialog('Invalid time', 'Please choose a future date and time.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingReservation) {
        await reservationService.updateReservation({
          reservationId: editingReservation.id,
          userId: user?.id,
          scheduledAt: scheduled.toISOString(),
          notes,
        });

        showDialog('Reservation updated', 'Your reservation schedule was changed successfully.');
      } else {
        await reservationService.createReservation({
          userId: user?.id,
          scheduledAt: scheduled.toISOString(),
          customerName: profile?.full_name || null,
          customerPhone: profile?.phone_number || null,
          notes,
        });

        showDialog('Reservation sent', 'Your schedule has been submitted. Admin can now view it.');
      }

      setMode('overview');
      setStep(1);
      setEditingReservation(null);
      setSelectedTime('');
      setNotes('');

      await Promise.all([refreshMyReservations(), refreshSelectedDaySlots(), refreshMonthIndicators()]);
    } catch (error) {
      const msg = error?.message || '';
      if (msg.toLowerCase().includes('duplicate key') || msg.toLowerCase().includes('unique')) {
        showDialog('Slot unavailable', 'That slot is already reserved. Please choose another time.');
        await refreshSelectedDaySlots();
      } else {
        showDialog('Reservation failed', msg || 'Unable to save your reservation right now.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const editingSlotTimeKey = editingReservation ? toTimeKey(new Date(editingReservation.scheduled_at)) : null;
  const editingSlotDateKey = editingReservation ? toDateKey(new Date(editingReservation.scheduled_at)) : null;
  const stepContentAnimatedStyle = {
    opacity: stepTransitionAnim,
    transform: [
      {
        translateY: stepTransitionAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (mode === 'new') {
              setMode('overview');
              setStep(1);
              setEditingReservation(null);
              return;
            }

            if (navigation?.canGoBack?.()) {
              navigation.goBack();
            } else {
              navigation?.navigate?.('Home');
            }
          }}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color="#0033A0" />
        </TouchableOpacity>

        <Ionicons name="calendar" size={20} color="#0033A0" />
        <Text style={styles.headerTitle}>Reservation</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 150 + insets.bottom }]}>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtnPrimary} onPress={startNewReservation}>
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={styles.actionBtnPrimaryText}>New Reservation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={() => setManageModalVisible(true)}
            disabled={myReservations.length === 0}
          >
            <Ionicons name="settings-outline" size={16} color="#0033A0" />
            <Text style={styles.actionBtnSecondaryText}>Manage Reservation</Text>
          </TouchableOpacity>
        </View>

        {mode === 'overview' ? (
          <>
            <Text style={styles.sectionTitle}>Calendar</Text>

            <View style={styles.monthHeader}>
              <TouchableOpacity onPress={() => goToMonth(-1)} style={styles.monthButton}>
                <Ionicons name="chevron-back" size={18} color="#0033A0" />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <TouchableOpacity onPress={() => goToMonth(1)} style={styles.monthButton}>
                <Ionicons name="chevron-forward" size={18} color="#0033A0" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={styles.weekCell}>{label}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                }

                const dayKey = toDateKey(date);
                const isSelected = dayKey === selectedDateKey;
                const disabled = isPastDate(dayKey);
                const hasReservations = daysWithReservations.has(dayKey);

                return (
                  <TouchableOpacity
                    key={dayKey}
                    disabled={disabled}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      disabled && styles.dayCellDisabled,
                    ]}
                    onPress={() => setSelectedDateKey(dayKey)}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected, disabled && styles.dayTextDisabled]}>
                      {date.getDate()}
                    </Text>
                    {hasReservations && <View style={styles.dayDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Your upcoming reservations</Text>
            {loadingMine ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color="#0033A0" />
              </View>
            ) : myReservations.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No upcoming reservations yet.</Text>
              </View>
            ) : (
              myReservations.map((reservation) => (
                <View key={reservation.id} style={styles.myReservationCard}>
                  <Text style={styles.myReservationTime}>{formatReservationDateTime(reservation.scheduled_at)}</Text>
                  {!!reservation.notes && (
                    <Text style={styles.myReservationNotes}>{reservation.notes}</Text>
                  )}
                </View>
              ))
            )}

            {loadingMonth && <Text style={styles.helperText}>Refreshing reservation indicators...</Text>}
            <Text style={styles.helperText}>Tap New Reservation to start the 3-step flow.</Text>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {editingReservation ? 'Change reservation' : 'New reservation'} - Step {step} of 3
            </Text>

            <View style={styles.progressRow}>
              {[1, 2, 3].map((stepNumber, index) => {
                const isActive = step === stepNumber;
                const isDone = step > stepNumber;

                return (
                  <React.Fragment key={`progress-${stepNumber}`}>
                    <View style={styles.progressStepWrap}>
                      <View
                        style={[
                          styles.progressDot,
                          isActive && styles.progressDotActive,
                          isDone && styles.progressDotDone,
                        ]}
                      >
                        <Text
                          style={[
                            styles.progressDotText,
                            (isActive || isDone) && styles.progressDotTextActive,
                          ]}
                        >
                          {stepNumber}
                        </Text>
                      </View>
                      <Text style={[styles.progressLabel, (isActive || isDone) && styles.progressLabelActive]}>
                        {stepNumber === 1 ? 'Date' : stepNumber === 2 ? 'Time' : 'Submit'}
                      </Text>
                    </View>

                    {index < 2 && (
                      <View style={[styles.progressConnector, step > stepNumber && styles.progressConnectorActive]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>

            <Animated.View style={stepContentAnimatedStyle}>
              {step === 1 && (
                <>
                <Text style={styles.stepTitle}>Step 1: Pick a date</Text>

                <View style={styles.monthHeader}>
                  <TouchableOpacity onPress={() => goToMonth(-1)} style={styles.monthButton}>
                    <Ionicons name="chevron-back" size={18} color="#0033A0" />
                  </TouchableOpacity>
                  <Text style={styles.monthLabel}>{monthLabel}</Text>
                  <TouchableOpacity onPress={() => goToMonth(1)} style={styles.monthButton}>
                    <Ionicons name="chevron-forward" size={18} color="#0033A0" />
                  </TouchableOpacity>
                </View>

                <View style={styles.weekRow}>
                  {WEEKDAY_LABELS.map((label) => (
                    <Text key={label} style={styles.weekCell}>{label}</Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {calendarDays.map((date, index) => {
                    if (!date) {
                      return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                    }

                    const dayKey = toDateKey(date);
                    const isSelected = dayKey === selectedDateKey;
                    const disabled = isPastDate(dayKey);
                    const hasReservations = daysWithReservations.has(dayKey);

                    return (
                      <TouchableOpacity
                        key={dayKey}
                        disabled={disabled}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                          disabled && styles.dayCellDisabled,
                        ]}
                        onPress={() => setSelectedDateKey(dayKey)}
                      >
                        <Text style={[styles.dayText, isSelected && styles.dayTextSelected, disabled && styles.dayTextDisabled]}>
                          {date.getDate()}
                        </Text>
                        {hasReservations && <View style={styles.dayDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                </>
              )}

              {step === 2 && (
                <>
                <Text style={styles.stepTitle}>Step 2: Choose time</Text>
                {loadingSlots ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator size="small" color="#0033A0" />
                  </View>
                ) : (
                  <View style={styles.slotWrap}>
                    {TIME_SLOTS.map((slot) => {
                      const booked = reservedTimeKeys.has(slot);
                      const isCurrentEditingSlot =
                        editingSlotDateKey === selectedDateKey && editingSlotTimeKey === slot;
                      const past = isPastDateTime(selectedDateKey, slot);
                      const disabled = (booked && !isCurrentEditingSlot) || past;
                      const selected = selectedTime === slot;

                      return (
                        <TouchableOpacity
                          key={slot}
                          disabled={disabled}
                          onPress={() => setSelectedTime(slot)}
                          style={[
                            styles.slot,
                            selected && styles.slotSelected,
                            disabled && styles.slotDisabled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.slotText,
                              selected && styles.slotTextSelected,
                              disabled && styles.slotTextDisabled,
                            ]}
                          >
                            {slot}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                </>
              )}

              {step === 3 && (
                <>
                <Text style={styles.stepTitle}>Step 3: Add notes and submit</Text>
                <Text style={styles.summaryText}>Date: {selectedDateKey}</Text>
                <Text style={styles.summaryText}>Time: {selectedTime || 'Not selected'}</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add any note for admin"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  style={styles.notesInput}
                />
                </>
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {mode === 'overview' ? (
          <TouchableOpacity style={styles.submitButton} onPress={startNewReservation}>
            <Text style={styles.submitText}>Start New Reservation</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.footerGhostBtn, step === 1 && styles.footerGhostBtnDisabled]}
              onPress={() => setStep((prev) => Math.max(1, prev - 1))}
              disabled={step === 1}
            >
              <Text style={[styles.footerGhostText, step === 1 && styles.footerGhostTextDisabled]}>Back</Text>
            </TouchableOpacity>

            {step < 3 ? (
              <TouchableOpacity style={styles.submitButton} onPress={validateStepAndProceed}>
                <Text style={styles.submitText}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.submitButton} onPress={submitReservation} disabled={submitting || !user}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>{editingReservation ? 'Update Reservation' : 'Submit Reservation'}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <Modal
        visible={manageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Manage Reservations</Text>
              <TouchableOpacity onPress={() => setManageModalVisible(false)}>
                <Ionicons name="close" size={20} color="#334155" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 10 }}>
              {myReservations.length === 0 ? (
                <Text style={styles.emptyText}>No reservations to manage.</Text>
              ) : (
                myReservations.map((reservation) => (
                  <View key={reservation.id} style={styles.manageItemCard}>
                    <Text style={styles.myReservationTime}>{formatReservationDateTime(reservation.scheduled_at)}</Text>
                    <View style={styles.manageBtnRow}>
                      <TouchableOpacity style={styles.manageChangeBtn} onPress={() => startChangeReservation(reservation)}>
                        <Text style={styles.manageChangeText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.manageCancelBtn}
                        onPress={() => confirmCancelReservation(reservation)}
                        disabled={cancellingId === reservation.id}
                      >
                        {cancellingId === reservation.id ? (
                          <ActivityIndicator size="small" color="#B91C1C" />
                        ) : (
                          <Text style={styles.manageCancelText}>Cancel</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={dialog.visible} transparent animationType="fade" onRequestClose={closeDialog}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{dialog.title}</Text>
            <Text style={styles.modalMessage}>{dialog.message}</Text>
            <View style={styles.dialogActionsRow}>
              {dialog.actions.map((action, idx) => {
                const isDanger = action.type === 'danger';
                const isSecondary = action.type === 'secondary';
                return (
                  <TouchableOpacity
                    key={`${action.label}-${idx}`}
                    style={[
                      styles.dialogBtn,
                      isDanger && styles.dialogDangerBtn,
                      isSecondary && styles.dialogSecondaryBtn,
                    ]}
                    onPress={async () => {
                      if (action.onPress) {
                        await action.onPress();
                      } else {
                        closeDialog();
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.dialogBtnText,
                        isDanger && styles.dialogDangerText,
                        isSecondary && styles.dialogSecondaryText,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: '#0033A0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: '#E5EEFF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionBtnSecondaryText: {
    color: '#0033A0',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  progressStepWrap: {
    alignItems: 'center',
    width: 58,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    borderColor: '#0033A0',
    backgroundColor: '#0033A0',
  },
  progressDotDone: {
    borderColor: '#0EA5E9',
    backgroundColor: '#0EA5E9',
  },
  progressDotText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  progressDotTextActive: {
    color: '#FFFFFF',
  },
  progressLabel: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  progressLabelActive: {
    color: '#0F172A',
  },
  progressConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#CBD5E1',
    marginTop: 11,
    marginHorizontal: 4,
  },
  progressConnectorActive: {
    backgroundColor: '#0EA5E9',
  },
  summaryText: {
    color: '#334155',
    fontSize: 13,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    height: 44,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: '#0033A0',
    borderRadius: 10,
  },
  dayCellDisabled: {
    opacity: 0.35,
  },
  dayText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  dayTextDisabled: {
    color: '#94A3B8',
  },
  dayDot: {
    marginTop: 3,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ED2939',
  },
  loadingWrap: {
    paddingVertical: 14,
  },
  slotWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  slotSelected: {
    borderColor: '#0033A0',
    backgroundColor: '#0033A0',
  },
  slotDisabled: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
  },
  slotText: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '600',
  },
  slotTextSelected: {
    color: '#FFFFFF',
  },
  slotTextDisabled: {
    color: '#64748B',
  },
  notesInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    color: '#0F172A',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
  },
  myReservationCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
  },
  myReservationTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  myReservationNotes: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footerGhostBtn: {
    minWidth: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  footerGhostBtnDisabled: {
    opacity: 0.45,
  },
  footerGhostText: {
    color: '#334155',
    fontWeight: '700',
  },
  footerGhostTextDisabled: {
    color: '#64748B',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#ED2939',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  manageItemCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  manageBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manageChangeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#E5EEFF',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  manageChangeText: {
    color: '#0033A0',
    fontWeight: '700',
    fontSize: 12,
  },
  manageCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  manageCancelText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 12,
  },
  dialogActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  dialogBtn: {
    backgroundColor: '#0033A0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dialogBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dialogDangerBtn: {
    backgroundColor: '#B91C1C',
  },
  dialogDangerText: {
    color: '#FFFFFF',
  },
  dialogSecondaryBtn: {
    backgroundColor: '#E2E8F0',
  },
  dialogSecondaryText: {
    color: '#334155',
  },
});
