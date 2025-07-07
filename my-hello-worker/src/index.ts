export interface Env {
	ASSETS: {
		fetch: (req: Request) => Promise<Response>;
	};
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Manually handle the /api/login route
		if (url.pathname === '/api/login' && request.method === 'POST') {
			try {
				const data = await request.json<{ username?: string; password?: string }>();

				if (data.username === 'admin' && data.password === 'admin') {
					const successResponse = { status: 'ok' };
					return new Response(JSON.stringify(successResponse), {
						headers: { 'Content-Type': 'application/json' },
						status: 200,
					});
				} else {
					const errorResponse = { status: 'error', message: 'Invalid credentials' };
					return new Response(JSON.stringify(errorResponse), {
						headers: { 'Content-Type': 'application/json' },
						status: 401,
					});
				}
			} catch (err) {
				const badRequestResponse = { status: 'error', message: 'Bad Request' };
				return new Response(JSON.stringify(badRequestResponse), {
					headers: { 'Content-Type': 'application/json' },
					status: 400,
				});
			}
		}

		// Handle other API routes with a 404
		if (url.pathname.startsWith('/api/')) {
			return new Response('API route not found', { status: 404 });
		}

		// Static asset serving
		try {
			if (url.pathname === '/') {
				const loginUrl = new URL('/login.html', request.url);
				return env.ASSETS.fetch(new Request(loginUrl.toString(), request));
			}
			return await env.ASSETS.fetch(request);
		} catch (e) {
			try {
				const notFoundResponse = await env.ASSETS.fetch(new Request(new URL('/404.html', request.url), request));
				return new Response(notFoundResponse.body, {
					status: 404,
					headers: notFoundResponse.headers
				});
			} catch (err) {
				return new Response('Not found', { status: 404 });
			}
		}
	},
};