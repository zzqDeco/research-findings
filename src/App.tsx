import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  CalendarDays,
  LineChart,
  RefreshCw,
  Rss,
  Search,
} from 'lucide-react'
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
  }).format(parsed)
}

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedMarkdown, setSelectedMarkdown] = useState('')
  const [reportState, setReportState] = useState<LoadState>('idle')
  const [reportError, setReportError] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [query, setQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

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
          setReportState(text.trim().length > 0 ? 'ready' : 'empty')
        }
      } catch (error) {
        if (!ignore) {
          setSelectedMarkdown('')
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

  return (
    <div className="site-shell">
      <header className="site-header">
        <nav className="site-nav" aria-label="日报分类">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={kindFilter === filter.value ? 'active' : ''}
              aria-pressed={kindFilter === filter.value}
              onClick={() => setKindFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
          <a
            className="source-nav-link"
            href="https://daily.juya.uk/"
            target="_blank"
            rel="noreferrer"
          >
            <Rss aria-hidden="true" size={15} />
            源站
          </a>
          <button
            type="button"
            className="refresh-button"
            onClick={() => setRefreshKey((value) => value + 1)}
            title="刷新日报索引"
            aria-label="刷新日报索引"
          >
            <RefreshCw aria-hidden="true" size={16} />
          </button>
        </nav>
      </header>

      <main className="page-shell">
        <section className="page-heading" aria-labelledby="page-title">
          <h1 id="page-title">每日情报</h1>
          <p>
            AI {counts['ai-hotspot-daily']} · Polymarket{' '}
            {counts['polymarket-daily']} · 橘鸦 RSS {counts['juya-rss-daily']} ·
            更新于 {formatGeneratedAt(manifest?.generatedAt)}
          </p>
        </section>

        <div className="workspace">
          <aside className="archive-panel" aria-label="日报归档">
            <div className="archive-header">
              <div>
                <p className="section-label">Archive</p>
                <h2>日报归档</h2>
              </div>
              <span className="archive-count" title="当前筛选结果">
                {filteredReports.length}
              </span>
            </div>

            <label className="search-box">
              <Search aria-hidden="true" size={16} />
              <span className="sr-only">搜索日报</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索标题或日期"
              />
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
                    onClick={() => setSelectedId(report.id)}
                  >
                    <span className="report-icon">
                      <Icon aria-hidden="true" size={16} />
                    </span>
                    <span className="report-copy">
                      <strong>{kindLabels[report.kind]}</strong>
                      <span>
                        <CalendarDays aria-hidden="true" size={13} />
                        {formatDate(report.date)}
                      </span>
                    </span>
                    {report.date === latestDate && (
                      <span className="latest-mark">最新</span>
                    )}
                  </button>
                )
              })}
            </div>
          </aside>

          <section
            className={`reader ${
              selectedReport ? `kind-${selectedReport.kind}` : 'kind-empty'
            }`}
            aria-label="日报内容"
          >
            {selectedReport && (
              <div className="issue-meta">
                <span className="issue-kind">
                  <SelectedIcon aria-hidden="true" size={15} />
                  {kindLabels[selectedReport.kind]}
                </span>
                <span>{selectedReport.date}</span>
                <span>{kindDescriptions[selectedReport.kind]}</span>
                {selectedReport.date === latestDate && (
                  <span className="latest-label">最新一期</span>
                )}
              </div>
            )}

            <article className="markdown-frame">
              {reportState === 'loading' && (
                <div className="reader-state">正在加载日报内容...</div>
              )}

              {reportState === 'error' && (
                <div className="reader-state error">{reportError}</div>
              )}

              {(!selectedReport ||
                reportState === 'idle' ||
                reportState === 'empty') && (
                <div className="reader-state">
                  选择一份日报查看正文；如果列表为空，请等待自动化生成。
                </div>
              )}

              {selectedReport && reportState === 'ready' && (
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a({ href, children, ...props }) {
                      const external = href?.startsWith('http')

                      return (
                        <a
                          {...props}
                          href={href}
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
        </div>
      </main>

      <footer className="site-footer">
        <span>北京时间每日 08:00 更新</span>
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
