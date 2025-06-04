/**
 * SerialManager.js
 * Web Serial API를 사용하여 시리얼 포트 연결을 관리하는 모듈
 */
export class SerialManager {
    /**
     * SerialManager 생성자
     * @param {AppState} appState 애플리케이션 상태 관리자 (선택적)
     */
    constructor(appState = null) {
        // 브라우저 호환성 검사
        this.isWebSerialSupported = 'serial' in navigator;
        
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.readableStreamClosed = null;
        this.writableStreamClosed = null;
        this.isReading = false;
        this.connectionListeners = [];
        this.dataListeners = [];
        this.errorListeners = [];
        this.portInfo = null; // 연결된 포트 정보 저장
        
        // 데이터 버퍼 관련 변수
        this.receiveBuffer = new Uint8Array(4096); // 4KB 버퍼
        this.bufferPosition = 0;
        this.lastReceiveTime = 0;
        this.lastTxData = null;  // 마지막으로 전송된 데이터를 저장할 속성 추가
        
        // 애플리케이션 상태 관리자
        this.appState = appState;
        
        // 애플리케이션 상태가 있는 경우 연결 상태 변경 구독
        if (this.appState) {
            this.onConnectionChange((isConnected, message) => {
                this.appState.update('connection.isConnected', isConnected);
                if (isConnected) {
                    this.appState.notify(`시리얼 포트 연결됨: ${message}`, 'success');
                } else {
                    this.appState.notify(`시리얼 포트 연결 해제됨: ${message}`, 'info');
                }
            });
            
            this.onError((error) => {
                this.appState.notify(`시리얼 포트 오류: ${error.message}`, 'error');
            });
        }
        
        // 포트 연결 해제 감지를 위한 이벤트 리스너
        if (this.isWebSerialSupported) {
            navigator.serial.addEventListener('disconnect', (event) => {
                if (this.port && event.target === this.port) {
                    this._notifyConnectionChange(false, '장치가 분리되었습니다');
                    this.port = null;
                    this.reader = null;
                    this.writer = null;
                }
            });
        }
    }

    /**
     * 사용자에게 시리얼 포트 선택 대화상자를 표시
     * @param {Object} filters 필터 옵션 (선택적, USB 벤더/제품 ID 등)
     * @returns {Promise<boolean>} 포트 선택 성공 여부
     */
    async selectPort(filters = null) {
        if (!this.isWebSerialSupported) {
            this._notifyError(new Error('Web Serial API가 지원되지 않는 브라우저입니다. Chrome, Edge 또는 Opera 최신 버전을 사용하세요.'));
            return false;
        }

        try {
            // 필터 옵션이 제공된 경우 대화상자에 적용
            const options = filters ? { filters } : {};
            
            // 사용자에게 포트 선택 대화상자 표시
            this.port = await navigator.serial.requestPort(options);
            
            try {
                // 포트 정보 가져오기 시도 (브라우저에 따라 제한적일 수 있음)
                this.portInfo = this.port.getInfo ? this.port.getInfo() : { usbVendorId: 0, usbProductId: 0 };
            } catch (infoError) {
                console.warn('포트 정보 가져오기 실패:', infoError);
                this.portInfo = null;
            }
            
            this._notifyConnectionChange(false, '포트 선택됨');
            return true;
        } catch (error) {
            // 사용자가 취소한 경우 (AbortError)는 일반적인 동작이므로 에러로 처리하지 않음
            if (error.name !== 'AbortError') {
                this._notifyError(error);
                console.error('포트 선택 오류:', error);
            }
            return false;
        }
    }

