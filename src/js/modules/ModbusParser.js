/**
 * ModbusParser.js
 * Modbus-RTU 프로토콜 패킷을 파싱하는 모듈
 */
export class ModbusParser {
    constructor() {
        // Modbus 함수 코드 정의
        this.functionCodes = {
            1: "Read Coils (01h)",
            2: "Read Discrete Inputs (02h)",
            3: "Read Holding Registers (03h)",
            4: "Read Input Registers (04h)",
            5: "Write Single Coil (05h)",
            6: "Write Single Register (06h)",
            15: "Write Multiple Coils (0Fh)",
            16: "Write Multiple Registers (10h)",
            8: "Diagnostics (08h)",
            // 추가 함수 코드는 필요에 따라 확장
        };
        
        // 오류 코드 정의
        this.errorCodes = {
            0x01: "Illegal Function",
            0x02: "Illegal Data Address",
            0x03: "Illegal Data Value",
            0x04: "Slave Device Failure",
            0x05: "Acknowledge",
            0x06: "Slave Device Busy",
            0x07: "Negative Acknowledge",
            0x08: "Memory Parity Error",
            0x0A: "Gateway Path Unavailable",
            0x0B: "Gateway Target Device Failed to Respond"
        };
        
        // 버퍼 및 상태 변수
        this.buffer = new Uint8Array(0);
        this.packetTimeoutMs = 100; // 기본 패킷 타임아웃 (ms)
        this.lastByteTime = 0;
    }
    
    /**
     * 패킷 타임아웃 설정
     * @param {number} timeoutMs 타임아웃 (밀리초)
     */
    setPacketTimeout(timeoutMs) {
        this.packetTimeoutMs = timeoutMs;
    }
    
    /**
     * 데이터를 버퍼에 추가하고 패킷 파싱 시도
     * @param {Uint8Array} data 수신된 데이터
     * @returns {Array} 파싱된 패킷 배열
     */
    parseData(data) {
        const now = Date.now();
        
        // 타임아웃 체크: 마지막 바이트 수신 후 타임아웃 시간이 지났으면 패킷 완성
        if (this.buffer.length > 0 && (now - this.lastByteTime) > this.packetTimeoutMs) {
            // 현재 버퍼에서 패킷 추출 시도
            const packets = this._finalizePacket();
            
            // 새 데이터를 버퍼에 설정
            this.buffer = new Uint8Array(data);
            this.lastByteTime = now;
            
            return packets;
        }
        
        // 새 데이터를 버퍼에 추가
        const newBuffer = new Uint8Array(this.buffer.length + data.length);
        newBuffer.set(this.buffer);
        newBuffer.set(data, this.buffer.length);
        this.buffer = newBuffer;
        
        this.lastByteTime = now;
        
        // 패킷 추출 시도
        return this.extractPackets();
    }
    
    /**
     * 현재 버퍼에서 패킷 추출 시도
     * @returns {Array} 파싱된 패킷 배열
     * @private
     */
    _finalizePacket() {
        if (this.buffer.length < 4) {
            // Modbus-RTU 패킷의 최소 길이가 아님 (슬레이브 주소 + 함수 코드 + CRC 2바이트)
            return [];
        }
        
        // 패킷 추출 시도
        return this.extractPackets();
    }
    
    /**
     * 버퍼에서 완전한 Modbus-RTU 패킷 추출
     * @returns {Array} 파싱된 패킷 배열
     */
    extractPackets() {
        const packets = [];
        
        // 최소 패킷 길이 (슬레이브 주소 + 함수 코드 + CRC) = 4바이트
        while (this.buffer.length >= 4) {
            // 패킷 길이 추정
            let packetLength = this.estimatePacketLength(this.buffer);
            
            // 패킷 길이를 결정할 수 없거나 버퍼에 완전한 패킷이 없는 경우
            if (packetLength === -1 || packetLength > this.buffer.length) {
                break;
            }
            
            // 패킷 추출
            const packetData = this.buffer.slice(0, packetLength);
            
            // CRC 검증
            const isValidCRC = this.validateCRC(packetData);
            
            // 패킷 파싱
            const packet = this.parsePacket(packetData, isValidCRC);
            if (packet) {
                packets.push(packet);
                
                // 디버깅용 로그
                console.log('Modbus 패킷 감지:', packet);
            }
            
            // 처리된 패킷을 버퍼에서 제거
            this.buffer = this.buffer.slice(packetLength);
        }
        
        return packets;
    }
    
