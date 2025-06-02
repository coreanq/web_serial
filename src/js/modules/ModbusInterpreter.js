/**
 * ModbusInterpreter.js
 * Modbus 함수 코드 및 데이터를 해석하여 사용자가 이해하기 쉬운 정보를 제공하는 모듈
 */
export class ModbusInterpreter {
    constructor() {
        // 표준 Modbus 함수 코드 정의
        this.functionCodes = {
            0x01: "Read Coils (01h)",
            0x02: "Read Discrete Inputs (02h)",
            0x03: "Read Holding Registers (03h)",
            0x04: "Read Input Registers (04h)",
            0x05: "Write Single Coil (05h)",
            0x06: "Write Single Register (06h)",
            0x0F: "Write Multiple Coils (0Fh)",
            0x10: "Write Multiple Registers (10h)",
            0x08: "Diagnostics (08h)",
            0x07: "Read Exception Status (07h)",
            0x0B: "Get Comm Event Counter (0Bh)",
            0x0C: "Get Comm Event Log (0Ch)",
            0x11: "Report Slave ID (11h)",
            0x14: "Read File Record (14h)",
            0x15: "Write File Record (15h)",
            0x16: "Mask Write Register (16h)",
            0x17: "Read/Write Multiple Registers (17h)",
            0x18: "Read FIFO Queue (18h)",
            0x2B: "Encapsulated Interface Transport (2Bh)"
        };
        
        // 예외 코드 정의
        this.exceptionCodes = {
            0x01: "Illegal Function (01h)",
            0x02: "Illegal Data Address (02h)",
            0x03: "Illegal Data Value (03h)",
            0x04: "Slave Device Failure (04h)",
            0x05: "Acknowledge (05h)",
            0x06: "Slave Device Busy (06h)",
            0x07: "Negative Acknowledge (07h)",
            0x08: "Memory Parity Error (08h)",
            0x0A: "Gateway Path Unavailable (0Ah)",
            0x0B: "Gateway Target Device Failed to Respond (0Bh)"
        };
        
        // 진단 서브 함수 코드 (함수 코드 0x08)
        this.diagnosticSubFunctions = {
            0x0000: "Return Query Data (0000h)",
            0x0001: "Restart Communications Option (0001h)",
            0x0002: "Return Diagnostic Register (0002h)",
            0x0003: "Change ASCII Input Delimiter (0003h)",
            0x0004: "Force Listen Only Mode (0004h)",
            0x000A: "Clear Counters and Diagnostic Register (000Ah)",
            0x000B: "Return Bus Message Count (000Bh)",
            0x000C: "Return Bus Communication Error Count (000Ch)",
            0x000D: "Return Bus Exception Error Count (000Dh)",
            0x000E: "Return Slave Message Count (000Eh)",
            0x000F: "Return Slave No Response Count (000Fh)",
            0x0010: "Return Slave NAK Count (0010h)",
            0x0011: "Return Slave Busy Count (0011h)",
            0x0012: "Return Bus Character Overrun Count (0012h)",
            0x0014: "Clear Overrun Counter and Flag (0014h)"
        };
        this.packetTimeout = 1000; // Default packet timeout in ms
    }
    
    /**
     * Modbus 패킷 타임아웃 설정
     * @param {number} timeout 패킷 타임아웃 (ms)
     */
    setPacketTimeout(timeout) {
        this.packetTimeout = timeout;
        // console.log(`ModbusInterpreter: Packet timeout set to ${timeout}ms`); // 디버깅용
    }