    /**
     * 선택된 시리얼 포트에 연결
     * @param {Object} options 연결 옵션
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async connect(options = null) {
        if (!this.isWebSerialSupported) {
            this._notifyError(new Error('Web Serial API가 지원되지 않는 브라우저입니다.'));
            return false;
        }
        
        if (!this.port) {
            this._notifyError(new Error('선택된 포트가 없습니다. 먼저 포트를 선택해주세요.'));
            return false;
        }
        
        // 이미 연결된 경우 새로운 연결 차단
        if (this.isConnected()) {
            this._notifyError(new Error('이미 연결되어 있습니다. 새로 연결하려면 먼저 현재 연결을 해제하세요.'));
            return false;
        }
        
        // 애플리케이션 상태에서 설정 가져오기 또는 기본값 사용
        const defaultOptions = {
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none',
            bufferSize: 4096
        };
        
        // 옵션 설정
        let connectionOptions;
        
        if (this.appState) {
            // 애플리케이션 상태에서 설정 가져오기
            const stateSettings = this.appState.get('connection.settings');
            connectionOptions = stateSettings || defaultOptions;
        } else {
            // 전달된 옵션 또는 기본값 사용
            connectionOptions = options || defaultOptions;
        }

        // 연결 상태 알림
        this._notifyConnectionChange(false, '연결 시도 중...');
        
        try {
            // 포트 연결 시도
            await this.port.open(connectionOptions);
            
            // 읽기 스트림 설정
            const textDecoder = new TextDecoder();
            this.readableStreamClosed = this._readLoop(textDecoder);
            
            // 쓰기 스트림 설정
            this.writer = this.port.writable.getWriter();
            
            // 포트 정보 가져오기 시도
            try {
                if (this.port.getInfo) {
                    this.portInfo = this.port.getInfo();
                    
                    // 애플리케이션 상태 업데이트
                    if (this.appState) {
                        this.appState.update('connection.port', this.portInfo);
                    }
                }
            } catch (infoError) {
                console.warn('포트 정보 가져오기 실패:', infoError);
            }
            
            // 연결 상태 및 설정 저장
            if (this.appState) {
                this.appState.update('connection.settings', connectionOptions);
                this.appState.update('connection.lastConnected', new Date().toISOString());
            }
            
            this._notifyConnectionChange(true, '연결됨');
            return true;
        } catch (error) {
            // 연결 실패 시 더 자세한 오류 메시지 제공
            let errorMessage = '포트 연결 오류';
            
            // 자주 발생하는 오류 유형에 대한 상세 설명
            if (error.name === 'NotFoundError') {
                errorMessage = '지정된 포트가 발견되지 않았습니다.';
            } else if (error.name === 'InvalidStateError') {
                errorMessage = '포트가 이미 연결되어 있거나 다른 프로세스에서 사용 중입니다.';
            } else if (error.name === 'NetworkError') {
                errorMessage = '시리얼 포트 사용 중 네트워크 오류가 발생했습니다.';
            } else if (error.name === 'SecurityError') {
                errorMessage = '보안 제한으로 인해 포트에 액세스할 수 없습니다. HTTPS 연결을 확인해보세요.';
            } else if (error.name === 'AbortError') {
                errorMessage = '포트 연결이 취소되었습니다.';
            }
            
            this._notifyError(new Error(`${errorMessage} - ${error.message}`));
            console.error('포트 연결 오류:', error);
            
            // 포트 변수 초기화
            try {
                if (this.reader) {
                    await this.reader.cancel();
                    this.reader.releaseLock();
                    this.reader = null;
                }
                if (this.writer) {
                    await this.writer.close();
                    this.writer.releaseLock();
                    this.writer = null;
                }
            } catch (cleanupError) {
                console.error('연결 오류 후 리소스 정리 실패:', cleanupError);
            }
            
            return false;
        }
    }

    /**
     * 연결된 시리얼 포트에서 데이터 읽기 루프
     * @param {TextDecoder} textDecoder 텍스트 디코더
     * @returns {Promise<void>}
     */
    async _readLoop(textDecoder) {
        if (!this.port?.readable) {
            return;
        }

        this.isReading = true;
        
        // 수신 버퍼 초기화
        this.receiveBuffer = new Uint8Array(4096); // 4KB 버퍼
        this.bufferPosition = 0;
        this.lastReceiveTime = Date.now();
        
        try {
            this.reader = this.port.readable.getReader();
            
            while (this.isReading) {
                const { value, done } = await this.reader.read();
                
                if (done) {
                    break;
                }
                
                if (value) {
                    // 수신 시간 업데이트
                    this.lastReceiveTime = Date.now();
                    
                    // 수신 데이터 처리
                    this._processReceivedData(value, textDecoder);
                }
            }
        } catch (error) {
            this._notifyError(error);
            console.error('데이터 읽기 오류:', error);
        } finally {
            if (this.reader) {
                this.reader.releaseLock();
                this.reader = null;
            }
            this.isReading = false;
        }
    }
    
