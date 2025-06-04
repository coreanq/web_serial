export class TcpManager {
    constructor(uiController) {
        this.uiController = uiController;
        this.socket = null;
        this.connected = false;
        this.onDataCallback = null;
        this.onErrorCallback = null;
        this.onCloseCallback = null;

        // TODO: WebSocket 서버 주소 설정 (예: 'ws://localhost:8080/modbus')
        // 이 주소는 Modbus TCP 장치와 통신을 중계하는 WebSocket 서버의 주소입니다.
        this.webSocketServerUrl = ''; // 실제 사용 시 이 URL을 설정해야 합니다.
    }

    /**
     * Modbus TCP 서버(WebSocket 브릿지 경유)에 연결합니다.
     * @param {object} options - 연결 옵션
     * @param {string} options.ipAddress - 대상 Modbus TCP 서버 IP 주소
     * @param {number} options.port - 대상 Modbus TCP 서버 포트
     * @param {number} options.connectTimeout - 연결 타임아웃 (ms) - WebSocket 자체 타임아웃은 브라우저/라이브러리 따름
     * @param {string} options.ipVersion - 'ipv4' 또는 'ipv6' (주로 정보 전달용)
     * @param {string} options.modbusMode - 'rtu' 또는 'ascii' (Modbus TCP는 보통 RTU over TCP)
     * @param {number} options.delayBetweenPolls - 폴링 간 지연 시간 (ms)
     */
    async connect(options) {
        if (this.connected) {
            console.warn('TcpManager: Already connected.');
            return true;
        }

        if (!this.webSocketServerUrl) {
            const errorMsg = 'TcpManager: WebSocket server URL is not configured.';
            console.error(errorMsg);
            if (this.onErrorCallback) this.onErrorCallback(new Error(errorMsg));
            this.uiController.updateConnectionStatus(errorMsg, true);
            return false;
        }

        return new Promise((resolve) => {
            console.log(`TcpManager: Attempting to connect to WebSocket bridge: ${this.webSocketServerUrl} for target ${options.ipAddress}:${options.port}`);
            this.uiController.updateConnectionStatus(`TCP/IP 연결 시도 중... (${options.ipAddress}:${options.port})`, false);

            try {
                this.socket = new WebSocket(this.webSocketServerUrl);

                this.socket.onopen = () => {
                    this.connected = true;
                    console.log('TcpManager: WebSocket connection established.');
                    this.uiController.updateConnectionStatus(`TCP/IP 연결됨 (${options.ipAddress}:${options.port})`, false, true);
                    resolve(true);
                };

                this.socket.onmessage = (event) => {
                    if (this.onDataCallback) {
                        if (event.data instanceof ArrayBuffer) {
                            this.onDataCallback(new Uint8Array(event.data));
                        } else if (typeof event.data === 'string') {
                            console.warn('TcpManager: Received string data, expecting ArrayBuffer for Modbus.');
                        } else if (event.data instanceof Blob) {
                            const reader = new FileReader();
                            reader.onload = () => {
                                this.onDataCallback(new Uint8Array(reader.result));
                            };
                            reader.readAsArrayBuffer(event.data);
                        } else {
                            console.error('TcpManager: Received data in unhandled format:', event.data);
                        }
                    }
                };

                this.socket.onerror = (error) => {
                    console.error('TcpManager: WebSocket error:', error);
                    this.connected = false;
                    const errorMsg = `TCP/IP 오류: ${error.message || 'WebSocket 연결 실패'}`;
                    this.uiController.updateConnectionStatus(errorMsg, true);
                    if (this.onErrorCallback) this.onErrorCallback(error);
                    resolve(false);
                };

                this.socket.onclose = (event) => {
                    this.connected = false;
                    console.log(`TcpManager: WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
                    const statusMsg = event.wasClean ? `TCP/IP 연결 해제됨` : `TCP/IP 연결 끊김 (Code: ${event.code})`;
                    this.uiController.updateConnectionStatus(statusMsg, !event.wasClean);
                    if (this.onCloseCallback) this.onCloseCallback(event.wasClean);
                };

            } catch (error) {
                console.error('TcpManager: Failed to create WebSocket:', error);
                const errorMsg = `TCP/IP 오류: ${error.message || 'WebSocket 생성 실패'}`;
                this.uiController.updateConnectionStatus(errorMsg, true);
                if (this.onErrorCallback) this.onErrorCallback(error);
                resolve(false);
            }
        });
    }

    disconnect() {
        if (this.socket && this.connected) {
            console.log('TcpManager: Closing WebSocket connection.');
            this.socket.close();
        }
        this.connected = false;
    }

    sendMessage(data) {
        if (this.socket && this.connected) {
            try {
                this.socket.send(data.buffer);
                return true;
            } catch (error) {
                console.error('TcpManager: Error sending message:', error);
                if (this.onErrorCallback) this.onErrorCallback(error);
                this.uiController.updateConnectionStatus(`TCP/IP 메시지 전송 오류: ${error.message}`, true);
                return false;
            }
        } else {
            console.warn('TcpManager: Not connected. Cannot send message.');
            this.uiController.updateConnectionStatus('TCP/IP 연결되지 않음. 메시지를 보낼 수 없습니다.', true);
            return false;
        }
    }

    onData(callback) {
        this.onDataCallback = callback;
    }

    onError(callback) {
        this.onErrorCallback = callback;
    }

    onClose(callback) {
        this.onCloseCallback = callback;
    }

    isConnected() {
        return this.connected;
    }
}
