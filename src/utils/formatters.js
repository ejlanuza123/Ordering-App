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
  const rawValue = orderNumber ?? orderId;
  if (rawValue == null || rawValue === '') return '#-';

  const str = String(rawValue).trim();
  const match = str.match(/(\d+)$/);

  if (match) {
    return `#${parseInt(match[1], 10)}`;
  }

  return `#${str}`;
};