    /**
     * Modbus 패킷 해석
     * @param {Object} parsedPacket Modbus 패킷 객체
     * @returns {Object} 해석된 정보를 포함한 객체
     */
    interpretPacket(parsedPacket) {
        if (!parsedPacket) return null;
        
        const interpretation = {
            summary: '',
            details: {},
            html: ''
        };
        
        try {
            // 예외 응답 처리
            if (parsedPacket.isError) {
                return this._interpretExceptionResponse(parsedPacket, interpretation);
            }
            
            // 함수 코드별 해석
            const functionCode = parsedPacket.functionCode;
            
            switch (functionCode) {
                case 0x01: // Read Coils
                case 0x02: // Read Discrete Inputs
                    return this._interpretReadBits(parsedPacket, interpretation);
                    
                case 0x03: // Read Holding Registers
                case 0x04: // Read Input Registers
                    return this._interpretReadRegisters(parsedPacket, interpretation);
                    
                case 0x05: // Write Single Coil
                    return this._interpretWriteSingleCoil(parsedPacket, interpretation);
                    
                case 0x06: // Write Single Register
                    return this._interpretWriteSingleRegister(parsedPacket, interpretation);
                    
                case 0x0F: // Write Multiple Coils
                    return this._interpretWriteMultipleCoils(parsedPacket, interpretation);
                    
                case 0x10: // Write Multiple Registers
                    return this._interpretWriteMultipleRegisters(parsedPacket, interpretation);
                    
                case 0x08: // Diagnostics
                    return this._interpretDiagnostics(parsedPacket, interpretation);
                    
                default:
                    interpretation.summary = `${this.getFunctionName(functionCode)}`;
                    interpretation.details.message = '이 함수 코드에 대한 자세한 해석이 구현되지 않았습니다.';
                    interpretation.html = `<div class="mb-2">${interpretation.summary}</div>
                                          <div class="text-muted small">${interpretation.details.message}</div>`;
                    return interpretation;
            }
        } catch (error) {
            console.error('패킷 해석 오류:', error);
            interpretation.summary = '패킷 해석 오류';
            interpretation.details.error = error.message;
            interpretation.html = `<div class="text-danger">${interpretation.summary}: ${interpretation.details.error}</div>`;
            return interpretation;
        }
    }
    
    /**
     * 예외 응답 해석
     * @param {Object} parsedPacket Modbus 패킷 객체
     * @param {Object} interpretation 해석 객체
     * @returns {Object} 해석된 정보를 포함한 객체
     * @private
     */
    _interpretExceptionResponse(parsedPacket, interpretation) {
        const originalFunctionCode = parsedPacket.functionCode - 0x80;
        const exceptionCode = parsedPacket.data[0];
        
        interpretation.summary = `예외 응답: ${this.getExceptionName(exceptionCode)}`;
        interpretation.details = {
            originalFunction: this.getFunctionName(originalFunctionCode),
            exceptionCode: exceptionCode,
            exceptionName: this.getExceptionName(exceptionCode)
        };
        
        interpretation.html = `
            <div class="text-danger mb-2"><strong>${interpretation.summary}</strong></div>
            <div class="text-muted small">원본 함수: ${interpretation.details.originalFunction}</div>
            <div class="text-muted small">예외 코드: 0x${exceptionCode.toString(16).padStart(2, '0')} - ${interpretation.details.exceptionName}</div>
        `;
        
        return interpretation;
    }
    
    /**
     * Read Coils/Discrete Inputs 해석 (함수 코드 0x01, 0x02)
     * @param {Object} parsedPacket Modbus 패킷 객체
     * @param {Object} interpretation 해석 객체
     * @returns {Object} 해석된 정보를 포함한 객체
     * @private
     */
    _interpretReadBits(parsedPacket, interpretation) {
        const functionCode = parsedPacket.functionCode;
        const data = parsedPacket.raw;
        const functionName = this.getFunctionName(functionCode);
        
        interpretation.summary = functionName;
        
        // 요청 패킷 해석
        if (data.length === 4) {
            const startAddress = (data[0] << 8) | data[1];
            const quantity = (data[2] << 8) | data[3];
            
            interpretation.details = {
                type: '요청',
                startAddress: startAddress,
                startAddressHex: '0x' + startAddress.toString(16).padStart(4, '0').toUpperCase(),
                quantity: quantity
            };
            
            interpretation.html = `
                <div class="mb-2"><strong>${functionName} (요청)</strong></div>
                <div class="text-muted small">시작 주소: ${startAddress} (${interpretation.details.startAddressHex})</div>
                <div class="text-muted small">수량: ${quantity} 비트</div>
            `;
        }
        // 응답 패킷 해석
        else if (data.length > 0) {
            const byteCount = data[0];
            const values = [];
            
            // 각 바이트의 각 비트를 추출
            for (let i = 1; i <= byteCount && i < data.length; i++) {
                for (let bit = 0; bit < 8; bit++) {
                    values.push((data[i] >> bit) & 1);
                }
            }
            
            interpretation.details = {
                type: '응답',
                byteCount: byteCount,
                values: values
            };
            
            let valuesHtml = '';
            for (let i = 0; i < values.length; i += 8) {
                const group = values.slice(i, i + 8);
                valuesHtml += `<div class="text-monospace small">${i.toString().padStart(3, '0')}-${Math.min(i + 7, values.length - 1).toString().padStart(3, '0')}: ${group.map(v => v ? '1' : '0').join(' ')}</div>`;
            }
            
            interpretation.html = `
                <div class="mb-2"><strong>${functionName} (응답)</strong></div>
                <div class="text-muted small">바이트 수: ${byteCount}</div>
                <div class="text-muted small">비트 수: ${values.length}</div>
                <div class="mt-1">${valuesHtml}</div>
            `;
        }
        
        return interpretation;
    }
    
