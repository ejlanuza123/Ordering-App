import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity,
  RefreshControl 
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function OrderHistoryScreen({ navigation }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          created_at,
          order_items (
            quantity,
            products (name)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }); // Newest first

      if (error) throw error;
      setOrders(data);
    } catch (error) {
      console.log('Error fetching history:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // Helper to color-code status
  const getStatusColor = (status) => {
    switch(status) {
      case 'Pending': return '#FFA500'; // Orange
      case 'Processing': return '#0033A0'; // Blue
      case 'Out for Delivery': return '#10B981'; // Green
      case 'Completed': return '#333'; // Black
      case 'Cancelled': return '#EF4444'; // Red
      default: return '#666';
    }
  };

  const renderOrder = ({ item }) => (
    <View style={styles.card}>
      {/* Header: Date & Status */}
      <View style={styles.cardHeader}>
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      {/* Items List */}
      <View style={styles.itemsContainer}>
        {item.order_items.map((orderItem, index) => (
          <Text key={index} style={styles.itemText}>
            • {orderItem.products.name} ({orderItem.quantity})
          </Text>
        ))}
      </View>

      {/* Footer: Total */}
      <View style={styles.cardFooter}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>₱{item.total_amount.toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
           <Ionicons name="arrow-back" size={24} color="#0033A0" />
        </TouchableOpacity>
        <Text style={styles.title}>My Orders</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0033A0" style={{marginTop: 50}}/>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>You haven't ordered anything yet.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { 
    flexDirection: 'row', alignItems: 'center', padding: 20, 
    backgroundColor: 'white', elevation: 2 
  },
  backBtn: { marginRight: 15 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0033A0' },
  list: { padding: 15 },
  
  card: {
    backgroundColor: 'white', borderRadius: 10, padding: 15, marginBottom: 15,
    elevation: 2
  },
  cardHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10
  },
  date: { color: '#666', fontSize: 14 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15 },
  statusText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  
  itemsContainer: { 
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee', 
    paddingVertical: 10, marginBottom: 10 
  },
  itemText: { fontSize: 14, color: '#333', marginBottom: 2 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, color: '#666' },
  totalAmount: { fontSize: 18, fontWeight: 'bold', color: '#ED2939' },

  emptyText: { textAlign: 'center', marginTop: 50, color: '#999', fontSize: 16 }
});