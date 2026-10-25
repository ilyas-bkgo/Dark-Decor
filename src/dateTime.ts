export const CASABLANCA_TIME_ZONE = 'Africa/Casablanca';

const arabicDateTime = new Intl.DateTimeFormat('ar-MA-u-nu-latn', {
  timeZone: CASABLANCA_TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const arabicDate = new Intl.DateTimeFormat('ar-MA-u-nu-latn', {
  timeZone: CASABLANCA_TIME_ZONE,
  dateStyle: 'medium',
});

function dateParts(date: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`Invalid calendar date: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function formatCasablancaDateTime(instant: string | Date): string {
  return arabicDateTime.format(typeof instant === 'string' ? new Date(instant) : instant);
}

export function formatCasablancaDateTimeForExport(instant: string | Date): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat('en-CA-u-nu-latn', {
    timeZone: CASABLANCA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}

export function formatCasablancaCalendarDate(day: string): string {
  const [year, month, date] = dateParts(day);
  return arabicDate.format(new Date(Date.UTC(year, month - 1, date, 12)));
}

export function getCasablancaCalendarDate(instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA-u-nu-latn', {
    timeZone: CASABLANCA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addCalendarDays(day: string, amount: number): string {
  const [year, month, date] = dateParts(day);
  const shifted = new Date(Date.UTC(year, month - 1, date + amount));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function casablancaDayStartIso(day: string): string {
  const [year, month, date] = dateParts(day);
  const wantedWallTime = Date.UTC(year, month - 1, date);
  let candidate = wantedWallTime;
  const wallClock = new Intl.DateTimeFormat('en-US-u-nu-latn', {
    timeZone: CASABLANCA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      wallClock.formatToParts(new Date(candidate)).map(({ type, value }) => [type, Number(value)]),
    );
    const representedWallTime = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const correction = wantedWallTime - representedWallTime;
    candidate += correction;
    if (correction === 0) break;
  }

  return new Date(candidate).toISOString();
}

export function casablancaDayEndIso(day: string): string {
  return casablancaDayStartIso(addCalendarDays(day, 1));
}