    /**
     * Modbus-RTU 패킷 길이 추정
     * @param {Uint8Array} data 데이터 버퍼
     * @returns {number} 추정된 패킷 길이 또는 -1 (결정할 수 없는 경우)
     */
    estimatePacketLength(data) {
        if (data.length < 2) return -1;
        
        const functionCode = data[1];
        
        // 오류 응답 (0x80 이상의 함수 코드)
        if (functionCode >= 0x80) {
            return 5; // 슬레이브 주소(1) + 함수 코드(1) + 오류 코드(1) + CRC(2)
        }
        
        // 함수 코드별 패킷 길이 추정
        switch (functionCode) {
            case 0x01: // Read Coils
            case 0x02: // Read Discrete Inputs
                if (data.length < 3) return -1;
                return 5 + data[2]; // 슬레이브 주소(1) + 함수 코드(1) + 바이트 수(1) + 데이터(n) + CRC(2)
                
            case 0x03: // Read Holding Registers
            case 0x04: // Read Input Registers
                if (data.length < 3) return -1;
                return 5 + data[2]; // 슬레이브 주소(1) + 함수 코드(1) + 바이트 수(1) + 데이터(n) + CRC(2)
                
            case 0x05: // Write Single Coil
            case 0x06: // Write Single Register
                return 8; // 슬레이브 주소(1) + 함수 코드(1) + 주소(2) + 값(2) + CRC(2)
                
            case 0x0F: // Write Multiple Coils
            case 0x10: // Write Multiple Registers
                if (data.length < 8) return -1;
                return 9 + data[6]; // 슬레이브 주소(1) + 함수 코드(1) + 시작 주소(2) + 수량(2) + 바이트 수(1) + 데이터(n) + CRC(2)
                
            case 0x08: // Diagnostics
                return 8; // 슬레이브 주소(1) + 함수 코드(1) + 서브함수(2) + 데이터(2) + CRC(2)
                
            default:
                // 알 수 없는 함수 코드는 최소 길이로 가정
                return 8;
        }
    }
    
    /**
     * CRC-16 검증
     * @param {Uint8Array} data 검증할 데이터
     * @returns {boolean} CRC 유효 여부
     */
    validateCRC(data) {
        if (data.length < 3) return false;
        
        const calculatedCRC = this.calculateCRC16(data.slice(0, data.length - 2));
        const receivedCRC = (data[data.length - 1] << 8) | data[data.length - 2];
        
        const isValid = calculatedCRC === receivedCRC;
        
        // 디버깅용 로그
        if (!isValid) {
            console.log(`CRC 오류: 계산값=${calculatedCRC.toString(16)}, 수신값=${receivedCRC.toString(16)}`);
        }
        
        return isValid;
    }
    
