# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
