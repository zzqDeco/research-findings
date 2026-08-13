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

橘鸦 RSS 日报保留窗口内 feed issue、栏目和条目，清楚区分 RSS 摘要与原始链接核验状态。进入 AI 热点主榜的候选仍必须继续访问条目中的原始链接、核验主来源并与其他发现轨道去重，不能把聚合摘要直接作为已确认事实。

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
