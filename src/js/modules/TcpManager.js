export class TcpManager {
    /**
     * TcpManager 생성자
     * @param {UIController} uiController UI 컨트롤러 인스턴스
     */
    constructor(uiController) {
        this.uiController = uiController;
        this.socket = null;
        this.connected = false;
        this.onDataCallback = null;
        this.onErrorCallback = null;
        this.onCloseCallback = null;
        
        // WebSocket 서버 URL 설정
        this.wsServerUrl = this.loadWsServerUrl();
    }
    
    /**
     * localStorage에서 WebSocket 서버 URL을 불러옵니다.
     * @returns {string} WebSocket 서버 URL
     */
    loadWsServerUrl() {
        return localStorage.getItem('wsServerUrl') || 'ws://localhost:8080/modbus';
    }
    
    /**
     * WebSocket 서버 URL을 localStorage에 저장합니다.
     * @param {string} url WebSocket 서버 URL
     * @returns {boolean} 저장 성공 여부
     */
    saveWsServerUrl(url) {
        if (url && typeof url === 'string') {
            localStorage.setItem('wsServerUrl', url);
            this.wsServerUrl = url;
            console.log('WebSocket 서버 URL이 저장되었습니다:', url);
            return true;
        }
        return false;
    }
    
    /**
     * 현재 설정된 WebSocket 서버 URL을 반환합니다.
     * @returns {string} WebSocket 서버 URL
     */
    getWsServerUrl() {
        return this.wsServerUrl;
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

        if (!this.wsServerUrl) {
            const errorMsg = 'TcpManager: WebSocket 서버 URL이 설정되지 않았습니다.';
            console.error(errorMsg);
            if (this.onErrorCallback) this.onErrorCallback(new Error(errorMsg));
            this.uiController.updateConnectionStatus(errorMsg, true);
            return false;
        }

        return new Promise((resolve) => {
            // WebSocket URL에 대상 Modbus TCP 서버 정보를 쿼리 파라미터로 추가
            const targetUrl = new URL(this.wsServerUrl);
            targetUrl.searchParams.append('ip', options.ipAddress);
            targetUrl.searchParams.append('port', options.port);
            targetUrl.searchParams.append('mode', options.modbusMode || 'rtu');
            
            console.log(`TcpManager: Attempting to connect to WebSocket bridge: ${targetUrl.toString()} for target ${options.ipAddress}:${options.port}`);
            this.uiController.updateConnectionStatus(`TCP/IP 연결 시도 중... (${options.ipAddress}:${options.port})`, false);

            try {
                this.socket = new WebSocket(targetUrl.toString());

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

    /**
     * 메시지 전송
     * @param {ArrayBuffer|Uint8Array} data 전송할 데이터
     * @returns {boolean} 전송 성공 여부
     */
    sendMessage(data) {
        if (this.socket && this.connected) {
            try {
                // 데이터 형식 처리
                if (data instanceof Uint8Array) {
                    // Uint8Array인 경우 buffer 속성 사용
                    this.socket.send(data.buffer);
                } else if (data instanceof ArrayBuffer) {
                    // ArrayBuffer인 경우 그대로 전송
                    this.socket.send(data);
                } else {
                    // 기타 형식(문자열 등)은 그대로 전송
                    this.socket.send(data);
                }
                
                console.log(`TcpManager: 메시지 전송 성공 (${data.byteLength || data.length} bytes)`);
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
