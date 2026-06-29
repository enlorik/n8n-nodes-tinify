import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TinifyApi implements ICredentialType {
	name = 'tinifyApi';

	displayName = 'Tinify API';

	icon = 'file:tinify.svg' as const;

	documentationUrl = 'https://tinify.com/developers';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your Tinify (TinyPNG) API key. Find it at tinify.com/dashboard.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: 'api',
				password: '={{$credentials.apiKey}}',
			},
		},
	};

	// Tinify has no dedicated "validate key" endpoint. The credential test shrinks a
	// small public image via Tinify's `source.url` form, which returns 201 on a valid
	// key (green "Connection successful") and 401 on a bad one. This uses one of the
	// account's monthly compressions per test, which is the only way Tinify exposes a
	// definitive auth check.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.tinify.com',
			url: '/shrink',
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: {
				source: { url: 'https://www.gstatic.com/webp/gallery/1.jpg' },
			},
		},
	};
}
