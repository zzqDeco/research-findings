import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectAtomWindow, parseAtomFeed } from './lib/atom-feed.mjs'

function atom(entries) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Example feed</title>
      <link href="https://example.com/" rel="alternate" />
      <id>https://example.com/</id>
      <updated>2026-08-14T00:00:00Z</updated>
      ${entries.join('\n')}
    </feed>`
}

function entry({ title, published, updated = published, categories = [] }) {
  return `<entry>
    <title>${title}</title>
    <link href="https://example.com/${title}" rel="alternate" />
    <id>https://example.com/${title}</id>
    <published>${published}</published>
    <updated>${updated}</updated>
    ${categories.map((category) => `<category term="${category}" />`).join('\n')}
  </entry>`
}

test('parses Atom metadata, links, and categories', () => {
  const feed = parseAtomFeed(
    atom([
      entry({
        title: 'fresh',
        published: '2026-08-13T12:00:00Z',
        categories: ['ai', 'llms'],
      }),
    ]),
  )

  assert.equal(feed.title, 'Example feed')
  assert.equal(feed.homepage, 'https://example.com/')
  assert.deepEqual(feed.entries[0].categories, ['ai', 'llms'])
})

test('uses published timestamps and a half-open report window', () => {
  const feed = parseAtomFeed(
    atom([
      entry({ title: 'start', published: '2026-08-13T00:00:00Z' }),
      entry({ title: 'inside', published: '2026-08-13T23:59:59Z' }),
      entry({ title: 'end', published: '2026-08-14T00:00:00Z' }),
    ]),
  )
  const result = inspectAtomWindow(feed, {
    start: '2026-08-13T00:00:00Z',
    end: '2026-08-14T00:00:00Z',
  })

  assert.deepEqual(
    result.publishedEntries.map(({ title }) => title),
    ['start', 'inside'],
  )
})

test('tracks an old article updated in the window separately', () => {
  const feed = parseAtomFeed(
    atom([
      entry({
        title: 'updated-old-post',
        published: '2026-08-10T12:00:00Z',
        updated: '2026-08-13T12:00:00Z',
      }),
    ]),
  )
  const result = inspectAtomWindow(feed, {
    start: '2026-08-13T00:00:00Z',
    end: '2026-08-14T00:00:00Z',
  })

  assert.equal(result.publishedEntries.length, 0)
  assert.equal(result.updatedEntries[0].title, 'updated-old-post')
})

test('rejects invalid report windows', () => {
  const feed = parseAtomFeed(atom([]))

  assert.throws(
    () =>
      inspectAtomWindow(feed, {
        start: '2026-08-14T00:00:00Z',
        end: '2026-08-13T00:00:00Z',
      }),
    /valid start and end/,
  )
})
