import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
	NodeApiError,
} from 'n8n-workflow';

// Maps a Tinify output MIME type to the file extension the converted image should
// carry, so a PNG converted to WebP is named `photo.webp` rather than `photo.png`.
const MIME_EXTENSIONS: Record<string, string> = {
	'image/webp': 'webp',
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/avif': 'avif',
};

function extensionForMimeType(mimeType: string): string | undefined {
	return MIME_EXTENSIONS[mimeType.toLowerCase().split(';')[0].trim()];
}

export class Tinify implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tinify',
		name: 'tinify',
		icon: 'file:tinify.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Compress, resize, and convert images with the Tinify (TinyPNG) API',
		defaults: {
			name: 'Tinify',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'tinifyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Compress',
						value: 'compress',
						description: 'Shrink an image to the smallest possible size',
						action: 'Compress an image',
					},
					{
						name: 'Convert',
						value: 'convert',
						description: 'Convert an image to another format (counts as one extra compression)',
						action: 'Convert an image',
					},
					{
						name: 'Resize',
						value: 'resize',
						description: 'Resize an image (counts as one extra compression)',
						action: 'Resize an image',
					},
				],
				default: 'compress',
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary field on the incoming item that contains the image',
			},
			{
				displayName: 'Output Binary Field',
				name: 'outputBinaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary field to write the processed image to',
			},
			{
				displayName: 'Resize Method',
				name: 'resizeMethod',
				type: 'options',
				displayOptions: { show: { operation: ['resize'] } },
				options: [
					{ name: 'Cover', value: 'cover', description: 'Fill width AND height exactly, cropping smartly' },
					{ name: 'Fit', value: 'fit', description: 'Fit within width AND height, keeping proportions' },
					{ name: 'Scale', value: 'scale', description: 'Scale down proportionally; give width OR height' },
					{ name: 'Thumb', value: 'thumb', description: 'Smart thumbnail crop to width AND height' },
				],
				default: 'fit',
			},
			{
				displayName: 'Width',
				name: 'width',
				type: 'number',
				displayOptions: { show: { operation: ['resize'] } },
				default: 0,
				description: 'Target width in pixels. Leave 0 to omit (only valid for Scale).',
			},
			{
				displayName: 'Height',
				name: 'height',
				type: 'number',
				displayOptions: { show: { operation: ['resize'] } },
				default: 0,
				description: 'Target height in pixels. Leave 0 to omit (only valid for Scale).',
			},
			{
				displayName: 'Convert To',
				name: 'convertType',
				type: 'options',
				displayOptions: { show: { operation: ['convert'] } },
				options: [
					{ name: 'AVIF', value: 'image/avif' },
					{ name: 'JPEG', value: 'image/jpeg' },
					{ name: 'PNG', value: 'image/png' },
					{ name: 'Smallest (Let Tinify Choose)', value: '*/*' },
					{ name: 'WebP', value: 'image/webp' },
				],
				default: 'image/webp',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const inputField = this.getNodeParameter('binaryPropertyName', i) as string;
				const outputField = this.getNodeParameter('outputBinaryPropertyName', i) as string;

				const binary = items[i].binary?.[inputField];
				if (binary === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						`No binary field "${inputField}" found on item ${i}`,
						{ itemIndex: i },
					);
				}

				// Validate resize dimensions up front, before the /shrink upload consumes a
				// monthly compression. Scale takes exactly one dimension; fit/cover/thumb need both.
				if (operation === 'resize') {
					const method = this.getNodeParameter('resizeMethod', i) as string;
					const width = this.getNodeParameter('width', i) as number;
					const height = this.getNodeParameter('height', i) as number;
					if (method === 'scale') {
						if ((width > 0) === (height > 0)) {
							throw new NodeOperationError(
								this.getNode(),
								'Resize method "Scale" needs exactly one of Width or Height — not both, not neither.',
								{ itemIndex: i },
							);
						}
					} else if (width <= 0 || height <= 0) {
						throw new NodeOperationError(
							this.getNode(),
							`Resize method "${method}" needs both Width and Height to be greater than 0.`,
							{ itemIndex: i },
						);
					}
				}

				const buffer = await this.helpers.getBinaryDataBuffer(i, inputField);

				// POST to /shrink — the result URL comes back in the Location header, not the body.
				const shrinkResponse = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'tinifyApi',
					{
						method: 'POST',
						url: 'https://api.tinify.com/shrink',
						body: buffer,
						returnFullResponse: true,
						encoding: 'arraybuffer',
					},
				);

				const location = shrinkResponse.headers?.location as string | undefined;
				if (!location) {
					throw new NodeApiError(
						this.getNode(),
						{ message: 'Tinify did not return a result location' },
						{ itemIndex: i },
					);
				}

				let resultBuffer: Buffer;
				let resultMime = binary.mimeType;
				let resultName = binary.fileName ?? 'image';

				if (operation === 'compress') {
					const out = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'tinifyApi',
						{
							method: 'GET',
							url: location,
							encoding: 'arraybuffer',
							returnFullResponse: true,
						},
					);
					resultBuffer = Buffer.from(out.body as ArrayBuffer);
				} else {
					const transformBody: Record<string, unknown> = {};

					if (operation === 'resize') {
						const method = this.getNodeParameter('resizeMethod', i) as string;
						const width = this.getNodeParameter('width', i) as number;
						const height = this.getNodeParameter('height', i) as number;
						// Dimensions were already validated before the upload.
						const resize: Record<string, unknown> = { method };
						if (width > 0) resize.width = width;
						if (height > 0) resize.height = height;
						transformBody.resize = resize;
					} else {
						const convertType = this.getNodeParameter('convertType', i) as string;
						transformBody.convert = { type: convertType };
						resultMime = convertType === '*/*' ? binary.mimeType : convertType;
					}

					const out = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'tinifyApi',
						{
							method: 'POST',
							url: location,
							headers: { 'Content-Type': 'application/json' },
							body: transformBody,
							json: true,
							encoding: 'arraybuffer',
							returnFullResponse: true,
						},
					);
					resultBuffer = Buffer.from(out.body as ArrayBuffer);
					const ct = out.headers?.['content-type'] as string | undefined;
					if (ct) resultMime = ct;

					// Convert changes the image format, so update the filename extension to
					// match the new type (resize keeps the original format and filename).
					if (operation === 'convert') {
						const ext = extensionForMimeType(resultMime);
						if (ext) resultName = `${resultName.replace(/\.[^./\\]+$/, '')}.${ext}`;
					}
				}

				const newBinary = await this.helpers.prepareBinaryData(
					resultBuffer,
					resultName,
					resultMime,
				);

				returnData.push({
					json: {
						operation,
						compressionCount: shrinkResponse.headers?.['compression-count'] ?? null,
						inputMimeType: binary.mimeType,
						outputMimeType: resultMime,
					},
					binary: { [outputField]: newBinary },
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
