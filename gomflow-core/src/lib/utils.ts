import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: 'PHP' | 'MYR') {
  const symbol = currency === 'PHP' ? '₱' : 'RM';
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getOrderStatus(order: any) {
  if (!order.is_active) return 'closed';
  if (new Date(order.deadline) < new Date()) return 'expired';
  if (order.total_submissions >= order.min_orders) return 'confirmed';
  return 'active';
}

export function getSubmissionStatus(submission: any) {
  switch (submission.status) {
    case 'pending':
      return { label: 'Pending Payment', color: 'orange' };
    case 'confirmed':
      return { label: 'Payment Confirmed', color: 'green' };
    case 'cancelled':
      return { label: 'Cancelled', color: 'red' };
    case 'refunded':
      return { label: 'Refunded', color: 'blue' };
    default:
      return { label: submission.status, color: 'gray' };
  }
}