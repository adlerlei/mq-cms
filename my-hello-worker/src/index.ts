import { MessageBroadcaster } from './durable-object';

export interface Env {
	ASSETS: {
		fetch: (req: Request) => Promise<Response>;
	};
	MESSAGE_BROADCASTER: DurableObjectNamespace;
}

// Export Durable Object class
export { MessageBroadcaster };

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Handle WebSocket connections
		if (url.pathname === '/ws') {
			// Get or create a Durable Object instance
			const id = env.MESSAGE_BROADCASTER.idFromName('global-chat');
			const durableObject = env.MESSAGE_BROADCASTER.get(id);
			
			// Forward the request to the Durable Object
			return durableObject.fetch(request);
		}

		// Handle POST /api/message for broadcasting
		if (url.pathname === '/api/message' && request.method === 'POST') {
			const id = env.MESSAGE_BROADCASTER.idFromName('global-chat');
			const durableObject = env.MESSAGE_BROADCASTER.get(id);
			
			// Forward the request to the Durable Object
			return durableObject.fetch(request);
		}

		// Handle WebSocket stats
		if (url.pathname === '/api/ws-stats') {
			const id = env.MESSAGE_BROADCASTER.idFromName('global-chat');
			const durableObject = env.MESSAGE_BROADCASTER.get(id);
			
			const statsUrl = new URL('/stats', request.url);
			return durableObject.fetch(new Request(statsUrl.toString()));
		}

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