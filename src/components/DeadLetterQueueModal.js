// src/components/DeadLetterQueueModal.js
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { offlineStorageService } from '../services/offlineStorageService';

function getFriendlyOperationTitle(op) {
  if (!op) return 'Unknown Action';
  if (op.type === 'create_order' || op.type === 'create_order_bundle') {
    return 'Order Placement';
  }
  if (op.table === 'delivery_proofs') {
    return 'Delivery Proof Photo';
  }
  if (op.table === 'orders') {
    return 'Order Status Update';
  }
  if (op.table === 'deliveries') {
    return 'Delivery Assignment Update';
  }
  if (op.table === 'reviews' || op.table === 'rider_ratings') {
    return 'Customer Rating & Review';
  }
  return `${op.table || 'Data'} ${op.type || 'Action'}`;
}

export default function DeadLetterQueueModal({ visible, onClose, items = [] }) {
  const [retryingId, setRetryingId] = useState(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);

  const handleRetrySingle = async (queueId) => {
    setRetryingId(queueId);
    try {
      await offlineStorageService.retryDeadLetterOperation(queueId);
    } catch (err) {
      console.error('Error retrying single dead letter:', err);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDismissSingle = async (queueId) => {
    try {
      await offlineStorageService.removeDeadLetterOperation(queueId);
    } catch (err) {
      console.error('Error removing dead letter:', err);
    }
  };

  const handleRetryAll = async () => {
    setIsRetryingAll(true);
    try {
      await offlineStorageService.retryAllDeadLetters();
      if (onClose) onClose();
    } catch (err) {
      console.error('Error retrying all dead letters:', err);
    } finally {
      setIsRetryingAll(false);
    }
  };

  const handleClearAll = async () => {
    try {
      await offlineStorageService.clearDeadLetterQueue();
      if (onClose) onClose();
    } catch (err) {
      console.error('Error clearing dead letter queue:', err);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="cloud-offline" size={20} color="#DC2626" />
              </View>
              <View>
                <Text style={styles.title}>Failed Offline Actions</Text>
                <Text style={styles.subtitle}>
                  {items.length} {items.length === 1 ? 'action requires' : 'actions require'} attention
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Body / List */}
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done-circle-outline" size={44} color="#10B981" />
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptyText}>No failed offline actions found.</Text>
              </View>
            ) : (
              items.map((item, idx) => {
                const qId = item.queueId ?? item.id ?? String(idx);
                const title = getFriendlyOperationTitle(item);
                const isRetrying = retryingId === qId;
                const errorMsg = item.error || item.lastError || 'Upload error encountered';
                const timeStr = item.failedAt
                  ? new Date(item.failedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : null;

                return (
                  <View key={qId} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>{title}</Text>
                      {timeStr ? <Text style={styles.itemTime}>{timeStr}</Text> : null}
                    </View>

                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle-outline" size={14} color="#B91C1C" style={styles.errorIcon} />
                      <Text style={styles.errorText} numberOfLines={2}>
                        {errorMsg}
                      </Text>
                    </View>

                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.dismissBtn]}
                        onPress={() => handleDismissSingle(qId)}
                        disabled={isRetrying}
                      >
                        <Text style={styles.dismissBtnText}>Dismiss</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.retryBtn]}
                        onPress={() => handleRetrySingle(qId)}
                        disabled={isRetrying}
                      >
                        {isRetrying ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="refresh-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.retryBtnText}>Retry</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer actions */}
          {items.length > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.clearAllBtn}
                onPress={handleClearAll}
                disabled={isRetryingAll}
              >
                <Text style={styles.clearAllText}>Dismiss All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.retryAllBtn}
                onPress={handleRetryAll}
                disabled={isRetryingAll}
              >
                {isRetryingAll ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.retryAllText}>Retry All</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
  },
  list: {
    maxHeight: 380,
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
  },
  errorIcon: {
    marginRight: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#991B1B',
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dismissBtn: {
    backgroundColor: '#E5E7EB',
  },
  dismissBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  retryBtn: {
    backgroundColor: '#0033A0',
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
    backgroundColor: '#FAFAFA',
  },
  clearAllBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  retryAllBtn: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0033A0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
