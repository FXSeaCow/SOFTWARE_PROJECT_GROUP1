/**
 * Timezone helpers for scheduler jobs.
 *
 * Native Date uses the server process timezone. These helpers let jobs use the
 * application's business timezone even when the server runs in UTC.
 */

const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeTimeZone = (timeZone) => {
  const zone = timeZone || DEFAULT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
    return zone;
  } catch (_) {
    return DEFAULT_TIME_ZONE;
  }
};

const formatDateOnly = ({ year, month, day }) => {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
};

const toDate = (value) => (value instanceof Date ? value : new Date(value));

const zonedParts = (value = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
  const date = toDate(value);
  const zone = normalizeTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const hour = Number(parts.hour);

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

const timeZoneOffsetMs = (value, timeZone = DEFAULT_TIME_ZONE) => {
  const date = toDate(value);
  const parts = zonedParts(date, timeZone);
  const utcFromZonedParts = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const dateWithoutMilliseconds = Math.floor(date.getTime() / 1000) * 1000;

  return utcFromZonedParts - dateWithoutMilliseconds;
};

const zonedDateTimeToDate = (
  { year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0 },
  timeZone = DEFAULT_TIME_ZONE
) => {
  const zone = normalizeTimeZone(timeZone);
  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  );
  const firstOffset = timeZoneOffsetMs(utcGuess, zone);
  const firstDate = new Date(utcGuess.getTime() - firstOffset);
  const correctedOffset = timeZoneOffsetMs(firstDate, zone);

  return new Date(utcGuess.getTime() - correctedOffset);
};

const dateOnlyInTimeZone = (value = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  return formatDateOnly(zonedParts(value, timeZone));
};

const startOfDateInTimeZone = (value = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
  const [year, month, day] = dateOnlyInTimeZone(value, timeZone)
    .split('-')
    .map(Number);

  return zonedDateTimeToDate({ year, month, day }, timeZone);
};

const addDaysToParts = (parts, daysToAdd) => {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + daysToAdd, 12, 0, 0, 0)
  );

  return {
    ...parts,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

const millisecondsUntilDailyTime = (
  dailyTime,
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE
) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(dailyTime || '');
  const hour = match ? Number(match[1]) : 0;
  const minute = match ? Number(match[2]) : 0;
  const zone = normalizeTimeZone(timeZone);
  const currentParts = zonedParts(now, zone);
  let targetParts = {
    year: currentParts.year,
    month: currentParts.month,
    day: currentParts.day,
    hour,
    minute,
    second: 0,
    millisecond: 0,
  };
  let target = zonedDateTimeToDate(targetParts, zone);

  if (target < now) {
    targetParts = addDaysToParts(targetParts, 1);
    target = zonedDateTimeToDate(targetParts, zone);
  }

  return Math.max(0, target.getTime() - now.getTime());
};

module.exports = {
  DEFAULT_TIME_ZONE,
  normalizeTimeZone,
  dateOnlyInTimeZone,
  startOfDateInTimeZone,
  millisecondsUntilDailyTime,
};
