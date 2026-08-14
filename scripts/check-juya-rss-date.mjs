import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  currentDateInTimeZone,
  DEFAULT_TIME_ZONE,
  inspectIssueDate,
  parseJuyaRss,
} from './lib/juya-rss.mjs'

const CONFIG_PATH = path.join(process.cwd(), 'config', 'daily-sources.json')

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}

async function loadSource() {
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  const source = config.sources?.find(
    (candidate) =>
      candidate.enabled && candidate.dedicatedReportKind === 'juya-rss-daily',
  )

  if (!source) throw new Error('No enabled juya-rss-daily source is configured')
  return source
}

async function main() {
  const source = await loadSource()
  const timeZone = source.timeZone || DEFAULT_TIME_ZONE
  const targetDate = argumentValue('--date') || currentDateInTimeZone(timeZone)
  const feedUrl = argumentValue('--url') || source.url
  const fetchedAt = new Date()
  const response = await fetch(feedUrl, {
    headers: {
      accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'user-agent': 'research-findings-juya-date-check/1.0',
    },
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    throw new Error(`RSS fetch failed with HTTP ${response.status}`)
  }

  const feed = parseJuyaRss(await response.text(), { timeZone })
  const inspection = inspectIssueDate(feed, targetDate)
  const result = {
    ...inspection,
    timeZone,
    feedUrl,
    feedTitle: feed.title,
    feedHomepage: feed.link,
    lastBuildDate: feed.lastBuildDate,
    fetchedAt: fetchedAt.toISOString(),
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = inspection.found ? 0 : 2
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ found: false, error: error.message }, null, 2)}\n`,
  )
  process.exitCode = 1
})
