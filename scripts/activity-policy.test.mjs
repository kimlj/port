import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityDay, alreadyPublished, assertContributionCounts } from './activity-policy.mjs';

test('daily publishing follows Manila midnight and suppresses repeated logon runs', () => {
  const before = new Date('2026-10-31T15:59:59Z');
  const after = new Date('2026-10-31T16:00:00Z');
  assert.equal(activityDay(before), '2026-10-31');
  assert.equal(activityDay(after), '2026-11-01');
  assert.equal(alreadyPublished({ day: '2026-10-31' }, before), true);
  assert.equal(alreadyPublished({ day: '2026-10-31' }, after), false);
  assert.equal(alreadyPublished(null, before), false);
});

test('a GitHub login losing visibility of private contributions cannot publish', () => {
  const previous = { years: { 2026: { total: 3000 } } };
  assert.throws(() => assertContributionCounts(previous, { years: { 2026: { total: 200 } } }));
  assert.throws(() => assertContributionCounts(previous, { years: {} }));
  assert.doesNotThrow(() => assertContributionCounts(previous, { years: { 2026: { total: 3010 } } }));
});
