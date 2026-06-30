import { describe, it, expect, vi, afterEach } from 'vitest';
import { today, todayDayName, formatDateES, weeksSince, dayOrdinal } from '../../utils/date';

afterEach(() => {
  vi.useRealTimers();
});

describe('today', () => {
  it('returns ISO date string YYYY-MM-DD', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the mocked date when using fake timers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-15T12:00:00Z'));
    expect(today()).toBe('2025-03-15');
  });
});

describe('todayDayName', () => {
  it('returns a valid Spanish day name without accents', () => {
    const validDays = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    expect(validDays).toContain(todayDayName());
  });

  it('returns lunes for a known Monday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-03T10:00:00')); // Monday
    expect(todayDayName()).toBe('lunes');
  });

  it('returns domingo for a known Sunday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-02T10:00:00')); // Sunday
    expect(todayDayName()).toBe('domingo');
  });
});

describe('formatDateES', () => {
  it('formats a date in Spanish long format', () => {
    const d = new Date('2025-06-30T12:00:00');
    const result = formatDateES(d);
    expect(result).toContain('junio');
    expect(result).toContain('2025');
    expect(result).toContain('30');
  });

  it('includes the day of the week', () => {
    const d = new Date('2025-03-03T12:00:00'); // lunes
    expect(formatDateES(d)).toMatch(/^lunes/);
  });
});

describe('weeksSince', () => {
  it('returns 1 for today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-30T10:00:00'));
    expect(weeksSince('2025-06-30')).toBe(1);
  });

  it('returns 1 for dates less than 7 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-05T10:00:00'));
    expect(weeksSince('2025-06-30')).toBe(1);
  });

  it('returns 2 after exactly 7 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-07T10:00:00'));
    expect(weeksSince('2025-06-30')).toBe(2);
  });

  it('returns at least 1 even for future dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T10:00:00'));
    expect(weeksSince('2025-12-31')).toBe(1);
  });

  it('grows correctly over multiple weeks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-08-25T10:00:00')); // 8 semanas después
    expect(weeksSince('2025-06-30')).toBe(9);
  });
});

describe('dayOrdinal', () => {
  it('returns a number', () => {
    expect(typeof dayOrdinal()).toBe('number');
  });

  it('increments by 1 each day', () => {
    const d1 = new Date('2025-06-30');
    const d2 = new Date('2025-07-01');
    expect(dayOrdinal(d2) - dayOrdinal(d1)).toBe(1);
  });

  it('is the same for two Date objects on the same day', () => {
    const morning = new Date('2025-06-30T08:00:00');
    const evening = new Date('2025-06-30T22:00:00');
    expect(dayOrdinal(morning)).toBe(dayOrdinal(evening));
  });
});
