import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reportsRoot = path.join(rootDir, 'public', 'reports')
const reportKinds = [
  'ai-hotspot-daily',
  'polymarket-daily',
  'juya-rss-daily',
]
const datedMarkdownPattern = /^\d{4}-\d{2}-\d{2}\.md$/
const reportKindTitles = {
  'ai-hotspot-daily': 'AI 热点日报',
  'polymarket-daily': 'Polymarket 热点日报',
  'juya-rss-daily': '橘鸦 RSS 追踪日报',
}
const reportKindOrder = new Map(
  reportKinds.map((kind, index) => [kind, index]),
)

async function exists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function collectReports(kind) {
  const kindDir = path.join(reportsRoot, kind)

  if (!(await exists(kindDir))) {
    return []
  }

  const entries = await fs.readdir(kindDir, { withFileTypes: true })
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && datedMarkdownPattern.test(entry.name))
    .map((entry) => entry.name)

  return Promise.all(
    markdownFiles.map(async (fileName) => {
      const date = fileName.replace(/\.md$/, '')
      const title = `${reportKindTitles[kind] ?? kind}｜${date}`

      return {
        id: `${kind}/${date}`,
        kind,
        date,
        title,
        path: `/reports/${kind}/${fileName}`,
      }
    }),
  )
}

await fs.mkdir(reportsRoot, { recursive: true })

const reports = (await Promise.all(reportKinds.map(collectReports)))
  .flat()
  .sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      (reportKindOrder.get(left.kind) ?? reportKinds.length) -
        (reportKindOrder.get(right.kind) ?? reportKinds.length),
  )

const manifest = {
  generatedAt: new Date().toISOString(),
  reports,
}

await fs.writeFile(
  path.join(reportsRoot, 'index.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)

console.log(`Indexed ${reports.length} reports in public/reports/index.json`)
