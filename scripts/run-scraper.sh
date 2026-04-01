#!/bin/sh
# run-scraper.sh — wrapper for system crontab
#
# Add to crontab with:
#   crontab -e
#   */30 * * * * /path/to/poe-hub/scripts/run-scraper.sh >> /var/log/poe-scraper.log 2>&1
#
# Or for hourly runs:
#   0 * * * * /path/to/poe-hub/scripts/run-scraper.sh >> /var/log/poe-scraper.log 2>&1

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "--- $(date -u '+%Y-%m-%dT%H:%M:%SZ') run-scraper start ---"
cd "$APP_DIR"
npx tsx scripts/discord-price-scraper/cron-runner.ts
echo "--- $(date -u '+%Y-%m-%dT%H:%M:%SZ') run-scraper end (exit $?) ---"