    /**
     * 수신된 데이터 처리
     * @param {Uint8Array} data 수신된 바이너리 데이터
     * @param {TextDecoder} textDecoder 텍스트 디코더
     * @private
     */
    _processReceivedData(data, textDecoder) {
        if (!data || data.length === 0) {
            return; // 빈 데이터 무시
        }
        
        // 수신 시간 기록
        const receiveTime = Date.now();
        
        try {
            // 버퍼에 데이터 추가
            for (let i = 0; i < data.length; i++) {
                this.receiveBuffer[this.bufferPosition] = data[i];
                this.bufferPosition = (this.bufferPosition + 1) % this.receiveBuffer.length;
            }
            
            // 바이너리 데이터와 텍스트 형식 모두 리스너에게 전달
            const textData = textDecoder.decode(data.slice(0)); // slice로 복사하여 안전하게 디코딩
            
            // 디버깅용 로깅
            const hexString = Array.from(data)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
                
            console.debug(`RX [${data.length} bytes]: ${hexString} | Text: ${textData.replace(/[\r\n]/g, '⏎')}`);
            
            // 수신 데이터 알림
            this._notifyDataReceived(data, textData, 'rx', receiveTime);
            
            // 애플리케이션 상태 업데이트
            if (this.appState) {
                this.appState.update('connection.lastRxTime', receiveTime);
                this.appState.update('connection.rxBytes', (this.appState.get('connection.rxBytes') || 0) + data.length);
            }
        } catch (error) {
            console.error('수신 데이터 처리 오류:', error);
            this._notifyError(error);
        }
    }

