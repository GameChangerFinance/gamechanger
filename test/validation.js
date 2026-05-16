/* global Set, WeakSet */

import path from 'node:path'

const relevantExtensions = new Set(['.gcscript', '.json'])

const isInsideDir = (candidate, dir) => {
  const relative = path.relative(dir, candidate)
  return (
    Boolean(relative) &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  )
}

const walk = async (fs, dir, options = {}) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  const skipDir = options.skipDir ? path.resolve(options.skipDir) : undefined

  for (const entry of entries) {
    const fullPath = path.resolve(dir, entry.name)

    if (skipDir && (fullPath === skipDir || isInsideDir(fullPath, skipDir))) {
      continue
    }

    if (entry.isDirectory()) {
      files.push(...(await walk(fs, fullPath, options)))
      continue
    }

    if (!entry.isFile()) continue
    if (!relevantExtensions.has(path.extname(entry.name))) continue
    files.push(fullPath)
  }

  return files.sort((a, b) => a.localeCompare(b))
}

const heapUsed = () => Math.round(process.memoryUsage().heapUsed / 1024)

const reportPathFor = (fixturesDir, reportsDir, filePath) => {
  const relative = path.relative(fixturesDir, filePath)
  return path.resolve(reportsDir, `${relative}.report.json`)
}

const writeReport = async (fs, reportPath, report) => {
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
}

const pointerUnescape = (part) =>
  String(part).replace(/~1/g, '/').replace(/~0/g, '~')

const jsonPointerToPathParts = (jsonPath) => {
  const normalized = String(jsonPath || '')
  if (!normalized || normalized === '/') return []
  return normalized.split('/').slice(1).map(pointerUnescape)
}

const getAtJsonPath = (value, jsonPath) => {
  let cursor = value
  for (const part of jsonPointerToPathParts(jsonPath)) {
    if (cursor === null || cursor === undefined) return undefined
    cursor = cursor[part]
  }
  return cursor
}

const collectKnownTypeValues = (schemaRoot) => {
  const values = new Set()
  const seen = new WeakSet()
  const stack = [schemaRoot]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (seen.has(node)) continue
    seen.add(node)

    if (
      node.properties &&
      node.properties.type &&
      Object.prototype.hasOwnProperty.call(node.properties.type, 'const')
    ) {
      values.add(node.properties.type.const)
    }

    for (const child of Array.isArray(node) ? node : Object.values(node)) {
      if (child && typeof child === 'object') stack.push(child)
    }
  }
  return values
}

const parseStrictJsonOrUndefined = (input) => {
  try {
    return JSON.parse(input)
  } catch {
    return undefined
  }
}

const hasPrimitiveRunChild = (code) =>
  code &&
  code.type === 'script' &&
  code.run &&
  !Array.isArray(code.run) &&
  typeof code.run === 'object' &&
  Object.values(code.run).some(
    (value) =>
      value === null ||
      ['boolean', 'number', 'string'].includes(typeof value) ||
      Array.isArray(value)
  )

const assertValidationReportQuality = ({
  assert,
  filePath,
  input,
  report,
  knownTypeValues
}) => {
  const [error] = report.errors || []
  if (!error) return [`${path.basename(filePath)} missed an error object`]

  const failures = []
  const code = parseStrictJsonOrUndefined(input)
  const label = path.basename(filePath)
  const closestProperties = error.details?.closestProperties || []
  const provided = error.provided

  if (
    error.code === 'code-invalid' &&
    /must be equal to constant|schema validation failed|must match a schema/i.test(
      error.message || ''
    )
  ) {
    failures.push(`${label} exposed a generic AJV fallback message`)
  }

  if (
    typeof provided === 'string' &&
    (closestProperties.includes(provided) ||
      (error.suggestion || '').includes(`"${provided}" with "${provided}"`) ||
      (error.message || '').includes(`Did you mean "${provided}"`))
  ) {
    failures.push(`${label} suggested replacing a value/property with itself`)
  }

  if (
    code &&
    !Array.isArray(code) &&
    typeof code === 'object' &&
    typeof code.type === 'string' &&
    code.type !== 'script' &&
    knownTypeValues.has(code.type) &&
    /must be equal to constant/i.test(error.message || '')
  ) {
    failures.push(
      `${label} hid a known nested root function behind const noise`
    )
  }

  if (
    error.details?.branchMismatch &&
    Array.isArray(closestProperties) &&
    closestProperties.length > 0
  ) {
    failures.push(`${label} kept typo suggestions for a branch mismatch`)
  }

  if (hasPrimitiveRunChild(code) && error.jsonPath === '/run') {
    failures.push(`${label} pointed at /run instead of the invalid child`)
  }

  if (!error.location) failures.push(`${label} missed derivable location`)
  if (error.code !== 'code-syntax-error' && !error.suggestion) {
    failures.push(`${label} missed a recovery suggestion`)
  }
  if (error.code !== 'code-syntax-error' && !error.details) {
    failures.push(`${label} missed diagnostic details`)
  }
  if (
    error.code !== 'code-syntax-error' &&
    error.code !== 'code-required-property' &&
    getAtJsonPath(code, error.jsonPath) !== undefined &&
    error.provided === undefined
  ) {
    failures.push(`${label} missed a derivable provided value`)
  }

  assert.ok(Array.isArray(failures), 'quality failures must be enumerable')
  return failures
}

