// vitest is a dev-only dependency and this file is never published (only `dist`
// ships), so it is exempt from the community-node "no runtime dependencies" rule.
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { describe, expect, it, vi } from 'vitest';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { Tinify } from '../nodes/Tinify/Tinify.node';

/**
 * Builds a mock IExecuteFunctions for a single input item carrying one binary image.
 * `params` supplies node-parameter values; `httpMock` stands in for the Tinify API.
 */
function makeContext(options: {
	params: Record<string, unknown>;
	binary?: { mimeType: string; fileName?: string };
	httpMock: ReturnType<typeof vi.fn>;
	continueOnFail?: boolean;
}): IExecuteFunctions {
	const { params, httpMock, continueOnFail = false } = options;
	// Only default the binary when the caller omits the key entirely — passing
	// `binary: undefined` deliberately models an item that arrived without one.
	const binary = 'binary' in options ? options.binary : { mimeType: 'image/jpeg', fileName: '1.jpg' };

	const items: INodeExecutionData[] = [
		{ json: {}, binary: binary ? { data: binary as never } : undefined },
	];

	return {
		getInputData: () => items,
		getNodeParameter: (name: string) => params[name],
		getNode: () => ({ name: 'Tinify' }),
		continueOnFail: () => continueOnFail,
		getCredentials: vi.fn(),
		helpers: {
			getBinaryDataBuffer: vi.fn().mockResolvedValue(Buffer.from('original-image-bytes')),
			httpRequestWithAuthentication: httpMock,
			prepareBinaryData: vi
				.fn()
				.mockImplementation(async (buffer: Buffer, fileName: string, mimeType: string) => ({
					data: buffer.toString('base64'),
					fileName,
					mimeType,
				})),
		},
	} as unknown as IExecuteFunctions;
}

const SHRINK_URL = 'https://api.tinify.com/shrink';
const RESULT_URL = 'https://api.tinify.com/output/abc123';

describe('Tinify node', () => {
	it('compresses: posts to /shrink, follows the Location header, returns smaller binary + quota', async () => {
		const http = vi.fn(async (_cred: string, opts: { method: string; url: string }) => {
			if (opts.url === SHRINK_URL) {
				return { headers: { location: RESULT_URL, 'compression-count': '7' }, body: new ArrayBuffer(0) };
			}
			// GET the optimized result
			return { headers: {}, body: Buffer.from('smaller').buffer };
		});

		const ctx = makeContext({
			params: { operation: 'compress', binaryPropertyName: 'data', outputBinaryPropertyName: 'data' },
			httpMock: http,
		});

		const [out] = await Tinify.prototype.execute.call(ctx);

		// First call uploads to /shrink, second downloads the result URL.
		expect(http).toHaveBeenCalledTimes(2);
		expect(http.mock.calls[0][1]).toMatchObject({ method: 'POST', url: SHRINK_URL });
		expect(http.mock.calls[1][1]).toMatchObject({ method: 'GET', url: RESULT_URL });

		expect(out[0].json).toMatchObject({
			operation: 'compress',
			compressionCount: '7',
			inputMimeType: 'image/jpeg',
			outputMimeType: 'image/jpeg',
		});
		expect(out[0].binary?.data).toBeDefined();
		expect(out[0].pairedItem).toEqual({ item: 0 });
	});

	it('converts: sends a convert transform and takes the output mime from the response', async () => {
		const http = vi.fn(async (_cred: string, opts: { method: string; url: string; body?: unknown }) => {
			if (opts.url === SHRINK_URL) {
				return { headers: { location: RESULT_URL, 'compression-count': '8' }, body: new ArrayBuffer(0) };
			}
			return { headers: { 'content-type': 'image/webp' }, body: Buffer.from('webp').buffer };
		});

		const ctx = makeContext({
			params: {
				operation: 'convert',
				binaryPropertyName: 'data',
				outputBinaryPropertyName: 'data',
				convertType: 'image/webp',
			},
			httpMock: http,
		});

		const [out] = await Tinify.prototype.execute.call(ctx);

		expect(http.mock.calls[1][1]).toMatchObject({
			method: 'POST',
			url: RESULT_URL,
			body: { convert: { type: 'image/webp' } },
		});
		expect(out[0].json).toMatchObject({ operation: 'convert', outputMimeType: 'image/webp' });
	});

	it('omits a zero width/height when resizing', async () => {
		const http = vi.fn(async (_cred: string, opts: { url: string }) => {
			if (opts.url === SHRINK_URL) {
				return { headers: { location: RESULT_URL, 'compression-count': '9' }, body: new ArrayBuffer(0) };
			}
			return { headers: {}, body: Buffer.from('resized').buffer };
		});

		const ctx = makeContext({
			params: {
				operation: 'resize',
				binaryPropertyName: 'data',
				outputBinaryPropertyName: 'data',
				resizeMethod: 'scale',
				width: 150,
				height: 0,
			},
			httpMock: http,
		});

		await Tinify.prototype.execute.call(ctx);

		expect(http.mock.calls[1][1]).toMatchObject({ body: { resize: { method: 'scale', width: 150 } } });
		expect((http.mock.calls[1][1] as { body: { resize: Record<string, unknown> } }).body.resize).not.toHaveProperty('height');
	});

	it('honours Continue On Fail when the item has no binary', async () => {
		const http = vi.fn();
		const ctx = makeContext({
			params: { operation: 'compress', binaryPropertyName: 'data', outputBinaryPropertyName: 'data' },
			binary: undefined,
			httpMock: http,
			continueOnFail: true,
		});

		const [out] = await Tinify.prototype.execute.call(ctx);

		expect(http).not.toHaveBeenCalled();
		expect(out[0].json.error).toContain('No binary field');
	});
});