    /**
     * Read Holding/Input Registers 해석 (함수 코드 0x03, 0x04)
     * @param {Object} parsedPacket Modbus 패킷 객체
     * @param {Object} interpretation 해석 객체
     * @returns {Object} 해석된 정보를 포함한 객체
     * @private
     */
    _interpretReadRegisters(parsedPacket, interpretation) {
        const functionCode = parsedPacket.functionCode;
        const data = parsedPacket.raw;
        const functionName = this.getFunctionName(functionCode);
        
        interpretation.summary = functionName;
        
        // 요청 패킷 해석
        if (data.length === 4) {
            const startAddress = (data[0] << 8) | data[1];
            const quantity = (data[2] << 8) | data[3];
            
            interpretation.details = {
                type: '요청',
                startAddress: startAddress,
                startAddressHex: '0x' + startAddress.toString(16).padStart(4, '0').toUpperCase(),
                quantity: quantity
            };
            
            interpretation.html = `
                <div class="mb-2"><strong>${functionName} (요청)</strong></div>
                <div class="text-muted small">시작 주소: ${startAddress} (${interpretation.details.startAddressHex})</div>
                <div class="text-muted small">수량: ${quantity} 레지스터</div>
            `;
        }
        // 응답 패킷 해석
        else if (data.length > 0) {
            const byteCount = data[0];
            const registers = [];
            
            // 2바이트씩 레지스터 값 추출
            for (let i = 1; i < data.length; i += 2) {
                if (i + 1 < data.length) {
                    const registerValue = (data[i] << 8) | data[i + 1];
                    registers.push(registerValue);
                }
            }
            
            interpretation.details = {
                type: '응답',
                byteCount: byteCount,
                registers: registers
            };
            
            let registersHtml = '';
            for (let i = 0; i < registers.length; i++) {
                const value = registers[i];
                const hexValue = '0x' + value.toString(16).padStart(4, '0').toUpperCase();
                registersHtml += `<div class="text-monospace small">${i.toString().padStart(3, '0')}: ${value} (${hexValue})</div>`;
            }
            
            interpretation.html = `
                <div class="mb-2"><strong>${functionName} (응답)</strong></div>
                <div class="text-muted small">바이트 수: ${byteCount}</div>
                <div class="text-muted small">레지스터 수: ${registers.length}</div>
                <div class="mt-1">${registersHtml}</div>
            `;
        }
        
        return interpretation;
    }
    
    /**
     * Write Single Coil 해석 (함수 코드 0x05)
     * @param {Object} parsedPacket Modbus 패킷 객체
     * @param {Object} interpretation 해석 객체
     * @returns {Object} 해석된 정보를 포함한 객체
     * @private
     */
    _interpretWriteSingleCoil(parsedPacket, interpretation) {
        const data = parsedPacket.raw;
        const functionName = this.getFunctionName(parsedPacket.functionCode);
        
        interpretation.summary = functionName;
        
        if (data.length >= 4) {
            const outputAddress = (data[0] << 8) | data[1];
            const outputValue = (data[2] << 8) | data[3];
            const state = outputValue === 0xFF00 ? 'ON (1)' : 'OFF (0)';
            
            interpretation.details = {
                outputAddress: outputAddress,
                outputAddressHex: '0x' + outputAddress.toString(16).padStart(4, '0').toUpperCase(),
                outputValue: outputValue,
                state: state
            };
            
            interpretation.html = `
                <div class="mb-2"><strong>${functionName}</strong></div>
                <div class="text-muted small">출력 주소: ${outputAddress} (${interpretation.details.outputAddressHex})</div>
                <div class="text-muted small">값: ${state}</div>
            `;
        }
        
        return interpretation;
    }
    
