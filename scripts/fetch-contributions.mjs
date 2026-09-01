#!/usr/bin/env node
/**
 * Pull the GitHub contribution calendar and write it to assets/contributions.json.
 *
 * Run this, not the browser. The contributions calendar is GraphQL-only and needs
 * an authenticated token, and a token that reaches the browser is a token that has
 * leaked — so the data is fetched here and the RESULT is what ships. The page
 * loads a static JSON file and knows nothing about GitHub.
 *
 * Auth comes from the `gh` CLI you are already logged into, so there is no token
 * to paste, store, or rotate:
 *
 *     node scripts/fetch-contributions.mjs
 *
 * The `restrictedContributionsCount` matters here more than usual: most of this
 * account's work is in private repos, so a public-only view undercounts 2026 by
 * about 20x. The calendar API includes private contributions for your own user
 * when called with your own token, which is the whole reason this runs locally.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "assets/contributions.json");
const LOGIN = process.env.GH_LOGIN || "kimlj";

// GitHub's calendar query caps at one year per call, so each year is its own.
const FIRST_YEAR = 2024;
const THIS_YEAR = new Date().getUTCFullYear();

function graphql(query) {
  try {
    return JSON.parse(
      execFileSync("gh", ["api", "graphql", "-f", `query=${query}`], {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      })
    );
  } catch (err) {
    console.error(
      "gh call failed. Is the CLI installed and logged in? Try: gh auth status\n" +
        (err.stderr || err.message)
    );
    process.exit(1);
  }
}

const years = {};
const days = {};

for (let year = FIRST_YEAR; year <= THIS_YEAR; year++) {
  const data = graphql(`{
    user(login: "${LOGIN}") {
      contributionsCollection(from: "${year}-01-01T00:00:00Z", to: "${year}-12-31T23:59:59Z") {
        totalCommitContributions
        totalPullRequestContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }`);

  const c = data?.data?.user?.contributionsCollection;
  if (!c) {
    console.error(`No data for ${year} — is the login "${LOGIN}" right?`);
    process.exit(1);
  }

  years[year] = {
    total: c.contributionCalendar.totalContributions,
    commits: c.totalCommitContributions,
    pullRequests: c.totalPullRequestContributions,
    private: c.restrictedContributionsCount,
  };

  // Flatten to date -> count, dropping zeroes. A year is 365 entries and most of
  // them are 0; storing only the active days keeps the file small enough to sit
  // inline in a page that already loads 19MB of media.
  for (const week of c.contributionCalendar.weeks) {
    for (const d of week.contributionDays) {
      if (d.contributionCount > 0) days[d.date] = d.contributionCount;
    }
  }
  console.log(
    `${year}: ${String(years[year].total).padStart(5)} contributions ` +
      `(${years[year].private} in private repos)`
  );
}

const payload = {
  login: LOGIN,
  generatedAt: new Date().toISOString(),
  // Stated plainly so the page can say so: this counts private work, which is
  // where nearly all of it lives. A viewer comparing against the public profile
  // would otherwise see two different numbers and trust neither.
  includesPrivate: true,
  years,
  days,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload), "utf8");

const total = Object.values(years).reduce((n, y) => n + y.total, 0);
console.log(
  `\nwrote ${OUT}\n  ${Object.keys(days).length} active days, ` +
    `${total} contributions across ${Object.keys(years).length} years`
);
