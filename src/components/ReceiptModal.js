// src/components/ReceiptModal.js
import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ReceiptModal({ visible, onClose, order, storeName = 'PETRON SAN PEDRO STATION' }) {
  if (!order) return null;

  const orderNum = String(order.order_number || order.id || '').slice(0, 10).toUpperCase();
  const orderDate = order.created_at ? new Date(order.created_at).toLocaleString() : new Date().toLocaleString();
  const items = order.order_items || [];
  
  let itemsCalculatedSubtotal = 0;
  items.forEach(item => {
    const price = Number(item.price_at_order ?? item.price_per_unit ?? item.unit_price ?? item.products?.price ?? 0);
    const qty = Number(item.quantity || 1);
    itemsCalculatedSubtotal += (price * qty);
  });

  const deliveryFee = Number(order.delivery_fee || 0);
  const grandTotal = Number(order.total_amount || 0);
  const subtotal = itemsCalculatedSubtotal > 0 ? itemsCalculatedSubtotal : Math.max(0, grandTotal - deliveryFee);
  const paymentMethod = (order.payment_method || 'Cash on Delivery').toUpperCase();

  const handleShareReceipt = async () => {
    try {
      const itemsList = items
        .map(i => {
          const price = Number(i.price_at_order ?? i.price_per_unit ?? i.unit_price ?? i.products?.price ?? 0);
          return `• ${i.products?.name || i.product_name || 'Item'} x${i.quantity || 1} - ₱${price.toFixed(2)}`;
        })
        .join('\n');

      const message = `🧾 OFFICIAL E-RECEIPT\n${storeName}\nOrder #: ${orderNum}\nDate: ${orderDate}\n\nITEMS:\n${itemsList}\n\nSubtotal: ₱${subtotal.toFixed(2)}\nDelivery Fee: ₱${deliveryFee.toFixed(2)}\nTotal Amount: ₱${grandTotal.toFixed(2)}\nPayment: ${paymentMethod}\nStatus: ${order.status?.toUpperCase() || 'COMPLETED'}\n\nThank you for ordering!`;

      await Share.share({
        title: `Receipt #${orderNum}`,
        message
      });
    } catch (err) {
      console.error('Share receipt error:', err);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="receipt-outline" size={22} color="#ED2939" />
              <Text style={styles.headerTitle}>Digital E-Receipt</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Store Banner */}
            <View style={styles.storeBanner}>
              <Text style={styles.storeName}>{storeName}</Text>
              <Text style={styles.storeSub}>National Highway, Barangay San Pedro, Puerto Princesa City, 5300 Palawan</Text>
              <Text style={styles.storeSub}>Official Sales E-Receipt</Text>
            </View>

            <View style={styles.divider} />

            {/* Order Info */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Number:</Text>
              <Text style={styles.infoVal}>#{orderNum}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date & Time:</Text>
              <Text style={styles.infoVal}>{orderDate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Method:</Text>
              <Text style={styles.infoVal}>{paymentMethod}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={[styles.infoVal, { color: '#00A859', fontWeight: 'bold' }]}>
                {order.status?.toUpperCase() || 'COMPLETED'}
              </Text>
            </View>

            <View style={styles.dashedDivider} />

            {/* Itemized Table */}
            <Text style={styles.sectionHeading}>ORDER ITEMS</Text>
            {items.map((item, idx) => {
              const price = Number(item.price_at_order ?? item.price_per_unit ?? item.unit_price ?? item.products?.price ?? 0);
              const qty = Number(item.quantity || 1);
              const total = price * qty;

              return (
                <View key={item.id || idx} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.products?.name || item.product_name || 'Product'}</Text>
                    <Text style={styles.itemMeta}>₱{price.toFixed(2)} x {qty}</Text>
                  </View>
                  <Text style={styles.itemTotal}>₱{total.toFixed(2)}</Text>
                </View>
              );
            })}

            <View style={styles.dashedDivider} />

            {/* Summary Breakdown */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryVal}>₱{subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee:</Text>
              <Text style={styles.summaryVal}>₱{deliveryFee.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: 6 }]}>
              <Text style={styles.totalLabel}>TOTAL PAID:</Text>
              <Text style={styles.totalVal}>₱{grandTotal.toFixed(2)}</Text>
            </View>

            <View style={styles.divider} />

            {/* Footer QR Placeholder */}
            <View style={styles.footerNote}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#0033A0" style={{ marginBottom: 4 }} />
              <Text style={styles.footerText}>Verified Digital Receipt</Text>
              <Text style={styles.footerSubText}>Thank you for choosing {storeName}!</Text>
            </View>
          </ScrollView>

          {/* Modal Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShareReceipt}>
              <Ionicons name="share-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.shareBtnText}>Share / Save Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    backgroundColor: '#F8FAFC',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 16,
  },
  storeBanner: {
    alignItems: 'center',
    marginBottom: 12,
  },
  storeName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0033A0',
    textAlign: 'center',
  },
  storeSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  dashedDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0033A0',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ED2939',
  },
  totalVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ED2939',
  },
  footerNote: {
    alignItems: 'center',
    marginVertical: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  footerSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  actions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  shareBtn: {
    backgroundColor: '#ED2939',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  shareBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
