/**
 * MessageSender.js
 * 사용자 정의 Modbus 메시지 전송 기능을 제공하는 모듈
 */
export class MessageSender {
    /**
     * MessageSender 생성자
     * @param {UIController} uiController UI 컨트롤러 인스턴스
     * @param {SerialManager} serialManager 시리얼 관리자 인스턴스
     * @param {TcpManager} tcpManager TCP 관리자 인스턴스
     * @param {ModbusParser} modbusParser Modbus RTU 파서 인스턴스
     * @param {ModbusInterpreter} modbusInterpreter Modbus 인터프리터 인스턴스
     * @param {ModbusASCIIParser} modbusASCIIParser Modbus ASCII 파서 인스턴스
     * @param {Object} options 옵션 객체 (주로 UI 요소 ID 포함)
     */
    constructor(uiController, serialManager, tcpManager, modbusParser, modbusInterpreter, modbusASCIIParser, options = {}) {
        this.uiController = uiController; // UIController 인스턴스 저장
        this.serialManager = serialManager;
        this.tcpManager = tcpManager; // TcpManager 인스턴스 저장
        this.modbusParser = modbusParser;
        this.modbusASCIIParser = modbusASCIIParser;
        this.modbusInterpreter = modbusInterpreter;
        this.loopInterval = null;
        this.isLooping = false;
        this.transactionId = 0; // Modbus TCP 트랜잭션 ID
        
        // DOM 요소 캐싱
        this.elements = {
            messageInput: options.messageInputElement || document.getElementById('messageInput'),
            sendBtn: options.sendButton || document.getElementById('sendBtn'),
            hexSend: options.hexCheckbox || document.getElementById('hexSend'),
            appendCRLF: options.crlfCheckbox || document.getElementById('appendCRLF'),
            loopSend: options.loopCheckbox || document.getElementById('loopSend'),
            sendInterval: options.intervalInput || document.getElementById('sendInterval'),
            messageStatus: options.statusElement || document.getElementById('messageStatus'),
            quickSendBtn: options.quickSendButton || document.getElementById('quickSendBtn'),
            quickSendList: document.getElementById('quickSendList')
        };
        
        // 빠른 전송 메시지 목록
        this.quickSendMessages = [
            { name: 'Modbus RTU 레지스터 읽기 (FC 03)', value: '01 03 00 00 00 0A C5 CD' },
            { name: 'Modbus RTU 코일 읽기 (FC 01)', value: '01 01 00 00 00 08 3D CC' },
            { name: 'Modbus RTU 레지스터 쓰기 (FC 06)', value: '01 06 00 01 00 03 19 CA' },
            { name: 'Modbus RTU 진단 (FC 08)', value: '01 08 00 00 00 00 A1 88' },
            { name: 'Modbus ASCII 레지스터 읽기 (FC 03)', value: ':010300000A44\r\n' },
            { name: 'Modbus ASCII 코일 읽기 (FC 01)', value: ':01010000087E\r\n' },
            { name: 'Modbus ASCII 레지스터 쓰기 (FC 06)', value: ':01060001000396\r\n' },
            { name: 'Modbus ASCII 진단 (FC 08)', value: ':0108000000F7\r\n' }
        ];
    }
    
