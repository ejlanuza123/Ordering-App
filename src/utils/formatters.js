// src/utils/formatters.js (add this function)
export const formatCurrency = (amount) => {
  if (amount == null || isNaN(amount)) return '₱0.00';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatOrderNumber = (orderNumber, orderId) => {
  const numId = Number(orderId);
  const hasValidOrderId = Number.isFinite(numId) && numId > 0;

  // If orderNumber is absent, empty, or corrupted like 'ORD-0000' / 'ORD-000000'
  if (!orderNumber || String(orderNumber).trim() === '' || String(orderNumber).includes('ORD-0000')) {
    if (hasValidOrderId) return `#${numId}`;
  }

  const rawValue = orderNumber ?? orderId;
  if (rawValue == null || rawValue === '') return '#-';

  const str = String(rawValue).trim();
  const match = str.match(/(\d+)$/);

  if (match) {
    const parsed = parseInt(match[1], 10);
    if (parsed > 0) {
      return `#${parsed}`;
    }
    if (hasValidOrderId) {
      return `#${numId}`;
    }
  }

  if (hasValidOrderId) return `#${numId}`;
  return `#${str}`;
};