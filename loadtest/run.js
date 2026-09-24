/**
 * Runs the load test end to end:
 *
 * 1. checks the target answers, and seeds the accounts (seed.js);
 * 2. samples the server's CPU and memory once a second while the test runs, when the target is a
 *    process on this machine (found by the port it listens on);
 * 3. runs Artillery (scenarios.yml), saving its raw results to results/<time>.json;
 * 4. writes results/<time>-summary.md, a per-endpoint table of latency and errors plus the resource
 *    samples, prints it, and exits 1 if a threshold below is missed.
 *
 * npm test         the full load profile (about four minutes)
 * npm run smoke    a 15-second check that the scenarios work; no thresholds
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { BASE_PATH, TARGET } from './config.js'

const SMOKE = process.argv.includes('--smoke')

/**
 * What a passing run looks like. Checked on the load profile only. Latency is the 95th percentile
 * per endpoint, so one slow endpoint cannot hide behind many fast ones.
 */
const THRESHOLDS = {
  errorRate: 0.01, // non-2xx responses and failed requests, as a share of all requests
  p95Ms: {
    'POST /auth/login': 1500, // BCrypt is deliberately slow, and every session starts with it
    default: 500,
  },
}

const here = new URL('.', import.meta.url).pathname
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const resultsFile = `${here}results/${stamp}${SMOKE ? '-smoke' : ''}.json`
const summaryFile = resultsFile.replace(/\.json$/, '-summary.md')

