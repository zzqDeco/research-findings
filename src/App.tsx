import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  CalendarDays,
  LineChart,
  RefreshCw,
  Rss,
  Search,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Download,
  X,
} from 'lucide-react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import type { RootContent } from 'mdast'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

type ReportKind =
  | 'ai-hotspot-daily'
  | 'polymarket-daily'
  | 'juya-rss-daily'
type KindFilter = 'all' | ReportKind

type ReportMeta = {
  id: string
  kind: ReportKind
  date: string
  title: string
  path: string
}

type ReportManifest = {
  generatedAt: string
  reports: ReportMeta[]
}

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

const kindLabels: Record<ReportKind, string> = {
  'ai-hotspot-daily': 'AI 热点',
  'polymarket-daily': 'Polymarket',
  'juya-rss-daily': '橘鸦 RSS',
}

const kindDescriptions: Record<ReportKind, string> = {
  'ai-hotspot-daily': '模型、产品、研究与政策动态',
  'polymarket-daily': '预测市场热点、概率变化与背景',
  'juya-rss-daily': '橘鸦AI早报 RSS 完整追踪',
}

const kindIcons: Record<ReportKind, typeof Bot> = {
  'ai-hotspot-daily': Bot,
  'polymarket-daily': LineChart,
  'juya-rss-daily': Rss,
}

const filters: Array<{ value: KindFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'ai-hotspot-daily', label: 'AI 热点' },
  { value: 'polymarket-daily', label: 'Polymarket' },
  { value: 'juya-rss-daily', label: '橘鸦 RSS' },
]

