/**
 * SerialManager.js
 * Web Serial API를 사용하여 시리얼 포트 연결을 관리하는 모듈
 */
export class SerialManager {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.readableStreamClosed = null;
        this.writableStreamClosed = null;
        this.isReading = false;
        this.connectionListeners = [];
        this.dataListeners = [];
        this.errorListeners = [];
        
        // 데이터 버퍼 관련 변수
        this.receiveBuffer = new Uint8Array(4096); // 4KB 버퍼
        this.bufferPosition = 0;
        this.lastReceiveTime = 0;
    }

    /**
     * 사용자에게 시리얼 포트 선택 대화상자를 표시
     * @returns {Promise<boolean>} 포트 선택 성공 여부
     */
    async selectPort() {
        if (!navigator.serial) {
            this._notifyError(new Error('Web Serial API가 지원되지 않는 브라우저입니다.'));
            return false;
        }

        try {
            this.port = await navigator.serial.requestPort();
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
    async connect(options = {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
        bufferSize: 1024
    }) {
        if (!this.port) {
            this._notifyError(new Error('선택된 포트가 없습니다. 먼저 포트를 선택해주세요.'));
            return false;
        }

        try {
            await this.port.open(options);
            
            // 읽기 스트림 설정
            const textDecoder = new TextDecoder();
            this.readableStreamClosed = this._readLoop(textDecoder);
            
            // 쓰기 스트림 설정
            this.writer = this.port.writable.getWriter();
            
            this._notifyConnectionChange(true, '연결됨');
            return true;
        } catch (error) {
            this._notifyError(error);
            console.error('포트 연결 오류:', error);
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
        // 버퍼에 데이터 추가
        for (let i = 0; i < data.length; i++) {
            this.receiveBuffer[this.bufferPosition] = data[i];
            this.bufferPosition = (this.bufferPosition + 1) % this.receiveBuffer.length;
        }
        
        // 바이너리 데이터와 텍스트 형식 모두 리스너에게 전달
        const textData = textDecoder.decode(data);
        
        // 수신 데이터 알림
        this._notifyDataReceived(data, textData, 'rx');
    }

    /**
     * 시리얼 포트로 데이터 전송
     * @param {string|Uint8Array} data 전송할 데이터
     * @param {boolean} isHex 16진수 문자열 여부
     * @param {boolean} appendCRLF CRLF 추가 여부
     * @returns {Promise<boolean>} 전송 성공 여부
     */
    async sendData(data, isHex = false, appendCRLF = false) {
        if (!this.writer) {
            this._notifyError(new Error('연결되지 않았습니다.'));
            return false;
        }

        try {
            let dataToSend;
            
            if (typeof data === 'string') {
                if (isHex) {
                    // 16진수 문자열을 바이트 배열로 변환
                    const hexString = data.replace(/\s+/g, ''); // 공백 제거
                    const bytes = [];
                    
                    for (let i = 0; i < hexString.length; i += 2) {
                        const byte = parseInt(hexString.substr(i, 2), 16);
                        if (isNaN(byte)) {
                            throw new Error('유효하지 않은 16진수 문자열입니다.');
                        }
                        bytes.push(byte);
                    }
                    
                    dataToSend = new Uint8Array(bytes);
                } else {
                    // 일반 문자열을 UTF-8 인코딩
                    let processedData = data;
                    
                    // CRLF 추가
                    if (appendCRLF) {
                        processedData += '\r\n';
                    }
                    
                    const encoder = new TextEncoder();
                    dataToSend = encoder.encode(processedData);
                }
            } else if (data instanceof Uint8Array) {
                if (appendCRLF) {
                    // CRLF 추가
                    const crlfBuffer = new Uint8Array([0x0D, 0x0A]); // CR, LF
                    const combinedBuffer = new Uint8Array(data.length + 2);
                    combinedBuffer.set(data);
                    combinedBuffer.set(crlfBuffer, data.length);
                    dataToSend = combinedBuffer;
                } else {
                    dataToSend = data;
                }
            } else {
                throw new Error('지원되지 않는 데이터 형식입니다.');
            }
            
            await this.writer.write(dataToSend);
            
            // 전송 데이터 알림
            this._notifyDataReceived(dataToSend, new TextDecoder().decode(dataToSend), 'tx');
            
            return true;
        } catch (error) {
            this._notifyError(error);
            console.error('데이터 전송 오류:', error);
            return false;
        }
    }

    /**
     * 시리얼 포트 연결 해제
     * @returns {Promise<boolean>} 연결 해제 성공 여부
     */
    async disconnect() {
        if (!this.port) {
            return true; // 이미 연결되지 않은 상태
        }

        this.isReading = false;

        try {
            // 읽기 스트림 정리
            if (this.reader) {
                await this.reader.cancel();
                this.reader.releaseLock();
                this.reader = null;
            }

            // 쓰기 스트림 정리
            if (this.writer) {
                await this.writer.close();
                this.writer.releaseLock();
                this.writer = null;
            }

            // 포트 닫기
            await this.port.close();
            this._notifyConnectionChange(false, '연결 해제됨');
            return true;
        } catch (error) {
            this._notifyError(error);
            console.error('연결 해제 오류:', error);
            return false;
        }
    }

    /**
     * 현재 연결 상태 확인
     * @returns {boolean} 연결 상태
     */
    isConnected() {
        return this.port?.readable && this.port?.writable;
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
        this.connectionListeners.forEach(callback => {
            try {
                callback(isConnected, message);
            } catch (error) {
                console.error('연결 상태 리스너 오류:', error);
            }
        });
    }

    /**
     * 데이터 수신/전송 알림
     * @param {Uint8Array} binaryData 바이너리 데이터
     * @param {string} textData 텍스트 데이터
     * @param {string} direction 방향 ('rx' 또는 'tx')
     * @private
     */
    _notifyDataReceived(binaryData, textData, direction) {
        const timestamp = new Date();
        
        this.dataListeners.forEach(callback => {
            try {
                callback({
                    binaryData: new Uint8Array(binaryData),  // 원본 데이터 복사본 전달
                    textData,
                    direction,
                    timestamp
                });
            } catch (error) {
                console.error('데이터 수신 리스너 오류:', error);
            }
        });
    }

    /**
     * 오류 알림
     * @param {Error} error 오류 객체
     * @private
     */
    _notifyError(error) {
        this.errorListeners.forEach(callback => {
            try {
                callback(error);
            } catch (err) {
                console.error('오류 리스너 오류:', err);
            }
        });
    }
}
