# Task: Scraper Scheduler (Keep Zillow Data Fresh)

## Files to create
- `web/app/api/scraper/trigger/route.ts`
- `Real-Estate-Search-Automation/run_scraper.py`

## Files to modify
- `Real-Estate-Search-Automation/.env`

## Install
None new. Uses existing Python venv + Next.js API.

## Context
`rea.zillow_unique` has 1454 rows migrated manually. Data goes stale.
Goal: trigger scraper from Supabase Edge Function or a cron so market data refreshes weekly.
Simple approach: webhook endpoint in Next.js that runs the Python scraper via a secret token.
Alternative: GitHub Actions cron job.

## Option A: GitHub Actions Cron (Recommended — no server needed)

### Create `.github/workflows/scrape-zillow.yml` in Real-Estate-Search-Automation repo:
```yaml
name: Zillow Scraper

on:
  schedule:
    - cron: "0 6 * * 1"   # Every Monday 6am UTC
  workflow_dispatch:        # Manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - run: python main.py
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_PORT: ${{ secrets.DB_PORT }}
          DB_NAME: ${{ secrets.DB_NAME }}
          DB_USER: ${{ secrets.DB_USER }}
          DB_PASS: ${{ secrets.DB_PASS }}
          DB_SCHEMA: rea
          ZILLOW_RAPID_API_KEY: ${{ secrets.ZILLOW_RAPID_API_KEY }}
```

Add secrets in GitHub repo → Settings → Secrets and Variables → Actions.

## Option B: Next.js Webhook Trigger

### `Real-Estate-Search-Automation/run_scraper.py`
Minimal script called by webhook — runs scraper + exits:
```python
"""Triggered by POST /api/scraper/trigger. Runs main.py scrape cycle."""
import subprocess
import sys

result = subprocess.run([sys.executable, "main.py"], capture_output=True, text=True)
print(result.stdout)
if result.returncode != 0:
    print(result.stderr, file=sys.stderr)
    sys.exit(1)
```

### `web/app/api/scraper/trigger/route.ts`
Secured with a secret token. Called by Vercel cron or external scheduler:
```typescript
import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)
const SECRET = process.env.SCRAPER_SECRET

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (token !== SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { stdout } = await execAsync("cd /path/to/Real-Estate-Search-Automation && python run_scraper.py")
    return NextResponse.json({ ok: true, output: stdout })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
```

Add to `.env.local`:
```
SCRAPER_SECRET=some-random-long-secret
```

## Recommendation
Use **Option A (GitHub Actions)**. No server dependency, free, easy secrets management.
Option B only if app runs on a persistent server (not Vercel serverless).

## Done
- Zillow data refreshes automatically every week
- Manual trigger available (workflow_dispatch or POST endpoint)
- `rea.zillow_unique` stays current — market map/analytics stay useful
