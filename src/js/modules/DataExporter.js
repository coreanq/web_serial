/**
 * DataExporter.js
 * 데이터 내보내기 기능을 제공하는 모듈
 */
export class DataExporter {
    constructor() {
        // 내보내기 형식 정의
        this.exportFormats = {
            csv: { mimeType: 'text/csv;charset=utf-8;', extension: '.csv' },
            json: { mimeType: 'application/json;charset=utf-8;', extension: '.json' },
            txt: { mimeType: 'text/plain;charset=utf-8;', extension: '.txt' }
        };
    }
    
    /**
     * CSV 형식으로 데이터 내보내기
     * @param {Array} data 내보낼 데이터 배열
     * @param {string} filename 파일명
     */
    exportToCSV(data, filename) {
        if (!data || !data.length) {
            console.error('내보낼 데이터가 없습니다.');
            return;
        }
        
        // CSV 헤더 생성 (객체의 키를 기반으로)
        const headers = Object.keys(data[0]);
        let csvContent = '\uFEFF'; // BOM for UTF-8
        
        // 헤더 추가
        csvContent += headers.join(',') + '\n';
        
        // 데이터 행 추가
        data.forEach(item => {
            const row = headers.map(header => {
                let cellValue = item[header];
                
                // 값이 객체나 배열인 경우 JSON 문자열로 변환
                if (cellValue !== null && typeof cellValue === 'object') {
                    cellValue = JSON.stringify(cellValue);
                }
                
                // 문자열인 경우 따옴표 처리 및 이스케이프
                if (typeof cellValue === 'string') {
                    // 쉼표가 포함된 경우 따옴표로 감싸고 따옴표를 이스케이프
                    if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')) {
                        cellValue = '"' + cellValue.replace(/"/g, '""') + '"';
                    }
                }
                
                return cellValue === undefined ? '' : cellValue;
            }).join(',');
            
            csvContent += row + '\n';
        });
        
        // 다운로드 링크 생성
        this._downloadFile(csvContent, filename || 'export.csv', 'text/csv;charset=utf-8;');
    }
    
    /**
     * JSON 형식으로 데이터 내보내기
     * @param {Object} data 내보낼 데이터 객체
     * @param {string} filename 파일명
     */
    exportToJSON(data, filename) {
        if (!data) {
            console.error('내보낼 데이터가 없습니다.');
            return;
        }
        
        // Uint8Array를 일반 배열로 변환하여 JSON 직렬화 가능하게 처리
        const processedData = this._processDataForJSON(data);
        
        // JSON 문자열로 변환
        const jsonContent = JSON.stringify(processedData, null, 2);
        
        // 다운로드 링크 생성
        this._downloadFile(jsonContent, filename || 'export.json', 'application/json;charset=utf-8;');
    }
    
