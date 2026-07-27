import type { CheckinResult, CheckinState } from '../frontend/src/types/entities';
import { buildCurrentUser, createId, getAll, getOne, getUserRowById, nowIso, run } from './helpers.ts';
import type { PointLedgerRow } from './models.ts';

const dailyCheckinPoints = 5;
const shanghaiTimeZone = 'Asia/Shanghai';

function formatShanghaiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: shanghaiTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function addCalendarDays(dateText: string, days: number) {
  const [year, month, day] = dateText.split('-').map((item) => Number(item));
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeMonth(month?: string) {
  const value = month?.trim();
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  return formatShanghaiDate().slice(0, 7);
}

function getMonthDays(month: string) {
  const [year, monthIndex] = month.split('-').map((item) => Number(item));
  return new Date(Date.UTC(year, monthIndex, 0, 12)).getUTCDate();
}

function getCheckedDates(userId: string, month: string) {
  const monthDays = getMonthDays(month);
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(monthDays).padStart(2, '0')}`;
  return getAll<Pick<PointLedgerRow, 'ref_id'>>(
    `
      SELECT ref_id
      FROM point_ledger
      WHERE user_id = @userId
        AND type = 'checkin'
        AND ref_type = 'date'
        AND ref_id >= @startDate
        AND ref_id <= @endDate
      ORDER BY ref_id ASC
    `,
    { userId, startDate, endDate }
  )
    .map((row) => row.ref_id)
    .filter((value): value is string => Boolean(value));
}

function buildCalendar(month: string, today: string, checkedDates: string[]) {
  const checkedSet = new Set(checkedDates);
  return Array.from({ length: getMonthDays(month) }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, '0')}`;
    return {
      date,
      day,
      checked: checkedSet.has(date),
      today: date === today,
    };
  });
}

function hasCheckinLedger(userId: string, date: string) {
  return Boolean(
    getOne<{ id: string }>(
      `
        SELECT id
        FROM point_ledger
        WHERE user_id = @userId
          AND type = 'checkin'
          AND ref_type = 'date'
          AND ref_id = @date
        LIMIT 1
      `,
      { userId, date }
    )
  );
}

export function getCheckinState(userId: string, month?: string): CheckinState {
  const user = getUserRowById(userId);
  const today = formatShanghaiDate();
  const currentMonth = normalizeMonth(month);
  const checkedDateSet = new Set(getCheckedDates(userId, currentMonth));

  if (user.last_checkin_date && user.last_checkin_date.startsWith(currentMonth)) {
    checkedDateSet.add(user.last_checkin_date);
  }

  const checkedDates = Array.from(checkedDateSet).sort();
  const checkedInToday = user.last_checkin_date === today || checkedDateSet.has(today) || hasCheckinLedger(userId, today);

  return {
    points: Number(user.points || 0),
    streak: Number(user.checkin_streak || 0),
    checkedInToday,
    lastCheckinDate: user.last_checkin_date || undefined,
    todayReward: dailyCheckinPoints,
    month: currentMonth,
    checkedDates,
    calendar: buildCalendar(currentMonth, today, checkedDates),
  };
}

export function checkinToday(userId: string): CheckinResult {
  const user = getUserRowById(userId);
  const today = formatShanghaiDate();

  if (user.last_checkin_date === today || hasCheckinLedger(userId, today)) {
    return {
      ...getCheckinState(userId),
      awardedPoints: 0,
      message: '今日已签到',
      user: buildCurrentUser(userId),
    };
  }

  const yesterday = addCalendarDays(today, -1);
  const nextStreak = user.last_checkin_date === yesterday ? Number(user.checkin_streak || 0) + 1 : 1;
  const nextPoints = Number(user.points || 0) + dailyCheckinPoints;
  const createdAt = nowIso();

  run(
    `
      UPDATE users
      SET points = @points,
          checkin_streak = @checkinStreak,
          last_checkin_date = @lastCheckinDate,
          updated_at = @updatedAt
      WHERE id = @userId
    `,
    {
      userId,
      points: nextPoints,
      checkinStreak: nextStreak,
      lastCheckinDate: today,
      updatedAt: createdAt,
    }
  );

  run(
    `
      INSERT INTO point_ledger (
        id, user_id, type, points, balance_after, note, ref_type, ref_id, created_at
      ) VALUES (
        @id, @userId, 'checkin', @points, @balanceAfter, @note, 'date', @date, @createdAt
      )
    `,
    {
      id: createId('pts'),
      userId,
      points: dailyCheckinPoints,
      balanceAfter: nextPoints,
      note: '每日签到',
      date: today,
      createdAt,
    }
  );

  return {
    ...getCheckinState(userId),
    awardedPoints: dailyCheckinPoints,
    message: `签到成功，积分 +${dailyCheckinPoints}`,
    user: buildCurrentUser(userId),
  };
}
