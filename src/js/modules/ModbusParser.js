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
        this.rxPacketTimeoutMs = 10; // 기본 RX 패킷 타임아웃 (ms)
        this.rxLastByteTime = 0;
        this.txPacketTimeoutMs = 10; // 기본 TX 패킷 타임아웃 (ms) - 필요시 setTxPacketTimeout으로 조정
        this.txLastByteTime = 0;
    }
    
    /**
     * RX 패킷 타임아웃 설정
     * @param {number} timeoutMs 타임아웃 (밀리초)
     */
    setRxPacketTimeout(timeoutMs) {
        this.rxPacketTimeoutMs = timeoutMs;
    }

    /**
     * TX 패킷 타임아웃 설정
     * @param {number} timeoutMs 타임아웃 (밀리초)
     */
    setTxPacketTimeout(timeoutMs) {
        this.txPacketTimeoutMs = timeoutMs;
    }
    
    /**
     * 데이터를 버퍼에 추가하고 패킷 파싱 시도
     * @param {Uint8Array} rawData 수신된 데이터
     * @returns {Array} 파싱된 패킷 배열
     */
    parseData(rawData, direction) {
        const now = Date.now();
        let packets = [];

        if (direction === 'tx') {
            this.txLastByteTime = now;
            const txPacketObject = {
                raw: rawData, 
                hex: this.bytesToHexString(rawData),
                direction: 'tx',
                timestamp: now,
                slaveAddress: rawData.length > 0 ? rawData[0] : undefined,
                functionCode: rawData.length > 1 ? rawData[1] : undefined,
                functionName: rawData.length > 1 ? this.getFunctionName(rawData[1]) : "N/A",
                interpretedData: null // TX 데이터는 이 파서에서 해석하지 않음
            };
            return [txPacketObject]; // 배열 형태로 반환하여 RX 경로와 일관성 유지
        }

        // --- RX Data Handling --- 
        if (this.buffer.length > 0 && (now - this.rxLastByteTime) > this.rxPacketTimeoutMs) {
            const oldPackets = this._finalizePacket();
            packets = packets.concat(oldPackets);
            if (this.buffer.length > 0) {
                 this.buffer = new Uint8Array(0);
            }
        }

        const newCombinedBuffer = new Uint8Array(this.buffer.length + rawData.length);
        newCombinedBuffer.set(this.buffer);
        newCombinedBuffer.set(rawData, this.buffer.length);
        this.buffer = newCombinedBuffer;
        this.rxLastByteTime = now;

        const newPackets = this.extractPackets();
        packets = packets.concat(newPackets);
        
        return packets;
    }
    
    /**
     * 현재 버퍼에서 패킷 추출 시도
     * @returns {Array} 파싱된 패킷 배열
     * @private
     */
    _finalizePacket() {
        if (this.buffer.length < 4) {
            return [];
        }
        
        return this.extractPackets();
    }
    
    /**
     * 버퍼에서 완전한 Modbus-RTU 패킷 추출
     * @returns {Array} 파싱된 패킷 배열
     */
    extractPackets() { 
        const packets = [];
        
        while (this.buffer.length >= 4) {
            let packetLength = this.estimatePacketLength(this.buffer);
            
            if (packetLength === -1 || packetLength > this.buffer.length) {
                break;
            }
            
            const packetData = this.buffer.slice(0, packetLength);
            
            const isValidCRC = this.validateCRC(packetData);
            const parsedPacket = this.parsePacket(packetData, isValidCRC, 'rx'); 
            if (parsedPacket) {
                packets.push(parsedPacket);
                
                console.log('Modbus 패킷 감지:', parsedPacket);
            }
            
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
        
        if (functionCode >= 0x80) {
            return 5; 
        }
        
        switch (functionCode) {
            case 0x01: 
            case 0x02: 
                if (data.length < 3) return -1;
                return 5 + data[2]; 
                
            case 0x03: 
            case 0x04: 
                if (data.length < 3) return -1;
                return 5 + data[2]; 
                
            case 0x05: 
            case 0x06: 
                return 8; 
                
            case 0x0F: 
            case 0x10: 
                if (data.length < 8) return -1;
                return 9 + data[6]; 
                
            case 0x08: 
                return 8; 
                
            default:
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
     * @param {string} direction 데이터 방향 ('rx' 또는 'tx')
     * @returns {Object} 파싱된 패킷 정보
     */
    parsePacket(data, isValidCRC, direction = 'rx') {
        if (direction === 'rx' && data.length < 4) return null;
        if (data.length === 0) return null; 

        const slaveAddress = data[0];
        const functionCode = data.length > 1 ? data[1] : undefined; 
        
        const payload = (direction === 'rx' && data.length >= 4) ? data.slice(2, data.length - 2) :
                        (direction === 'tx' && data.length >= 2) ? data.slice(2) : new Uint8Array(0);
        
        let crcReceivedHex = "N/A";
        let crcCalculatedHex = "N/A";
        let actualIsValidCRC = direction === 'tx'; 

        if (direction === 'rx') {
            if (data.length >= 2) { 
                const crcReceived = (data[data.length - 2] << 8) | data[data.length - 1];
                crcReceivedHex = this.toHexString(crcReceived, 4);
                const crcCalculated = this.calculateCRC16(data.slice(0, data.length - 2));
                crcCalculatedHex = this.toHexString(crcCalculated, 4);
            }
            actualIsValidCRC = isValidCRC; 
        }

        const packet = {
            raw: data,
            hex: this.bytesToHexString(data),
            slaveAddress,
            functionCode,
            functionName: functionCode !== undefined ? this.getFunctionName(functionCode) : "N/A",
            payload, 
            crcReceived: crcReceivedHex,
            crcCalculated: crcCalculatedHex,
            isValidCRC: actualIsValidCRC,
            direction,
            timestamp: Date.now(),
            interpreted: null,
            isError: direction === 'rx' && functionCode !== undefined && functionCode >= 0x80
        };

        if (direction === 'rx') {
            if (packet.isError) {
                if (payload.length > 0) { 
                    const errorCode = payload[0];
                    packet.errorCode = errorCode;
                    packet.errorMessage = this.errorCodes[errorCode] || "Unknown Error";
                }
            } else if (packet.isValidCRC) {
                this._interpretFunctionData(packet); 
            }
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
        const data = packet.payload;
        
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
                    
                    packet.interpretedData = {
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
                    
                    packet.interpretedData = {
                        byteCount,
                        registers
                    };
                }
                break;
                
            case 0x05: // Write Single Coil
                if (data.length >= 4) {
                    const address = (data[0] << 8) | data[1];
                    const value = (data[2] === 0xFF && data[3] === 0x00) ? 1 : 0;
                    
                    packet.interpretedData = {
                        address,
                        value
                    };
                }
                break;
                
            case 0x06: // Write Single Register
                if (data.length >= 4) {
                    const address = (data[0] << 8) | data[1];
                    const value = (data[2] << 8) | data[3];
                    
                    packet.interpretedData = {
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
                    
                    packet.interpretedData = {
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
