import { XMLParser } from 'fast-xml-parser'

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

function validDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function inHalfOpenWindow(value, start, end) {
  const date = validDate(value)
  return Boolean(date && date >= start && date < end)
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
  const startDate = validDate(start)
  const endDate = validDate(end)

  if (!startDate || !endDate || startDate >= endDate) {
    throw new Error('Atom window requires valid start and end timestamps')
  }

  const publishedEntries = feed.entries.filter((entry) =>
    inHalfOpenWindow(entry.published, startDate, endDate),
  )
  const updatedEntries = feed.entries.filter(
    (entry) =>
      !inHalfOpenWindow(entry.published, startDate, endDate) &&
      inHalfOpenWindow(entry.updated, startDate, endDate),
  )
  const invalidEntries = feed.entries.filter(
    (entry) => !validDate(entry.published),
  )

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    interval: '[start, end)',
    freshnessField: 'published',
    publishedEntries,
    updatedEntries,
    invalidEntries,
  }
}
