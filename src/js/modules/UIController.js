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
     * @param {ModbusParser} modbusRTUParser Modbus 파서 인스턴스
     * @param {ModbusInterpreter} modbusInterpreter Modbus 함수 코드 인터프리터 인스턴스
     * @param {DataStorage} dataStorage 데이터 저장소 인스턴스
     * @param {AppState} appState 애플리케이션 상태 관리자 인스턴스
     * @param {LogManager} logManager 로그 관리자 인스턴스
     * @param {DataExporter} dataExporter 데이터 내보내기 인스턴스
     * @param {MessageSender} messageSender 메시지 전송자 인스턴스
     * @param {ModbusASCIIParser} modbusASCIIParser Modbus ASCII 파서 인스턴스
     */
    constructor(serialManager, tcpManager = null, modbusRTUParser = null, modbusASCIIParser = null, modbusInterpreter = null, dataStorage = null, appState = null, logManager = null, dataExporter = null, messageSender = null) {
        this.serialManager = serialManager;
        this.tcpManager = tcpManager;
        this.messageSender = messageSender; // MessageSender 인스턴스 주입
        this.modbusRTUParser = modbusRTUParser; // ModbusRTUParser 인스턴스 저장
        this.modbusASCIIParser = modbusASCIIParser; // ModbusASCIIParser 인스턴스 저장
        this.modbusInterpreter = modbusInterpreter; // ModbusInterpreter 인스턴스 저장
        this.dataStorage = dataStorage;
        this.appState = appState;
        this.logManager = logManager;
        this.dataExporter = dataExporter;
        
        // 현재 선택된 Modbus 모드에 따라 적절한 파서 할당
        this.modbusParser = this.modbusRTUParser; // 기본값은 RTU 파서
        
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
            // packetTimeout: document.getElementById('packetTimeout'), // responseTimeout으로 대체됨

            // 새로운 연결 UI 요소들
            connectionType: document.getElementById('connectionType'),
            serialSettingsContainer: document.getElementById('serialSettingsContainer'),
            tcpSettingsContainer: document.getElementById('tcpSettingsContainer'),
            ipAddress: document.getElementById('ipAddress'),
            serverPort: document.getElementById('serverPort'),
            connectTimeoutTcp: document.getElementById('connectTimeoutTcp'),
            ipv4: document.getElementById('ipv4'),
            ipv6: document.getElementById('ipv6'),
            connectTcpBtn: document.getElementById('connectTcpBtn'),
            commonModbusSettingsContainer: document.getElementById('commonModbusSettingsContainer'),
            modbusRtuMode: document.getElementById('modbusRtuMode'),
            modbusAsciiMode: document.getElementById('modbusAsciiMode'),
            responseTimeout: document.getElementById('responseTimeout'), // 기존 packetTimeout 대체
            delayBetweenPolls: document.getElementById('delayBetweenPolls'),
            
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
        this.isInitialized = false;
        this.currentModbusMode = 'rtu'; // 기본값은 RTU 모드
    }
    
    setSerialManager(serialManager) {
        this.serialManager = serialManager;
        if (this.serialManager && this.isInitialized) { // init 이후에 설정될 경우 대비
            this.serialManager.onData(this.handleSerialData.bind(this));
            this.serialManager.onError(this.handleSerialError.bind(this));
        }
    }

    setTcpManager(tcpManager) {
        this.tcpManager = tcpManager;
        if (this.tcpManager && this.isInitialized) { // init 이후에 설정될 경우 대비
            this.tcpManager.onData(this.handleTcpData.bind(this));
            this.tcpManager.onError(this.handleTcpError.bind(this));
            this.tcpManager.onClose(this.handleTcpClose.bind(this));
        }
    }

    setMessageSender(messageSender) {
        this.messageSender = messageSender;
    }
    
    /**
     * UI 초기화 및 이벤트 리스너 설정
     */
    init() {
        this.isInitialized = true;
        
        // Web Serial API 지원 확인
        const isWebSerialSupported = 'serial' in navigator;
        
        // Web Serial API 지원여부에 따라 UI 조정
        if (!isWebSerialSupported) {
            // 지원하지 않는 브라우저일 경우 시리얼 옵션 비활성화
            this.elements.selectPortBtn.disabled = true;
            this.elements.openPortBtn.disabled = true;
            this.elements.connectionType.value = 'tcp';
            this.elements.serialSettingsContainer.style.display = 'none';
            this.elements.tcpSettingsContainer.style.display = 'block';
            this.updateConnectionStatus('Web Serial API가 지원되지 않는 브라우저입니다. Chrome/Edge/Opera 최신 버전을 사용해주세요.', true);
            
            // 시리얼 옵션 비활성화
            const serialOption = this.elements.connectionType.querySelector('option[value="serial"]');
            if (serialOption) {
                serialOption.disabled = true;
                serialOption.textContent += ' (지원되지 않는 브라우저)';
            }
        }
        
        // Connection Type 변경 이벤트 리스너
        if (this.elements.connectionType) {
            this.elements.connectionType.addEventListener('change', (event) => {
                const type = event.target.value;
                if (type === 'serial') {
                    this.elements.serialSettingsContainer.style.display = 'block';
                    this.elements.tcpSettingsContainer.style.display = 'none';
                    // 모드버스 공통 설정 표시
                    this.elements.commonModbusSettingsContainer.style.display = 'block';
                } else if (type === 'tcp') {
                    this.elements.serialSettingsContainer.style.display = 'none';
                    this.elements.tcpSettingsContainer.style.display = 'block';
                    // 모드버스 공통 설정 표시
                    this.elements.commonModbusSettingsContainer.style.display = 'block';
                }
                // 연결 설정 표시 업데이트
                this.updateConnectionSettingsSummary();
            });
        }

        // 시리얼 포트 선택 버튼
        this.elements.selectPortBtn.addEventListener('click', async () => {
            try {
                // Web Serial API 호환성 확인
                if (!this.serialManager.isWebSerialSupported) {
                    this.updateConnectionStatus('Web Serial API가 지원되지 않는 브라우저입니다.', true);
                    return;
                }
                
                // 포트 선택 중 상태 표시
                this.updateConnectionStatus('포트 선택 중...', false, true);
                this.elements.selectPortBtn.disabled = true;
                
                // 필터 옵션 준비 (선택적)
                // usbVendorId와 usbProductId를 지정하여 특정 장치 필터링을 할 수 있음
                const filters = null; // 필터링 필요 시 추가
                
                const selected = await this.serialManager.selectPort(filters);
                if (selected) {
                    this.elements.openPortBtn.disabled = false;
                    this.updateConnectionStatus('포트 선택됨. 연결 준비 완료.', false);
                    
                    // 포트 정보가 있으면 표시
                    if (this.serialManager.portInfo) {
                        const { usbVendorId, usbProductId } = this.serialManager.portInfo;
                        if (usbVendorId && usbProductId) {
                            console.log(`선택된 포트 정보: Vendor ID 0x${usbVendorId.toString(16).padStart(4, '0')}, Product ID 0x${usbProductId.toString(16).padStart(4, '0')}`);
                        }
                    }
                } else {
                    this.updateConnectionStatus('포트 선택이 취소되었습니다.', false);
                }
            } catch (error) {
                this.updateConnectionStatus(`포트 선택 오류: ${error.message}`, true);
            } finally {
                this.elements.selectPortBtn.disabled = false;
            }
        });
        
        // Modbus 모드 선택 이벤트 리스너 (RTU/ASCII)
        if (this.elements.modbusRtuMode && this.elements.modbusAsciiMode) {
            this.elements.modbusRtuMode.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.currentModbusMode = 'rtu';
                    this.modbusParser = this.modbusRTUParser; // RTU 모드 선택 시 RTU 파서 할당
                    console.log('Modbus RTU 모드 선택됨');
                }
            });
            
            this.elements.modbusAsciiMode.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.currentModbusMode = 'ascii';
                    this.modbusParser = this.modbusASCIIParser; // ASCII 모드 선택 시 ASCII 파서 할당
                    console.log('Modbus ASCII 모드 선택됨');
                }
            });
        }
        
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
                    console.log('시리얼 포트가 이미 열려 있습니다.');
                    // 연결 해제 중 상태 표시
                    this.updateConnectionStatus('연결 해제 중...', false, true);
                    this.elements.openPortBtn.disabled = true;
                    await this.disconnectPort();
                } else {
                    console.log('시리얼 포트가 닫혀 있습니다.')
                    // 연결 중 상태 표시
                    this.updateConnectionStatus('연결 중...', false, true);
                    this.elements.openPortBtn.disabled = true;
                    await this.connectPort();
                }
            } catch (error) {
                console.log(`연결 오류: ${error.message}`);
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
                this.updatePacketTimeouts(); // 초기 값으로 parser와 interpreter 업데이트
            });
        });
        
        // 응답 타임아웃 설정 변경 이벤트 처리 (기존 packetTimeout)
        if (this.elements.responseTimeout) {
            this.elements.responseTimeout.addEventListener('change', () => {
                this.updatePacketTimeouts();
            });
        }
        
        // 로그 지우기 버튼
        this.elements.clearBtn.addEventListener('click', () => this.logManager.clearLog());

        // 패킷 타임아웃 설정 변경 이벤트 처리
        if (this.elements.packetTimeout) {
            this.elements.packetTimeout.addEventListener('change', () => this.updatePacketTimeouts());
        }

        // 시리얼 연결 상태 변경 리스너
        this.serialManager.onConnectionChange((isConnected, message) => {
            this.updateConnectionUI(isConnected);
            this.updateConnectionStatus(message);
        });
        
        // 시리얼 데이터 수신 리스너
        this.serialManager.onDataReceived((data) => {
            const { binary, text, direction, timestamp } = data;
            console.log(`데이터 ${direction === 'tx' ? '송신' : '수신'}:`, binary, text);
            
            // Modbus 패킷 파싱 시도
            if (direction === 'rx') {
                const packets = this.modbusParser.parseData(binary, 'rx');
                packets.forEach(packet => {
                    console.log('RX Packet:', packet);
                    this.logManager.addPacketToLog(packet, 'RX');
                });
            } else if (direction === 'tx') {
                const packets = this.modbusParser.parseData(binary, 'tx');
                packets.forEach(packet => {
                    console.log('TX Packet', packet);
                    this.logManager.addPacketToLog(packet, 'TX');
                });
            }
        });
        
        // 패킷 타임아웃 설정 변경 이벤트 처리
        if (this.elements.packetTimeout) {
            this.elements.packetTimeout.addEventListener('change', () => this.updatePacketTimeouts());
        }

        // 시리얼 오류 리스너
        this.serialManager.onError((error) => {
            this.updateConnectionStatus(`오류: ${error.message}`, true);
        });
        
        // 초기 UI 상태 설정
        this.updateConnectionUI(false);
        this.updatePacketTimeouts(); // 초기 값으로 parser와 interpreter 업데이트
        
        // TCP/IP 연결 버튼 이벤트 리스너
        if (this.elements.connectTcpBtn) {
            this.elements.connectTcpBtn.addEventListener('click', async () => {
                // TODO: 현재 TCP 연결 상태 확인 로직 필요 (예: this.tcpManager.isConnected())
                const isTcpConnected = false; // 임시 값
                if (isTcpConnected) {
                    await this.disconnectTcpIp();
                } else {
                    await this.connectTcpIp();
                }
            });
        }
    }
    
    /**
     * 시리얼 포트 연결
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async connectPort() {
        try {
            // Web Serial API 호환성 확인
            if (!this.serialManager.isWebSerialSupported) {
                this.updateConnectionStatus('Web Serial API가 지원되지 않는 브라우저입니다.', true);
                return false;
            }
            
            // 포트가 선택되었는지 확인
            if (!this.serialManager.port) {
                this.updateConnectionStatus('포트가 선택되지 않았습니다. 먼저 포트를 선택해주세요.', true);
                return false;
            }
            
            // 이미 연결되어 있는지 확인
            if (this.serialManager.isConnected()) {
                this.updateConnectionStatus('이미 연결되어 있습니다.', true);
                return false;
            }
            
            // 연결 설정 가져오기
            const options = {
                baudRate: parseInt(this.elements.baudRate.value, 10),
                dataBits: parseInt(this.elements.dataBits.value, 10),
                stopBits: parseInt(this.elements.stopBits.value, 10),
                parity: this.elements.parity.value,
                flowControl: this.elements.flowControl.value,
                bufferSize: parseInt(this.elements.buffer.value, 10)
            };
            
            // 공통 Modbus 설정 읽기
            const modbusMode = this.elements.modbusRtuMode && this.elements.modbusRtuMode.checked ? 'rtu' : 'ascii';
            const delayBetweenPolls = this.elements.delayBetweenPolls ? parseInt(this.elements.delayBetweenPolls.value, 10) : 1000;
            const responseTimeout = this.elements.responseTimeout ? parseInt(this.elements.responseTimeout.value, 10) : 1000;
            
            console.log(`Serial Connect - Modbus Mode: ${modbusMode}, Response Timeout: ${responseTimeout}ms, Delay: ${delayBetweenPolls}ms`);
            
            // Modbus 통신 설정 적용
            if (this.modbusRTUParser && this.modbusASCIIParser) {
                // 모드 값에 따라 적절한 파서 선택
                if (modbusMode === 'ascii') {
                    this.currentModbusMode = 'ascii';
                    this.modbusParser = this.modbusASCIIParser;
                    this.elements.modbusAsciiMode.checked = true;
                    this.elements.modbusRtuMode.checked = false;
                    console.log('Modbus ASCII 모드로 설정됨');
                } else {
                    this.currentModbusMode = 'rtu';
                    this.modbusParser = this.modbusRTUParser;
                    this.elements.modbusRtuMode.checked = true;
                    this.elements.modbusAsciiMode.checked = false;
                    console.log('Modbus RTU 모드로 설정됨');
                }
                
                // 파서 설정 적용
            }
            
            console.log(`!!!!Serial Connect - Options: ${JSON.stringify(options)}`);

            // 연결 시도 전 상태 표시
            this.updateConnectionStatus('연결 시도 중...', false, true);

            // 연결 시도
            const connected = await this.serialManager.connect(options);
            
            if (connected) {
                // 연결 성공 시 UI 업데이트
                this.elements.openPortBtn.textContent = '닫기';
                this.elements.openPortBtn.classList.replace('btn-success', 'btn-danger');
                
                // 패킷 타임아웃 설정 적용
                this.updatePacketTimeouts();
                
                // 연결 상태 표시
                this.updateConnectionStatus(`연결됨: ${options.baudRate} baud, ${options.dataBits}${options.parity.charAt(0).toUpperCase()}${options.stopBits}`, false);
                
                // 연결 설정 요소 비활성화
                this.updateConnectionUI(true);
                
                // 연결 설정 요약 업데이트
                this.updateConnectionSettingsSummary();
                
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
            // 연결 상태 확인
            if (!this.serialManager || !this.serialManager.isConnected()) {
                this.updateConnectionStatus('연결되지 않은 상태입니다.', true);
                // UI를 연결 해제 상태로 맞추기
                this.elements.openPortBtn.textContent = '열기';
                this.elements.openPortBtn.classList.replace('btn-danger', 'btn-success');
                this.updateConnectionUI(false);
                return false;
            }
            
            // 연결 해제 시도 전 상태 표시
            this.updateConnectionStatus('연결 해제 중...', false, true);
            
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
                
                // 연결 설정 요약 업데이트
                this.updateConnectionSettingsSummary();
                
                return true;
            } else {
                this.updateConnectionStatus('연결 해제 실패', true);
                return false;
            }
        } catch (error) {
            this.updateConnectionStatus(`연결 해제 오류: ${error.message}`, true);
            
            // 오류 발생 시 UI 초기화 시도
            try {
                this.elements.openPortBtn.textContent = '열기';
                this.elements.openPortBtn.classList.replace('btn-danger', 'btn-success');
                this.updateConnectionUI(false);
                this.stopLoopSend();
            } catch (uiError) {
                console.error('UI 초기화 오류:', uiError);
            }
            
            return false;
        }
    }

    /**
     * TCP/IP 연결
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async connectTcpIp() {
        if (!this.tcpManager) {
            this.updateConnectionStatus('TCP Manager가 초기화되지 않았습니다.', true);
            return false;
        }
        this.updateConnectionStatus('TCP/IP 연결 시도 중...', false);
        this.elements.connectTcpBtn.disabled = true;

        const options = {
            ipAddress: this.elements.ipAddress.value,
            port: parseInt(this.elements.serverPort.value, 10),
            connectTimeout: parseInt(this.elements.connectTimeoutTcp.value, 10),
            ipVersion: this.elements.ipv4.checked ? 'ipv4' : 'ipv6',
            modbusMode: this.elements.modbusRtuMode && this.elements.modbusRtuMode.checked ? 'rtu' : 'ascii',
            delayBetweenPolls: this.elements.delayBetweenPolls ? parseInt(this.elements.delayBetweenPolls.value, 10) : 1000
        };
        // responseTimeout은 MessageSender 또는 ModbusParser/Interpreter에서 직접 사용

        if (!options.ipAddress || isNaN(options.port) || options.port <= 0 || isNaN(options.connectTimeout)) {
            this.updateConnectionStatus('TCP/IP 설정 오류: IP 주소, 포트, 연결 타임아웃을 확인하세요.', true);
            this.elements.connectTcpBtn.disabled = false;
            return false;
        }

        const connected = await this.tcpManager.connect(options);
        this.updateConnectionUI(connected);
        if (connected) {
            this.elements.connectTcpBtn.textContent = 'Disconnect TCP/IP';
            this.elements.connectTcpBtn.classList.replace('btn-success', 'btn-danger');
        } else {
            // 연결 실패 시 TcpManager의 onError 또는 onClose에서 상태 메시지 업데이트
            // updateConnectionUI(false)는 TcpManager의 콜백에서 호출될 수 있음
        }
        this.elements.connectTcpBtn.disabled = false; // 연결 시도 후 버튼 항상 활성화
        return connected;
    }

    /**
     * TCP/IP 연결 해제
     * @returns {Promise<boolean>} 연결 해제 성공 여부
     */
    async disconnectTcpIp() {
        if (!this.tcpManager) {
            this.updateConnectionStatus('TCP Manager가 초기화되지 않았습니다.', true);
            return false;
        }
        this.updateConnectionStatus('TCP/IP 연결 해제 중...', false);
        this.tcpManager.disconnect();
        // 실제 상태 업데이트는 TcpManager의 onClose 콜백에서 처리됩니다.
        // this.updateConnectionUI(false); // onClose에서 호출될 것
        this.elements.connectTcpBtn.textContent = 'Connect TCP/IP';
        this.elements.connectTcpBtn.classList.replace('btn-danger', 'btn-success');
        this.elements.connectTcpBtn.disabled = false;
        return true; // 비동기 작업이 아니므로 즉시 반환 (실제 해제는 비동기일 수 있음)
    }

    handleSerialData(data) {
        const { binaryData, textData, direction, timestamp } = data;
        console.log(`데이터 ${direction === 'tx' ? '송신' : '수신'}:`, binaryData, textData);
        
        // Modbus 패킷 파싱 시도
        if (direction === 'rx') {
            const packets = this.modbusParser.parseData(binaryData, 'rx');
            packets.forEach(packet => {
                console.log('RX Packet:', packet);
                this.logManager.addPacketToLog(packet, 'RX');
            });
        } else if (direction === 'tx') {
            const packets = this.modbusParser.parseData(binaryData, 'tx');
            packets.forEach(packet => {
                console.log('TX Packet', packet);
                this.logManager.addPacketToLog(packet, 'TX');
            });
        }
    }

    handleSerialError(error) {
        console.error('UIController: Serial Error:', error);
        this.updateConnectionStatus(`시리얼 오류: ${error.message}`, true);
        this.updateConnectionUI(false); // 오류 발생 시 UI 업데이트
    }

    handleTcpData(data) {
        // console.log('UIController: TCP Data Received:', data);
        if (this.modbusInterpreter) {
            this.modbusInterpreter.parseResponse(data);
        }
    }

    handleTcpError(error) {
        console.error('UIController: TCP Error:', error);
        // TcpManager 내부에서 이미 updateConnectionStatus를 호출할 수 있으므로, 여기서는 중복 호출을 피하거나 추가 정보만 로깅
        // this.updateConnectionStatus(`TCP 오류: ${error.message}`, true);
        this.updateConnectionUI(false); // 오류 발생 시 UI 업데이트
    }

    handleTcpClose(wasClean) {
        console.log(`UIController: TCP connection closed. Was clean: ${wasClean}`);
        // TcpManager 내부에서 이미 updateConnectionStatus를 호출할 수 있으므로, 여기서는 중복 호출을 피하거나 추가 정보만 로깅
        // if (!wasClean) {
        //     this.updateConnectionStatus('TCP 연결이 비정상적으로 종료되었습니다.', true);
        // }
        this.updateConnectionUI(false); // 연결 종료 시 UI 업데이트
        this.elements.connectTcpBtn.textContent = 'Connect TCP/IP';
        this.elements.connectTcpBtn.classList.replace('btn-danger', 'btn-success');
        this.elements.connectTcpBtn.disabled = false;
    }
    
    /**
     * 패킷 타임아웃 UI 요소의 값에 따라 ModbusParser와 ModbusInterpreter의 타임아웃 값을 업데이트합니다.
     */
    updatePacketTimeouts() {
        if (!this.elements.responseTimeout) return;

        const timeoutValue = parseInt(this.elements.responseTimeout.value, 10);
        if (isNaN(timeoutValue) || timeoutValue <= 0) {
            console.error("UIController: Invalid response timeout value:", this.elements.responseTimeout.value);
            // 유효하지 않은 경우, UI 값을 이전 유효 값으로 되돌리거나 기본값을 설정할 수 있습니다.
            // 예: if (this.modbusParser && this.modbusParser.rxPacketTimeoutMs) this.elements.responseTimeout.value = this.modbusParser.rxPacketTimeoutMs;
            return;
        }

        if (this.modbusRTUParser && this.modbusASCIIParser) {
            // 두 파서 모두 타임아웃 값 업데이트
            this.modbusRTUParser.rxPacketTimeoutMs = timeoutValue;
            this.modbusRTUParser.txPacketTimeoutMs = timeoutValue;
            this.modbusASCIIParser.rxPacketTimeoutMs = timeoutValue;
            this.modbusASCIIParser.txPacketTimeoutMs = timeoutValue;
            // console.log(`UIController: ModbusParser timeouts updated to ${timeoutValue}ms`);
        }
        if (this.modbusInterpreter) {
            this.modbusInterpreter.packetTimeoutMs = timeoutValue;
            // console.log(`UIController: ModbusInterpreter timeout updated to ${timeoutValue}ms`);
        }
    }
    
    /**
     * 메시지 전송
     */
    async sendMessage() {
        if (this.messageSender) {
            return await this.messageSender.sendMessage();
        } else {
            console.error('MessageSender not initialized in UIController');
            // MessageSender가 없는 경우의 폴백 로직 (또는 오류 명시)
            this.updateConnectionStatus('오류: 메시지 전송 기능이 초기화되지 않았습니다.', true);
            return false;
        }
    }
    
    /**
     * 루프 전송 시작
     */
    startLoopSend() {
        if (this.messageSender) {
            this.messageSender.startLoopSend();
        } else {
            console.error('MessageSender not initialized in UIController');
            this.updateConnectionStatus('오류: 루프 전송 기능이 초기화되지 않았습니다.', true);
        }
    }
    
    /**
     * 루프 전송 중지
     */
    stopLoopSend() {
        if (this.messageSender) {
            this.messageSender.stopLoopSend();
        } else {
            console.error('MessageSender not initialized in UIController');
            this.updateConnectionStatus('오류: 루프 전송 중지 기능이 초기화되지 않았습니다.', true);
        }
    }
    
    /**
     * 연결 상태 UI 업데이트
     * @param {boolean} isConnected 연결 상태
     */
    updateConnectionUI(isConnected) {
        const connectionType = this.elements.connectionType ? this.elements.connectionType.value : 'serial';

        // 기본적으로 모든 설정 UI를 숨김 처리하고 시작
        if (this.elements.serialSettingsContainer) this.elements.serialSettingsContainer.style.display = 'none';
        if (this.elements.tcpSettingsContainer) this.elements.tcpSettingsContainer.style.display = 'none';

        if (connectionType === 'serial') {
            if (this.elements.serialSettingsContainer) this.elements.serialSettingsContainer.style.display = 'block';
            this.disableSerialUI(isConnected);
            this.disableTcpUI(true); // TCP 설정은 항상 비활성화 및 숨김
            if (this.elements.tcpSettingsContainer) this.elements.tcpSettingsContainer.style.display = 'none';
            if (this.elements.openPortBtn) this.elements.openPortBtn.disabled = false; // 시리얼 연결 버튼은 연결 시도 후 항상 활성화
            if (this.elements.connectTcpBtn) this.elements.connectTcpBtn.disabled = true; // TCP 연결 버튼은 비활성화

        } else if (connectionType === 'tcp') {
            if (this.elements.tcpSettingsContainer) this.elements.tcpSettingsContainer.style.display = 'block';
            this.disableTcpUI(isConnected);
            this.disableSerialUI(true); // 시리얼 설정은 항상 비활성화 및 숨김
            if (this.elements.serialSettingsContainer) this.elements.serialSettingsContainer.style.display = 'none';
            if (this.elements.connectTcpBtn) this.elements.connectTcpBtn.disabled = false; // TCP 연결 버튼은 연결 시도 후 항상 활성화
            if (this.elements.openPortBtn) this.elements.openPortBtn.disabled = true; // 시리얼 연결 버튼은 비활성화
            if (this.elements.selectPortBtn) this.elements.selectPortBtn.disabled = true; // 시리얼 포트 선택 버튼 비활성화
        }

        // 공통 Modbus 설정 UI
        if (this.elements.modbusRtuMode) this.elements.modbusRtuMode.disabled = isConnected;
        if (this.elements.modbusAsciiMode) this.elements.modbusAsciiMode.disabled = isConnected;
        // responseTimeout, delayBetweenPolls는 연결 상태와 관계없이 현재는 활성화 상태 유지
        // if (this.elements.responseTimeout) this.elements.responseTimeout.disabled = isConnected;
        // if (this.elements.delayBetweenPolls) this.elements.delayBetweenPolls.disabled = isConnected;

        // 연결 유형 선택 드롭다운은 연결 중에는 비활성화
        if (this.elements.connectionType) this.elements.connectionType.disabled = isConnected;
    }

    disableSerialUI(disable) {
        if (this.elements.baudRate) this.elements.baudRate.disabled = disable;
        if (this.elements.dataBits) this.elements.dataBits.disabled = disable;
        if (this.elements.stopBits) this.elements.stopBits.disabled = disable;
        if (this.elements.parity) this.elements.parity.disabled = disable;
        if (this.elements.flowControl) this.elements.flowControl.disabled = disable;
        if (this.elements.buffer) this.elements.buffer.disabled = disable;
        if (this.elements.selectPortBtn) this.elements.selectPortBtn.disabled = disable;
        // openPortBtn의 disabled 상태는 updateConnectionUI에서 직접 관리
    }

    disableTcpUI(disable) {
        if (this.elements.ipAddress) this.elements.ipAddress.disabled = disable;
        if (this.elements.serverPort) this.elements.serverPort.disabled = disable;
        if (this.elements.connectTimeoutTcp) this.elements.connectTimeoutTcp.disabled = disable;
        if (this.elements.ipv4) this.elements.ipv4.disabled = disable;
        if (this.elements.ipv6) this.elements.ipv6.disabled = disable;
        // connectTcpBtn의 disabled 상태는 updateConnectionUI에서 직접 관리
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
            this.elements.connectionStatus.innerHTML = `<span class="spinner-border spinner-border-sm text-warning me-2" role="status" aria-hidden="true"></span>${message}`;
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
                // 대기 중 - 노란색
                this.elements.connectionIndicator.style.backgroundColor = '#ffc107';
            }
        }
    }
    
    /**
     * 연결 설정 요약 정보 업데이트
     */
    updateConnectionSettingsSummary() {
        const connectionType = this.elements.connectionType ? this.elements.connectionType.value : 'serial';
        
        // 요약 정보를 표시할 요소 확인
        const summaryElement = this.elements.connectionSettingsSummary;
        if (!summaryElement) return;
        
        let summaryText = '';
        
        if (connectionType === 'serial') {
            // 시리얼 연결 설정 요약
            const baudRate = this.elements.baudRate ? this.elements.baudRate.value : '9600';
            const dataBits = this.elements.dataBits ? this.elements.dataBits.value : '8';
            const stopBits = this.elements.stopBits ? this.elements.stopBits.value : '1';
            const parity = this.elements.parity ? this.elements.parity.value : 'none';
            const flowControl = this.elements.flowControl ? this.elements.flowControl.value : 'none';
            
            // 모드버스 설정
            const modbusMode = this.elements.modbusRtuMode && this.elements.modbusRtuMode.checked ? 'RTU' : 'ASCII';
            
            summaryText = `시리얼: ${baudRate} baud, ${dataBits}${parity.charAt(0).toUpperCase()}${stopBits}, 흐름제어: ${flowControl}, 모드버스: ${modbusMode}`;
            
            // 연결 상태 추가
            if (this.serialManager && this.serialManager.isConnected()) {
                const portInfo = this.serialManager.portInfo;
                if (portInfo && portInfo.usbVendorId && portInfo.usbProductId) {
                    summaryText += ` | VID: 0x${portInfo.usbVendorId.toString(16).padStart(4, '0')}, PID: 0x${portInfo.usbProductId.toString(16).padStart(4, '0')}`;
                }
                
                // 수신/송신 바이트 수 표시
                if (this.appState) {
                    const rxBytes = this.appState.get('connection.rxBytes') || 0;
                    const txBytes = this.appState.get('connection.txBytes') || 0;
                    summaryText += ` | RX: ${rxBytes} bytes, TX: ${txBytes} bytes`;
                }
            }
        } else if (connectionType === 'tcp') {
            // TCP/IP 연결 설정 요약
            const host = this.elements.tcpHost ? this.elements.tcpHost.value : 'localhost';
            const port = this.elements.tcpPort ? this.elements.tcpPort.value : '502';
            
            summaryText = `TCP/IP: ${host}:${port}`;
            
            // 연결 상태 추가
            if (this.tcpManager && this.tcpManager.isConnected) {
                const isConnected = this.tcpManager.isConnected();
                summaryText += isConnected ? ' | 연결됨' : ' | 연결 안됨';
                
                // 수신/송신 바이트 수 표시
                if (isConnected && this.appState) {
                    const rxBytes = this.appState.get('connection.rxBytes') || 0;
                    const txBytes = this.appState.get('connection.txBytes') || 0;
                    summaryText += ` | RX: ${rxBytes} bytes, TX: ${txBytes} bytes`;
                }
            } else {
                summaryText += ' | 연결 안됨';
            }
        }
        
        // 요약 정보 표시
        summaryElement.textContent = summaryText;
        
        // 애플리케이션 상태 업데이트
        if (this.appState) {
            this.appState.update('connection.settings', {
                type: connectionType,
                summary: summaryText,
                timestamp: Date.now()
            });
        }
        
        // 연결되지 않은 상태에서 상태바에 설정 정보 표시
        if (this.serialManager && !this.serialManager.isConnected()) {
            this.updateConnectionStatus(`설정: ${summaryText}`, false);
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
    
    /**
     * 현재 선택된 연결 타입을 반환합니다.
     * @returns {string} 연결 타입 ('serial' 또는 'tcp')
     */
    getConnectionType() {
        // connectionType 요소의 값에 따라 연결 타입 반환
        // Modbus RTU(Serial)의 경우 'serial', Modbus TCP/IP의 경우 'tcp'
        return this.elements.connectionType.value === 'serial' ? 'serial' : 'tcp';
    }
}
