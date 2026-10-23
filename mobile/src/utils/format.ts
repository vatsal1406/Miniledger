/**
 * Currency, Date, and Status Formatters
 */

/**
 * Formats a number in Indian Rupee format (e.g. ₹1,50,000 or ₹2,500.50)
 */
export function formatINR(amount: number | string | null | undefined, showDecimals = false): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount || 0);
  if (isNaN(num)) return '₹0';

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const options: Intl.NumberFormatOptions = {
    maximumFractionDigits: showDecimals ? 2 : 0,
    minimumFractionDigits: showDecimals ? 2 : 0,
  };

  try {
    const formatted = new Intl.NumberFormat('en-IN', options).format(absNum);
    return `${isNegative ? '-' : ''}₹${formatted}`;
  } catch {
    return `${isNegative ? '-' : ''}₹${absNum.toLocaleString('en-US', options)}`;
  }
}

/**
 * Formats a Date object or ISO string to e.g. "24 Oct 2026"
 */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns human-readable relative due status, e.g. "Overdue by 3 days", "Due today", "Due in 5 days"
 */
export function formatRelativeDue(
  dueDate: string | Date | null | undefined,
  remainingBalance: number
): { text: string; isOverdue: boolean; daysDiff: number } {
  if (!dueDate) return { text: '', isOverdue: false, daysDiff: 0 };
  if (remainingBalance <= 0) return { text: 'Repaid', isOverdue: false, daysDiff: 0 };

  const target = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();

  // Normalize to midnight
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const diffMs = targetMidnight - nowMidnight;
  const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    const pastDays = Math.abs(daysDiff);
    return {
      text: pastDays === 1 ? 'Overdue by 1 day' : `Overdue by ${pastDays} days`,
      isOverdue: true,
      daysDiff,
    };
  }

  if (daysDiff === 0) {
    return { text: 'Due today', isOverdue: false, daysDiff: 0 };
  }

  if (daysDiff === 1) {
    return { text: 'Due tomorrow', isOverdue: false, daysDiff: 1 };
  }

  return { text: `Due in ${daysDiff} days`, isOverdue: false, daysDiff };
}

/**
 * Gets initials from friend's name for avatar (e.g. "Aarav Sharma" -> "AS")
 */
export function getInitials(name: string): string {
  if (!name) return 'FL';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1 && parts[0]) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
