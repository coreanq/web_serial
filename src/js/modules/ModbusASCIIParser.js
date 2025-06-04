/**
 * ModbusASCIIParser.js
 * Modbus-ASCII 프로토콜 패킷을 파싱하는 모듈
 */
export class ModbusASCIIParser {
    constructor(packetTimeoutMs = 1000) {
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
        this.buffer = '';
        this.packetTimeoutMs = packetTimeoutMs;
        this.lastByteTime = 0;
    }
    
    /**
     * 데이터를 버퍼에 추가하고 패킷 파싱 시도
     * @param {string} asciiData 수신된 ASCII 데이터
     * @param {string} direction 데이터 방향 ('rx' 또는 'tx')
     * @returns {Array} 파싱된 패킷 배열
     */
    parseData(asciiData, direction) {
        const now = Date.now();
        let packets = [];

        if (direction === 'tx') {
            const txPacketObject = {
                raw: asciiData,
                direction: 'tx',
                timestamp: now,
                // TX 데이터는 바로 파싱하지 않고 원시 데이터만 저장
            };
            
            // TX 데이터가 유효한 Modbus ASCII 형식인 경우 파싱 시도
            if (asciiData.startsWith(':')) {
                const parsedFrame = this.parseFrame(asciiData);
                if (parsedFrame) {
                    txPacketObject.slaveAddress = parsedFrame.address;
                    txPacketObject.functionCode = parsedFrame.functionCode;
                    txPacketObject.functionName = this.getFunctionName(parsedFrame.functionCode);
                    txPacketObject.data = parsedFrame.data;
                    txPacketObject.lrc = parsedFrame.lrc;
                    txPacketObject.isValid = parsedFrame.isValid;
                }
            }
            
            return [txPacketObject];
        }

        // --- RX Data Handling ---
        // 타임아웃 체크: 마지막 바이트 수신 후 일정 시간이 지나면 버퍼 처리
        if (this.buffer.length > 0 && (now - this.lastByteTime) > this.packetTimeoutMs) {
            const oldPackets = this._finalizePacket();
            packets = packets.concat(oldPackets);
            this.buffer = '';
        }

        // 새 데이터를 버퍼에 추가
        this.buffer += asciiData;
        this.lastByteTime = now;

        // 완전한 패킷 추출 시도
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
        if (this.buffer.length < 3) { // 최소 ':' + 1자 + CRLF
            return [];
        }
        
        return this.extractPackets();
    }
    
    /**
     * 버퍼에서 완전한 Modbus-ASCII 패킷 추출
     * @returns {Array} 파싱된 패킷 배열
     */
    extractPackets() {
        const packets = [];
        
        // Modbus ASCII 패킷은 ':'로 시작하고 CR+LF로 끝남
        while (this.buffer.length > 0) {
            // 시작 문자 찾기
            const startIndex = this.buffer.indexOf(':');
            if (startIndex === -1) {
                // 시작 문자가 없으면 버퍼 비우기
                this.buffer = '';
                break;
            } else if (startIndex > 0) {
                // 시작 문자 이전의 데이터는 제거
                this.buffer = this.buffer.substring(startIndex);
            }
            
            // 종료 문자 찾기
            const endIndex = this.buffer.indexOf('\r\n');
            if (endIndex === -1) {
                // 종료 문자가 없으면 더 많은 데이터를 기다림
                break;
            }
            
            // 완전한 패킷 추출
            const packetString = this.buffer.substring(0, endIndex + 2); // ':' ~ CR+LF 포함
            this.buffer = this.buffer.substring(endIndex + 2);
            
            // 패킷 파싱
            const parsedFrame = this.parseFrame(packetString);
            if (parsedFrame) {
                const packet = {
                    raw: packetString,
                    slaveAddress: parsedFrame.address,
                    functionCode: parsedFrame.functionCode,
                    functionName: this.getFunctionName(parsedFrame.functionCode),
                    data: parsedFrame.data,
                    lrc: parsedFrame.lrc,
                    isValid: parsedFrame.isValid,
                    direction: 'rx',
                    timestamp: Date.now(),
                    isError: parsedFrame.functionCode >= 0x80
                };
                
                if (packet.isError) {
                    if (parsedFrame.data.length > 0) {
                        const errorCode = parsedFrame.data[0];
                        packet.errorCode = errorCode;
                        packet.errorMessage = this.errorCodes[errorCode] || "Unknown Error";
                    }
                } else if (packet.isValid) {
                    packet.interpretedData = this._interpretFunctionData(packet);
                }
                
                packets.push(packet);
                console.log('Modbus ASCII 패킷 감지:', packet);
            }
        }
        
        return packets;
    }
    
