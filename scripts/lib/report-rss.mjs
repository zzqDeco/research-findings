import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { XMLBuilder } from 'fast-xml-parser'

export const DEFAULT_SITE_URL = 'https://zzqdeco.github.io/research-findings/'
export const RSS_LIMIT = 60

export async function generateReportRss({ reports, generatedAt, readReport, siteUrl = DEFAULT_SITE_URL }) {
  const site = new URL(siteUrl)
  if (!['https:', 'http:'].includes(site.protocol) || site.search || site.hash) {
    throw new Error('REPORT_SITE_URL must be an absolute HTTP(S) site URL without query or fragment')
  }
  site.pathname = `${site.pathname.replace(/\/$/, '')}/`

  const items = []
  for (const report of reports.slice(0, RSS_LIMIT)) {
    const link = new URL(site)
    link.searchParams.set('report', report.id)
    const markdownUrl = new URL(report.path.replace(/^\/+/, ''), site)
    const markdown = await readReport(report)
    const html = renderToStaticMarkup(createElement(Markdown, {
      remarkPlugins: [remarkGfm],
      skipHtml: true,
      urlTransform(value) {
        const safe = defaultUrlTransform(value)
        try {
          return safe ? new URL(safe, markdownUrl).href : ''
        } catch {
          return ''
        }
      },
      children: markdown,
    }))
    items.push({
      title: report.title,
      link: link.href,
      guid: { '@_isPermaLink': 'true', '#text': link.href },
      category: report.kind,
      // Report issue time, not a claim about the publication time of source stories.
      pubDate: new Date(`${report.date}T08:00:00+08:00`).toUTCString(),
      description: html,
    })
  }

  const builder = new XMLBuilder({ ignoreAttributes: false, suppressBooleanAttributes: false, format: true })
  return builder.build({
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    rss: {
      '@_version': '2.0',
      '@_xmlns:atom': 'http://www.w3.org/2005/Atom',
      channel: {
        title: '每日情报',
        link: site.href,
        description: 'AI 热点、Polymarket 与橘鸦 RSS 每日日报',
        language: 'zh-cn',
        lastBuildDate: new Date(generatedAt).toUTCString(),
        ttl: 60,
        'atom:link': {
          '@_href': new URL('reports/rss.xml', site).href,
          '@_rel': 'self',
          '@_type': 'application/rss+xml',
        },
        item: items,
      },
    },
  })
}