    /**
     * 패킷 데이터를 CSV 형식으로 내보내기
     * @param {Array} packets 패킷 데이터 배열
     * @param {string} filename 파일명
     */
    exportPacketsToCSV(packets, filename) {
        if (!packets || !packets.length) {
            console.error('내보낼 패킷이 없습니다.');
            return;
        }
        
        // 패킷 데이터를 CSV용 형식으로 변환
        const csvData = packets.map(packet => {
            const { timestamp, direction, packet: rawData, interpretation } = packet;
            
            // 슬레이브 주소와 함수 코드 추출
            const slaveAddress = rawData.length > 0 ? rawData[0] : '';
            const functionCode = rawData.length > 1 ? rawData[1] : '';
            
            // 데이터 바이트 표시
            const dataBytes = rawData.length > 2 ? rawData.slice(2, -2) : [];
            const dataHex = Array.from(dataBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
            
            // CRC 값 추출
            const crcBytes = rawData.length >= 2 ? rawData.slice(-2) : [];
            const crcHex = crcBytes.length === 2 ? 
                ((crcBytes[0] << 8) | crcBytes[1]).toString(16).padStart(4, '0') : '';
            
            return {
                timestamp: timestamp.toISOString(),
                direction: direction,
                slaveAddress: slaveAddress,
                functionCode: functionCode,
                functionHex: functionCode ? '0x' + functionCode.toString(16).padStart(2, '0') : '',
                data: dataHex,
                crc: crcHex,
                interpretation: interpretation
            };
        });
        
        // CSV로 내보내기
        this.exportToCSV(csvData, filename || `modbus_packets_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`);
    }
    
    /**
     * 패킷 데이터를 JSON 형식으로 내보내기
     * @param {Array} packets 패킷 데이터 배열
     * @param {string} filename 파일명
     */
    exportPacketsToJSON(packets, filename) {
        if (!packets || !packets.length) {
            console.error('내보낼 패킷이 없습니다.');
            return;
        }
        
        // 패킷 데이터를 JSON용 형식으로 변환
        const jsonData = {
            exportTime: new Date().toISOString(),
            totalPackets: packets.length,
            packets: packets.map(packet => {
                const { timestamp, direction, packet: rawData, interpretation } = packet;
                
                return {
                    timestamp: timestamp.toISOString(),
                    direction: direction,
                    rawData: Array.from(rawData),
                    interpretation: interpretation
                };
            })
        };
        
        // 통계 정보 추가
        jsonData.statistics = this.calculateStatistics(packets);
        
        // JSON으로 내보내기
        this.exportToJSON(jsonData, filename || `modbus_packets_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.json`);
    }
    
    /**
     * 패킷 통계 계산
     * @param {Array} packets 패킷 데이터 배열
     * @returns {Object} 통계 정보
     */
    calculateStatistics(packets) {
        const totalPackets = packets.length;
        const txPackets = packets.filter(p => p.direction === 'TX').length;
        const rxPackets = packets.filter(p => p.direction === 'RX').length;
        
        // 패킷 크기 통계
        const packetSizes = packets.map(p => p.packet.length);
        const avgPacketSize = packetSizes.reduce((sum, size) => sum + size, 0) / totalPackets;
        
        // 패킷 응답 시간 계산 (TX 패킷 이후 RX 패킷 사이의 시간 차이)
        const responseTimes = [];
        for (let i = 0; i < packets.length - 1; i++) {
            if (packets[i].direction === 'TX' && packets[i+1].direction === 'RX') {
                const responseTime = packets[i+1].timestamp.getTime() - packets[i].timestamp.getTime();
                responseTimes.push(responseTime);
            }
        }
        
        const avgResponseTime = responseTimes.length > 0 ? 
            responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
        
        // 함수 코드 분포
        const functionCodes = {};
        packets.forEach(packet => {
            if (packet.packet.length > 1) {
                const functionCode = packet.packet[1];
                functionCodes[functionCode] = (functionCodes[functionCode] || 0) + 1;
            }
        });
        
        return {
            totalPackets,
            txPackets,
            rxPackets,
            avgPacketSize: avgPacketSize.toFixed(2),
            minPacketSize: Math.min(...packetSizes),
            maxPacketSize: Math.max(...packetSizes),
            avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
            minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes).toFixed(2) + 'ms' : 'N/A',
            maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes).toFixed(2) + 'ms' : 'N/A',
            functionCodeDistribution: functionCodes
        };
    }
    
    /**
     * 데이터를 JSON용으로 처리 (바이너리 데이터 변환 등)
     * @param {Object|Array} data 처리할 데이터
     * @returns {Object|Array} 처리된 데이터
     * @private
     */
    _processDataForJSON(data) {
        if (data === null || data === undefined) {
            return data;
        }
        
        // 배열인 경우
        if (Array.isArray(data)) {
            return data.map(item => this._processDataForJSON(item));
        }
        
        // Uint8Array인 경우
        if (data instanceof Uint8Array) {
            return Array.from(data);
        }
        
        // 객체인 경우
        if (typeof data === 'object' && data !== null) {
            const result = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    result[key] = this._processDataForJSON(data[key]);
                }
            }
            return result;
        }
        
        // 기본 형식은 그대로 반환
        return data;
    }
    
    /**
     * 파일 다운로드 처리
     * @param {string} content 파일 내용
     * @param {string} filename 파일명
     * @param {string} mimeType MIME 타입
     * @private
     */
    _downloadFile(content, filename, mimeType) {
        // Blob 생성
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // 다운로드 링크 생성
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.display = 'none';
        
        // 링크 클릭 시뮬레이션
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // URL 리소스 해제
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    /**
     * 데이터를 클립보드에 복사
     * @param {string} content 복사할 내용
     * @returns {Promise<boolean>} 복사 성공 여부
     */
    async copyToClipboard(content) {
        try {
            await navigator.clipboard.writeText(content);
            return true;
        } catch (error) {
            console.error('클립보드 복사 오류:', error);
            return false;
        }
    }
    
    /**
     * 로그 데이터를 텍스트 형식으로 변환
     * @param {Array} logs 로그 항목 배열
     * @returns {string} 텍스트 문자열
     */
    toText(logs) {
        if (!logs || logs.length === 0) {
            return 'No data';
        }
        
        const textLines = logs.map(log => {
            const direction = log.direction === 'TX' ? '[송신]' : '[수신]';
            const timestamp = log.timestamp ? new Date(log.timestamp).toISOString() : '';
            const slaveAddress = log.slaveAddress !== undefined ? `슬레이브: ${log.slaveAddress}` : '';
            const functionCode = log.functionCode !== undefined ? `함수코드: 0x${log.functionCode.toString(16).padStart(2, '0')}` : '';
            const interpretation = log.interpretation ? `해석: ${log.interpretation}` : '';
            
            return `${timestamp} ${direction} ${slaveAddress} ${functionCode} ${interpretation}`.trim();
        });
        
        return textLines.join('\n');
    }
    
    /**
     * 로그 데이터를 CSV 형식으로 변환
     * @param {Array} logs 로그 항목 배열
     * @returns {string} CSV 문자열
     */
    toCSV(logs) {
        if (!logs || logs.length === 0) {
            return '';
        }
        
        // 헤더 정의
        const headers = ['timestamp', 'direction', 'slaveAddress', 'functionCode', 'data', 'crc', 'interpretation'];
        
        // 헤더 행
        let csvContent = '\uFEFF'; // BOM for UTF-8
        csvContent += headers.join(',') + '\n';
        
        // 데이터 행
        logs.forEach(log => {
            const row = headers.map(header => {
                let value = log[header];
                
                // 값이 객체나 배열인 경우 JSON 문자열로 변환
                if (value !== null && typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                
                // 문자열인 경우 따옴표 처리
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
                
                return value === undefined ? '' : value;
            }).join(',');
            
            csvContent += row + '\n';
        });
        
        return csvContent;
    }
    
    /**
     * 로그 데이터를 JSON 형식으로 변환
     * @param {Array} logs 로그 항목 배열
     * @returns {string} JSON 문자열
     */
    toJSON(logs) {
        if (!logs || logs.length === 0) {
            return '{}';
        }
        
        // 로그 데이터 처리
        const processedLogs = logs.map(log => {
            // 바이너리 데이터 처리
            const processedLog = { ...log };
            
            if (processedLog.packet instanceof Uint8Array) {
                processedLog.packetHex = Array.from(processedLog.packet)
                    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
                    .join(' ');
            }
            
            return processedLog;
        });
        
        // 통계 정보 추가
        const stats = this.calculateStatistics(logs);
        
        // 최종 결과
        const result = {
            exportTime: new Date().toISOString(),
            logs: processedLogs,
            statistics: stats
        };
        
        return JSON.stringify(result, null, 2);
    }
    
    /**
     * 패킷 데이터를 JSON 형식으로 내보내기
     * @param {Array} packets 패킷 데이터 배열
     * @param {string} filename 파일명
     */
    exportPacketsToJSON(packets, filename) {
        if (!packets || !packets.length) {
            console.error('내보낼 패킷이 없습니다.');
            return;
        }
        
        // 패킷 데이터를 JSON용 형식으로 변환
        const jsonData = {
            exportTime: new Date().toISOString(),
            totalPackets: packets.length,
            packets: packets.map(packet => {
                const { timestamp, direction, packet: rawData, interpretation } = packet;
                
                return {
                    timestamp: timestamp.toISOString(),
                    direction: direction,
                    rawData: Array.from(rawData),
                    interpretation: interpretation
                };
            })
        };
        
        // 통계 정보 추가
        jsonData.statistics = this.calculateStatistics(packets);
        
        // JSON으로 내보내기
        this.exportToJSON(jsonData, filename || `modbus_packets_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.json`);
    }
    
    /**
     * 패킷 통계 계산
     * @param {Array} packets 패킷 데이터 배열
     * @returns {Object} 통계 정보
     */
    calculateStatistics(packets) {
        const totalPackets = packets.length;
        const txPackets = packets.filter(p => p.direction === 'TX').length;
        const rxPackets = packets.filter(p => p.direction === 'RX').length;
        
        // 패킷 크기 통계
        const packetSizes = packets.map(p => p.packet.length);
        const avgPacketSize = packetSizes.reduce((sum, size) => sum + size, 0) / totalPackets;
        
        // 패킷 응답 시간 계산 (TX 패킷 이후 RX 패킷 사이의 시간 차이)
        const responseTimes = [];
        for (let i = 0; i < packets.length - 1; i++) {
            if (packets[i].direction === 'TX' && packets[i+1].direction === 'RX') {
                const responseTime = packets[i+1].timestamp.getTime() - packets[i].timestamp.getTime();
                responseTimes.push(responseTime);
            }
        }
        
        const avgResponseTime = responseTimes.length > 0 ? 
            responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
        
        // 함수 코드 분포
        const functionCodes = {};
        packets.forEach(packet => {
            if (packet.packet.length > 1) {
                const functionCode = packet.packet[1];
                functionCodes[functionCode] = (functionCodes[functionCode] || 0) + 1;
            }
        });
        
        return {
            totalPackets,
            txPackets,
            rxPackets,
            avgPacketSize: avgPacketSize.toFixed(2),
            minPacketSize: Math.min(...packetSizes),
            maxPacketSize: Math.max(...packetSizes),
            avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
            minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes).toFixed(2) + 'ms' : 'N/A',
            maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes).toFixed(2) + 'ms' : 'N/A',
            functionCodeDistribution: functionCodes
        };
    }
    
    /**
     * 데이터를 JSON용으로 처리 (바이너리 데이터 변환 등)
     * @param {Object|Array} data 처리할 데이터
     * @returns {Object|Array} 처리된 데이터
     * @private
     */
    _processDataForJSON(data) {
        if (data === null || data === undefined) {
            return data;
        }
        
        // 배열인 경우
        if (Array.isArray(data)) {
            return data.map(item => this._processDataForJSON(item));
        }
        
        // Uint8Array인 경우
        if (data instanceof Uint8Array) {
            return Array.from(data);
        }
        
        // 객체인 경우
        if (typeof data === 'object' && data !== null) {
            const result = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    result[key] = this._processDataForJSON(data[key]);
                }
            }
            return result;
        }
        
        // 기본 형식은 그대로 반환
        return data;
    }
    
    /**
     * 파일 다운로드 처리
     * @param {string} content 파일 내용
     * @param {string} filename 파일명
     * @param {string} mimeType MIME 타입
     * @private
     */
    _downloadFile(content, filename, mimeType) {
        // Blob 생성
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // 다운로드 링크 생성
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.display = 'none';
        
        // 링크 클릭 시뮬레이션
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // URL 리소스 해제
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    /**
     * 로그 데이터를 지정된 형식으로 내보내기
     * @param {Array} logs 로그 항목 배열
     * @param {string} format 내보내기 형식 ('csv', 'json', 'txt')
     * @returns {Object} 내보내기 데이터 객체
     */
    exportData(logs, format) {
        if (!this.exportFormats[format]) {
            throw new Error(`지원되지 않는 내보내기 형식: ${format}`);
        }
        
        let content = '';
        
        switch (format) {
            case 'csv':
                content = this.toCSV(logs);
                break;
            case 'json':
                content = this.toJSON(logs);
                break;
            case 'txt':
                content = this.toText(logs);
                break;
        }
        
        return {
            content,
            mimeType: this.exportFormats[format].mimeType,
            extension: this.exportFormats[format].extension,
            filename: `modbus_logs_${new Date().toISOString().replace(/[:.]/g, '-')}${this.exportFormats[format].extension}`
        };
    }
    
    /**
     * 데이터를 파일로 다운로드
     * @param {Object} exportData 내보내기 데이터 객체
     */
    downloadFile(exportData) {
        const blob = new Blob([exportData.content], { type: exportData.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = exportData.filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
}
