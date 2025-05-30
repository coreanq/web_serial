/**
 * LogManager.js
 * 로그 데이터를 관리하고 표시하는 모듈
 */
import { ModbusInterpreter } from './ModbusInterpreter.js';
import { ModbusParser } from './ModbusParser.js';

export class LogManager {
    /**
     * 생성자
     * @param {ModbusInterpreter} modbusInterpreter Modbus 인터프리터 인스턴스
     */
    constructor(modbusInterpreter, modbusParser) {
        this.modbusInterpreter = modbusInterpreter;
        this.modbusParser = modbusParser; // 주입받은 ModbusParser 인스턴스 사용
        this.packets = [];
        this.autoScroll = true;
        this.filterType = 'all'; // 'all', 'tx', 'rx'
        
        // DOM 요소 참조 캐싱 
        this.logTableBody = document.getElementById('logTableBody');
        this.logContainer = document.querySelector('.log-container');
        this.logTypeSelect = document.getElementById('logType');
        this.autoScrollCheckbox = document.getElementById('autoScroll');
        this.clearBtn = document.getElementById('clearBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.selectAllCheckbox = document.getElementById('selectAllPackets');
        
        // 이벤트 리스너 추가
        this._attachEventListeners();
    }
    
    /**
     * 이벤트 리스너 추가
     */
    _attachEventListeners() {
        // 필터 변경 이벤트
        this.logTypeSelect.addEventListener('change', () => {
            this.filterType = this.logTypeSelect.value;
            this._refreshLogView();
        });
        
        // 자동 스크롤 설정 이벤트
        this.autoScrollCheckbox.addEventListener('change', () => {
            this.autoScroll = this.autoScrollCheckbox.checked;
            if (this.autoScroll) {
                this._scrollToBottom();
            }
        });
        
        // 로그 지우기 버튼 이벤트
        this.clearBtn.addEventListener('click', () => {
            this.clearLog();
        });
        
        // 로그 복사 버튼 이벤트
        this.copyBtn.addEventListener('click', () => {
            this.copySelectedPackets();
        });
        
        // 로그 내보내기 버튼 이벤트
        this.exportBtn.addEventListener('click', () => {
            this.exportPackets();
        });
        
        // 전체 선택 체크박스 이벤트
        this.selectAllCheckbox.addEventListener('change', () => {
            const isChecked = this.selectAllCheckbox.checked;
            const checkboxes = this.logTableBody.querySelectorAll('.packet-select');
            checkboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        });
    }
    
    /**
     * 로그 테이블에 패킷 추가
     * @param {Object} packetData 패킷 데이터
     * @param {string} direction 방향 ('TX' 또는 'RX')
     */
    addPacketToLog(packetData, direction) { // 변수명을 packetData로 변경하여 명확성 확보
        const timestamp = new Date();
        let parsedPacket;

        if (packetData instanceof Uint8Array) {
            // Uint8Array인 경우, ModbusParser를 사용하여 파싱
            parsedPacket = this.modbusParser.parsePacket(packetData, direction);
        } else {
            // 이미 파싱된 객체인 경우 그대로 사용
            parsedPacket = packetData;
        }

        console.log("addPacketToLog parsedPacket", parsedPacket);
        const interpretation = this.modbusInterpreter.interpretPacket(parsedPacket);
        
        parsedPacket.interpretedData = interpretation;
        this.packets.push(parsedPacket);
        
        // 필터링 적용
        if (this.filterType === 'all' || 
            (this.filterType === 'tx' && direction === 'TX') || 
            (this.filterType === 'rx' && direction === 'RX')) {
            // UI에 표시
            this.displayPacket(parsedPacket);
        }
    }
    
    /**
     * 패킷을 UI에 표시
     * @param {Object} packetInfo 패킷 정보
     */
    displayPacket(packetInfo) {
        const { timestamp, direction, interpretedData, raw, slaveAddress, functionCode, data, crc } = packetInfo;
        console.log("displayPacket packetInfo", packetInfo);

        const row = document.createElement('tr');
        row.className = direction === 'tx' ? 'table-primary' : 'table-success';

        let fullPacketBytes = [];
        if (raw instanceof Uint8Array) {
            fullPacketBytes = Array.from(raw); // Uint8Array를 일반 배열로 변환하여 사용
            // console.log("displayPacket raw (from Uint8Array):", fullPacketBytes);
        } else if (typeof slaveAddress === 'number' && typeof functionCode === 'number') {
            console.warn("displayPacket: 'raw' field was not a Uint8Array or was missing, reconstructing from parts.");
            fullPacketBytes.push(slaveAddress);
            fullPacketBytes.push(functionCode);
            if (data instanceof Uint8Array) {
                fullPacketBytes.push(...Array.from(data)); // Uint8Array를 일반 배열로 변환하여 사용
            }
            if (crc && typeof crc.value === 'number') {
                fullPacketBytes.push(crc.value & 0xFF);      // CRC Low
                fullPacketBytes.push((crc.value >> 8) & 0xFF); // CRC High
            }
        } else {
            console.warn("Cannot construct fullPacketBytes from packetInfo:", packetInfo);
        }
        
        // Store fullPacketBytes in packetInfo for potential use in _showPacketDetails
        packetInfo.fullPacketBytes = fullPacketBytes; 

        const hexSendCheckbox = document.getElementById('hexSend');
        const isHexSendChecked = hexSendCheckbox ? hexSendCheckbox.checked : false;

        const hexStrWithDec = this._bytesToHexString(fullPacketBytes); // 수정된 함수 사용
        const asciiStr = this._bytesToAsciiString(fullPacketBytes);
        // const decStr = this._bytesToDecimalString(fullPacketBytes); // 이 줄은 더 이상 필요 없음

        let packetDataHtml = `
            <table class="packet-data-table" style="width: 100%; border-collapse: collapse;">
        `;

        if (isHexSendChecked) { // 송신 시 HEX 우선
            packetDataHtml += `
                <tr>
                    <td style="font-weight: bold; width: 45px; padding-right: 5px; vertical-align: top;">HEX:</td>
                    <td style="word-break: break-all; vertical-align: top;">${hexStrWithDec}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold; width: 45px; padding-right: 5px; vertical-align: top;">ASC:</td>
                    <td style="word-break: break-all; vertical-align: top;">${asciiStr}</td>
                </tr>
            `;
        } else { // 수신 시 또는 기본 ASC 우선
            packetDataHtml += `
                <tr>
                    <td style="font-weight: bold; width: 45px; padding-right: 5px; vertical-align: top;">ASC:</td>
                    <td style="word-break: break-all; vertical-align: top;">${asciiStr}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold; width: 45px; padding-right: 5px; vertical-align: top;">HEX:</td>
                    <td style="word-break: break-all; vertical-align: top;">${hexStrWithDec}</td>
                </tr>
            `;
        }
        packetDataHtml += '</table>';

        row.innerHTML = `
            <td><input type="checkbox" class="packet-select"></td>
            <td>${new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}</td>
            <td>${direction}</td>
            <td>${packetDataHtml}</td>
        `;

        // Add interpretation as a tooltip if available
        if (interpretedData) {
            row.title = interpretedData;
        }
        
        row.addEventListener('click', () => this._showPacketDetails(packetInfo));

        this.logTableBody.appendChild(row);
        if (this.autoScrollCheckbox.checked) {
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
    }
    
    /**
     * 패킷 상세 정보 표시
     * @param {Object} packetInfo 패킷 정보
     */
    _showPacketDetails(packetInfo) {
        const { direction, packet, interpretedData, fullPacketBytes } = packetInfo;
        
        // 패킷 데이터를 HEX와 ASCII로 표시
        const hexData = Array.from(fullPacketBytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        let asciiData = Array.from(fullPacketBytes).map(b => {
            // 출력 가능한 ASCII 문자만 표시
            if (b >= 32 && b <= 126) {
                return String.fromCharCode(b);
            } else {
                return '.';
            }
        }).join('');
        
        // 모달 대화상자로 표시
        const detailsHTML = `
            <div class="modal fade" id="packetDetailsModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content bg-dark text-light">
                        <div class="modal-header">
                            <h5 class="modal-title">${direction} 패킷 상세 정보</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <h6>해석 정보</h6>
                            <pre class="bg-dark text-light p-3 rounded">${interpretedData}</pre>
                            
                            <h6>HEX 데이터</h6>
                            <pre class="bg-dark text-light p-3 rounded">${hexData}</pre>
                            
                            <h6>ASCII 데이터</h6>
                            <pre class="bg-dark text-light p-3 rounded">${asciiData}</pre>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 기존 모달 삭제 후 새로 추가
        const existingModal = document.getElementById('packetDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', detailsHTML);
        
        // Bootstrap 모달 생성 및 표시
        const modal = new bootstrap.Modal(document.getElementById('packetDetailsModal'));
        modal.show();
    }
    
    /**
     * 로그 뷰 새로고침
     */
    _refreshLogView() {
        this.logTableBody.innerHTML = '';
        
        this.packets.forEach(packet => {
            if (this.filterType === 'all' || 
                (this.filterType === 'tx' && packet.direction === 'TX') || 
                (this.filterType === 'rx' && packet.direction === 'RX')) {
                this.displayPacket(packet);
            }
        });
        
        if (this.autoScroll) {
            this._scrollToBottom();
        }
    }
    
    /**
     * 화면 하단으로 스크롤
     */
    _scrollToBottom() {
        if (this.logContainer) {
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
    }
    
    /**
     * 선택한 패킷 복사
     */
    copySelectedPackets() {
        const selectedRows = this._getSelectedRows();
        
        if (selectedRows.length === 0) {
            alert('복사할 패킷을 선택해주세요.');
            return;
        }
        
        let copyText = '';
        
        selectedRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const rowData = [];
            
            // 체크박스 셀은 제외
            for (let i = 1; i < cells.length; i++) {
                rowData.push(cells[i].textContent.trim());
            }
            
            copyText += rowData.join('\t') + '\n';
        });
        
        // 클립보드에 복사
        navigator.clipboard.writeText(copyText)
            .then(() => {
                alert('클립보드에 복사되었습니다.');
            })
            .catch(err => {
                console.error('복사 오류:', err);
                alert('복사 중 오류가 발생했습니다.');
            });
    }
    
    /**
     * 패킷 내보내기 (CSV 형식)
     */
    exportPackets() {
        // 선택한 패킷 가져오기
        const selectedRows = this._getSelectedRows();
        const packetsToExport = selectedRows.length > 0 ? selectedRows : this.logTableBody.querySelectorAll('tr');
        
        if (packetsToExport.length === 0) {
            alert('내보낼 패킷이 없습니다.');
            return;
        }
        
        // CSV 헤더
        let csvContent = '\uFEFF'; // BOM for UTF-8
        csvContent += '시간,방향,슬레이브,함수,데이터,CRC,상태\n';
        
        packetsToExport.forEach(row => {
            const cells = row.querySelectorAll('td');
            const rowData = [];
            
            // 체크박스 셀은 제외
            for (let i = 1; i < cells.length; i++) {
                // CSV 형식에 맞게 이스케이프 처리
                let cellText = cells[i].textContent.trim();
                if (cellText.includes(',')) {
                    cellText = `"${cellText}"`;
                }
                rowData.push(cellText);
            }
            
            csvContent += rowData.join(',') + '\n';
        });
        
        // 다운로드 링크 생성
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `modbus_log_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`);
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * 선택한 행 가져오기
     * @returns {Array} 선택한 행 요소들
     */
    _getSelectedRows() {
        const selectedRows = [];
        const rows = this.logTableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const checkbox = row.querySelector('.packet-select');
            if (checkbox && checkbox.checked) {
                selectedRows.push(row);
            }
        });
        
        return selectedRows;
    }
    
    /**
     * 로그 테이블 지우기
     */
    clearLog() {
        this.logTableBody.innerHTML = '';
        this.packets = [];
    }
    
    /**
     * 로그 데이터 가져오기
     * @returns {Array} 패킷 데이터 배열
     */
    getLogData() {
        return this.packets;
    }

    /**
     * 바이트 배열을 16진수 문자열로 변환합니다.
     * @param {Uint8Array} bytes - 변환할 바이트 배열
     * @returns {string} 16진수 문자열 (예: "0A 1B 2C")
     */
    _bytesToHexString(bytes) {
        if (!bytes) return '';
        return Array.from(bytes).map(byte => {
            const hex = byte.toString(16).padStart(2, '0').toUpperCase();
            const dec = byte.toString(10);
            return `${hex}<span style="color: gray;">(${dec})</span>`; // 공백 제거 및 span 추가
        }).join(' '); // 각 바이트 표현 사이에는 공백 유지
    }

    /**
     * 바이트 배열을 10진수 문자열로 변환합니다.
     * @param {Uint8Array} bytes - 변환할 바이트 배열
     * @returns {string} 10진수 문자열 (예: "10 27 44")
     */
    _bytesToDecimalString(bytes) {
        if (!bytes) return '';
        return Array.from(bytes).map(byte => byte.toString(10)).join(' ');
    }

    /**
     * 바이트 배열을 ASCII 문자열로 변환합니다. 
     * 제어 문자는 Symbolic 이름으로 표시하고, 제어 문자임을 시각적으로 표시합니다.
     * @param {Uint8Array} bytes - 변환할 바이트 배열
     * @returns {string} ASCII 문자열 (제어 문자는 [NAME] 형식으로 표시)
     */
    _bytesToAsciiString(bytes) {
        if (!bytes) return '';
        
        // ASCII 제어 문자와 해당 이름 매핑 (0-31, 127)
        const controlChars = {
            0: 'NUL', 1: 'SOH', 2: 'STX', 3: 'ETX', 4: 'EOT', 5: 'ENQ', 6: 'ACK', 7: 'BEL',
            8: 'BS', 9: 'HT', 10: 'LF', 11: 'VT', 12: 'FF', 13: 'CR', 14: 'SO', 15: 'SI',
            16: 'DLE', 17: 'DC1', 18: 'DC2', 19: 'DC3', 20: 'DC4', 21: 'NAK', 22: 'SYN', 23: 'ETB',
            24: 'CAN', 25: 'EM', 26: 'SUB', 27: 'ESC', 28: 'FS', 29: 'GS', 30: 'RS', 31: 'US',
            127: 'DEL'
        };
        
        return Array.from(bytes).map(byte => {
            if (byte >= 32 && byte <= 126) {
                // 출력 가능한 ASCII 문자
                return String.fromCharCode(byte);
            } else if (controlChars[byte] !== undefined) {
                // 제어 문자인 경우 [NAME] 형식으로 표시하고 제어 문자임을 시각적으로 표시
                return `<span class="control-char" title="Control Character: ${controlChars[byte]} (${byte})">[${controlChars[byte]}]</span>`;
            } else {
                // 그 외의 바이트 (128-255) -> 확장 ASCII는 그대로 표시
                return String.fromCharCode(byte);
            }
        }).join('');
    }
}
