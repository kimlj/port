"""Export aggregate evidence only; never publish the database or job records.

Usage: python scripts/export-jobsift-hub.py PATH_TO_SQLITE
Run again against a fresh core backup, then deploy the updated assets file.
"""
import argparse
import json
import re
from html import escape
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def snapshot(path):
    with sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True) as db:
        db.execute('BEGIN')
        scalar = lambda query: db.execute(query).fetchone()[0]
        stages = dict(db.execute('SELECT stage, COUNT(*) FROM sheet_stages GROUP BY stage'))
        applied = scalar("SELECT COUNT(*) FROM (SELECT url FROM applied_jobs UNION SELECT url FROM sheet_stages WHERE stage IN ('Applied','Interviewing','Rejected'))")
        latest = scalar('SELECT MAX(created_at) FROM jobs')
        return {
            'generatedAt': datetime.now(timezone.utc).isoformat(),
            'latestJobAt': datetime.fromtimestamp(latest, timezone.utc).isoformat() if latest else None,
            'kind': 'snapshot',
            'counts': {
                'jobs': scalar('SELECT COUNT(*) FROM jobs'),
                'companies': scalar("SELECT COUNT(DISTINCT LOWER(TRIM(company))) FROM jobs WHERE TRIM(company) != ''"),
                'sources': scalar('SELECT COUNT(DISTINCT source) FROM jobs'),
                'applied': applied,
                'ignored': stages.get('Ignore', 0) if stages else None,
                'emails': scalar('SELECT COUNT(*) FROM processed_emails'),
            },
            'sources': [{'name': name, 'count': count} for name, count in db.execute('SELECT source, COUNT(*) FROM jobs GROUP BY source ORDER BY COUNT(*) DESC')],
            'stages': [{'name': name, 'count': count} for name, count in sorted(stages.items())],
        }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path)
    args = parser.parse_args()
    result = snapshot(args.database)
    output = Path(__file__).resolve().parents[1] / 'assets' / 'jobsift-stats.json'
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    # Keep the no-JavaScript walkthrough backed by the same exported evidence.
    hub = output.parents[1] / 'hub.html'
    html = hub.read_text(encoding='utf-8')
    for key, value in result['counts'].items():
        pattern = r'(<span[^>]*data-job-count="' + key + r'"[^>]*>)[^<]*(</span>)'
        html = re.sub(pattern, lambda match: match[1] + (format(value, ',') if value is not None else '\u2014') + match[2], html)
    stamp = 'Database snapshot \u00b7 exported ' + result['generatedAt'][:16].replace('T', ' ') + ' UTC'
    if result['latestJobAt']:
        stamp += ' \u00b7 latest stored job ' + result['latestJobAt'][:16].replace('T', ' ') + ' UTC'
    html = re.sub(r'(<p[^>]*data-job-stamp[^>]*>).*?(</p>)', lambda m: m[1] + stamp + m[2], html, flags=re.S)
    rows = result['sources']
    maximum = max([r['count'] for r in rows] + [1])
    bars = '<div class="evidence-grid">' + ''.join(
        '<div class="evidence-row"><span>' + escape(r['name']) + '</span><b>' + str(r['count']) +
        '</b><i><em style="--bar:' + str(round(r['count'] / maximum * 100, 2)) + '%"></em></i></div>' for r in rows) + '</div>'
    html = re.sub(r'(<div data-job-evidence>).*?(</div>\s*<p class="console-footnote">)', lambda m: m[1] + bars + m[2], html, flags=re.S)
    hub.write_text(html, encoding='utf-8')
    print(json.dumps(result, indent=2))
