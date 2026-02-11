# rNews

Personal news aggregation & push tool. Fetches news from RSS feeds and GitHub Trending, formats them as Markdown, and pushes to WPS Teams, WeChat Work (WeCom), and more via webhooks — all on a local cron schedule.

个人新闻聚合推送工具。从 RSS / GitHub Trending 抓取新闻，格式化为 Markdown，通过 Webhook 推送到 WPS Teams、企业微信等平台。支持本地定时调度与开机自启动。

## Why

- News apps are full of ads and clickbait
- Information feeds are inefficient and noisy
- You want to choose your own sources and topics

## Features

- **Multiple data sources** — RSS feeds and GitHub Trending
- **Multiple push platforms** — WPS Teams, WeChat Work (extensible via `WebhookAdapter` interface)
- **Auto-translation** — English titles are auto-translated to Chinese (Google Translate free API)
- **YAML config** — categories, sources, webhooks, and schedules are all configurable without touching code
- **Config & secrets separation** — `config.yaml` is safe to commit; secrets live in `.env`
- **Built-in cron scheduler** — runs locally with timezone support, no server or GitHub Actions needed
- **Auto-start on boot** — install scripts for both macOS (launchd) and Windows (Task Scheduler)

## Supported News Categories

| Category | Sources |
|----------|---------|
| Politics (时政要闻) | ChinaNews (World/Politics), BBC World, Al Jazeera |
| AI (AI 前沿) | TechCrunch AI, MIT Tech Review, The Verge AI |
| Finance (经济金融) | ChinaNews (Finance/Headlines), 36Kr, CNBC, MarketWatch |
| Tech (科技动态) | The Verge, Ars Technica, Wired |
| Frontend (前端开发) | 阮一峰的网络日志, CSS-Tricks, Smashing Magazine |
| Trending (网络热梗) | Baidu Hot Search, Toutiao Hot Board, Hacker News |
| Football (足球资讯) | BBC Football, ESPN FC |
| GitHub Trending | Daily trending repos (stars, growth, language) |

> All categories and sources are configurable in `config.yaml` — no code changes needed.

## Supported Push Platforms

| Platform | Type ID | Status |
|----------|---------|--------|
| WPS Teams | `wps-teams` | Implemented |
| WeChat Work (WeCom) | `wecom` | Implemented |

- Multiple webhook URLs per platform (different groups/channels)
- Each category can push to different webhooks
- Add more platforms by implementing the `WebhookAdapter` interface

## Project Structure

```
rNews/
├── src/
│   ├── index.ts              # CLI entry (push / list / start)
│   ├── scheduler.ts          # Cron-based local scheduler
│   ├── dispatcher.ts         # Fetch → translate → format → push
│   ├── translator.ts         # English title auto-translation
│   ├── formatter.ts          # Markdown formatter
│   ├── config/
│   │   ├── loader.ts         # YAML config + env var resolution
│   │   └── types.ts          # TypeScript type definitions
│   ├── sources/
│   │   ├── rss-source.ts     # RSS feed fetcher
│   │   ├── github-trending.ts # GitHub Trending scraper
│   │   └── types.ts          # Data source interfaces
│   └── webhooks/
│       ├── wps-teams.ts      # WPS Teams adapter
│       ├── wecom.ts          # WeChat Work adapter
│       └── types.ts          # Webhook adapter interface
├── scripts/
│   ├── install-macos.sh      # macOS auto-start installer (launchd)
│   ├── uninstall-macos.sh    # macOS auto-start uninstaller
│   ├── install-windows.ps1   # Windows auto-start installer (Task Scheduler)
│   └── uninstall-windows.ps1 # Windows auto-start uninstaller
├── config.yaml               # Configuration (no secrets)
├── config.example.yaml       # Configuration template
├── .env                      # Secrets (not committed)
├── run.sh                    # Startup script (macOS/Linux)
├── run.bat                   # Startup script (Windows)
├── package.json
└── tsconfig.json
```

## Quick Start

### Prerequisites