    /**
     * Write Single Register 해석 (함수 코드 0x06)
     * @param {Object} parsedPacket Modbus 패킷 객체
     * @param {Object} interpretation 해석 객체
     * @returns {Object} 해석된 정보를 포함한 객체
     * @private
     */
    _interpretWriteSingleRegister(parsedPacket, interpretation) {
        const data = parsedPacket.raw;
        const functionName = this.getFunctionName(parsedPacket.functionCode);
        
        interpretation.summary = functionName;
        
        if (data.length >= 4) {
            const registerAddress = (data[0] << 8) | data[1];
            const registerValue = (data[2] << 8) | data[3];
            
            interpretation.details = {
                registerAddress: registerAddress,
                registerAddressHex: '0x' + registerAddress.toString(16).padStart(4, '0').toUpperCase(),
                registerValue: registerValue,
                registerValueHex: '0x' + registerValue.toString(16).padStart(4, '0').toUpperCase()
            };
            
            interpretation.html = `
                <div class="mb-2"><strong>${functionName}</strong></div>
                <div class="text-muted small">레지스터 주소: ${registerAddress} (${interpretation.details.registerAddressHex})</div>
                <div class="text-muted small">값: ${registerValue} (${interpretation.details.registerValueHex})</div>
            `;
        }
        
        return interpretation;
    }
    
    /**
     * Write Multiple Coils 해석 (함수 코드 0x0F)
     * @param {Object} parsedPacket Modbus 패킷 객체
     * @param {Object} interpretation 해석 객체
     * @returns {Object} 해석된 정보를 포함한 객체
     * @private
     */
    _interpretWriteMultipleCoils(parsedPacket, interpretation) {
        const data = parsedPacket.raw;
        const functionName = this.getFunctionName(parsedPacket.functionCode);
        
        interpretation.summary = functionName;
        
        // 요청 패킷 해석 (더 긴 데이터)
        if (data.length > 5) {
            const startAddress = (data[0] << 8) | data[1];
            const quantity = (data[2] << 8) | data[3];
            const byteCount = data[4];
            const values = [];
            
            // 각 바이트의 각 비트를 추출
            for (let i = 5; i < data.length; i++) {
                for (let bit = 0; bit < 8; bit++) {
                    if (values.length < quantity) {
                        values.push((data[i] >> bit) & 1);
                    }
                }
            }
            
            interpretation.details = {
                type: '요청',
                startAddress: startAddress,
                startAddressHex: '0x' + startAddress.toString(16).padStart(4, '0').toUpperCase(),
                quantity: quantity,
                byteCount: byteCount,
                values: values
            };
            
            let valuesHtml = '';
            for (let i = 0; i < values.length; i += 8) {
                const group = values.slice(i, i + 8);
                valuesHtml += `<div class="text-monospace small">${i.toString().padStart(3, '0')}-${Math.min(i + 7, values.length - 1).toString().padStart(3, '0')}: ${group.map(v => v ? '1' : '0').join(' ')}</div>`;
            }
            
            interpretation.html = `
                <div class="mb-2"><strong>${functionName} (요청)</strong></div>
                <div class="text-muted small">시작 주소: ${startAddress} (${interpretation.details.startAddressHex})</div>
                <div class="text-muted small">수량: ${quantity} 비트</div>
                <div class="text-muted small">바이트 수: ${byteCount}</div>
                <div class="mt-1">${valuesHtml}</div>
            `;
        }
        // 응답 패킷 해석
        else if (data.length === 4) {
            const startAddress = (data[0] << 8) | data[1];
            const quantity = (data[2] << 8) | data[3];
            
            interpretation.details = {
                type: '응답',
                startAddress: startAddress,
                startAddressHex: '0x' + startAddress.toString(16).padStart(4, '0').toUpperCase(),
                quantity: quantity
            };
            
            interpretation.html = `
                <div class="mb-2"><strong>${functionName} (응답)</strong></div>
                <div class="text-muted small">시작 주소: ${startAddress} (${interpretation.details.startAddressHex})</div>
                <div class="text-muted small">수량: ${quantity} 비트</div>
            `;
        }
        
        return interpretation;
    }
    
