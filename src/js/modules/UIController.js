/**
 * UIController.js
 * UI 요소와 이벤트를 관리하는 모듈
 */
import { LogManager } from './LogManager.js';
import { DataExporter } from './DataExporter.js';
import { DataStorage } from './DataStorage.js';

export class UIController {
    /**
     * UIController 생성자
     * @param {SerialManager} serialManager 시리얼 관리자 인스턴스
     * @param {ModbusParser} modbusParser Modbus 파서 인스턴스
     * @param {ModbusInterpreter} modbusInterpreter Modbus 함수 코드 인터프리터 인스턴스
     * @param {DataStorage} dataStorage 데이터 저장소 인스턴스
     * @param {AppState} appState 애플리케이션 상태 관리자 인스턴스
     * @param {LogManager} logManager 로그 관리자 인스턴스
     * @param {DataExporter} dataExporter 데이터 내보내기 인스턴스
     */
    constructor(serialManager, modbusParser, modbusInterpreter, dataStorage, appState, logManager, dataExporter) {
        this.serialManager = serialManager;
        this.modbusParser = modbusParser;
        this.modbusInterpreter = modbusInterpreter;
        this.dataStorage = dataStorage;
        this.appState = appState;
        this.logManager = logManager;
        this.dataExporter = dataExporter;
        
        // UI 요소
        this.elements = {
            // 연결 설정 요소
            selectPortBtn: document.getElementById('selectPortBtn'),
            openPortBtn: document.getElementById('openPortBtn'),
            baudRate: document.getElementById('baudRate'),
            dataBits: document.getElementById('dataBits'),
            stopBits: document.getElementById('stopBits'),
            parity: document.getElementById('parity'),
            buffer: document.getElementById('buffer'),
            flowControl: document.getElementById('flowControl'),
            connectionStatus: document.getElementById('connectionStatus'),
            connectionIndicator: document.getElementById('connectionIndicator'),
            
            // 로그 영역 요소
            logTableBody: document.getElementById('logTableBody'),
            clearBtn: document.getElementById('clearBtn'),
            copyBtn: document.getElementById('copyBtn'),
            exportBtn: document.getElementById('exportBtn'),
            logType: document.getElementById('logType'),
            autoScroll: document.getElementById('autoScroll'),
            packetTimeout: document.getElementById('packetTimeout'),
            
            // 메시지 입력 영역
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            appendCRLF: document.getElementById('appendCRLF'),
            hexSend: document.getElementById('hexSend'),
            loopSend: document.getElementById('loopSend'),
            sendInterval: document.getElementById('sendInterval'),
            
            // 기타 버튼
            systemOptionsBtn: document.getElementById('systemOptionsBtn'),
            quickSendBtn: document.getElementById('quickSendBtn'),
            selectAll: document.getElementById('selectAll')
        };
        
        // 상태 변수
        this.loopSendIntervalId = null;
    }
    