    /**
     * Modbus ASCII 프레임 파싱
     * @param {string} asciiString ASCII 문자열
     * @returns {Object|null} 파싱된 프레임 또는 null
     */
    parseFrame(asciiString) {
        // 유효한 시작 및 종료 문자 확인
        if (!asciiString.startsWith(':') || !asciiString.endsWith('\r\n')) {
            return null;
        }
        
        // 시작 및 종료 문자 제거
        const content = asciiString.slice(1, -2);
        
        // ASCII 16진수를 바이너리로 변환
        const buffer = this.hexStringToBuffer(content);
        
        // 최소 내용은 3바이트 (주소, 함수 코드, LRC)
        if (buffer.length < 3) {
            return null;
        }
        
        const address = buffer[0];
        const functionCode = buffer[1];
        const data = buffer.slice(2, buffer.length - 1);
        const receivedLRC = buffer[buffer.length - 1];
        const calculatedLRC = this.calculateLRC(buffer.slice(0, buffer.length - 1));
        
        const isValid = receivedLRC === calculatedLRC;
        
        if (!isValid) {
            console.log(`LRC 오류: 계산값=${calculatedLRC.toString(16)}, 수신값=${receivedLRC.toString(16)}`);
        }
        
        return {
            address,
            functionCode,
            data,
            lrc: receivedLRC,
            isValid
        };
    }
    
    /**
     * ASCII 16진수 문자열을 바이너리 버퍼로 변환
     * @param {string} hexString 16진수 문자열
     * @returns {Uint8Array} 바이너리 버퍼
     */
    hexStringToBuffer(hexString) {
        // 공백 제거 및 대문자로 변환
        const cleanHex = hexString.replace(/\s/g, '').toUpperCase();
        
        // 문자열 길이가 짝수인지 확인
        if (cleanHex.length % 2 !== 0) {
            console.error('16진수 문자열 길이가 짝수가 아닙니다:', hexString);
            return new Uint8Array(0);
        }
        
        // 문자열이 유효한 16진수인지 확인
        if (!/^[0-9A-F]*$/.test(cleanHex)) {
            console.error('유효하지 않은 16진수 문자열:', hexString);
            return new Uint8Array(0);
        }
        
        const buffer = new Uint8Array(cleanHex.length / 2);
        
        for (let i = 0; i < cleanHex.length; i += 2) {
            const byteValue = parseInt(cleanHex.substr(i, 2), 16);
            buffer[i / 2] = byteValue;
        }
        
        return buffer;
    }
    
    /**
     * 버퍼를 ASCII 16진수 문자열로 변환
     * @param {Uint8Array} buffer 바이너리 버퍼
     * @returns {string} 16진수 문자열
     */
    bufferToHexString(buffer) {
        return Array.from(buffer)
            .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
            .join('');
    }
    
    /**
     * Modbus LRC 계산
     * @param {Uint8Array} buffer LRC를 계산할 데이터
     * @returns {number} 계산된 LRC 값
     */
    calculateLRC(buffer) {
        let lrc = 0;
        
        // 모든 바이트 값을 더함
        for (let i = 0; i < buffer.length; i++) {
            lrc += buffer[i];
        }
        
        // 2의 보수 취함 (256에서 하위 8비트를 뺌)
        lrc = (256 - (lrc & 0xFF)) & 0xFF;
        
        return lrc;
    }
    
    /**
     * 함수 코드별 데이터 해석
     * @param {Object} packet 패킷 객체
     * @returns {Object|null} 해석된 데이터 객체
     * @private
     */
    _interpretFunctionData(packet) {
        const functionCode = packet.functionCode;
        const data = packet.data;
        
        if (!data || data.length === 0) {
            return null;
        }
        
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
                    
                    return {
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
                    
                    return {
                        byteCount,
                        registers
                    };
                }
                break;
                
            case 0x05: // Write Single Coil
                if (data.length >= 4) {
                    const address = (data[0] << 8) | data[1];
                    const value = (data[2] === 0xFF && data[3] === 0x00) ? 1 : 0;
                    
                    return {
                        address,
                        value
                    };
                }
                break;
                
            case 0x06: // Write Single Register
                if (data.length >= 4) {
                    const address = (data[0] << 8) | data[1];
                    const value = (data[2] << 8) | data[3];
                    
                    return {
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
                    
                    return {
                        address,
                        quantity
                    };
                }
                break;
        }
        
        return null;
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
}