    /**
     * 시리얼 포트로 데이터 전송
     * @param {string|Uint8Array} data 전송할 데이터
     * @param {boolean} isHex 16진수 문자열 여부
     * @param {boolean} appendCRLF CRLF 추가 여부
     * @returns {Promise<boolean>} 전송 성공 여부
     */
    async sendData(data, isHex = false, appendCRLF = false) {
        if (!this.isConnected()) {
            const error = new Error('연결되지 않은 상태에서 데이터를 전송할 수 없습니다.');
            this._notifyError(error);
            throw error;
        }

        if (!this.writer) {
            const error = new Error('쓰기 스트림이 없습니다. 연결을 다시 시도해주세요.');
            this._notifyError(error);
            throw error;
        }

        try {
            let dataToSend;
            const sendTime = Date.now();
            
            // 문자열이고 16진수로 해석해야 하는 경우
            if (typeof data === 'string' && isHex) {
                // 공백, 탭, 줄바꾸기 등 제거하고 16진수 문자열을 바이트 배열로 변환
                const hexString = data.replace(/[\s\r\n\t]+/g, '');
                if (hexString.length === 0) {
                    console.warn('빈 16진수 문자열이 전송되었습니다.');
                    return true; // 빈 문자열은 성공으로 처리하고 전송하지 않음
                }
                
                if (hexString.length % 2 !== 0) {
                    const error = new Error('16진수 문자열의 길이는 짝수여야 합니다.');
                    this._notifyError(error);
                    throw error;
                }
                
                const bytes = [];
                for (let i = 0; i < hexString.length; i += 2) {
                    const byteStr = hexString.substr(i, 2);
                    const byte = parseInt(byteStr, 16);
                    if (isNaN(byte)) {
                        const error = new Error(`잘못된 16진수 문자: ${byteStr}`);
                        this._notifyError(error);
                        throw error;
                    }
                    bytes.push(byte);
                }
                
                dataToSend = new Uint8Array(bytes);
            } 
            // 문자열이고 일반 텍스트인 경우
            else if (typeof data === 'string') {
                let textToSend = data;
                if (appendCRLF) {
                    textToSend += '\r\n';
                }
                dataToSend = new TextEncoder().encode(textToSend);
            } 
            // 이미 Uint8Array인 경우
            else if (data instanceof Uint8Array) {
                if (appendCRLF) {
                    const crlfArray = new Uint8Array([0x0D, 0x0A]); // \r\n
                    const combinedArray = new Uint8Array(data.length + crlfArray.length);
                    combinedArray.set(data);
                    combinedArray.set(crlfArray, data.length);
                    dataToSend = combinedArray;
                } else {
                    dataToSend = data;
                }
            } 
            else {
                const error = new Error('지원되지 않는 데이터 형식입니다.');
                this._notifyError(error);
                throw error;
            }
            
            // 디버깅용 로깅
            const hexString = Array.from(dataToSend)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
                
            console.debug(`TX [${dataToSend.length} bytes]: ${hexString} | Text: ${new TextDecoder().decode(dataToSend).replace(/[\r\n]/g, '⏎')}`);
            
            // 데이터 전송
            await this.writer.write(dataToSend);
            
            // 전송 데이터 알림
            const textData = new TextDecoder().decode(dataToSend);
            this._notifyDataReceived(dataToSend, textData, 'tx', sendTime);
            
            // 애플리케이션 상태 업데이트
            if (this.appState) {
                this.appState.update('connection.lastTxTime', sendTime);
                this.appState.update('connection.txBytes', (this.appState.get('connection.txBytes') || 0) + dataToSend.length);
            }
            
            return true;
        } catch (error) {
            console.error('데이터 전송 오류:', error);
            this._notifyError(error);
            throw error;
        }
    }
    
    /**
     * 연결 상태 확인
     * @returns {boolean} 현재 연결되어 있는지 여부
     */
    isConnected() {
        return this.port !== null && this.writer !== null;
    }
    
    /**
     * 시리얼 포트 연결 해제
     * @returns {Promise<boolean>} 연결 해제 성공 여부 
     */
    async disconnect() {
        if (!this.port) {
            console.log('연결된 포트가 없습니다.');
            return false;
        }

        try {
            // 데이터 읽기 루프 중지
            this.isReading = false;
            
            try {
                // 읽기 작업이 진행 중이었다면 취소하고 리소스 해제
                if (this.reader) {
                    await this.reader.cancel();
                    this.reader.releaseLock();
                    this.reader = null;
                }
            } catch (readerError) {
                console.warn('리더 닫기 오류:', readerError);
            }

            try {
                // 쓰기 작업 종료 및 리소스 해제
                if (this.writer) {
                    await this.writer.close();
                    this.writer.releaseLock();
                    this.writer = null;
                }
            } catch (writerError) {
                console.warn('라이터 닫기 오류:', writerError);
            }

            try {
                // 포트 닫기
                await this.port.close();
                
                // 변수 초기화
                this.readableStreamClosed = null;
                this.writableStreamClosed = null;
                this.bufferPosition = 0;
                
                // 애플리케이션 상태 업데이트
                if (this.appState) {
                    this.appState.update('connection.isConnected', false);
                }
                
                this._notifyConnectionChange(false, '연결 해제됨');
                return true;
            } catch (portError) {
                this._notifyError(new Error(`포트 닫기 실패: ${portError.message}`));
                console.error('포트 연결 해제 오류:', portError);
                return false;
            }
        } catch (error) {
            this._notifyError(new Error(`연결 해제 중 오류 발생: ${error.message}`));
            console.error('포트 연결 해제 오류:', error);
            return false;
        }
    }

