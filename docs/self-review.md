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
| Strict lint | passes with 0 errors and one documented non-blocking themed-icon warning |
| Provenance | published to npm via GitHub Actions with an SLSA attestation |

## What I found and fixed (v0.1.1)

| Finding | Severity | Fix |
|---------|----------|-----|
| Convert kept the original file extension — a PNG converted to WebP was still named `photo.png` while holding WebP bytes, which misleads downstream nodes. | Medium | Derive the output extension from the result MIME type (`photo.webp`). |
| Resize dimensions were sent to the API unvalidated — invalid combinations failed with an opaque API error, *after* the upload had already consumed a monthly compression. | Medium | Validate dimensions before upload: Scale needs exactly one dimension; Fit/Cover/Thumb need both. Invalid input now fails fast with a clear message and no wasted quota. |
| The TypeScript build-info file shipped inside the package. | Low | Relocated it out of `dist`; the published tarball no longer includes it. |

No Critical findings were identified.

## Known limitation: `usableAsTool`

The node declares `usableAsTool: true`. I checked whether that is genuinely useful: it
is not fully, because the node's input is a **binary image** on the item, and an AI Agent
can only supply text/JSON parameters via `$fromAI` — it cannot hand the node an image. So
the node is only meaningful as a tool inside a workflow that already provides the binary
data.

I kept the flag as `true` because n8n's framework requires it: the strict lint rule
`@n8n/community-nodes/node-usable-as-tool` demands the property be present, and the
`INodeTypeDescription` type only accepts `true` (it rejects `false`). There is therefore no
way to declare a truthful "not a tool" state in code. I have documented the caveat here
instead of implying a capability that works end-to-end.

## Icon: single file retained intentionally

`n8n-node lint` emits one non-blocking warning (`icon-prefer-themed-variants`) suggesting
separate light and dark icon files. It is a warning, not an error, and the lint run passes
with 0 errors. I kept the single `file:tinify.svg` icon on purpose: n8n's standard-parameters
documentation states that a single `file:` icon is valid when it renders in both themes, and
this SVG has an opaque orange background with a white symbol, so it reads correctly on both
light and dark backgrounds without a separate variant. (The linter also rejects declaring the
same file for both `light` and `dark`, so a two-file form would require a redundant duplicate.)

## Dependency and audit posture (as of 0.1.2)

- **Production dependencies: 0 advisories.** `npm audit --omit=dev` reports zero. The
  package **declares no regular runtime dependencies** and places its compiled node code
  under `dist` (npm additionally includes the package metadata, README, and LICENSE in the
  tarball) — so nothing the node installs into an n8n instance carries a known vulnerability.
- **Development advisories: 6 moderate (0 high, 0 critical).** All six are the single
  `uuid@10` "missing buffer bounds check" advisory (GHSA-w5hq-g745-h8pq), inherited only
  through the official `@n8n/node-cli` build tool:
  `@n8n/node-cli → @n8n/ai-node-sdk → @n8n/ai-utilities → @langchain/classic | @langchain/community → uuid@10`.
  These are upstream, dev-only, and cannot be resolved without forcing incompatible
  versions of n8n's own tooling, so they are left as documented upstream residuals rather
  than patched over with `overrides` or `audit fix --force`. They are never present in the
  runtime a user installs.
- The `0.1.2` release refreshed dev tooling (eslint, prettier, typescript, release-it,
  vitest, `@n8n/node-cli`) to current versions aligned with n8n's official starter, which
  is what reduced the development advisory count from 16 to 6.

## What I would look at next

- A test exercising the real Tinify API end-to-end in CI (currently the HTTP layer is
  mocked in unit tests and verified manually against the live API).
- Optional pass-through of Tinify's `preserve` metadata options (copyright, creation date).
