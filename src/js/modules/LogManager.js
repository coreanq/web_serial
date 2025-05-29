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
     * @param {Object} packet 패킷 데이터
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

        const interpretation = this.modbusInterpreter.interpretPacket(parsedPacket, direction);
        
        // 패킷 정보 저장 (parsedPacket을 저장하도록 변경)
        const packetInfo = {
            timestamp,
            direction,
            packet: parsedPacket, // 파싱된 패킷 객체를 저장
            interpretation
        };
        
        this.packets.push(packetInfo);
        
        // 필터링 적용
        if (this.filterType === 'all' || 
            (this.filterType === 'tx' && direction === 'TX') || 
            (this.filterType === 'rx' && direction === 'RX')) {
            // UI에 표시
            this.displayPacket(packetInfo);
        }
    }
    
    /**
     * 패킷을 UI에 표시
     * @param {Object} packetInfo 패킷 정보
     */
    displayPacket(packetInfo) {
        const { timestamp, direction, packet, interpretation } = packetInfo;
        
        const row = document.createElement('tr');
        row.className = direction === 'TX' ? 'table-primary' : 'table-success';
        
        // 슬레이브 주소와 함수 코드 추출
        const slaveAddress = packet.length > 0 ? packet[0] : '';
        const functionCode = packet.length > 1 ? packet[1] : '';
        
        // 데이터 바이트 표시
        const dataBytes = packet.length > 2 ? packet.slice(2, -2) : [];
        const dataHex = Array.from(dataBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        
        // CRC 값 추출
        const crcBytes = packet.length >= 2 ? packet.slice(-2) : [];
        const crcHex = crcBytes.length === 2 ? 
            ((crcBytes[0] << 8) | crcBytes[1]).toString(16).padStart(4, '0') : '';
        
        row.innerHTML = `
            <td><input type="checkbox" class="packet-select"></td>
            <td>${timestamp.toLocaleTimeString()}</td>
            <td>${direction}</td>
            <td>${slaveAddress}</td>
            <td>${functionCode} (0x${functionCode.toString(16).padStart(2, '0')})</td>
            <td>${dataHex}</td>
            <td>${crcHex}</td>
            <td>Valid</td>
        `;
        
        // 패킷 해석 정보 툴팁으로 추가
        row.title = interpretation;
        
        // 패킷 상세 정보 표시를 위한 클릭 이벤트 추가
        row.addEventListener('click', (e) => {
            // 체크박스 클릭은 무시
            if (e.target.type === 'checkbox') return;
            
            // 패킷 상세 정보 표시
            this._showPacketDetails(packetInfo);
        });
        
        this.logTableBody.appendChild(row);
        
        // 자동 스크롤 처리
        if (this.autoScroll) {
            this._scrollToBottom();
        }
    }
    
    /**
     * 패킷 상세 정보 표시
     * @param {Object} packetInfo 패킷 정보
     */
    _showPacketDetails(packetInfo) {
        const { direction, packet, interpretation } = packetInfo;
        
        // 패킷 데이터를 HEX와 ASCII로 표시
        const hexData = Array.from(packet).map(b => b.toString(16).padStart(2, '0')).join(' ');
        let asciiData = Array.from(packet).map(b => {
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
                            <pre class="bg-dark text-light p-3 rounded">${interpretation}</pre>
                            
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
}
