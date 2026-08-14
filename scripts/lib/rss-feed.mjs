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

export function parseRssFeed(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    processEntities: true,
    trimValues: true,
  })
  const channel = parser.parse(xml)?.rss?.channel

  if (!channel || typeof channel !== 'object') {
    throw new Error('RSS channel is missing')
  }

  const entries = asArray(channel.item).map((item) => ({
    title: text(item?.title),
    url: text(item?.link),
    id: text(item?.guid),
    published: text(item?.pubDate),
    updated: '',
    author: text(item?.['dc:creator']),
    description: text(item?.description),
    categories: asArray(item?.category).map(text).filter(Boolean),
  }))

  return {
    title: text(channel.title),
    homepage: text(channel.link),
    description: text(channel.description),
    lastBuildDate: text(channel.lastBuildDate),
    entries,
  }
}

export function inspectRssWindow(feed, { start, end }) {
  return inspectFeedWindow(feed, { start, end })
}