const printProfileSummary = (rows, fixturesDir) => {
  const slowest = [...rows]
    .sort((a, b) => b.elapsedMs - a.elapsedMs)
    .slice(0, 5)
  const totalMs = rows.reduce((sum, row) => sum + row.elapsedMs, 0)
  const maxHeapDeltaKB = Math.max(0, ...rows.map((row) => row.heapDeltaKB))
  console.info(
    `Validation fixtures: ${rows.length} invalid reports, ${totalMs.toFixed(
      1
    )}ms total, max heap delta ${maxHeapDeltaKB}KB`
  )
  for (const row of slowest) {
    console.info(
      `  ${path.relative(fixturesDir, row.filePath)} · ${row.elapsedMs.toFixed(
        1
      )}ms · ${row.heapDeltaKB}KB · ${row.code}`
    )
  }
}

export const appendValidationTests = ({
  tests,
  run,
  assert,
  fs,
  path: pathModule,
  rootDir,
  validateReport,
  validationSchemaFull
}) => {
  const fixturesDir = pathModule.resolve(rootDir, 'test/validation-fixtures')
  const reportsDir = pathModule.resolve(fixturesDir, 'reports')
  const knownTypeValues = collectKnownTypeValues(validationSchemaFull)

  tests.push(
    run(
      'validation fixture suite returns invalid reports with profiling',
      async () => {
        await fs.mkdir(reportsDir, { recursive: true })
        const files = await walk(fs, fixturesDir, { skipDir: reportsDir })
        assert.ok(files.length >= 30, 'expected at least 30 invalid fixtures')

        const failures = []
        const profileRows = []
        for (const filePath of files) {
          const input = await fs.readFile(filePath, 'utf8')
          const beforeHeapKB = heapUsed()
          const startedAt = performance.now()
          const report = await validateReport(input, {
            useSchema: validationSchemaFull,
            fileName: pathModule.basename(filePath),
            filePath
          })
          const reportPath = reportPathFor(fixturesDir, reportsDir, filePath)
          await writeReport(fs, reportPath, report)
          const elapsedMs = performance.now() - startedAt
          const heapDeltaKB = heapUsed() - beforeHeapKB
          const error = report.errors?.[0]

          profileRows.push({
            filePath,
            reportPath,
            elapsedMs,
            heapDeltaKB,
            code: error?.code || 'missing-error'
          })

          if (report.isValid !== false || !error?.code || !error?.message) {
            failures.push(
              `${pathModule.basename(
                filePath
              )} did not produce a useful invalid report`
            )
          }
          if (
            !report.profiling?.validateMs &&
            report.profiling?.validateMs !== 0
          ) {
            failures.push(
              `${pathModule.basename(filePath)} missed validateMs profiling`
            )
          }

          failures.push(
            ...assertValidationReportQuality({
              assert,
              filePath,
              input,
              report,
              knownTypeValues
            })
          )
        }

        printProfileSummary(profileRows, fixturesDir)
        assert.deepEqual(failures, [])
      }
    )
  )

  tests.push(
    run(
      'additional property typo suggests address in current schema context',
      async () => {
        const report = await validateReport(
          JSON.stringify({
            type: 'script',
            run: {
              sig: {
                type: 'signDataWithAddress',
                adress: 'addr_test1qpzexample',
                dataHex: '00'
              }
            }
          }),
          { useSchema: validationSchemaFull }
        )
        const [error] = report.errors
        assert.equal(error.code, 'code-additional-property')
        assert.equal(error.jsonPath, '/run/sig/adress')
        assert.equal(error.provided, 'adress')
        assert.deepEqual(error.details.closestProperties, ['address'])
        assert.match(error.suggestion, /address/)
      }
    )
  )

  tests.push(
    run(
      'additional property typo suggestions work beyond address',
      async () => {
        const report = await validateReport(
          JSON.stringify({
            type: 'script',
            exportAss: 'result',
            run: {
              address: { type: 'getCurrentAddress' }
            }
          }),
          { useSchema: validationSchemaFull }
        )
        const [error] = report.errors
        assert.equal(error.code, 'code-additional-property')
        assert.equal(error.provided, 'exportAss')
        assert.deepEqual(error.details.closestProperties, ['exportAs'])
      }
    )
  )

  tests.push(
    run('additional property avoids unrelated branch suggestions', async () => {
      const report = await validateReport(
        JSON.stringify({
          type: 'script',
          run: {
            address: {
              type: 'getCurrentAddress',
              adress: 'addr_test1qpzexample'
            }
          }
        }),
        { useSchema: validationSchemaFull }
      )
      const [error] = report.errors
      assert.equal(error.code, 'code-additional-property')
      assert.equal(error.provided, 'adress')
      assert.deepEqual(error.details.closestProperties || [], [])
    })
  )

  tests.push(
    run('additional property never suggests itself', async () => {
      const report = await validateReport(
        JSON.stringify({
          type: 'script',
          run: {
            address: {
              type: 'getCurrentAddress',
              title: 'Known elsewhere, invalid here'
            }
          }
        }),
        { useSchema: validationSchemaFull }
      )
      const [error] = report.errors
      assert.equal(error.code, 'code-branch-property-mismatch')
      assert.equal(error.provided, 'title')
      assert.deepEqual(error.details.closestProperties || [], [])
      assert.doesNotMatch(error.message, /Did you mean "title"/)
      assert.doesNotMatch(error.suggestion, /"title" with "title"/)
    })
  )

  tests.push(
    run(
      'root known nested function reports script wrapper guidance',
      async () => {
        const report = await validateReport(
          JSON.stringify({
            type: 'getCurrentAddress'
          }),
          { useSchema: validationSchemaFull }
        )
        const [error] = report.errors
        assert.equal(error.code, 'code-root-function-wrapper-required')
        assert.equal(error.jsonPath, '/type')
        assert.equal(error.provided, 'getCurrentAddress')
        assert.match(error.message, /Root GCScript must be a "script" block/)
        assert.match(error.suggestion, /"run"/)
        assert.equal(error.examples[0].type, 'script')
      }
    )
  )

  tests.push(
    run(
      'branch mismatch diagnostics do not offer unrelated typo fixes',
      async () => {
        const report = await validateReport(
          JSON.stringify({
            type: 'script',
            run: {
              address: {
                type: 'getCurrentAddress',
                title: 'Allowed on other branches only'
              }
            }
          }),
          { useSchema: validationSchemaFull }
        )
        const [error] = report.errors
        assert.equal(error.code, 'code-branch-property-mismatch')
        assert.equal(error.details.branchMismatch, true)
        assert.deepEqual(error.details.closestProperties || [], [])
      }
    )
  )

  tests.push(
    run('run object child mismatch points to invalid child path', async () => {
      const report = await validateReport(
        JSON.stringify({
          type: 'script',
          run: {
            bad: false
          }
        }),
        { useSchema: validationSchemaFull }
      )
      const [error] = report.errors
      assert.equal(error.code, 'code-type-mismatch')
      assert.equal(error.jsonPath, '/run/bad')
      assert.match(error.message, /boolean/)
    })
  )

  tests.push(
    run('lightweight ISL warnings suggest close function names', async () => {
      const report = await validateReport(
        JSON.stringify({
          type: 'script',
          run: {
            hash: {
              type: 'macro',
              run: "{sha51(get('cache.address'))}"
            }
          }
        }),
        { useSchema: validationSchemaFull }
      )
      assert.equal(report.isValid, true)
      const warning = report.warnings.find(
        (item) => item.code === 'code-isl-unknown-function-warning'
      )
      assert.ok(warning)
      assert.equal(warning.provided, 'sha51')
      assert.deepEqual(warning.details.closestFunctions, ['sha512'])
      assert.match(warning.suggestion, /sha512/)
    })
  )

  tests.push(
    run('plain strings do not emit ISL warnings', async () => {
      const report = await validateReport(
        JSON.stringify({
          type: 'script',
          run: {
            hash: {
              type: 'macro',
              run: "sha51(get('cache.address'))"
            }
          }
        }),
        { useSchema: validationSchemaFull }
      )
      assert.equal(report.isValid, true)
      assert.deepEqual(report.warnings, [])
    })
  )
}
