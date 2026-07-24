#!/usr/bin/env node
/* global Promise, Set */
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../..')
const fixturesDir = path.resolve(rootDir, 'src/tests/gcscript')
const reportDir = path.resolve(fixturesDir, 'report')
const schemaPath = path.resolve(rootDir, 'test/schema/index.json.full')
const cliPath = path.resolve(rootDir, 'bin/cli.js')

// Keep this at 1 for deterministic, low-memory local and AI/container runs.
// It can be safely raised later after validating local machine capacity.
const concurrency = 1

const relevantExtensions = new Set(['.gcscript', '.json'])

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.resolve(dir, entry.name)
    if (fullPath.startsWith(reportDir + path.sep)) continue
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
      continue
    }
    if (!entry.isFile()) continue
    if (!relevantExtensions.has(path.extname(entry.name))) continue
    files.push(fullPath)
  }
  return files.sort((a, b) => a.localeCompare(b))
}

const runCliValidate = (filePath, reportPath) =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [cliPath, 'validate', '-f', filePath, '-o', reportPath, '--quiet'],
      {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('close', (status) => resolve({ status, stdout, stderr }))
  })

const reportPathFor = (filePath) => {
  const relative = path.relative(fixturesDir, filePath)
  const parsed = path.parse(relative)
  const safeDir = path.resolve(reportDir, parsed.dir)
  return path.resolve(safeDir, `${parsed.name}.report.json`)
}

const readJsonIfExists = async (filePath) => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return undefined
  }
}

const main = async () => {
  const startedAt = Date.now()
  await fs.mkdir(reportDir, { recursive: true })

  // Reuse the same schema cache path that the CLI normally uses.
  await fs.copyFile(schemaPath, path.join(os.tmpdir(), '.lang.def'))

  const files = await walk(fixturesDir)
  const valid = []
  const invalid = []

  for (let index = 0; index < files.length; index += concurrency) {
    const batch = files.slice(index, index + concurrency)
    for (const filePath of batch) {
      const relative = path.relative(fixturesDir, filePath)
      const reportPath = reportPathFor(filePath)
      await fs.mkdir(path.dirname(reportPath), { recursive: true })
      process.stderr.write(`› Validating ${relative}\n`)
      const result = await runCliValidate(filePath, reportPath)
      const report = await readJsonIfExists(reportPath)
      if (result.status === 0 && report?.isValid === true) {
        valid.push(filePath)
        process.stderr.write(`  ✅ valid\n`)
      } else {
        invalid.push({ filePath, report, result })
        const errors = report?.errors?.length ?? 0
        process.stderr.write(`  ❌ invalid (${errors} reported errors)\n`)
        if (result.stderr.trim()) process.stderr.write(`${result.stderr}\n`)
      }
    }
  }

  const elapsedMs = Date.now() - startedAt
  process.stderr.write('\nGCScript validation summary\n')
  process.stderr.write(`  total files   : ${files.length}\n`)
  process.stderr.write(`  valid files   : ${valid.length}\n`)
  process.stderr.write(`  invalid files : ${invalid.length}\n`)
  process.stderr.write(`  report dir    : ${reportDir}\n`)
  process.stderr.write(`  elapsed       : ${(elapsedMs / 1000).toFixed(1)}s\n`)

  if (invalid.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err)
  process.exit(1)
})
