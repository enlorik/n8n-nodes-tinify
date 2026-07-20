# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2]

Development-tooling and dependency hygiene only. **No change to the Tinify node's
runtime behavior** — operations, credentials, API requests, and outputs are unchanged.

### Changed

- Updated development dependencies to align with the official n8n node starter:
  `eslint` 9.29.0 → 9.39.4, `prettier` 3.6.2 → 3.8.3, `typescript` 5.9.2 → 5.9.3,
  `release-it` ^19.0.4 → 20.2.1, `vitest` ^4.1.9 → ^4.1.10, and refreshed
  `@n8n/node-cli` to 0.39.3 (kept as `*`, per n8n's manifest convention).
- Added a privacy-preserving author email (GitHub noreply), required by a new lint
  rule in the updated `@n8n/node-cli`.

### Security

- Reduced dev-only `npm audit` advisories from 16 (5 moderate, 11 high) to 6
  (6 moderate, 0 high). Production dependencies remain at **0** advisories. The
  remaining 6 are inherited solely through `@n8n/node-cli`'s transitive
  `@langchain/*` → `uuid@10` chain — development tooling that is never part of the
  published, zero-dependency runtime package.

## [0.1.1]

### Fixed

- **Convert now renames the output file extension.** Converting a PNG to WebP
  previously produced a file still named `photo.png` while holding WebP bytes;
  the output filename now matches the new format (`photo.webp`).
- **Resize dimensions are validated before upload.** Invalid combinations
  (Scale with both or neither dimension; Fit/Cover/Thumb missing a dimension)
  now raise a clear error *before* the image is uploaded, so an invalid request
  no longer consumes one of your monthly compressions.

### Changed

- Removed the TypeScript build-info file from the published package.

## [0.1.0]

### Added

- Initial release.
- **Compress** — shrink PNG, JPEG, WebP, and AVIF images.
- **Resize** — Scale, Fit, Cover, and Thumb methods.
- **Convert** — WebP, PNG, JPEG, AVIF, or Tinify's smallest-format choice.
- **Tinify API** credential with a live connection test.
- Published to npm via GitHub Actions with an npm provenance attestation.