    /**
     * Modbus CRC-16 계산
     * @param {Uint8Array} data CRC를 계산할 데이터
     * @returns {number} 계산된 CRC-16 값
     */
    calculateCRC16(data) {
        let crc = 0xFFFF;
        
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
            
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x0001) !== 0) {
                    crc >>= 1;
                    crc ^= 0xA001;
                } else {
                    crc >>= 1;
                }
            }
        }
        
        return crc;
    }
    
    /**
     * Modbus-RTU 패킷 파싱
     * @param {Uint8Array} data 패킷 데이터
     * @param {boolean} isValidCRC CRC 유효 여부
     * @returns {Object} 파싱된 패킷 정보
     */
    parsePacket(data, isValidCRC) {
        if (data.length < 4) return null;
        
        const slaveAddress = data[0];
        const functionCode = data[1];
        const timestamp = new Date().toLocaleTimeString();
        
        // 패킷 기본 정보
        const packet = {
            timestamp,
            slaveAddress,
            functionCode,
            functionName: this.getFunctionName(functionCode),
            data: Array.from(data.slice(2, data.length - 2)),
            crc: {
                value: (data[data.length - 1] << 8) | data[data.length - 2],
                isValid: isValidCRC
            },
            rawData: Array.from(data),
            isError: functionCode >= 0x80
        };
        
        // 오류 응답 처리
        if (packet.isError) {
            const errorCode = data[2];
            packet.errorCode = errorCode;
            packet.errorMessage = this.errorCodes[errorCode] || "Unknown Error";
        } else {
            // 함수 코드별 데이터 해석
            this._interpretFunctionData(packet);
        }
        
        return packet;
    }
    
    /**
     * 함수 코드별 데이터 해석
     * @param {Object} packet 패킷 객체
     * @private
     */
    _interpretFunctionData(packet) {
        const functionCode = packet.functionCode;
        const data = packet.data;
        
        // 해석된 데이터를 저장할 객체
        packet.interpreted = {};
        
        switch (functionCode) {
            case 0x01: // Read Coils
            case 0x02: // Read Discrete Inputs
                if (data.length > 0) {
                    const byteCount = data[0];
                    const values = [];
                    
                    // 각 바이트의 각 비트를 추출
                    for (let i = 1; i <= byteCount; i++) {
                        if (i < data.length) {
                            for (let bit = 0; bit < 8; bit++) {
                                values.push((data[i] >> bit) & 1);
                            }
                        }
                    }
                    
                    packet.interpreted = {
                        byteCount,
                        values
                    };
                }
                break;
                
            case 0x03: // Read Holding Registers
            case 0x04: // Read Input Registers
                if (data.length > 0) {
                    const byteCount = data[0];
                    const registers = [];
                    
                    // 2바이트씩 레지스터 값 추출
                    for (let i = 1; i < data.length; i += 2) {
                        if (i + 1 < data.length) {
                            const registerValue = (data[i] << 8) | data[i + 1];
                            registers.push(registerValue);
                        }
                    }
                    
                    packet.interpreted = {
                        byteCount,
                        registers
                    };
                }
                break;
                
            case 0x05: // Write Single Coil
                if (data.length >= 4) {
                    const address = (data[0] << 8) | data[1];
                    const value = (data[2] === 0xFF && data[3] === 0x00) ? 1 : 0;
                    
                    packet.interpreted = {
                        address,
                        value
                    };
                }
                break;
                
            case 0x06: // Write Single Register
                if (data.length >= 4) {
                    const address = (data[0] << 8) | data[1];
                    const value = (data[2] << 8) | data[3];
                    
                    packet.interpreted = {
                        address,
                        value
                    };
                }
                break;
                
            case 0x0F: // Write Multiple Coils
            case 0x10: // Write Multiple Registers
                if (data.length >= 4) {
                    const address = (data[0] << 8) | data[1];
                    const quantity = (data[2] << 8) | data[3];
                    
                    packet.interpreted = {
                        address,
                        quantity
                    };
                }
                break;
        }
    }
    
    /**
     * 함수 코드에 해당하는 이름 반환
     * @param {number} functionCode 함수 코드
     * @returns {string} 함수 이름
     */
    getFunctionName(functionCode) {
        // 오류 응답인 경우
        if (functionCode >= 0x80) {
            const originalCode = functionCode - 0x80;
            return `Error: ${this.functionCodes[originalCode] || `Unknown Function (${originalCode.toString(16)}h)`}`;
        }
        
        return this.functionCodes[functionCode] || `Unknown Function (${functionCode.toString(16)}h)`;
    }
    
    /**
     * 16진수 문자열로 변환
     * @param {number} value 변환할 값
     * @param {number} padLength 패딩 길이
     * @returns {string} 16진수 문자열
     */
    toHexString(value, padLength = 2) {
        return value.toString(16).toUpperCase().padStart(padLength, '0');
    }
    
    /**
     * 바이트 배열을 16진수 문자열로 변환
     * @param {Array|Uint8Array} bytes 바이트 배열
     * @returns {string} 16진수 문자열
     */
    bytesToHexString(bytes) {
        return Array.from(bytes)
            .map(byte => this.toHexString(byte))
            .join(' ');
    }
}
