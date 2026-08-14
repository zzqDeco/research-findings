import { XMLParser } from 'fast-xml-parser'
import { inspectFeedWindow } from './feed-window.mjs'

function asArray(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function text(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object') return text(value['#text'])
  return ''
}

function alternateLink(value) {
  const links = asArray(value)
  const alternate = links.find(
    (link) => link?.['@_rel'] === 'alternate' && link?.['@_href'],
  )
  const fallback = links.find((link) => link?.['@_href'])
  return text(alternate?.['@_href'] ?? fallback?.['@_href'])
}

export function parseAtomFeed(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    processEntities: true,
    trimValues: true,
  })
  const feed = parser.parse(xml)?.feed

  if (!feed || typeof feed !== 'object') {
    throw new Error('Atom feed is missing')
  }

  const entries = asArray(feed.entry).map((entry) => ({
    title: text(entry?.title),
    url: alternateLink(entry?.link),
    id: text(entry?.id),
    published: text(entry?.published),
    updated: text(entry?.updated),
    categories: asArray(entry?.category)
      .map((category) => text(category?.['@_term']))
      .filter(Boolean),
  }))

  return {
    title: text(feed.title),
    homepage: alternateLink(feed.link),
    id: text(feed.id),
    updated: text(feed.updated),
    entries,
  }
}

export function inspectAtomWindow(feed, { start, end }) {
  return inspectFeedWindow(feed, { start, end })
}
