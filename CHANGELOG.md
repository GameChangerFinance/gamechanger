# Changelog

All notable changes to this project will be documented in this user-facing file.

This changelog follows a Keep a Changelog-style structure, but version headings
omit dates because project dates here would track tag creation rather than
publishing.

## [1.2.2]

### Security

- Resolved Root repo audit: 20 advisories -> 0
- Resolved examples/project standalone audit: 25 advisories -> 0
- Regenerated the root and example project pnpm lockfiles with verified package
  signatures.
- Removed the `fast-uri` workspace override and release-age exception from
  `pnpm-workspace.yaml`.

### Changed

- Updated the example project scripts to use the repository CLI directly instead
  of requiring example-local `node_modules/.bin` shims.
- Updated `fast-uri`, `svgo`, `eslint`, `eslint-config-prettier`, `rollup`, and
  `rollup-plugin-polyfill-node`.
- Migrated the build toolchain to Rollup 4 while preserving the public package
  exports, types, and call signatures.

### Fixed

- Added an example project setup step that links `examples/project/res` to the
  generated `examples/res` artifacts before building.
- Ignored the generated example resource symlink so local example builds do not
  dirty the working tree.

## [1.2.1]

### Security

- Updated dependency versions and pinned patched `fast-uri`.

### Changed

- Refreshed package metadata for the dependency hardening patch release.

## [1.2.0]

### Added

- Added multi-file project build support for GCScript projects.
- Added code validation support, validation fixtures, and expanded GCScript test
  coverage.
- Added `--snippetArgsFile` support for passing larger JSON snippet arguments.
- Added a generated example project with build, validation, serve, and dev
  scripts.

### Changed

- Refactored CLI usage rendering into contextual, POSIX-style help and error
  output.
- Preserved script args and `argsByKey` through imported script wrappers.
- Removed source map emission from package builds.
- Updated README and examples for the multi-file build and validation workflows.

### Fixed

- Hardened resource URI resolution and app/file import semantics.
- Blocked path traversal above project roots and unsafe mutable remote imports
  from local resources.

[Unreleased]:
  https://github.com/GameChangerFinance/gamechanger/compare/v1.2.1...HEAD
[1.2.1]:
  https://github.com/GameChangerFinance/gamechanger/compare/v1.2.0...v1.2.1
[1.2.0]:
  https://github.com/GameChangerFinance/gamechanger/compare/v1.1.1...v1.2.0
