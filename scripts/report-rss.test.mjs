import assert from 'node:assert/strict'
import test from 'node:test'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { generateReportRss, RSS_LIMIT } from './lib/report-rss.mjs'

const report = {
  id: 'ai-hotspot-daily/2026-09-29', kind: 'ai-hotspot-daily',
  date: '2026-09-29', title: 'AI & <每日情报>',
  path: '/reports/ai-hotspot-daily/2026-09-29.md',
}
const options = {
  reports: [report], generatedAt: '2026-09-29T02:00:00Z',
  readReport: async () => '# 标题\n\nA & B ]]>\n\n[证据](https://example.com/?a=1&b=2)\n\n[附件](./image.png)\n\n<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n| A | B |\n| - | - |\n| 1 | 2 |',
}
const parse = (xml) => new XMLParser({ ignoreAttributes: false }).parse(xml).rss.channel

test('valid XML, full safe HTML, absolute links, stable GUID and Shanghai issue date', async () => {
  const xml = await generateReportRss(options)
  assert.equal(XMLValidator.validate(xml), true)
  const channel = parse(xml)
  assert.equal(channel.item.title, report.title)
  assert.equal(new URL(channel.item.link).searchParams.get('report'), report.id)
  assert.equal(channel.item.guid['#text'], channel.item.link)
  assert.equal(channel.item.pubDate, 'Tue, 29 Sep 2026 00:00:00 GMT')
  assert.match(channel.item.description, /<table>/)
  assert.match(channel.item.description, /https:\/\/zzqdeco.github.io\/research-findings\/reports\/ai-hotspot-daily\/image.png/)
  assert.doesNotMatch(channel.item.description, /<script|javascript:/)
  assert.match(channel.item.description, /a=1&amp;b=2/)
  const refreshed = parse(await generateReportRss({ ...options, generatedAt: '2026-09-30T02:00:00Z' }))
  assert.equal(refreshed.item.guid['#text'], channel.item.guid['#text'])
  assert.equal(refreshed.item.pubDate, channel.item.pubDate)
})

test('custom site base, all kinds, bounded reads and empty archive', async () => {
  let reads = 0
  const reports = Array.from({ length: 80 }, (_, i) => ({
    ...report, id: `report-${i}`, kind: ['ai-hotspot-daily', 'polymarket-daily', 'juya-rss-daily'][i % 3],
  }))
  const channel = parse(await generateReportRss({
    ...options, reports, siteUrl: 'https://example.org/news',
    readReport: async () => { reads++; return 'text' },
  }))
  assert.equal(reads, RSS_LIMIT)
  assert.equal(channel.item.length, RSS_LIMIT)
  assert.equal(new Set(channel.item.map((item) => item.category)).size, 3)
  assert.equal(channel['atom:link']['@_href'], 'https://example.org/news/reports/rss.xml')
  assert.equal(new URL(channel.item[0].link).pathname, '/news/')
  const empty = await generateReportRss({ ...options, reports: [] })
  assert.equal(XMLValidator.validate(empty), true)
  assert.equal(parse(empty).item, undefined)
  await assert.rejects(generateReportRss({ ...options, siteUrl: 'file:///tmp/' }))
})