    /**
     * UI 초기화 및 이벤트 리스너 설정
     */
    init() {
        // 시리얼 포트 선택 버튼
        this.elements.selectPortBtn.addEventListener('click', async () => {
            try {
                // 포트 선택 중 상태 표시
                this.updateConnectionStatus('포트 선택 중...', false, true);
                this.elements.selectPortBtn.disabled = true;
                
                const selected = await this.serialManager.selectPort();
                if (selected) {
                    this.elements.openPortBtn.disabled = false;
                    this.updateConnectionStatus('포트 선택됨. 연결 준비 완료.', false);
                } else {
                    this.updateConnectionStatus('포트 선택이 취소되었습니다.', false);
                }
            } catch (error) {
                this.updateConnectionStatus(`포트 선택 오류: ${error.message}`, true);
            } finally {
                this.elements.selectPortBtn.disabled = false;
            }
        });
        
        // 내보내기 버튼 이벤트 리스너
        this.elements.exportBtn.addEventListener('click', () => {
            this.showExportDialog();
        });
        
        // 세션 관리 버튼 이벤트 리스너
        this.elements.sessionManagerBtn = document.getElementById('sessionManagerBtn');
        this.elements.sessionManagerBtn.addEventListener('click', () => {
            this.showSessionManagerDialog();
        });
        
        // 시리얼 포트 열기/닫기 버튼
        this.elements.openPortBtn.addEventListener('click', async () => {
            try {
                if (this.serialManager.isConnected()) {
                    // 연결 해제 중 상태 표시
                    this.updateConnectionStatus('연결 해제 중...', false, true);
                    this.elements.openPortBtn.disabled = true;
                    await this.disconnectPort();
                } else {
                    // 연결 중 상태 표시
                    this.updateConnectionStatus('연결 중...', false, true);
                    this.elements.openPortBtn.disabled = true;
                    await this.connectPort();
                }
            } catch (error) {
                this.updateConnectionStatus(`연결 오류: ${error.message}`, true);
            } finally {
                this.elements.openPortBtn.disabled = false;
            }
        });
        
        // 연결 설정 변경 이벤트 처리
        const connectionSettings = [
            this.elements.baudRate,
            this.elements.dataBits,
            this.elements.stopBits,
            this.elements.parity,
            this.elements.flowControl,
            this.elements.buffer
        ];
        
        connectionSettings.forEach(element => {
            element.addEventListener('change', () => {
                // 연결 설정이 변경되면 현재 설정을 표시
                this.updateConnectionSettingsSummary();
            });
        });
        
        // 패킷 타임아웃 설정 변경 이벤트 처리
        this.elements.packetTimeout.addEventListener('change', () => {
            const packetTimeout = parseInt(this.elements.packetTimeout.value, 10);
            
            // 연결된 상태에서만 즉시 적용
            if (this.serialManager.isConnected()) {
                this.modbusParser.setPacketTimeout(packetTimeout);
                this.updateConnectionStatus(`패킷 타임아웃 설정됨: ${packetTimeout}ms`, false);
            }
        });
        
        // 메시지 전송 버튼
        this.elements.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });
        
        // 메시지 입력 영역에서 Enter 키 처리
        this.elements.messageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.sendMessage();
            }
        });
        
        // 로그 지우기 버튼
        this.elements.clearBtn.addEventListener('click', () => {
            this.elements.logTableBody.innerHTML = '';
        });
        
        // 루프 전송 체크박스
        this.elements.loopSend.addEventListener('change', (event) => {
            if (event.target.checked) {
                this.startLoopSend();
            } else {
                this.stopLoopSend();
            }
        });
        
        // 시리얼 연결 상태 변경 리스너
        this.serialManager.onConnectionChange((isConnected, message) => {
            this.updateConnectionUI(isConnected);
            this.updateConnectionStatus(message);
        });
        
        // 시리얼 데이터 수신 리스너
        this.serialManager.onDataReceived((data) => {
            const { binaryData, textData, direction, timestamp } = data;
            console.log(`데이터 ${direction === 'tx' ? '송신' : '수신'}:`, binaryData, textData);
            
            // Modbus 패킷 파싱 시도
            if (direction === 'rx') {
                const packets = this.modbusParser.parseData(binaryData);
                packets.forEach(packet => {
                    console.log('RX Packet:', packet);
                    this.logManager.addPacketToLog(packet, 'RX');
                });
            } else if (direction === 'tx') {
                const packets = this.modbusParser.parseData(binaryData);
                packets.forEach(packet => {
                    console.log('TX Packet:', packet);
                    this.logManager.addPacketToLog(packet, 'TX');
                });
            }
        });
        
        // 시리얼 오류 리스너
        this.serialManager.onError((error) => {
            this.updateConnectionStatus(`오류: ${error.message}`, true);
        });
        
        // 초기 UI 상태 설정
        this.updateConnectionUI(false);
    }
    
    /**
     * 시리얼 포트 연결
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async connectPort() {
        try {
            // 연결 설정 가져오기
            const options = {
                baudRate: parseInt(this.elements.baudRate.value, 10),
                dataBits: parseInt(this.elements.dataBits.value, 10),
                stopBits: parseInt(this.elements.stopBits.value, 10),
                parity: this.elements.parity.value,
                flowControl: this.elements.flowControl.value,
                bufferSize: parseInt(this.elements.buffer.value, 10)
            };
            
            // 연결 시도
            const connected = await this.serialManager.connect(options);
            
            if (connected) {
                // 연결 성공 시 UI 업데이트
                this.elements.openPortBtn.textContent = '닫기';
                this.elements.openPortBtn.classList.replace('btn-success', 'btn-danger');
                
                // 패킷 타임아웃 설정 적용
                const packetTimeout = parseInt(this.elements.packetTimeout.value, 10);
                this.modbusParser.setPacketTimeout(packetTimeout);
                
                // 연결 상태 표시
                this.updateConnectionStatus(`연결됨: ${options.baudRate} baud, ${options.dataBits}${options.parity.charAt(0).toUpperCase()}${options.stopBits}`, false);
                
                // 연결 설정 요소 비활성화
                this.updateConnectionUI(true);
                
                return true;
            } else {
                this.updateConnectionStatus('연결 실패', true);
                return false;
            }
        } catch (error) {
            this.updateConnectionStatus(`연결 오류: ${error.message}`, true);
            return false;
        }
    }
    
    /**
     * 시리얼 포트 연결 해제
     * @returns {Promise<boolean>} 연결 해제 성공 여부
     */
    async disconnectPort() {
        try {
            // 연결 해제 시도
            const disconnected = await this.serialManager.disconnect();
            
            if (disconnected) {
                // 연결 해제 성공 시 UI 업데이트
                this.elements.openPortBtn.textContent = '열기';
                this.elements.openPortBtn.classList.replace('btn-danger', 'btn-success');
                
                // 루프 전송 중지
                this.stopLoopSend();
                
                // 연결 상태 표시
                this.updateConnectionStatus('연결 해제됨', false);
                
                // 연결 설정 요소 활성화
                this.updateConnectionUI(false);
                
                return true;
            } else {
                this.updateConnectionStatus('연결 해제 실패', true);
                return false;
            }
        } catch (error) {
            this.updateConnectionStatus(`연결 해제 오류: ${error.message}`, true);
            return false;
        }
    }
    
    /**
     * 메시지 전송
     */
    sendMessage() {
        if (!this.serialManager.isConnected()) {
            this.updateConnectionStatus('먼저 시리얼 포트에 연결하세요.', true);
            return;
        }
        
        const message = this.elements.messageInput.value.trim();
        if (!message) return;
        
        const isHex = this.elements.hexSend.checked;
        const appendCRLF = this.elements.appendCRLF.checked;
        
        try {
            // 메시지 전송
            this.serialManager.sendData(message, isHex, appendCRLF);
            
            // 메시지 입력창 초기화
            if (!this.elements.loopSend.checked) {
                this.elements.messageInput.value = '';
                this.elements.messageInput.focus();
            }
            
            // 전송한 데이터를 Modbus 패킷으로 처리
            const txData = this.serialManager.getLastTxData();
            if (txData && txData.length > 0) {
                console.log('TX Data:', txData);
                this.logManager.addPacketToLog(txData, 'TX');
            }
        } catch (error) {
            console.error('메시지 전송 오류:', error);
            this.updateConnectionStatus(`전송 오류: ${error.message}`, true);
        }
    }
    
    /**
     * 루프 전송 시작
     */
    startLoopSend() {
        if (this.loopSendIntervalId) {
            clearInterval(this.loopSendIntervalId);
        }
        
        const interval = parseInt(this.elements.sendInterval.value, 10);
        this.loopSendIntervalId = setInterval(() => {
            this.sendMessage();
        }, interval);
    }
    
    /**
     * 루프 전송 중지
     */
    stopLoopSend() {
        if (this.loopSendIntervalId) {
            clearInterval(this.loopSendIntervalId);
            this.loopSendIntervalId = null;
        }
        
        this.elements.loopSend.checked = false;
    }
    
    /**
     * 연결 상태 UI 업데이트
     * @param {boolean} isConnected 연결 상태
     */
    updateConnectionUI(isConnected) {
        // 연결 설정 필드 비활성화/활성화
        this.elements.baudRate.disabled = isConnected;
        this.elements.dataBits.disabled = isConnected;
        this.elements.stopBits.disabled = isConnected;
        this.elements.parity.disabled = isConnected;
        this.elements.buffer.disabled = isConnected;
        this.elements.flowControl.disabled = isConnected;
        
        // 포트 선택 버튼 비활성화/활성화
        this.elements.selectPortBtn.disabled = isConnected;
        
        // 연결 버튼 텍스트 변경
        if (isConnected) {
            this.elements.openPortBtn.textContent = '닫기';
            this.elements.openPortBtn.classList.replace('btn-success', 'btn-danger');
            this.elements.connectionStatus.classList.add('status-connected');
            this.elements.connectionStatus.classList.remove('text-muted');
            
            // 연결 상태 표시기 색상 변경 (연결됨 - 초록색)
            this.elements.connectionIndicator.style.backgroundColor = '#198754';
        } else {
            this.elements.openPortBtn.textContent = '열기';
            this.elements.openPortBtn.classList.replace('btn-danger', 'btn-success');
            this.elements.connectionStatus.classList.remove('status-connected');
            this.elements.connectionStatus.classList.add('text-muted');
            
            // 연결 상태 표시기 색상 변경 (연결 해제 - 회색)
            this.elements.connectionIndicator.style.backgroundColor = '#6c757d';
        }
    }
    
    /**
     * 연결 상태 메시지 업데이트
     * @param {string} message 상태 메시지
     * @param {boolean} isError 오류 여부
     * @param {boolean} isLoading 로딩 상태 여부
     */
    updateConnectionStatus(message, isError = false, isLoading = false) {
        // 로딩 상태일 경우 스피너 추가
        if (isLoading) {
            this.elements.connectionStatus.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${message}`;
        } else {
            this.elements.connectionStatus.textContent = message;
        }
        
        // 오류 상태 표시
        if (isError) {
            this.elements.connectionStatus.classList.add('status-disconnected');
            this.elements.connectionStatus.classList.remove('status-connected');
            
            // 연결 상태 표시기 색상 변경 (오류 - 빨강색)
            this.elements.connectionIndicator.style.backgroundColor = '#dc3545';
        } else if (this.serialManager.isConnected()) {
            this.elements.connectionStatus.classList.add('status-connected');
            this.elements.connectionStatus.classList.remove('status-disconnected');
            
            // 연결 상태 표시기 색상 변경 (연결됨 - 초록색)
            this.elements.connectionIndicator.style.backgroundColor = '#198754';
        } else {
            this.elements.connectionStatus.classList.remove('status-connected');
            this.elements.connectionStatus.classList.remove('status-disconnected');
            
            // 연결 상태 표시기 색상 변경 (연결 해제 - 회색)
            if (isLoading) {
                // 로딩 중 - 파란색
                this.elements.connectionIndicator.style.backgroundColor = '#0d6efd';
            } else {
                // 대기 중 - 회색
                this.elements.connectionIndicator.style.backgroundColor = '#6c757d';
            }
        }
    }
    
    /**
     * 연결 설정 요약 정보 업데이트
     */
    updateConnectionSettingsSummary() {
        // 현재 연결 설정 요약
        const baudRate = this.elements.baudRate.value;
        const dataBits = this.elements.dataBits.value;
        const stopBits = this.elements.stopBits.value;
        const parity = this.elements.parity.value.charAt(0).toUpperCase();
        const flowControl = this.elements.flowControl.value;
        
        // 설정 요약 표시
        const summary = `${baudRate} baud, ${dataBits}${parity}${stopBits}, Flow: ${flowControl}`;
        
        // 연결되지 않은 상태에서만 업데이트
        if (!this.serialManager.isConnected()) {
            this.updateConnectionStatus(`설정: ${summary}`, false);
        }
    }
    
    /**
     * 로그 항목 추가
     * @param {Object} packet 패킷 데이터
     * @param {string} direction 방향 ('TX' 또는 'RX')
     * @param {Date} timestamp 타임스태프
     */
    addLogEntry(packet, direction, timestamp) {
        // 로그 관리자에 패킷 추가
        this.logManager.addPacketToLog(packet, direction);
    }
    
    /**
     * 내보내기 대화상자 표시
     */
    async showExportDialog() {
        // 이미 존재하는 대화상자 제거
        const existingDialog = document.getElementById('exportDialog');
        if (existingDialog) {
            document.body.removeChild(existingDialog);
        }
        
        // 현재 로그 데이터 가져오기
        const logData = this.logManager.getLogData();
        
        // 로그가 없는 경우 경고
        if (logData.length === 0) {
            alert('내보낼 로그 데이터가 없습니다.');
            return;
        }
        
        // 통계 정보 계산
        const statistics = this.dataStorage.calculateStatistics(logData);
        
        // 대화상자 생성
        const dialog = document.createElement('div');
        dialog.id = 'exportDialog';
        dialog.className = 'modal fade';
        dialog.setAttribute('tabindex', '-1');
        dialog.setAttribute('aria-labelledby', 'exportDialogLabel');
        dialog.setAttribute('aria-hidden', 'true');
        
        dialog.innerHTML = `
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="exportDialogLabel">로그 데이터 내보내기</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <ul class="nav nav-tabs" id="exportTabs" role="tablist">
                            <li class="nav-item" role="presentation">
                                <button class="nav-link active" id="export-tab" data-bs-toggle="tab" data-bs-target="#export-content" 
                                    type="button" role="tab" aria-controls="export-content" aria-selected="true">내보내기</button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="stats-tab" data-bs-toggle="tab" data-bs-target="#stats-content" 
                                    type="button" role="tab" aria-controls="stats-content" aria-selected="false">통계</button>
                            </li>
                        </ul>
                        
                        <div class="tab-content mt-3" id="exportTabContent">
                            <div class="tab-pane fade show active" id="export-content" role="tabpanel" aria-labelledby="export-tab">
                                <form>
                                    <div class="mb-3">
                                        <label for="exportFormat" class="form-label">내보내기 형식</label>
                                        <select class="form-select" id="exportFormat">
                                            <option value="csv">CSV</option>
                                            <option value="json">JSON</option>
                                            <option value="txt">텍스트</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label for="exportFilename" class="form-label">파일명</label>
                                        <input type="text" class="form-control" id="exportFilename" 
                                            value="modbus_log_${new Date().toISOString().slice(0, 10)}">
                                    </div>
                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="saveToStorage" checked>
                                        <label class="form-check-label" for="saveToStorage">로컬 저장소에 저장</label>
                                    </div>
                                    <div class="mb-3" id="sessionNameGroup">
                                        <label for="sessionName" class="form-label">세션 이름</label>
                                        <input type="text" class="form-control" id="sessionName" 
                                            value="세션 ${new Date().toLocaleString()}">
                                    </div>
                                </form>
                            </div>
                            
                            <div class="tab-pane fade" id="stats-content" role="tabpanel" aria-labelledby="stats-tab">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="card mb-3">
                                            <div class="card-header">기본 통계</div>
                                            <div class="card-body">
                                                <table class="table table-sm">
                                                    <tbody>
                                                        <tr>
                                                            <th>총 패킷 수</th>
                                                            <td>${statistics.totalPackets}</td>
                                                        </tr>
                                                        <tr>
                                                            <th>송신 패킷</th>
                                                            <td>${statistics.txPackets}</td>
                                                        </tr>
                                                        <tr>
                                                            <th>수신 패킷</th>
                                                            <td>${statistics.rxPackets}</td>
                                                        </tr>
                                                        <tr>
                                                            <th>유효한 패킷</th>
                                                            <td>${statistics.validPackets}</td>
                                                        </tr>
                                                        <tr>
                                                            <th>유효하지 않은 패킷</th>
                                                            <td>${statistics.invalidPackets}</td>
                                                        </tr>
                                                        <tr>
                                                            <th>오류율</th>
                                                            <td>${statistics.errorRate}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="card mb-3">
                                            <div class="card-header">시간 통계</div>
                                            <div class="card-body">
                                                <table class="table table-sm">
                                                    <tbody>
                                                        <tr>
                                                            <th>평균 응답 시간</th>
                                                            <td>${statistics.avgResponseTime}</td>
                                                        </tr>
                                                        <tr>
                                                            <th>최소 응답 시간</th>
                                                            <td>${statistics.minResponseTime}</td>
                                                        </tr>
                                                        <tr>
                                                            <th>최대 응답 시간</th>
                                                            <td>${statistics.maxResponseTime}</td>
                                                        </tr>
                                                        <tr>
                                                            <th>시작 시간</th>
                                                            <td>${statistics.startTime ? new Date(statistics.startTime).toLocaleString() : 'N/A'}</td>
                                                        </tr>
                                                        <tr>
                                                            <th>종료 시간</th>
                                                            <td>${statistics.endTime ? new Date(statistics.endTime).toLocaleString() : 'N/A'}</td>
                                                        </tr>
                                                        <tr>
                                                            <th>총 소요 시간</th>
                                                            <td>${statistics.duration}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="card mb-3">
                                    <div class="card-header">함수 코드 분포</div>
                                    <div class="card-body">
                                        <table class="table table-sm">
                                            <thead>
                                                <tr>
                                                    <th>함수 코드</th>
                                                    <th>개수</th>
                                                    <th>비율</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${Object.entries(statistics.functionCodes || {}).map(([code, count]) => {
                                                    const percentage = (count / statistics.totalPackets * 100).toFixed(2);
                                                    return `<tr>
                                                        <td>${code}</td>
                                                        <td>${count}</td>
                                                        <td>${percentage}%</td>
                                                    </tr>`;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
                        <button type="button" class="btn btn-primary" id="exportConfirmBtn">내보내기</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 부트스트랩 모달 초기화
        const modalElement = document.getElementById('exportDialog');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        // 저장소 체크박스 이벤트 리스너
        const saveToStorage = document.getElementById('saveToStorage');
        const sessionNameGroup = document.getElementById('sessionNameGroup');
        
        saveToStorage.addEventListener('change', () => {
            sessionNameGroup.style.display = saveToStorage.checked ? 'block' : 'none';
        });
        
        // 내보내기 버튼 이벤트 리스너
        const exportConfirmBtn = document.getElementById('exportConfirmBtn');
        exportConfirmBtn.addEventListener('click', () => {
            const format = document.getElementById('exportFormat').value;
            const filename = document.getElementById('exportFilename').value;
            const saveToStorageChecked = document.getElementById('saveToStorage').checked;
            const sessionName = document.getElementById('sessionName').value;
            
            this.exportLogData(logData, format, filename, saveToStorageChecked, sessionName);
            modal.hide();
        });
    }
    
    /**
     * 로그 데이터 내보내기
     * @param {Array} logData 로그 데이터
     * @param {string} format 내보내기 형식 ('csv', 'json', 'txt')
     * @param {string} filename 파일명
     * @param {boolean} saveToStorage 로컬 저장소에 저장 여부
     * @param {string} sessionName 세션 이름
     * @returns {Promise<void>}
     */
    async exportLogData(logData, format, filename, saveToStorage, sessionName) {
        try {
            let sessionId = null;
            
            // 로컬 저장소에 저장
            if (saveToStorage) {
                try {
                    // 세션 생성
                    sessionId = await this.dataStorage.createSession(sessionName);
                    
                    // 패킷 저장
                    await this.dataStorage.savePackets(sessionId, logData.map(log => ({
                        packet: log.packet,
                        direction: log.direction,
                        timestamp: log.timestamp,
                        parsedData: log.parsedData
                    })));
                    
                    // 통계 정보 저장
                    const statistics = this.dataStorage.calculateStatistics(logData);
                    await this.dataStorage.saveStatistics(sessionId, statistics);
                    
                    console.log(`세션 저장 완료: ${sessionId}`);
                } catch (storageError) {
                    console.error('세션 저장 오류:', storageError);
                    alert(`세션 저장 오류: ${storageError.message}`);
                }
            }
            
            // 파일 내보내기
            if (format === 'csv' || format === 'json') {
                try {
                    // DataStorage의 내보내기 기능 사용
                    if (sessionId) {
                        // 세션 ID가 있으면 저장된 세션 데이터 사용
                        const exportedFileName = await this.dataStorage.exportToFile(sessionId, format);
                        alert(`파일이 성공적으로 내보내졌습니다: ${exportedFileName}`);
                    } else {
                        // 임시 세션 생성 후 내보내기
                        const tempSessionId = await this.dataStorage.createSession('임시 세션');
                        await this.dataStorage.savePackets(tempSessionId, logData.map(log => ({
                            packet: log.packet,
                            direction: log.direction,
                            timestamp: log.timestamp,
                            parsedData: log.parsedData
                        })));
                        
                        const exportedFileName = await this.dataStorage.exportToFile(tempSessionId, format);
                        
                        // 임시 세션 삭제
                        await this.dataStorage.deleteSession(tempSessionId);
                        
                        alert(`파일이 성공적으로 내보내졌습니다: ${exportedFileName}`);
                    }
                } catch (exportError) {
                    console.error('파일 내보내기 오류:', exportError);
                    
                    // 기존 DataExporter로 폴백
                    const exportData = this.dataExporter.exportData(logData, format);
                    exportData.filename = filename + exportData.extension;
                    this.dataExporter.downloadFile(exportData);
                }
            } else {
                // txt 형식은 기존 DataExporter 사용
                const exportData = this.dataExporter.exportData(logData, format);
                exportData.filename = filename + exportData.extension;
                this.dataExporter.downloadFile(exportData);
            }
            
            // 저장 성공 메시지 (세션 저장한 경우만)
            if (saveToStorage && sessionId) {
                alert(`세션 '${sessionName}'이(가) 저장되었습니다.`);
            }
        } catch (error) {
            console.error('내보내기 오류:', error);
            alert(`내보내기 오류: ${error.message}`);
        }
    }
    
    /**
     * 세션 관리 대화상자 표시
     */
    async showSessionManagerDialog() {
        // 기존 대화상자가 있는 경우 제거
        const existingDialog = document.getElementById('sessionManagerDialog');
        if (existingDialog) {
            document.body.removeChild(existingDialog);
        }
        
        // 세션 목록 가져오기
        const sessions = await this.dataStorage.getAllSessions();
        
        // 대화상자 생성
        const dialog = document.createElement('div');
        dialog.id = 'sessionManagerDialog';
        dialog.className = 'modal fade show';
        dialog.style.display = 'block';
        dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        dialog.setAttribute('tabindex', '-1');
        
        let sessionsHtml = '';
        if (sessions.length === 0) {
            sessionsHtml = '<tr><td colspan="4" class="text-center">저장된 세션이 없습니다.</td></tr>';
        } else {
            sessions.forEach(session => {
                const date = new Date(session.timestamp).toLocaleString();
                sessionsHtml += `
                    <tr data-session-id="${session.id}">
                        <td>${session.name}</td>
                        <td>${date}</td>
                        <td>${session.packetCount || 0}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary load-session">불러오기</button>
                            <button class="btn btn-sm btn-outline-danger delete-session">삭제</button>
                        </td>
                    </tr>
                `;
            });
        }
        
        dialog.innerHTML = `
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content bg-dark text-light">
                    <div class="modal-header">
                        <h5 class="modal-title">세션 관리</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="table-responsive">
                            <table class="table table-dark table-hover">
                                <thead>
                                    <tr>
                                        <th>세션 이름</th>
                                        <th>생성 시간</th>
                                        <th>패킷 수</th>
                                        <th>작업</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sessionsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 닫기 버튼 이벤트 리스너
        dialog.querySelector('.btn-close').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // 취소 버튼 이벤트 리스너
        dialog.querySelector('.btn-secondary').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // 세션 불러오기 버튼 이벤트 리스너
        dialog.querySelectorAll('.load-session').forEach(button => {
            button.addEventListener('click', async (e) => {
                const sessionId = e.target.closest('tr').dataset.sessionId;
                try {
                    // 세션 패킷 불러오기
                    const packets = await this.dataStorage.getPackets(sessionId);
                    
                    // 현재 로그 지우기
                    this.logManager.clearLog();
                    
                    // 패킷 추가
                    packets.forEach(packet => {
                        this.logManager.addPacketToLog(packet.packet, packet.direction, new Date(packet.timestamp));
                    });
                    
                    // 대화상자 닫기
                    document.body.removeChild(dialog);
                    
                    // 세션 정보 표시
                    const session = await this.dataStorage.getSession(sessionId);
                    alert(`세션 '${session.name}'이(가) 로드되었습니다.`);
                } catch (error) {
                    console.error('세션 불러오기 오류:', error);
                    alert(`세션 불러오기 오류: ${error.message}`);
                }
            });
        });
        
        // 세션 삭제 버튼 이벤트 리스너
        dialog.querySelectorAll('.delete-session').forEach(button => {
            button.addEventListener('click', async (e) => {
                const row = e.target.closest('tr');
                const sessionId = row.dataset.sessionId;
                const sessionName = row.cells[0].textContent;
                
                if (confirm(`세션 '${sessionName}'을(를) 삭제하시겠습니까?`)) {
                    try {
                        // 세션 삭제
                        await this.dataStorage.deleteSession(sessionId);
                        
                        // 행 제거
                        row.remove();
                        
                        // 남은 세션이 없는 경우 메시지 표시
                        const tbody = dialog.querySelector('tbody');
                        if (tbody.children.length === 0) {
                            tbody.innerHTML = '<tr><td colspan="4" class="text-center">저장된 세션이 없습니다.</td></tr>';
                        }
                    } catch (error) {
                        console.error('세션 삭제 오류:', error);
                        alert(`세션 삭제 오류: ${error.message}`);
                    }
                }
            });
        });
    }
}