    /**
     * 연결 상태 변경 이벤트 리스너 등록
     * @param {Function} callback 콜백 함수
     * @returns {Function} 리스너 제거 함수
     */
    onConnectionChange(callback) {
        this.connectionListeners.push(callback);
        return () => {
            this.connectionListeners = this.connectionListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * 데이터 수신 이벤트 리스너 등록
     * @param {Function} callback 콜백 함수
     * @returns {Function} 리스너 제거 함수
     */
    onDataReceived(callback) {
        this.dataListeners.push(callback);
        return () => {
            this.dataListeners = this.dataListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * 오류 이벤트 리스너 등록
     * @param {Function} callback 콜백 함수
     * @returns {Function} 리스너 제거 함수
     */
    onError(callback) {
        this.errorListeners.push(callback);
        return () => {
            this.errorListeners = this.errorListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * 연결 상태 변경 알림
     * @param {boolean} isConnected 연결 상태
     * @param {string} message 상태 메시지
     * @private
     */
    _notifyConnectionChange(isConnected, message) {
        // 애플리케이션 상태 업데이트
        if (this.appState) {
            this.appState.update('connection.isConnected', isConnected);
        }
        
        // 리스너에게 알림
        this.connectionListeners.forEach(callback => {
            try {
                callback(isConnected, message);
            } catch (error) {
                console.error('연결 상태 리스너 오류:', error);
            }
        });
    }

    /**
     * 데이터 수신 리스너에게 알림
     * @param {Uint8Array} binaryData 바이너리 데이터
     * @param {string} textData 텍스트 데이터
     * @param {string} direction 방향 ('rx' 또는 'tx')
     * @param {number} timestamp 타임스태프 (선택사항)
     * @private
     */
    _notifyDataReceived(binaryData, textData, direction, timestamp = null) {
        if (!binaryData || binaryData.length === 0) {
            return; // 빈 데이터 무시
        }
        
        if (this.dataListeners.length > 0) {
            const currentTime = timestamp || Date.now();
            
            // 데이터 이벤트 객체 생성
            const dataEvent = {
                binary: binaryData,
                text: textData,
                direction: direction,
                timestamp: currentTime,
                size: binaryData.length,
                hexString: Array.from(binaryData)
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join(' ')
            };
            
            // 모든 리스너에게 알림
            this.dataListeners.forEach(listener => {
                try {
                    listener(dataEvent);
                } catch (error) {
                    console.error('리스너 호출 오류:', error);
                }
            });
            
            // 애플리케이션 상태 업데이트 - 마지막 데이터 이벤트 저장
            if (this.appState) {
                this.appState.update('connection.lastDataEvent', {
                    direction: direction,
                    timestamp: currentTime,
                    size: binaryData.length
                });
            }
        }
    }
    
    /**
     * 오류 알림
     * @param {Error} error 오류 객체
     * @private
     */
    _notifyError(error) {
        // 애플리케이션 상태에 오류 알림 추가
        if (this.appState) {
            this.appState.notify(`시리얼 포트 오류: ${error.message}`, 'error');
        }
        
        // 리스너에게 알림
        this.errorListeners.forEach(callback => {
            try {
                callback(error);
            } catch (err) {
                console.error('오류 리스너 오류:', err);
            }
        });
    }
    
    /**
     * 마지막으로 전송된 데이터를 가져옵니다.
     * @returns {Uint8Array|null} 마지막으로 전송된 데이터 또는 전송된 데이터가 없을 경우 null
     */
    getLastTxData() {
        return this.lastTxData ? new Uint8Array(this.lastTxData) : null;
    }
}
