import assert from 'node:assert/strict';
import {
  casablancaDayEndIso,
  casablancaDayStartIso,
  formatCasablancaDateTimeForExport,
} from '../src/dateTime.ts';

assert.equal(
  formatCasablancaDateTimeForExport('2026-10-24T23:30:00Z'),
  '2026-10-25 00:30',
  'Morocco is UTC+1 on 24 October 2026.',
);
assert.equal(
  formatCasablancaDateTimeForExport('2024-03-20T23:30:00Z'),
  '2024-03-20 23:30',
  '20 March 2024 is in Morocco’s Ramadan UTC+0 period.',
);
assert.equal(
  casablancaDayStartIso('2026-10-25'),
  '2026-10-24T23:00:00.000Z',
  'The Casablanca midnight boundary in October uses UTC+1.',
);
assert.equal(
  casablancaDayEndIso('2024-03-20'),
  '2024-03-21T00:00:00.000Z',
  'The Casablanca midnight boundary during Ramadan uses UTC+0.',
);

console.log('Casablanca timezone checks passed for 2026-10-24 and Ramadan 2024-03-20.');