- **Node.js >= 20** (use [nvm](https://github.com/nvm-sh/nvm) for version management)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure

The project separates config from secrets:

- `config.yaml` — categories, sources, schedules, settings (**no secrets**, safe to commit)
- `.env` — webhook URLs and other sensitive values (**excluded by `.gitignore`**)

Copy the example files:

```bash
cp config.example.yaml config.yaml
cp .env.example .env
```

Edit `.env` with your actual webhook URLs:

```env
WPS_TEAMS_PERSONAL_URL=https://365.kdocs.cn/woa/api/v1/webhook/send?key=YOUR_KEY
```

In `config.yaml`, secrets are referenced via `${VAR_NAME}`:

```yaml
webhooks:
  wps-teams-personal:
    type: wps-teams
    url: "${WPS_TEAMS_PERSONAL_URL}"
```

> Lookup order: **System env vars > `.env` file**.

### 3. Manual Push

```bash
# Push all categories
npm run push:all

# Push specific categories
npx tsx src/index.ts push --category ai
npx tsx src/index.ts push --category politics,ai,finance

# List all configured categories, webhooks, and schedules
npm run list
```

On Windows, use `run.bat` instead of `run.sh`:

```cmd
run.bat push --category ai
run.bat list
```

### 4. Start the Local Scheduler

The scheduler reads cron rules from `config.yaml` and pushes news at scheduled times:

```bash
npm start
```

Default schedule (configurable in `config.yaml`):

| Time (Beijing) | Categories |
|----------------|------------|
| 08:00 daily | Politics, AI, Tech, Finance |
| 20:00 daily | Football, GitHub Trending |

The scheduler reloads config on each trigger — edit `config.yaml` without restarting.

### 5. Auto-Start on Boot

#### macOS (launchd)

Run the install script:

```bash
npm run install:macos
# or
bash scripts/install-macos.sh
```

This creates a launchd service (`com.rnews.scheduler`) that:
- Starts automatically on login
- Restarts if the process exits unexpectedly
- Logs to `./logs/scheduler.log`

**Useful commands:**

```bash
# Check status
launchctl list | grep rnews

# Stop
launchctl unload ~/Library/LaunchAgents/com.rnews.scheduler.plist

# Start
launchctl load ~/Library/LaunchAgents/com.rnews.scheduler.plist

# View logs
tail -f logs/scheduler.log

# Uninstall
npm run uninstall:macos
# or
bash scripts/uninstall-macos.sh
```

#### Windows (Task Scheduler)

Run the install script in PowerShell (as Administrator):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

This creates a Windows Task Scheduler task ("rNews Scheduler") that:
- Starts automatically on logon
- Runs even on battery power
- Auto-restarts up to 3 times on failure
- Logs to `.\logs\scheduler.log`

**Useful commands (PowerShell):**

```powershell
# Check status
Get-ScheduledTask -TaskName "rNews Scheduler"

# Stop
Stop-ScheduledTask -TaskName "rNews Scheduler"

# Start
Start-ScheduledTask -TaskName "rNews Scheduler"

# View logs
Get-Content -Tail 50 -Wait logs\scheduler.log

# Uninstall
powershell -ExecutionPolicy Bypass -File scripts\uninstall-windows.ps1
```

## Configuration Reference

See [config.example.yaml](config.example.yaml) for a fully commented example.

```yaml
# Global settings
settings:
  translate: true               # Auto-translate English titles (default: true)
  timezone: "Asia/Shanghai"     # Timezone for schedule (IANA format)

# Webhook definitions
webhooks:
  <webhook-id>:
    type: wps-teams | wecom
    url: "${ENV_VAR}"

# News categories
categories:
  <category-id>:
    name: "Display Name"
    count: 10
    webhooks: [webhook-id-1]
    sources:
      - name: "Source Name"
        type: rss
        url: "https://..."
      - type: github-trending
        language: ""             # Optional: "python", "javascript", etc.
        since: daily             # daily / weekly / monthly

# Schedule rules (cron format, used by local scheduler)
schedule:
  - cron: "0 8 * * *"           # minute hour day month weekday
    categories: [politics, ai]
```

### Adding a New Push Platform

Create a file in `src/webhooks/` implementing the `WebhookAdapter` interface:

```typescript
export interface WebhookAdapter {
  sendMarkdown(text: string): Promise<void>;
}
```

Then register it in `src/dispatcher.ts` → `createWebhookAdapter()`.

### Adding a New Category

Just add to `config.yaml` — no code changes:

```yaml
categories:
  my-category:
    name: "My Category"
    count: 10
    webhooks: [wps-teams-personal]
    sources:
      - name: "Some RSS Feed"
        type: rss
        url: "https://example.com/rss"
```

## Push Output Examples

**News (with auto-translated English titles):**

```markdown
## AI 前沿

1. [OpenAI Releases GPT-5（OpenAI 发布 GPT-5）](https://example.com/1)
2. [中国人工智能产业规模突破万亿元](https://example.com/2)
...

> Sources: TechCrunch AI / MIT Tech Review / The Verge AI
> Updated: 2026-02-11 08:00
```

**GitHub Trending (with auto-translated descriptions):**

```markdown
## GitHub 热门项目

1. [vercel/next.js](https://github.com/vercel/next.js) - The React Framework（React 框架） (*TypeScript, 128.5k ⭐, +320 today*)
2. [denoland/deno](https://github.com/denoland/deno) - A modern runtime（现代运行时） (*Rust, 98.2k ⭐, +150 today*)
...
```

## Notes

- **RSS availability**: Some international RSS feeds may require a proxy in mainland China. Consider [RSSHub](https://docs.rsshub.app/) as a middleware.
- **Translation**: Uses Google Translate free API. Set `settings.translate: false` if inaccessible from your network. Translation failures are silently skipped.
- **Timezone**: Default is `Asia/Shanghai`. Change `settings.timezone` to any [IANA timezone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

## Tech Stack

| Technology | Purpose |
|------------|---------|
| TypeScript + tsx | Language & runtime |
| node-cron | Local cron scheduler |
| commander | CLI framework |
| rss-parser | RSS feed parsing |
| cheerio | GitHub Trending HTML scraping |
| js-yaml | YAML config loading |
| launchd / Task Scheduler | OS-level auto-start |

## License

MIT
