import { Router } from 'itty-router';

// Define the environment interface
interface Env {
  ASSETS: Fetcher;
}

// Create a router that ONLY handles API requests under the /api base path.
const apiRouter = Router({ base: '/api' });

apiRouter
  .post('/login', () => {
    const responseBody = JSON.stringify({ status: 'ok', message: 'Login successful' });
    return new Response(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  })
  // A catch-all 404 for any other request to /api/*
  .all('*', () => new Response('API route not found', { status: 404 }));

// Export the main worker fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // If the path starts with /api/, delegate to the API router.
    if (url.pathname.startsWith('/api/')) {
      return apiRouter.handle(request, env, ctx).catch(err => {
        console.error('API Router Error:', err);
        return new Response('Internal Server Error in API', { status: 500 });
      });
    }

    // Handle the root path specifically, rewriting the request to /login.html
    if (url.pathname === '/') {
      const newUrl = new URL(request.url);
      newUrl.pathname = '/login.html';
      const newRequest = new Request(newUrl.toString(), request);
      return env.ASSETS.fetch(newRequest);
    }

    // For all other paths, attempt to fetch the asset directly.
    // The ASSETS service itself will produce a 404 if the asset is not found.
    // This is the crucial part that prevents the infinite loop.
    return env.ASSETS.fetch(request);
  },
};