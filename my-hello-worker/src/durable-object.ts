/**
 * MessageBroadcaster Durable Object
 * 用於處理 WebSocket 連線和訊息廣播
 */
export class MessageBroadcaster {
	private connections: Set<WebSocket>;
	private env: Env;

	constructor(ctx: DurableObjectState, env: Env) {
		this.connections = new Set();
		this.env = env;
	}

	/**
	 * 處理 HTTP 請求，包括 WebSocket 升級和 POST 請求
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// 處理 WebSocket 升級請求
		if (request.headers.get('Upgrade') === 'websocket') {
			return this.handleWebSocketUpgrade(request);
		}

		// 處理 POST 請求進行廣播
		if (request.method === 'POST') {
			return this.handleBroadcastRequest(request);
		}

		// 處理其他 HTTP 請求
		if (url.pathname === '/stats') {
			return this.getStats();
		}

		return new Response('Not found', { status: 404 });
	}

	/**
	 * 處理 WebSocket 升級
	 */
	private handleWebSocketUpgrade(request: Request): Response {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		// 接受 WebSocket 連線
		server.accept();

		// 將新連線加入到連線集合中
		this.connections.add(server);

		// 設置事件監聽器
		server.addEventListener('message', (event) => {
			this.webSocketMessage(server, event);
		});

		server.addEventListener('close', (event) => {
			this.webSocketClose(server, event);
		});

		server.addEventListener('error', (event) => {
			this.webSocketError(server, event);
		});

		// 發送歡迎訊息
		server.send(JSON.stringify({
			type: 'welcome',
			message: 'Connected to WebSocket broadcast server',
			timestamp: new Date().toISOString(),
			connectionCount: this.connections.size
		}));

		// 通知其他客戶端有新連線
		this.broadcast({
			type: 'user_joined',
			message: 'A new user joined the chat',
			timestamp: new Date().toISOString(),
			connectionCount: this.connections.size
		}, server);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	/**
	 * 處理 WebSocket 訊息
	 */
	webSocketMessage(webSocket: WebSocket, event: MessageEvent): void {
		try {
			let messageData;
			
			// 解析訊息
			if (typeof event.data === 'string') {
				try {
					messageData = JSON.parse(event.data);
				} catch {
					// 如果不是 JSON，就當作純文字訊息
					messageData = {
						type: 'message',
						content: event.data,
						timestamp: new Date().toISOString()
					};
				}
			} else {
				// 處理二進制訊息
				messageData = {
					type: 'binary',
					content: 'Binary message received',
					timestamp: new Date().toISOString()
				};
			}

			// 添加伺服器端的元數據
			const broadcastMessage = {
				...messageData,
				timestamp: new Date().toISOString(),
				connectionCount: this.connections.size
			};

			// 廣播訊息給所有其他客戶端（不包括發送者）
			this.broadcast(broadcastMessage, webSocket);

		} catch (error) {
			console.error('Error processing WebSocket message:', error);
			
			// 發送錯誤訊息給發送者
			webSocket.send(JSON.stringify({
				type: 'error',
				message: 'Failed to process your message',
				timestamp: new Date().toISOString()
			}));
		}
	}

	/**
	 * 處理 WebSocket 關閉
	 */
	webSocketClose(webSocket: WebSocket, event: CloseEvent): void {
		// 從連線集合中移除
		this.connections.delete(webSocket);

		console.log(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);

		// 通知其他客戶端有用戶離開
		this.broadcast({
			type: 'user_left',
			message: 'A user left the chat',
			timestamp: new Date().toISOString(),
			connectionCount: this.connections.size
		});
	}

	/**
	 * 處理 WebSocket 錯誤
	 */
	webSocketError(webSocket: WebSocket, event: ErrorEvent): void {
		// 從連線集合中移除
		this.connections.delete(webSocket);

		console.error('WebSocket error:', event);

		// 通知其他客戶端有用戶因錯誤離開
		this.broadcast({
			type: 'user_error',
			message: 'A user disconnected due to an error',
			timestamp: new Date().toISOString(),
			connectionCount: this.connections.size
		});
	}

	/**
	 * 廣播訊息給所有客戶端（可選擇排除特定客戶端）
	 */
	private broadcast(message: any, excludeWebSocket?: WebSocket): void {
		const messageString = JSON.stringify(message);
		const connectionsToRemove: WebSocket[] = [];

		for (const connection of this.connections) {
			// 跳過被排除的連線
			if (excludeWebSocket && connection === excludeWebSocket) {
				continue;
			}

			try {
				// 檢查連線狀態
				if (connection.readyState === WebSocket.READY_STATE_OPEN) {
					connection.send(messageString);
				} else {
					// 連線已關閉，標記為待移除
					connectionsToRemove.push(connection);
				}
			} catch (error) {
				console.error('Error sending message to client:', error);
				// 發送失敗，標記為待移除
				connectionsToRemove.push(connection);
			}
		}

		// 清理無效的連線
		for (const connection of connectionsToRemove) {
			this.connections.delete(connection);
		}
	}

	/**
	 * 處理廣播請求
	 */
	private async handleBroadcastRequest(request: Request): Promise<Response> {
		try {
			const body = await request.text();
			
			// 廣播訊息給所有已連線的 WebSocket 客戶端
			this.broadcast({
				type: 'broadcast',
				data: body,
				timestamp: new Date().toISOString(),
				connectionCount: this.connections.size
			});

			return new Response(JSON.stringify({
				success: true,
				message: 'Message broadcasted successfully',
				connectionCount: this.connections.size
			}), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*'
				}
			});
		} catch (error) {
			console.error('Error handling broadcast request:', error);
			return new Response(JSON.stringify({
				success: false,
				error: 'Failed to broadcast message'
			}), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}
	}

	/**
	 * 獲取伺服器統計資訊
	 */
	private getStats(): Response {
		const stats = {
			activeConnections: this.connections.size,
			timestamp: new Date().toISOString()
		};

		return new Response(JSON.stringify(stats), {
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*'
			}
		});
	}
}

// 導出 Durable Object 類別
export { MessageBroadcaster as default };