import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  CalendarDays,
  FileText,
  Globe2,
  LineChart,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

type ReportKind = 'ai-hotspot-daily' | 'polymarket-daily'
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
}

const kindDescriptions: Record<ReportKind, string> = {
  'ai-hotspot-daily': '模型、产品、研究与政策动态',
  'polymarket-daily': '预测市场热点、概率变化与背景',
}

const kindIcons: Record<ReportKind, typeof Bot> = {
  'ai-hotspot-daily': Bot,
  'polymarket-daily': LineChart,
}

const filters: Array<{ value: KindFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'ai-hotspot-daily', label: 'AI 热点' },
  { value: 'polymarket-daily', label: 'Polymarket' },
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

function getReportHeadline(report?: ReportMeta) {
  if (!report) {
    return '等待第一份日报'
  }

  return report.title.replace(/^#\s*/, '')
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
  const latestReport = reports[0]

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
        { 'ai-hotspot-daily': 0, 'polymarket-daily': 0 } satisfies Record<
          ReportKind,
          number
        >,
      ),
    [reports],
  )

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            <Globe2 aria-hidden="true" size={16} />
            Research Findings
          </p>
          <h1>每日情报阅读器</h1>
          <p className="subtitle">
            汇总本地生成的 AI 热点与 Polymarket 日报，按日期沉淀为可检索的阅读库。
          </p>
        </div>
        <button
          type="button"
          className="icon-button refresh-button"
          onClick={() => setRefreshKey((value) => value + 1)}
          title="刷新日报索引"
          aria-label="刷新日报索引"
        >
          <RefreshCw aria-hidden="true" size={18} />
        </button>
      </header>

      <section className="summary-strip" aria-label="日报统计">
        <div className="metric">
          <span>全部日报</span>
          <strong>{reports.length}</strong>
        </div>
        <div className="metric">
          <span>AI 热点</span>
          <strong>{counts['ai-hotspot-daily']}</strong>
        </div>
        <div className="metric">
          <span>Polymarket</span>
          <strong>{counts['polymarket-daily']}</strong>
        </div>
        <div className="metric wide">
          <span>索引更新时间</span>
          <strong>{formatGeneratedAt(manifest?.generatedAt)}</strong>
        </div>
      </section>

      <div className="workspace">
        <aside className="sidebar" aria-label="日报列表">
          <div className="sidebar-header">
            <div>
              <p className="section-label">Reports</p>
              <h2>日报归档</h2>
            </div>
            <FileText aria-hidden="true" size={20} />
          </div>

          <label className="search-box">
            <Search aria-hidden="true" size={17} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、日期或类型"
            />
          </label>

          <div className="segmented-control" aria-label="日报类型筛选">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={kindFilter === filter.value ? 'active' : ''}
                onClick={() => setKindFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

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
                    : '没有匹配当前筛选条件的日报。'}
                </div>
              )}

            {filteredReports.map((report) => {
              const Icon = kindIcons[report.kind]
              const isSelected = selectedReport?.id === report.id

              return (
                <button
                  key={report.id}
                  type="button"
                  className={`report-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedId(report.id)}
                >
                  <span className="report-kind">
                    <Icon aria-hidden="true" size={15} />
                    {kindLabels[report.kind]}
                  </span>
                  <strong>{report.title}</strong>
                  <span className="report-date">
                    <CalendarDays aria-hidden="true" size={14} />
                    {formatDate(report.date)}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="reader" aria-label="日报内容">
          <div className="reader-header">
            <div>
              <p className="section-label">
                {selectedReport ? kindLabels[selectedReport.kind] : '日报内容'}
              </p>
              <h2>{getReportHeadline(selectedReport ?? undefined)}</h2>
              {selectedReport && (
                <p className="reader-meta">
                  {formatDate(selectedReport.date)} ·{' '}
                  {kindDescriptions[selectedReport.kind]}
                </p>
              )}
            </div>
            {selectedReport && latestReport?.id === selectedReport.id && (
              <span className="latest-badge">
                <Sparkles aria-hidden="true" size={15} />
                最新
              </span>
            )}
          </div>

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
                选择一份日报查看正文；如果列表为空，请等待自动化生成或手动放入 Markdown。
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
  )
}

export default App