    /**
     * Write Multiple Registers 해석 (함수 코드 0x10)
     * @param {Object} parsedPacket Modbus 패킷 객체
     * @param {Object} interpretation 해석 객체
     * @returns {Object} 해석된 정보를 포함한 객체
     * @private
     */
    _interpretWriteMultipleRegisters(parsedPacket, interpretation) {
        const data = parsedPacket.raw;
        const functionName = this.getFunctionName(parsedPacket.functionCode);
        
        interpretation.summary = functionName;
        
        // 요청 패킷 해석 (더 긴 데이터)
        if (data.length > 5) {
            const startAddress = (data[0] << 8) | data[1];
            const quantity = (data[2] << 8) | data[3];
            const byteCount = data[4];
            const registers = [];
            
            // 2바이트씩 레지스터 값 추출
            for (let i = 5; i < data.length; i += 2) {
                if (i + 1 < data.length) {
                    const registerValue = (data[i] << 8) | data[i + 1];
                    registers.push(registerValue);
                }
            }
            
            interpretation.details = {
                type: '요청',
                startAddress: startAddress,
                startAddressHex: '0x' + startAddress.toString(16).padStart(4, '0').toUpperCase(),
                quantity: quantity,
                byteCount: byteCount,
                registers: registers
            };
            
            let registersHtml = '';
            for (let i = 0; i < registers.length; i++) {
                const value = registers[i];
                const hexValue = '0x' + value.toString(16).padStart(4, '0').toUpperCase();
                registersHtml += `<div class="text-monospace small">${i.toString().padStart(3, '0')}: ${value} (${hexValue})</div>`;
            }
            
            interpretation.html = `
                <div class="mb-2"><strong>${functionName} (요청)</strong></div>
                <div class="text-muted small">시작 주소: ${startAddress} (${interpretation.details.startAddressHex})</div>
                <div class="text-muted small">수량: ${quantity} 레지스터</div>
                <div class="text-muted small">바이트 수: ${byteCount}</div>
                <div class="mt-1">${registersHtml}</div>
            `;
        }
        // 응답 패킷 해석
        else if (data.length === 4) {
            const startAddress = (data[0] << 8) | data[1];
            const quantity = (data[2] << 8) | data[3];
            
            interpretation.details = {
                type: '응답',
                startAddress: startAddress,
                startAddressHex: '0x' + startAddress.toString(16).padStart(4, '0').toUpperCase(),
                quantity: quantity
            };
            
            interpretation.html = `
                <div class="mb-2"><strong>${functionName} (응답)</strong></div>
                <div class="text-muted small">시작 주소: ${startAddress} (${interpretation.details.startAddressHex})</div>
                <div class="text-muted small">수량: ${quantity} 레지스터</div>
            `;
        }
        
        return interpretation;
    }
    
    /**
     * Diagnostics 해석 (함수 코드 0x08)
     * @param {Object} parsedPacket Modbus 패킷 객체
     * @param {Object} interpretation 해석 객체
     * @returns {Object} 해석된 정보를 포함한 객체
     * @private
     */
    _interpretDiagnostics(parsedPacket, interpretation) {
        const data = parsedPacket.raw;
        const functionName = this.getFunctionName(parsedPacket.functionCode);
        
        interpretation.summary = functionName;
        
        if (data.length >= 4) {
            const subFunctionCode = (data[0] << 8) | data[1];
            const subFunctionData = (data[2] << 8) | data[3];
            
            interpretation.details = {
                subFunctionCode: subFunctionCode,
                subFunctionCodeHex: '0x' + subFunctionCode.toString(16).padStart(4, '0').toUpperCase(),
                subFunctionName: this.getDiagnosticSubFunctionName(subFunctionCode),
                data: subFunctionData,
                dataHex: '0x' + subFunctionData.toString(16).padStart(4, '0').toUpperCase()
            };
            
            interpretation.html = `
                <div class="mb-2"><strong>${functionName}</strong></div>
                <div class="text-muted small">서브 함수: ${interpretation.details.subFunctionName}</div>
                <div class="text-muted small">데이터: ${subFunctionData} (${interpretation.details.dataHex})</div>
            `;
        }
        
        return interpretation;
    }
    
    /**
     * 함수 코드에 해당하는 이름 반환
     * @param {number} functionCode 함수 코드
     * @returns {string} 함수 이름
     */
    getFunctionName(functionCode) {
        return this.functionCodes[functionCode] || `Unknown Function (${functionCode.toString(16).padStart(2, '0')}h)`;
    }
    
    /**
     * 예외 코드에 해당하는 이름 반환
     * @param {number} exceptionCode 예외 코드
     * @returns {string} 예외 이름
     */
    getExceptionName(exceptionCode) {
        return this.exceptionCodes[exceptionCode] || `Unknown Exception (${exceptionCode.toString(16).padStart(2, '0')}h)`;
    }
    
    /**
     * 진단 서브 함수 코드에 해당하는 이름 반환
     * @param {number} subFunctionCode 서브 함수 코드
     * @returns {string} 서브 함수 이름
     */
    getDiagnosticSubFunctionName(subFunctionCode) {
        return this.diagnosticSubFunctions[subFunctionCode] || `Unknown Sub-function (${subFunctionCode.toString(16).padStart(4, '0')}h)`;
    }
}
