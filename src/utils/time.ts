const MINUTES_IN_DAY = 24 * 60;

const toMinutes = (time: string): number | null => {
  const [hours, minutes] = time.split(':').map(Number);
  if ([hours, minutes].some((part) => Number.isNaN(part))) {
    return null;
  }
  return hours * 60 + minutes;
};

export const calculateShiftDurationHours = (startTime: string, endTime: string): number => {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return 0;
  }

  let adjustedEnd = endMinutes;
  if (adjustedEnd === startMinutes) {
    return 0;
  }
  if (adjustedEnd < startMinutes) {
    adjustedEnd += MINUTES_IN_DAY;
  }

  const durationMinutes = adjustedEnd - startMinutes;
  return Math.round((durationMinutes / 60) * 100) / 100;
};

export const formatHours = (hours: number): string => {
  if (!Number.isFinite(hours) || hours <= 0) {
    return '0';
  }

  const rounded = Math.round(hours * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2).replace(/\.?0+$/, '');
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(date.getDate() + days);
  return result;
};

export const startOfWeek = (date: Date): Date => {
  const start = new Date(date);
  const day = start.getDay(); // Sunday = 0
  const diff = (day + 6) % 7; // Convert to Monday-based index
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

export const toISODate = (date: Date): string => date.toISOString().split('T')[0];

export const formatMonthDay = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const formatWeekdayShort = (date: Date): string =>
  date.toLocaleDateString('en-US', { weekday: 'short' });

export const formatLongDate = (date: Date): string =>
  date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
