# Self-review: `n8n-nodes-tinify` against n8n's community-node criteria

This is a review I ran on my **own** node, applying the same criteria n8n uses when
vetting community nodes: code quality, security, credential handling, UX conventions,
binary-data behaviour, error handling, tests, documentation, package hygiene, and
provenance. I built the node first to understand the author's journey, then reviewed it
the way a reviewer would, and fixed what I found.

> **This is a self-assessment, not an official result.** n8n has not reviewed, approved,
> or verified this node. Nothing here should be read as an n8n verification or as a claim
> that the node meets n8n's full quality bar — only n8n can determine that.

## Method

- Read the published source against n8n's community-node guidelines and the
  `@n8n/node-cli` strict lint ruleset (`n8n.strict: true`).
- Classified each finding by severity and required fix.
- Fixed every confirmed Medium finding and added regression tests before releasing a new
  version.

## What passed

| Area | Evidence |
|------|----------|
| MIT license, zero runtime dependencies | `LICENSE`, `package.json` (`files: ["dist"]`, no `dependencies`) |
| Credential secret masked | `typeOptions: { password: true }` on the API key |
| Live credential test | declarative `test` request that returns 201 on a valid key, 401 on a bad one |
| Authentication via helper | `httpRequestWithAuthentication` (no manual header handling) |
| Filesystem-safe binary I/O | `getBinaryDataBuffer` / `prepareBinaryData` |
| Correct error types | `NodeOperationError` and `NodeApiError` with `itemIndex` |
| `continueOnFail` support | per-item error routing, covered by a test |
| `usableAsTool` | node is usable as an AI tool |
| Strict lint clean | `n8n-node lint` exits 0 |
| Provenance | published to npm via GitHub Actions with an SLSA attestation |

## What I found and fixed (v0.1.1)

| Finding | Severity | Fix |
|---------|----------|-----|
| Convert kept the original file extension — a PNG converted to WebP was still named `photo.png` while holding WebP bytes, which misleads downstream nodes. | Medium | Derive the output extension from the result MIME type (`photo.webp`). |
| Resize dimensions were sent to the API unvalidated — invalid combinations failed with an opaque API error, *after* the upload had already consumed a monthly compression. | Medium | Validate dimensions before upload: Scale needs exactly one dimension; Fit/Cover/Thumb need both. Invalid input now fails fast with a clear message and no wasted quota. |
| The TypeScript build-info file shipped inside the package. | Low | Relocated it out of `dist`; the published tarball no longer includes it. |

No Critical findings were identified.

## What I would look at next

- A test exercising the real Tinify API end-to-end in CI (currently the HTTP layer is
  mocked in unit tests and verified manually against the live API).
- Optional pass-through of Tinify's `preserve` metadata options (copyright, creation date).
