# 每日情报阅读器

本项目是一个纯前端 React + Vite 日报查看器，用于阅读自动化生成的 AI 热点日报、Polymarket 日报和橘鸦 RSS 追踪日报。线上版本通过 GitHub Project Pages 发布，不占用或修改个人主页仓库。

## 公网地址

项目站点发布到：

```text
https://zzqdeco.github.io/research-findings/
```

## 本地运行

```bash
npm install
npm run dev
```

`npm run dev` 会先扫描 `public/reports` 并生成 `public/reports/index.json`，再启动 Vite 开发服务器。

## 日报目录

自动化任务应将 Markdown 写入：

```text
public/reports/ai-hotspot-daily/YYYY-MM-DD.md
public/reports/polymarket-daily/YYYY-MM-DD.md
public/reports/juya-rss-daily/YYYY-MM-DD.md
```

刷新索引：

```bash
npm run reports:index
```

日报内容和索引属于运行时数据，已通过 `.gitignore` 排除：

```text
reports/
public/reports/
```

源码分支 `main` 不保存日报。`npm run reports:publish` 会将当前日报快照发布到自动生成的 `reports-data` 分支，并触发 GitHub Actions 构建和部署 Project Pages。该数据分支每次都会被新快照替换，不作为日报版本历史。

## 固定信息源

每日自动化会读取 [`config/daily-sources.json`](./config/daily-sources.json) 中启用的信息源。当前固定追踪：

- 橘鸦AI早报 RSS：`https://daily.juya.uk/rss.xml`，单独生成 `juya-rss-daily` 日报，同时作为 AI 热点日报的候选发现源。
- Simon Willison's Weblog Atom：`https://simonwillison.net/atom/everything/`，只作为 AI 热点日报的固定发现与分析源，不生成独立日报。

Simon Atom 按 AI 日报的严格过去 24 小时窗口筛选 `published`，使用半开区间 `[start, end)`。旧文章即使在窗口内更新，也只能标为 update signal，不能伪装成当天新发布。自动化会先打开完整文章；文章涉及 Simon 自己的项目或实验时按作者原始记录归因，涉及外部模型、公司、论文或安全事件时必须继续追踪厂商公告、官方文档、论文、仓库或 advisory，不能只凭博客评论提升为 `Confirmed`。可用 `npm run reports:simon:scan -- --start ISO_TIME --end ISO_TIME` 查看窗口内条目。

橘鸦 RSS 日报按 `Asia/Shanghai` 的自然日精确匹配 Issue，而不是使用过去 24 小时窗口。`YYYY-MM-DD.md` 只允许收录标题、Issue 链接日期和 `pubDate` 北京时间日期都等于 `YYYY-MM-DD` 的 feed issue；昨天的 Issue 即使落入过去 24 小时也不能复用。

每天 08:00 首次检查。如果当天 Issue 尚未发布，日报会明确标记为等待状态，现有的同线程任务会临时从每日 08:00 切换为每小时检查一次。轮询只追踪固定目标日期；发现后生成完整 RSS 日报、刷新同日 AI 日报中的 RSS 发现、发布站点，并把同一个任务恢复为次日 08:00。这样不会为轮询创建新的会话或重复任务。

本地检查当天 Issue：

```bash
npm run reports:juya:check
```

也可以检查指定日期：

```bash
npm run reports:juya:check -- --date 2026-08-14
```

命令在精确匹配时退出 `0`，当天 Issue 不存在时退出 `2`，抓取或解析失败时退出 `1`。RSS 日报仍会保留当天 Issue 的全部栏目和条目，并清楚区分 RSS 摘要与原始链接核验状态。进入 AI 热点主榜的候选必须继续访问原始链接、核验主来源并与其他发现轨道去重，不能把聚合摘要直接作为已确认事实。

## 发布日报

```bash
npm run reports:publish
```

GitHub Actions 会：

1. 检出 `main` 上的前端源码。
2. 从 `reports-data` 恢复三类日报快照。
3. 使用 `/research-findings/` 作为 Vite base 构建静态站点。
4. 将 `dist` 发布到 GitHub Pages。

## 构建检查

```bash
npm run build
npm run preview
```
