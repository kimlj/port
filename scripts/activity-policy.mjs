export function activityDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function alreadyPublished(state, now = new Date()) {
  return state?.day === activityDay(now);
}

export function assertContributionCounts(previous, next) {
  const year = Object.keys(previous.years).sort().at(-1);
  const oldTotal = previous.years[year].total;
  const newTotal = next.years?.[year]?.total;
  if (!Number.isFinite(newTotal) || newTotal < oldTotal * 0.9) {
    throw new Error(`GitHub contribution count for ${year} is missing or fell by more than 10%; refusing to publish.`);
  }
}