    /**
     * 이벤트 리스너 초기화
     * @private
     */
    _initEventListeners() {
        // 전송 버튼 클릭 이벤트
        this.elements.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });
        
        // 메시지 입력 영역 키보드 이벤트
        this.elements.messageInput.addEventListener('keydown', (e) => {
            // Ctrl+Enter 또는 Shift+Enter로 전송
            if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
                e.preventDefault();
                this.sendMessage();
            }
            
            // 16진수 모드일 때 유효한 문자만 입력 허용
            if (this.elements.hexSend.checked) {
                // 허용된 키: 0-9, A-F, a-f, 백스페이스, 화살표, 스페이스, 탭, 삭제, 복사/붙여넣기 관련 키
                const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 
                                    'a', 'b', 'c', 'd', 'e', 'f', 
                                    'A', 'B', 'C', 'D', 'E', 'F',
                                    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 
                                    'ArrowUp', 'ArrowDown', 'Tab', ' '];
                                    
                const isCtrlKey = e.ctrlKey || e.metaKey; // Ctrl 또는 Command(Mac)
                const isAllowedCtrlKey = isCtrlKey && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase());
                
                if (!allowedKeys.includes(e.key) && !isAllowedCtrlKey) {
                    e.preventDefault();
                    this._showStatus('16진수 모드에서는 0-9, A-F만 입력 가능합니다.', 'warning');
                }
            }
        });
        
        // 16진수 전송 모드 변경 이벤트
        this.elements.hexSend.addEventListener('change', (e) => {
            const isHexMode = e.target.checked;
            
            // 16진수 모드로 전환 시 현재 입력값 검증
            if (isHexMode && this.elements.messageInput.value.trim()) {
                if (!this._validateHexInput(this.elements.messageInput.value)) {
                    this._showStatus('현재 입력값이 유효한 16진수 형식이 아닙니다. 입력값을 수정해주세요.', 'error');
                }
            }
            
            // 입력 필드 플레이스홀더 변경
            this.elements.messageInput.placeholder = isHexMode ? 
                '16진수 데이터 입력 (예: 01 03 00 00 00 0A C5 CD)' : 
                '전송할 메시지 입력';
                
            // 입력 필드 스타일 변경
            if (isHexMode) {
                this.elements.messageInput.classList.add('hex-input');
            } else {
                this.elements.messageInput.classList.remove('hex-input');
            }
        });
        
        // 루프 전송 체크박스 이벤트
        this.elements.loopSend.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startLoopSend();
            } else {
                this.stopLoopSend();
            }
        });
        
        // 전송 간격 입력 이벤트
        this.elements.sendInterval.addEventListener('change', () => {
            // 루프 전송 중이면 재시작
            if (this.isLooping) {
                this.stopLoopSend();
                this.startLoopSend();
            }
        });
    }
    
    /**
     * 빠른 전송 메뉴 초기화
     * @private
     */
    _initQuickSendMenu() {
        // 저장된 메시지 불러오기
        this._loadQuickSendMessages();
        
        // 드롭다운 메뉴 생성
        this._updateQuickSendMenu();
        
        // 빠른 전송 버튼 클릭 이벤트 - Bootstrap 드롭다운 활용
        this.elements.quickSendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Bootstrap의 드롭다운 토글 기능 사용
            const dropdownList = this.elements.quickSendList;
            if (dropdownList.classList.contains('show')) {
                dropdownList.classList.remove('show');
            } else {
                dropdownList.classList.add('show');
                // 드롭다운 위치 조정
                const buttonRect = this.elements.quickSendBtn.getBoundingClientRect();
                dropdownList.style.position = 'absolute';
                dropdownList.style.inset = '0px auto auto 0px';
                dropdownList.style.transform = `translate3d(${buttonRect.left}px, ${buttonRect.bottom}px, 0px)`;
            }
        });
        
        // 외부 클릭 시 드롭다운 닫기
        document.addEventListener('click', (e) => {
            if (!this.elements.quickSendList.contains(e.target) && 
                e.target !== this.elements.quickSendBtn) {
                this.elements.quickSendList.classList.remove('show');
            }
        });
    }
    
    /**
     * 빠른 전송 메뉴 업데이트
     * @private
     */
    _updateQuickSendMenu() {
        const dropdownList = this.elements.quickSendList;
        
        // 기존 메뉴 항목 제거
        dropdownList.innerHTML = '';
        
        // 메뉴 항목 추가
        this.quickSendMessages.forEach((msg, index) => {
            const item = document.createElement('a');
            item.className = 'dropdown-item';
            item.href = '#';
            item.textContent = msg.name;
            item.dataset.index = index;
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.elements.messageInput.value = msg.value;
                this.elements.hexSend.checked = true;
                // 16진수 모드 변경 이벤트 수동 발생
                this.elements.hexSend.dispatchEvent(new Event('change'));
                this.elements.quickSendList.classList.remove('show');
            });
            
            dropdownList.appendChild(item);
        });
        
        // 구분선 추가
        const divider = document.createElement('div');
        divider.className = 'dropdown-divider';
        dropdownList.appendChild(divider);
        
        // 현재 메시지 저장 옵션
        const saveItem = document.createElement('a');
        saveItem.className = 'dropdown-item';
        saveItem.href = '#';
        saveItem.textContent = '현재 메시지 저장';
        saveItem.addEventListener('click', (e) => {
            e.preventDefault();
            this._saveCurrentMessage();
            this.elements.quickSendList.classList.remove('show');
        });
        dropdownList.appendChild(saveItem);
    }
    
    /**
     * 현재 메시지를 빠른 전송 목록에 저장
     * @private
     */
    _saveCurrentMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message) {
            this._showStatus('저장할 메시지가 없습니다.', 'warning');
            return;
        }
        
        // 이름 입력 대화상자 표시
        const name = prompt('저장할 메시지 이름을 입력하세요:', '사용자 정의 메시지');
        if (!name) return;
        
        // 메시지 저장
        this.quickSendMessages.push({
            name: name,
            value: message
        });
        
        this._showStatus(`'${name}' 메시지가 저장되었습니다.`, 'success');
        
        // 로컬 스토리지에 저장
        this._saveQuickSendMessages();
        
        // 메뉴 업데이트
        this._updateQuickSendMenu();
    }
    
    /**
     * 빠른 전송 메시지 목록을 로컬 스토리지에 저장
     * @private
     */
    _saveQuickSendMessages() {
        try {
            localStorage.setItem('quickSendMessages', JSON.stringify(this.quickSendMessages));
        } catch (error) {
            console.error('빠른 전송 메시지 저장 오류:', error);
        }
    }
    
    /**
     * 로컬 스토리지에서 빠른 전송 메시지 목록 로드
     * @private
     */
    _loadQuickSendMessages() {
        try {
            const saved = localStorage.getItem('quickSendMessages');
            if (saved) {
                this.quickSendMessages = JSON.parse(saved);
            }
        } catch (error) {
            console.error('빠른 전송 메시지 로드 오류:', error);
            this._showStatus('빠른 전송 메시지 로드 중 오류 발생', 'error');
        }
    }
        
    /**
     * 메시지 전송
     * @returns {Promise<boolean>} 전송 성공 여부
     */
    async sendMessage() {
        const connectionType = this.uiController.getConnectionType();
        let isConnected = false;

        if (connectionType === 'serial') {
            isConnected = this.serialManager && this.serialManager.isConnected();
        } else if (connectionType === 'tcp') {
            isConnected = this.tcpManager && this.tcpManager.isConnected();
        }

        if (!isConnected) {
            this._showStatus(`${connectionType === 'serial' ? '시리얼 포트가' : 'TCP/IP가'} 연결되지 않았습니다.`, 'error');
            return false;
        }

        const message = this.elements.messageInput.value.trim();
        if (!message) {
            this._showStatus('전송할 메시지를 입력하세요.', 'warning');
            return false;
        }

        const isHex = this.elements.hexSend.checked;
        const appendCRLF = this.elements.appendCRLF.checked; // 시리얼 전용 옵션으로 남겨둘 수 있음

        if (isHex && !this._validateHexInput(message)) {
            this._showStatus('유효하지 않은 16진수 형식입니다. 올바른 형식으로 입력하세요.', 'error');
            return false;
        }

        let dataToSend;
        if (isHex) {
            dataToSend = this._hexStringToBytes(message);
        } else {
            dataToSend = message;
            if (connectionType === 'serial' && appendCRLF) {
                dataToSend += '\r\n';
            }
        }

        try {
            let success = false;
            if (connectionType === 'serial') {
                // SerialManager의 sendData는 문자열, 16진수 여부, CRLF 추가 여부를 인자로 받음
                success = await this.serialManager.sendData(message, isHex, appendCRLF); 
            } else if (connectionType === 'tcp') {
                // TcpManager의 sendMessage는 Uint8Array 또는 문자열을 직접 받음 (구현에 따라 다름)
                // 여기서는 TcpManager가 Uint8Array를 기대한다고 가정 (hex 모드에서 변환된 데이터)
                // 또는 문자열을 보내고 TcpManager 내부에서 변환할 수도 있음.
                // 현재 TcpManager.sendMessage는 ArrayBuffer를 받으므로 변환 필요
                // Modbus TCP 프레이밍
                // 사용자 입력은 UnitID + PDU (Hex 문자열)로 가정
                // dataToSend는 _hexStringToBytes를 통해 Uint8Array로 변환된 상태 (UnitID + PDU)
                if (dataToSend.length < 1) {
                    this._showStatus('TCP 모드에서는 Unit ID를 포함한 PDU를 입력해야 합니다.', 'error');
                    return false;
                }

                const unitId = dataToSend[0];
                const pdu = dataToSend.slice(1);

                const mbapHeader = new Uint8Array(7);
                const view = new DataView(mbapHeader.buffer);

                // Transaction ID (2 bytes)
                view.setUint16(0, this.transactionId, false); // Big-endian
                this.transactionId = (this.transactionId + 1) % 0xFFFF; // 롤오버

                // Protocol ID (2 bytes) - 0x0000 for Modbus
                view.setUint16(2, 0x0000, false);

                // Length (2 bytes) - Unit ID (1) + PDU length
                view.setUint16(4, 1 + pdu.length, false);

                // Unit ID (1 byte)
                view.setUint8(6, unitId);

                // ADU = MBAP Header + PDU
                const adu = new Uint8Array(mbapHeader.length + pdu.length);
                adu.set(mbapHeader, 0);
                adu.set(pdu, mbapHeader.length);

                success = this.tcpManager.sendMessage(adu.buffer); // TcpManager는 ArrayBuffer를 받음
            }

            if (success) {
                this._showStatus('메시지 전송 완료', 'success');
                if (!this.isLooping) {
                    this._addToHistory(message); // 원본 메시지 저장
                    // this.elements.messageInput.value = ''; // 필요시 주석 해제
                    this.elements.messageInput.focus();
                }
                return true;
            } else {
                this._showStatus(`메시지 전송 실패 (${connectionType})`, 'error');
                return false;
            }
        } catch (error) {
            console.error('메시지 전송 오류:', error);
            this._showStatus(`전송 오류: ${error.message}`, 'error');
            return false;
        }
    }
    
    /**
     * 루프 전송 시작
     */
    startLoopSend() {
        const connectionType = this.uiController.getConnectionType();
        let isConnected = false;
        if (connectionType === 'serial') {
            isConnected = this.serialManager && this.serialManager.isConnected();
        } else if (connectionType === 'tcp') {
            isConnected = this.tcpManager && this.tcpManager.isConnected();
        }

        if (!isConnected) {
            this._showStatus(`먼저 ${connectionType === 'serial' ? '시리얼 포트에' : 'TCP/IP에'} 연결하세요.`, 'error');
            this.elements.loopSend.checked = false;
            return;
        }
        
        const message = this.elements.messageInput.value.trim();
        if (!message) {
            this._showStatus('전송할 메시지를 입력하세요.', 'warning');
            this.elements.loopSend.checked = false;
            return;
        }
        
        // 16진수 모드일 때 입력값 검증
        const isHex = this.elements.hexSend.checked;
        if (isHex && !this._validateHexInput(message)) {
            this._showStatus('유효하지 않은 16진수 형식입니다. 올바른 형식으로 입력하세요.', 'error');
            this.elements.loopSend.checked = false;
            return;
        }
        
        // 기존 루프 중지
        this.stopLoopSend();
        
        // 전송 간격 설정
        const interval = parseInt(this.elements.sendInterval.value, 10);
        if (isNaN(interval) || interval < 100) {
            this._showStatus('전송 간격은 최소 100ms 이상이어야 합니다.', 'warning');
            this.elements.sendInterval.value = '100';
        }
        
        // 루프 시작
        this.isLooping = true;
        this._showStatus(`${interval}ms 간격으로 루프 전송 시작`, 'info');
        
        // 입력 필드 비활성화
        this.elements.messageInput.readOnly = true;
        this.elements.sendInterval.disabled = true;
        this.elements.hexSend.disabled = true;
        
        // 즉시 첫 메시지 전송
        this.sendMessage();
        
        // 간격에 따라 반복 전송
        this.loopInterval = setInterval(() => {
            this.sendMessage();
        }, interval);
    }
    
    /**
     * 루프 전송 중지
     */
    stopLoopSend() {
        if (this.loopInterval) {
            clearInterval(this.loopInterval);
            this.loopInterval = null;
            this.isLooping = false;
            
            // 입력 필드 활성화
            this.elements.messageInput.readOnly = false;
            this.elements.sendInterval.disabled = false;
            this.elements.hexSend.disabled = false;
            
            this._showStatus('루프 전송 중지됨', 'info');
        }
    }
    
    /**
     * 메시지를 히스토리에 추가
     * @param {string} message 메시지
     * @private
     */
    _addToHistory(message) {
        try {
            // 히스토리 가져오기
            let history = JSON.parse(localStorage.getItem('messageHistory') || '[]');
            
            // 중복 제거 후 추가
            history = history.filter(item => item !== message);
            history.unshift(message);
            
            // 최대 20개 유지
            if (history.length > 20) {
                history = history.slice(0, 20);
            }
            
            // 저장
            localStorage.setItem('messageHistory', JSON.stringify(history));
        } catch (error) {
            console.error('메시지 히스토리 저장 오류:', error);
        }
    }
    
    /**
     * 16진수 입력값 검증
     * @param {string} input 입력값
     * @returns {boolean} 유효성 여부
     * @private
     */
    _validateHexInput(input) {
        // 공백 제거
        const hexString = input.replace(/\s/g, '');
        
        // 빈 문자열이면 유효하지 않음
        if (hexString.length === 0) {
            return false;
        }
        
        // 16진수 문자만 포함하는지 확인
        const hexPattern = /^[0-9A-Fa-f]+$/;
        
        // 바이트 단위로 나누어져야 함 (길이가 짝수여야 함)
        return hexString.length % 2 === 0 && hexPattern.test(hexString);
    }
    
    /**
     * 16진수 문자열을 바이트 배열로 변환
     * @param {string} hexString 16진수 문자열
     * @returns {Uint8Array} 바이트 배열
     * @private
     */
    _hexStringToBytes(hexString) {
        // 공백 제거
        const hex = hexString.replace(/\s/g, '');
        
        // 바이트 배열로 변환
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i/2] = parseInt(hex.substr(i, 2), 16);
        }
        
        return bytes;
    }
    
    /**
     * 상태 메시지 표시
     * @param {string} message 메시지
     * @param {string} type 메시지 타입 ('success', 'error', 'warning', 'info')
     * @private
     */
    _showStatus(message, type = 'info') {
        if (!this.elements.messageStatus) return;
        
        // 메시지 타입에 따른 클래스 설정
        this.elements.messageStatus.className = 'message-status';
        this.elements.messageStatus.classList.add(`status-${type}`);
        
        // 메시지 표시
        this.elements.messageStatus.textContent = message;
        this.elements.messageStatus.style.display = 'block';
        
        // 일정 시간 후 숨김 (success와 info는 3초, error와 warning은 5초)
        const timeout = ['success', 'info'].includes(type) ? 3000 : 5000;
        setTimeout(() => {
            this.elements.messageStatus.style.display = 'none';
        }, timeout);
    }
    
    /**
     * 메시지 센더 초기화
     */
    init() {
        // 이벤트 리스너 초기화
        this._initEventListeners();
        
        // 빠른 전송 메뉴 초기화
        this._initQuickSendMenu();
        
        // 16진수 입력 모드일 때 스타일 적용
        if (this.elements.hexSend && this.elements.hexSend.checked) {
            this.elements.messageInput.classList.add('hex-input');
        }
        
        // 상태 메시지 초기화
        this._showStatus('메시지 센더가 준비되었습니다.', 'info');
    }
}