function publicPath(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T00:00:00+08:00`)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Shanghai',
  }).format(parsed)
}

function nodeText(node: RootContent): string {
  if ('value' in node) return node.value
  return 'children' in node ? node.children.map(nodeText).join('') : ''
}

const markdownParser = unified().use(remarkParse)

function formatGeneratedAt(value?: string) {
  if (!value) {
    return '尚未生成索引'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(parsed)
}

function App() {
  const [manifest, setManifest] = useState<ReportManifest | null>(null)
  const [manifestState, setManifestState] = useState<LoadState>('idle')
  const [manifestError, setManifestError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('report'),
  )
  const [loadedReportId, setLoadedReportId] = useState<string | null>(null)
  const readerRef = useRef<HTMLElement>(null)
  const lastDisplayedId = useRef<string | null>(null)
  const openedFromLink = useRef(Boolean(selectedId))
  const [selectedMarkdown, setSelectedMarkdown] = useState('')
  const [reportState, setReportState] = useState<LoadState>('idle')
  const [reportError, setReportError] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [query, setQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [archiveOpen, setArchiveOpen] = useState(false)

  useEffect(() => {
    let ignore = false

    async function loadManifest() {
      setManifestState('loading')
      setManifestError('')

      try {
        const response = await fetch(
          `${publicPath('reports/index.json')}?refresh=${refreshKey}`,
        )

        if (!response.ok) {
          if (response.status === 404) {
            if (!ignore) {
              setManifest({ generatedAt: '', reports: [] })
              setManifestState('empty')
            }
            return
          }

          throw new Error(`索引读取失败：HTTP ${response.status}`)
        }

        const data = (await response.json()) as ReportManifest
        const reports = Array.isArray(data.reports) ? data.reports : []

        if (!ignore) {
          setManifest({ generatedAt: data.generatedAt ?? '', reports })
          setManifestState(reports.length > 0 ? 'ready' : 'empty')
        }
      } catch (error) {
        if (!ignore) {
          setManifest(null)
          setManifestError(error instanceof Error ? error.message : '索引读取失败')
          setManifestState('error')
        }
      }
    }

    loadManifest()

    return () => {
      ignore = true
    }
  }, [refreshKey])

  const reports = useMemo(() => manifest?.reports ?? [], [manifest])
  const latestDate = reports[0]?.date

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return reports.filter((report) => {
      const matchesKind = kindFilter === 'all' || report.kind === kindFilter
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${report.title} ${report.date} ${kindLabels[report.kind]}`
          .toLowerCase()
          .includes(normalizedQuery)

      return matchesKind && matchesQuery
    })
  }, [kindFilter, query, reports])

  const selectedReport = useMemo(() => {
    if (filteredReports.length === 0) {
      return null
    }

    const explicitSelection = selectedId
      ? filteredReports.find((report) => report.id === selectedId)
      : null

    return explicitSelection ?? filteredReports[0]
  }, [filteredReports, selectedId])

  useEffect(() => {
    if (!selectedReport) {
      return
    }

    let ignore = false
    const reportToLoad = selectedReport

    async function loadReport() {
      setReportState('loading')
      setReportError('')

      try {
        const response = await fetch(
          `${publicPath(reportToLoad.path)}?refresh=${refreshKey}`,
        )

        if (!response.ok) {
          throw new Error(`日报读取失败：HTTP ${response.status}`)
        }

        const text = await response.text()

        if (!ignore) {
          setSelectedMarkdown(text)
          setLoadedReportId(reportToLoad.id)
          setReportState(text.trim().length > 0 ? 'ready' : 'empty')
        }
      } catch (error) {
        if (!ignore) {
          setSelectedMarkdown('')
          setLoadedReportId(reportToLoad.id)
          setReportError(error instanceof Error ? error.message : '日报读取失败')
          setReportState('error')
        }
      }
    }

    loadReport()

    return () => {
      ignore = true
    }
  }, [refreshKey, selectedReport])

  useLayoutEffect(() => {
    if (
      !selectedReport ||
      loadedReportId !== selectedReport.id ||
      reportState === 'loading' ||
      reportState === 'idle'
    ) {
      return
    }

    if (lastDisplayedId.current !== selectedReport.id) {
      if (lastDisplayedId.current !== null || openedFromLink.current) {
        readerRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      }
      lastDisplayedId.current = selectedReport.id
    }
  }, [selectedReport, loadedReportId, reportState])

  useEffect(() => {
    if (!selectedReport) return
    const url = new URL(window.location.href)
    url.searchParams.set('report', selectedReport.id)
    url.hash = ''
    window.history.replaceState(null, '', url)
  }, [selectedReport])

  const counts = useMemo(
    () =>
      reports.reduce(
        (accumulator, report) => ({
          ...accumulator,
          [report.kind]: accumulator[report.kind] + 1,
        }),
        {
          'ai-hotspot-daily': 0,
          'polymarket-daily': 0,
          'juya-rss-daily': 0,
        } satisfies Record<ReportKind, number>,
      ),
    [reports],
  )

  const SelectedIcon = selectedReport ? kindIcons[selectedReport.kind] : Bot
  const currentReportLoaded = selectedReport?.id === loadedReportId
  const markdownTree = useMemo(() => markdownParser.parse(selectedMarkdown), [selectedMarkdown])
  const metadataNode = markdownTree.children[1]
  const metadataOffset = metadataNode?.type === 'list' && !metadataNode.ordered
    ? metadataNode.position?.start.offset : undefined
  const contents = useMemo(() => markdownTree.children
    .filter((node) => node.type === 'heading' && node.depth === 2)
    .map((node) => ({ id: `section-${node.position?.start.offset}`, title: nodeText(node) })),
  [markdownTree])

  function selectReport(id: string) {
    setSelectedId(id)
    setArchiveOpen(false)
    if (id === loadedReportId) {
      readerRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="每日情报首页">
          <img src={publicPath('favicon.svg')} width="30" height="30" alt="" />
          <span>每日情报<small>DAILY INTELLIGENCE</small></span>
        </a>
        <nav className="site-nav" aria-label="日报分类">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={kindFilter === filter.value ? 'active' : ''}
              aria-pressed={kindFilter === filter.value}
              onClick={() => { setKindFilter(filter.value); setArchiveOpen(false) }}
            >
              {filter.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <a
            className="source-nav-link"
            href={publicPath('reports/rss.xml')}
            title="订阅每日情报 RSS"
          >
            <Rss aria-hidden="true" size={15} />
            <span>RSS 订阅</span>
          </a>
          <button
            type="button"
            className={`icon-button ${manifestState === 'loading' ? 'is-refreshing' : ''}`}
            onClick={() => setRefreshKey((value) => value + 1)}
            title="刷新日报索引"
            aria-label="刷新日报索引"
          >
            <RefreshCw aria-hidden="true" size={16} />
          </button>
        </div>
      </header>

      <main className="page-shell">
        <div className="workspace">
          <button className="archive-toggle" type="button" aria-expanded={archiveOpen}
            aria-controls="archive-panel" onClick={() => setArchiveOpen((value) => !value)}>
            <BookOpen size={16} /> <span>日报归档</span>
            <span>{selectedReport?.date}</span><ChevronDown size={16} />
          </button>
          <aside id="archive-panel" className={`archive-panel ${archiveOpen ? 'is-open' : ''}`} aria-label="日报归档">
            <div className="archive-header">
              <div>
                <p className="section-label">THE ARCHIVE</p>
                <h2>每一天，值得关注</h2>
              </div>
              <span className="archive-count" title="当前筛选结果">
                {filteredReports.length}
              </span>
            </div>

            <p className="archive-summary">{reports.length} 份情报 · 三个观察视角</p>
            <label className="search-box">
              <Search aria-hidden="true" size={16} />
              <span className="sr-only">搜索日报</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索标题或日期"
              />
              {query && <button type="button" className="icon-button" onClick={() => setQuery('')}
                aria-label="清除搜索" title="清除搜索"><X size={14} /></button>}
            </label>

            <div className="report-list" aria-live="polite">
              {manifestState === 'loading' && (
                <div className="state-panel">正在读取日报索引...</div>
              )}

              {manifestState === 'error' && (
                <div className="state-panel error">{manifestError}</div>
              )}

              {manifestState !== 'loading' &&
                manifestState !== 'error' &&
                filteredReports.length === 0 && (
                  <div className="state-panel">
                    {reports.length === 0
                      ? '还没有日报。下一次 08:00 自动化运行后会出现在这里。'
                      : '没有匹配当前条件的日报。'}
                  </div>
                )}

              {filteredReports.map((report) => {
                const Icon = kindIcons[report.kind]
                const isSelected = selectedReport?.id === report.id

                return (
                  <button
                    key={report.id}
                    type="button"
                    className={`report-item kind-${report.kind} ${
                      isSelected ? 'selected' : ''
                    }`}
                    aria-pressed={isSelected}
                    onClick={() => selectReport(report.id)}
                  >
                    <span className="report-icon">
                      <Icon aria-hidden="true" size={16} />
                    </span>
                    <span className="report-copy">
                      <strong>{report.date}</strong>
                      <span>
                        {kindLabels[report.kind]}
                      </span>
                    </span>
                    {report.date === latestDate && (
                      <span className="latest-mark" title="最新一期">新</span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="archive-bottom"><span className="status-dot" />更新于 {formatGeneratedAt(manifest?.generatedAt)}</div>
          </aside>

          <section
            ref={readerRef}
            className={`reader ${
              selectedReport ? `kind-${selectedReport.kind}` : 'kind-empty'
            }`}
            aria-label="日报内容"
            id="reader"
          >
            {selectedReport && (
              <div className="issue-meta">
                <span className="issue-kind">
                  <SelectedIcon aria-hidden="true" size={15} />
                  {kindLabels[selectedReport.kind]}
                </span>
                <span><CalendarDays aria-hidden="true" size={14} />{formatDate(selectedReport.date)}</span>
                {selectedReport.date === latestDate && (
                  <span className="latest-label">最新一期</span>
                )}
                <a className="icon-button" href={publicPath(selectedReport.path)} download
                  title="下载 Markdown" aria-label="下载 Markdown"><Download size={16} /></a>
              </div>
            )}

            <article className="markdown-frame">
              {selectedReport && !currentReportLoaded && (
                <div className="reader-state">正在加载日报内容...</div>
              )}

              {selectedReport && currentReportLoaded && reportState === 'error' && (
                <div className="reader-state error">{reportError}</div>
              )}

              {(!selectedReport || (currentReportLoaded && reportState === 'empty')) && (
                <div className="reader-state">
                  选择一份日报查看正文；如果列表为空，请等待自动化生成。
                </div>
              )}

              {selectedReport && currentReportLoaded &&
                (reportState === 'ready' || reportState === 'loading') && (
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1({ children }) {
                      const date = selectedReport?.date
                      return <h1>{typeof children === 'string' && date && children.endsWith(date)
                        ? <>{children.slice(0, -date.length)}<span className="report-date">{date}</span></>
                        : children}</h1>
                    },
                    ul({ node, children, ...props }) {
                      if (metadataOffset !== undefined && node?.position?.start.offset === metadataOffset) {
                        return <details key={loadedReportId} className="report-notes">
                          <summary>采集与核验记录<ChevronDown size={14} aria-hidden="true" /></summary>
                          <ul {...props}>{children}</ul>
                        </details>
                      }
                      return <ul {...props}>{children}</ul>
                    },
                    h2({ node, children, ...props }) {
                      return <h2 {...props} id={`section-${node?.position?.start.offset}`}>{children}</h2>
                    },
                    a({ href, children, title }) {
                      const resolved = href && !href.startsWith('#') && selectedReport
                        ? new URL(href, new URL(publicPath(selectedReport.path), window.location.origin)) : null
                      const linkedReport = resolved && reports.find((report) =>
                        new URL(publicPath(report.path), window.location.origin).href === resolved.href)
                      const external = resolved?.protocol.startsWith('http') && !linkedReport

                      return (
                        <a
                          title={title}
                          href={linkedReport ? `?report=${encodeURIComponent(linkedReport.id)}` : resolved?.href ?? href}
                          onClick={linkedReport ? (event) => { event.preventDefault(); setKindFilter('all'); setQuery(''); selectReport(linkedReport.id) } : undefined}
                          target={external ? '_blank' : undefined}
                          rel={external ? 'noreferrer' : undefined}
                        >
                          {children}
                        </a>
                      )
                    },
                  }}
                >
                  {selectedMarkdown}
                </Markdown>
              )}
            </article>
          </section>
          <aside className="contents-panel" aria-label="文章目录">
            <p className="section-label">本期目录</p>
            <p className="contents-description">{selectedReport && kindDescriptions[selectedReport.kind]}</p>
            {currentReportLoaded && reportState === 'ready' && <nav>
              {contents.map((item) => <a key={item.id} href={`#${item.id}`}>{item.title}</a>)}
            </nav>}
            <div className="contents-tools">
              <button type="button" onClick={() => readerRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })}>
                <ArrowUp size={14} />回到顶部
              </button>
              <a href={publicPath('reports/rss.xml')}><Rss size={14} />订阅每日情报<ArrowUpRight size={12} /></a>
            </div>
            <div className="archive-stats">
              {Object.entries(counts).map(([kind, count]) => <div key={kind}>
                <span>{kindLabels[kind as ReportKind]}</span><strong>{count}</strong>
              </div>)}
            </div>
          </aside>
        </div>
      </main>

      <footer className="site-footer">
        <span>北京时间每日 08:00 更新</span>
        <a href={publicPath('reports/rss.xml')}>每日情报 RSS</a>
        <a
          href="https://daily.juya.uk/rss.xml"
          target="_blank"
          rel="noreferrer"
        >
          橘鸦AI早报 RSS
        </a>
      </footer>
    </div>
  )
}

export default App
