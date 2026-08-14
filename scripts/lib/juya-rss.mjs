import { XMLParser } from 'fast-xml-parser'

export const DEFAULT_TIME_ZONE = 'Asia/Shanghai'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISSUE_LINK_PATTERN = /\/issues\/(\d{4}-\d{2}-\d{2})\/?(?:[?#].*)?$/

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asArray(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

export function dateInTimeZone(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))

  return `${values.year}-${values.month}-${values.day}`
}

export function currentDateInTimeZone(timeZone = DEFAULT_TIME_ZONE, now = new Date()) {
  return dateInTimeZone(now, timeZone)
}

export function parseJuyaRss(xml, { timeZone = DEFAULT_TIME_ZONE } = {}) {
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

  const items = asArray(channel.item).map((item) => {
    const title = text(item?.title)
    const link = text(item?.link)
    const pubDate = text(item?.pubDate)
    const titleDate = DATE_PATTERN.test(title) ? title : null
    const linkDate = link.match(ISSUE_LINK_PATTERN)?.[1] ?? null

    return {
      title,
      link,
      pubDate,
      titleDate,
      linkDate,
      pubDateDate: dateInTimeZone(pubDate, timeZone),
    }
  })

  return {
    title: text(channel.title),
    link: text(channel.link),
    lastBuildDate: text(channel.lastBuildDate),
    items,
  }
}

export function inspectIssueDate(feed, targetDate) {
  if (!DATE_PATTERN.test(targetDate)) {
    throw new Error(`Invalid target date: ${targetDate}`)
  }

  const exactIssue = feed.items.find(
    (item) =>
      item.titleDate === targetDate &&
      item.linkDate === targetDate &&
      item.pubDateDate === targetDate,
  )
  const partialMatches = feed.items.filter(
    (item) =>
      item.titleDate === targetDate ||
      item.linkDate === targetDate ||
      item.pubDateDate === targetDate,
  )

  return {
    found: Boolean(exactIssue),
    targetDate,
    issue: exactIssue ?? null,
    latestIssue: feed.items[0] ?? null,
    partialMatches,
  }
}
