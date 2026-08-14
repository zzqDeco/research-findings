import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { inspectAtomWindow, parseAtomFeed } from './lib/atom-feed.mjs'

const CONFIG_PATH = path.join(process.cwd(), 'config', 'daily-sources.json')

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}

async function loadSource(sourceId) {
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  const source = config.sources?.find(
    (candidate) =>
      candidate.enabled &&
      candidate.id === sourceId &&
      candidate.type === 'atom' &&
      candidate.appliesTo?.includes('ai-hotspot-daily'),
  )

  if (!source) {
    throw new Error(`No enabled AI Atom source is configured for ${sourceId}`)
  }
  return source
}

async function main() {
  const sourceId = argumentValue('--source')
  if (!sourceId) throw new Error('Missing required --source argument')

  const source = await loadSource(sourceId)
  const end = new Date(argumentValue('--end') ?? Date.now())
  const durationHours = source.windowPolicy?.durationHours ?? 24
  const start = new Date(
    argumentValue('--start') ?? end.getTime() - durationHours * 60 * 60 * 1000,
  )
  const feedUrl = argumentValue('--url') ?? source.url
  const fetchedAt = new Date()
  const response = await fetch(feedUrl, {
    headers: {
      accept: 'application/atom+xml, application/xml;q=0.9, text/xml;q=0.8',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'user-agent': 'research-findings-fixed-atom-scan/1.0',
    },
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    throw new Error(`Atom fetch failed with HTTP ${response.status}`)
  }

  const feed = parseAtomFeed(await response.text())
  const inspection = inspectAtomWindow(feed, { start, end })
  const result = {
    sourceId: source.id,
    sourceName: source.name,
    feedUrl,
    feedTitle: feed.title,
    feedHomepage: feed.homepage,
    feedUpdated: feed.updated,
    fetchedAt: fetchedAt.toISOString(),
    totalEntries: feed.entries.length,
    ...inspection,
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message }, null, 2)}\n`)
  process.exitCode = 1
})
