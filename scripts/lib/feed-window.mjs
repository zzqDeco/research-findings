function validDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function inHalfOpenWindow(value, start, end) {
  const date = validDate(value)
  return Boolean(date && date >= start && date < end)
}

export function inspectFeedWindow(feed, { start, end }) {
  const startDate = validDate(start)
  const endDate = validDate(end)

  if (!startDate || !endDate || startDate >= endDate) {
    throw new Error('Feed window requires valid start and end timestamps')
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
