// src/utils/formatters.js (add this function)
export const formatCurrency = (amount) => {
  if (amount == null || isNaN(amount)) return '₱0.00';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount);
};