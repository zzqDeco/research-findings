import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(scriptDir, '..')
const reportsDir = path.join(rootDir, 'public', 'reports')
const temporaryDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'research-findings-reports-'),
)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  })

  if (result.status !== 0) {
    const detail = options.capture
      ? `\n${result.stderr || result.stdout || ''}`
      : ''
    throw new Error(`${command} ${args.join(' ')} failed${detail}`)
  }

  return options.capture ? result.stdout.trim() : ''
}

async function copyReportData(kind) {
  const source = path.join(reportsDir, kind)
  const destination = path.join(temporaryDir, kind)
  await fs.access(source)
  await fs.cp(source, destination, { recursive: true })
}

try {
  await fs.access(path.join(reportsDir, 'index.json'))
  await Promise.all([
    copyReportData('ai-hotspot-daily'),
    copyReportData('polymarket-daily'),
  ])
  await fs.copyFile(
    path.join(reportsDir, 'index.json'),
    path.join(temporaryDir, 'index.json'),
  )
  await fs.writeFile(
    path.join(temporaryDir, 'README.md'),
    '# Generated report data\n\nThis branch is an ephemeral deployment input. Source history lives on `main`.\n',
  )

  const remoteUrl = run('git', ['remote', 'get-url', 'origin'], {
    capture: true,
  })
  const repository = run(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
    { capture: true },
  )
  const userName = run('git', ['config', '--get', 'user.name'], {
    capture: true,
  })
  const userEmail = run('git', ['config', '--get', 'user.email'], {
    capture: true,
  })

  run('git', ['init', '--initial-branch=reports-data'], { cwd: temporaryDir })
  run('git', ['config', 'user.name', userName], { cwd: temporaryDir })
  run('git', ['config', 'user.email', userEmail], { cwd: temporaryDir })
  run('git', ['remote', 'add', 'origin', remoteUrl], { cwd: temporaryDir })
  run(
    'git',
    [
      'add',
      '--',
      'README.md',
      'index.json',
      'ai-hotspot-daily',
      'polymarket-daily',
    ],
    { cwd: temporaryDir },
  )
  run(
    'git',
    ['commit', '-m', `Publish reports ${new Date().toISOString()}`],
    { cwd: temporaryDir },
  )
  run(
    'git',
    ['push', '--force', 'origin', 'HEAD:refs/heads/reports-data'],
    { cwd: temporaryDir },
  )

  run('gh', [
    'workflow',
    'run',
    'deploy-pages.yml',
    '--repo',
    repository,
    '--ref',
    'main',
  ])

  console.log(`Published report data and requested Pages deployment for ${repository}`)
} finally {
  await fs.rm(temporaryDir, { recursive: true, force: true })
}
