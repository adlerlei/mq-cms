// src/index.ts

// ====================================================
// Durable Object: MessageBroadcaster
// ====================================================
export class MessageBroadcaster {
	private connections: Set<WebSocket>;
	private state: DurableObjectState;

	constructor(state: DurableObjectState) {
		this.state = state;
		this.connections = new Set();
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (request.headers.get('Upgrade') === 'websocket') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			server.accept();
			this.connections.add(server);

			const closeOrErrorHandler = () => {
				this.connections.delete(server);
				this.broadcast(JSON.stringify({ type: 'user_left', count: this.connections.size }));
			};

			server.addEventListener('close', closeOrErrorHandler);
			server.addEventListener('error', closeOrErrorHandler);

			server.send(JSON.stringify({ type: 'welcome', count: this.connections.size }));
			this.broadcast(JSON.stringify({ type: 'user_joined', count: this.connections.size }));

			return new Response(null, { status: 101, webSocket: client });
		} else if (request.method === 'POST' && url.pathname === '/api/message') {
			const message = await request.text();
			this.broadcast(message);
			return new Response('Message broadcasted', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
		} else if (request.method === 'POST' && url.pathname === '/api/playlist_updated') {
			// 處理播放列表更新的內部廣播
			const message = JSON.stringify({ type: 'playlist_updated' });
			this.broadcast(message);
			return new Response('Playlist update broadcasted', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
		} else if (url.pathname === '/stats') {
			return new Response(JSON.stringify({ connectionCount: this.connections.size }), {
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
			});
		}

		return new Response('Not found', { status: 404 });
	}

	private broadcast(message: string) {
		for (const conn of this.connections) {
			if (conn.readyState === WebSocket.READY_STATE_OPEN) {
				conn.send(message);
			}
		}
	}
}

// ====================================================
// Worker Entrypoint
// ====================================================

export interface Env {
	ASSETS: Fetcher;
	MESSAGE_BROADCASTER: DurableObjectNamespace;
	MEDIA_BUCKET: R2Bucket; // R2 儲存桶綁定
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// 處理媒體檔案相關的 API 請求
		if (url.pathname === '/api/media') {
			if (request.method === 'POST') {
				// 上傳檔案到 R2
				console.log('🚀 POST /api/media route called - starting file upload process');
				
				try {
					console.log('📝 Attempting to read FormData from request...');
					const formData = await request.formData();
					console.log('✅ Successfully read FormData from request');
					
					console.log('📁 Attempting to get file from FormData...');
					const file = formData.get('file') as File;
					
					if (!file) {
						console.log('❌ No file found in FormData');
						return new Response(JSON.stringify({ error: 'No file provided' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
						});
					}

					console.log(`✅ Successfully got file from FormData - Name: "${file.name}", Size: ${file.size} bytes`);

					// 生成檔案名稱（使用時間戳避免重複）
					const timestamp = Date.now();
					const fileExtension = file.name.split('.').pop();
					const key = `${timestamp}-${file.name}`;
					console.log(`🔑 Generated file key: "${key}"`);

					// 將檔案轉換為 ArrayBuffer 並上傳到 R2
					console.log('🔄 Converting file to ArrayBuffer...');
					const arrayBuffer = await file.arrayBuffer();
					console.log(`✅ File converted to ArrayBuffer, size: ${arrayBuffer.byteLength} bytes`);
					
					console.log('☁️ Calling env.MEDIA_BUCKET.put() to upload to R2...');
					await env.MEDIA_BUCKET.put(key, arrayBuffer, {
						httpMetadata: {
							contentType: file.type,
						},
					});
					console.log('✅ Successfully uploaded file to R2');

					// 通知所有客戶端播放列表已更新
					try {
						const id = env.MESSAGE_BROADCASTER.idFromName('global-broadcaster');
						const stub = env.MESSAGE_BROADCASTER.get(id);
						await stub.fetch(new Request('http://localhost/api/playlist_updated', {
							method: 'POST',
							body: JSON.stringify({ type: 'playlist_updated' })
						}));
						console.log('📢 Broadcasted playlist_updated message');
					} catch (broadcastError) {
						console.log('⚠️ Failed to broadcast playlist update:', broadcastError);
					}

					const response = {
						success: true, 
						key: key,
						originalName: file.name,
						size: file.size,
						type: file.type
					};
					console.log('📤 Sending success response:', response);

					return new Response(JSON.stringify(response), {
						status: 200,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				} catch (error) {
					console.log('❌ Error caught in POST /api/media:', error);
					console.log('❌ Error message:', error.message);
					console.log('❌ Error stack:', error.stack);
					
					return new Response(JSON.stringify({ error: 'Upload failed', details: error.message }), {
						status: 500,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}
			} else if (request.method === 'GET') {
				// 獲取檔案列表
				try {
					const objects = await env.MEDIA_BUCKET.list();
					const fileList = objects.objects.map(obj => obj.key);
					
					return new Response(JSON.stringify(fileList), {
						status: 200,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				} catch (error) {
					return new Response(JSON.stringify({ error: 'Failed to fetch file list', details: error.message }), {
						status: 500,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}
			}
		}

		// 處理刪除特定檔案的請求 DELETE /api/media/[filename]
		if (url.pathname.startsWith('/api/media/') && request.method === 'DELETE') {
			try {
				// 從 URL 中提取檔案名稱
				const filename = decodeURIComponent(url.pathname.replace('/api/media/', ''));
				
				if (!filename) {
					return new Response(JSON.stringify({ error: 'No filename provided' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}

				// 從 R2 中刪除檔案
				await env.MEDIA_BUCKET.delete(filename);

				// 通知所有客戶端播放列表已更新
				try {
					const id = env.MESSAGE_BROADCASTER.idFromName('global-broadcaster');
					const stub = env.MESSAGE_BROADCASTER.get(id);
					await stub.fetch(new Request('http://localhost/api/playlist_updated', {
						method: 'POST',
						body: JSON.stringify({ type: 'playlist_updated' })
					}));
					console.log('📢 Broadcasted playlist_updated message after deletion');
				} catch (broadcastError) {
					console.log('⚠️ Failed to broadcast playlist update after deletion:', broadcastError);
				}

				return new Response(JSON.stringify({ 
					success: true, 
					message: `File "${filename}" deleted successfully` 
				}), {
					status: 200,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: 'Delete failed', details: error.message }), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		}

		// 將 WebSocket 和其他 API 請求轉發給 Durable Object
		if (url.pathname === '/ws' || url.pathname.startsWith('/api/')) {
			const id = env.MESSAGE_BROADCASTER.idFromName('global-broadcaster');
			const stub = env.MESSAGE_BROADCASTER.get(id);
			return stub.fetch(request);
		}

		// 其他所有請求都交給靜態資源服務處理
		try {
			return await env.ASSETS.fetch(request);
		} catch (e) {
			let notFoundResponse = new Response('Not found', { status: 404 });
			try {
				const notFoundAsset = await env.ASSETS.fetch(new Request(new URL('/404.html', request.url), request));
				notFoundResponse = new Response(notFoundAsset.body, {
					status: 404,
					headers: notFoundAsset.headers,
				});
			} catch (err) {}
			return notFoundResponse;
		}
	},
};