async function checkTarget() {
  try {
    const response = await fetch(`${TARGET}${BASE_PATH}/`, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } catch (err) {
    throw new Error(`${TARGET}${BASE_PATH}/ does not answer (${err.message}). Start the backend with ./start-backend.sh, or set TARGET.`, { cause: err })
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: here, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args[0]} exited with ${code}`))))
  })
}

/** The pid of the local process listening on the target's port, or null for a remote target. */
function serverPid() {
  const { hostname, port } = new URL(TARGET)
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) return null
  const listing = spawnSync('ss', ['-ltnpH', `sport = :${port || 80}`], { encoding: 'utf8' }).stdout ?? ''
  const match = listing.match(/pid=(\d+)/)
  return match ? Number(match[1]) : null
}

/** Samples a process's CPU (share of one core) and resident memory every second, from /proc. */
function monitor(pid) {
  const samples = []
  if (!pid) return { samples, stop: () => {} }
  const ticksPerSecond = 100
  const cpuTicks = async () => {
    const fields = (await readFile(`/proc/${pid}/stat`, 'utf8')).split(') ')[1].split(' ')
    return Number(fields[11]) + Number(fields[12]) // utime + stime
  }
  const rssMb = async () => {
    const status = await readFile(`/proc/${pid}/status`, 'utf8')
    return Number(status.match(/VmRSS:\s+(\d+)/)[1]) / 1024
  }
  let last = null
  const timer = setInterval(async () => {
    try {
      const ticks = await cpuTicks()
      if (last !== null) {
        samples.push({ cpu: (ticks - last) / ticksPerSecond, rssMb: await rssMb(), load1: os.loadavg()[0] })
      }
      last = ticks
    } catch {
      // The process went away; keep what we have.
    }
  }, 1000)
  return { samples, stop: () => clearInterval(timer) }
}

const pct = (n) => `${(n * 100).toFixed(2)}%`
const ms = (n) => (n === undefined ? '—' : `${Math.round(n)}`)

function summarize(report, samples) {
  const { counters, summaries } = report.aggregate
  const prefix = 'plugins.metrics-by-endpoint.'
  const endpoints = Object.keys(summaries)
    .filter((k) => k.startsWith(`${prefix}response_time.`))
    .map((k) => k.slice(`${prefix}response_time.`.length))
    .sort()

  const rows = endpoints.map((name) => {
    const s = summaries[`${prefix}response_time.${name}`]
    const codes = Object.entries(counters)
      .filter(([k]) => k.startsWith(`${prefix}${name}.codes.`))
      .map(([k, v]) => [Number(k.split('.codes.')[1]), v])
    const total = codes.reduce((sum, [, v]) => sum + v, 0)
    const failed = codes.filter(([code]) => code >= 400).reduce((sum, [, v]) => sum + v, 0)
    return { name, count: total, failed, p50: s.median, p95: s.p95, p99: s.p99, max: s.max }
  })

  const requests = counters['http.requests'] ?? 0
  const badResponses = Object.entries(counters)
    .filter(([k]) => /^http\.codes\.\d+$/.test(k) && Number(k.split('.').pop()) >= 400)
    .reduce((sum, [, v]) => sum + v, 0)
  const transportErrors = Object.entries(counters)
    .filter(([k]) => k.startsWith('errors.'))
    .reduce((sum, [, v]) => sum + v, 0)
  const errorRate = requests ? (badResponses + transportErrors) / requests : 1
  const overall = summaries['http.response_time'] ?? {}
  const seconds = (report.aggregate.lastMetricAt - report.aggregate.firstMetricAt) / 1000

  const failures = []
  if (!SMOKE) {
    if (errorRate > THRESHOLDS.errorRate) failures.push(`error rate ${pct(errorRate)} > ${pct(THRESHOLDS.errorRate)}`)
    for (const row of rows) {
      const limit = THRESHOLDS.p95Ms[row.name] ?? THRESHOLDS.p95Ms.default
      if (row.p95 > limit) failures.push(`${row.name} p95 ${ms(row.p95)} ms > ${limit} ms`)
    }
  }

  const lines = [
    `# Load test ${SMOKE ? '(smoke) ' : ''}— ${new Date().toISOString()}`,
    '',
    `Target \`${TARGET}${BASE_PATH}\`, ${Math.round(seconds)} s, ${requests} requests ` +
      `(${(requests / Math.max(seconds, 1)).toFixed(1)}/s), ${counters['vusers.created'] ?? 0} sessions ` +
      `(${counters['vusers.completed'] ?? 0} completed, ${counters['vusers.failed'] ?? 0} failed).`,
    '',
    `Overall: p50 ${ms(overall.median)} ms, p95 ${ms(overall.p95)} ms, p99 ${ms(overall.p99)} ms; ` +
      `error rate ${pct(errorRate)} (${badResponses} error responses, ${transportErrors} failed requests).`,
    '',
    '| Endpoint | Requests | Errors | p50 ms | p95 ms | p99 ms | max ms |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((r) => `| ${r.name} | ${r.count} | ${r.failed} | ${ms(r.p50)} | ${ms(r.p95)} | ${ms(r.p99)} | ${ms(r.max)} |`),
    '',
    // Where it degraded: Artillery's 10-second windows, against the arrival rate at the time.
    '| t (s) | sessions/s | requests/s | p50 ms | p95 ms | failed |',
    '| ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.intermediate.map((period) => {
      const c = period.counters
      const s = period.summaries['http.response_time'] ?? {}
      const failed = Object.entries(c).filter(([k]) => k.startsWith('errors.')).reduce((sum, [, v]) => sum + v, 0)
      const t = Math.round((period.firstMetricAt - report.aggregate.firstMetricAt) / 1000)
      return `| ${t} | ${((c['vusers.created'] ?? 0) / 10).toFixed(1)} | ${((c['http.requests'] ?? 0) / 10).toFixed(1)} | ${ms(s.median)} | ${ms(s.p95)} | ${failed} |`
    }),
    '',
  ]
  if (samples.length) {
    const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
    const cpu = samples.map((s) => s.cpu)
    lines.push(
      `Server process: CPU avg ${pct(avg(cpu))} / max ${pct(Math.max(...cpu))} of one core ` +
        `(${os.cpus().length} cores here); memory max ${Math.round(Math.max(...samples.map((s) => s.rssMb)))} MB; ` +
        `load average max ${Math.max(...samples.map((s) => s.load1)).toFixed(2)}.`,
      '',
    )
  } else {
    lines.push('Server process: not sampled (the target is not a process on this machine).', '')
  }
  lines.push(SMOKE ? 'Smoke run: thresholds not applied.' : failures.length ? `**FAILED:** ${failures.join('; ')}` : '**PASSED** all thresholds.')
  return { text: `${lines.join('\n')}\n`, failures }
}

async function main() {
  await checkTarget()
  await run('node', ['seed.js'])
  await mkdir(`${here}results`, { recursive: true })

  const pid = serverPid()
  const { samples, stop } = monitor(pid)
  try {
    await run('npx', [
      'artillery', 'run',
      '--environment', SMOKE ? 'smoke' : 'load',
      '--target', TARGET,
      '--variables', JSON.stringify({ base: BASE_PATH }),
      '--output', resultsFile,
      'scenarios.yml',
    ])
  } finally {
    stop()
  }

  const report = JSON.parse(await readFile(resultsFile, 'utf8'))
  const { text, failures } = summarize(report, samples)
  await writeFile(summaryFile, text)
  console.log(`\n${text}\nRaw results: ${resultsFile}\nSummary: ${summaryFile}`)
  if (failures.length) process.exit(1)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
