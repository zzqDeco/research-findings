import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectRssWindow, parseRssFeed } from './lib/rss-feed.mjs'

function rss(items) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <rss xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
      <channel>
        <title>Example RSS</title>
        <link>https://example.com/</link>
        <description>AI newsletter</description>
        <lastBuildDate>Fri, 14 Aug 2026 00:00:00 GMT</lastBuildDate>
        ${items.join('\n')}
      </channel>
    </rss>`
}

function item({ title, pubDate, author = '' }) {
  return `<item>
    <title>${title}</title>
    <link>https://example.com/${title}</link>
    <guid isPermaLink="false">item-${title}</guid>
    <pubDate>${pubDate}</pubDate>
    <dc:creator>${author}</dc:creator>
    <description>Summary for ${title}</description>
    <category>AI</category>
  </item>`
}

test('parses RSS metadata and normalized entry fields', () => {
  const feed = parseRssFeed(
    rss([
      item({
        title: 'fresh',
        pubDate: 'Thu, 13 Aug 2026 12:00:00 GMT',
        author: 'Editor',
      }),
    ]),
  )

  assert.equal(feed.title, 'Example RSS')
  assert.equal(feed.entries[0].published, 'Thu, 13 Aug 2026 12:00:00 GMT')
  assert.equal(feed.entries[0].author, 'Editor')
  assert.deepEqual(feed.entries[0].categories, ['AI'])
})

test('selects RSS pubDate values with the same half-open report window', () => {
  const feed = parseRssFeed(
    rss([
      item({ title: 'start', pubDate: 'Thu, 13 Aug 2026 00:00:00 GMT' }),
      item({ title: 'inside', pubDate: 'Thu, 13 Aug 2026 23:59:59 GMT' }),
      item({ title: 'end', pubDate: 'Fri, 14 Aug 2026 00:00:00 GMT' }),
    ]),
  )
  const result = inspectRssWindow(feed, {
    start: '2026-08-13T00:00:00Z',
    end: '2026-08-14T00:00:00Z',
  })

  assert.deepEqual(
    result.publishedEntries.map(({ title }) => title),
    ['start', 'inside'],
  )
  assert.equal(result.updatedEntries.length, 0)
})
