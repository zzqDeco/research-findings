import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dateInTimeZone,
  inspectIssueDate,
  parseJuyaRss,
} from './lib/juya-rss.mjs'

function rss(items) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <rss version="2.0">
      <channel>
        <title>橘鸦AI早报</title>
        <link>https://daily.juya.uk/</link>
        <lastBuildDate>Fri, 14 Aug 2026 01:00:00 GMT</lastBuildDate>
        ${items.join('\n')}
      </channel>
    </rss>`
}

function item({ title, link = title, pubDate }) {
  return `<item>
    <title>${title}</title>
    <link>https://daily.juya.uk/issues/${link}/</link>
    <pubDate>${pubDate}</pubDate>
  </item>`
}

test('converts publication timestamps to an Asia/Shanghai calendar date', () => {
  assert.equal(
    dateInTimeZone('Thu, 13 Aug 2026 16:30:00 GMT'),
    '2026-08-14',
  )
})

test('does not reuse yesterday even when it falls within the past 24 hours', () => {
  const feed = parseJuyaRss(
    rss([
      item({
        title: '2026-08-13',
        pubDate: 'Thu, 13 Aug 2026 01:44:57 GMT',
      }),
    ]),
  )
  const result = inspectIssueDate(feed, '2026-08-14')

  assert.equal(result.found, false)
  assert.equal(result.issue, null)
  assert.equal(result.latestIssue.title, '2026-08-13')
})

test('accepts an issue only when title, link, and Shanghai pubDate all match', () => {
  const feed = parseJuyaRss(
    rss([
      item({
        title: '2026-08-14',
        pubDate: 'Fri, 14 Aug 2026 01:05:00 GMT',
      }),
    ]),
  )
  const result = inspectIssueDate(feed, '2026-08-14')

  assert.equal(result.found, true)
  assert.equal(result.issue.title, '2026-08-14')
  assert.equal(result.issue.linkDate, '2026-08-14')
  assert.equal(result.issue.pubDateDate, '2026-08-14')
})

test('rejects a partial date match instead of guessing the issue identity', () => {
  const feed = parseJuyaRss(
    rss([
      item({
        title: '2026-08-14',
        link: '2026-08-13',
        pubDate: 'Thu, 13 Aug 2026 01:44:57 GMT',
      }),
    ]),
  )
  const result = inspectIssueDate(feed, '2026-08-14')

  assert.equal(result.found, false)
  assert.equal(result.partialMatches.length, 1)
})
