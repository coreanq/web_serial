/**
 * AppState.js
 * 애플리케이션 상태 관리 시스템
 * 옵저버 패턴을 사용하여 다양한 모듈 간의 상태를 동기화하고 사용자 설정을 유지합니다.
 */

export class AppState {
    /**
     * AppState 생성자
     */
    constructor() {
        // 기본 상태 초기화
        this.state = {
            connection: {
                isConnected: false,
                port: null,
                settings: {
                    baudRate: 115200,
                    dataBits: 8,
                    stopBits: 1,
                    parity: 'none',
                    flowControl: 'none',
                    bufferSize: 4096
                }
            },
            monitoring: {
                isActive: false,
                packetTimeout: 50,
                autoScroll: true,
                filterType: 'all'
            },
            session: {
                id: null,
                startTime: null,
                packets: [],
                statistics: null
            },
            ui: {
                theme: 'dark',
                selectedPackets: [],
                notifications: []
            },
            messageSender: {
                isHexMode: false,
                appendCRLF: true,
                loopSending: false,
                sendInterval: 1000
            }
        };
        
        // 상태 변경 리스너 저장소
        this.listeners = {};
        
        // 사용자 설정 로드
        this.loadPreferences();
    }
    
    /**
     * 상태의 특정 부분 가져오기
     * @param {string} path 상태 경로 (예: 'connection.settings.baudRate')
     * @returns {any} 상태 값
     */
    get(path) {
        return this._getNestedProperty(this.state, path);
    }
    
    /**
     * 상태 업데이트 및 리스너에 알림
     * @param {string} path 상태 경로
     * @param {any} value 새 값
     * @returns {AppState} 체이닝을 위한 인스턴스 반환
     */
    update(path, value) {
        this._setNestedProperty(this.state, path, value);
        this._notifyListeners(path);
        
        // 영구 저장이 필요한 설정만 저장
        if (this._shouldPersist(path)) {
            this.savePreferences();
        }
        
        return this;
    }
    
    /**
     * 상태 변경 구독
     * @param {string} path 구독할 상태 경로
     * @param {Function} callback 상태 변경 시 호출될 콜백 함수
     * @returns {Function} 구독 취소 함수
     */
    subscribe(path, callback) {
        if (!this.listeners[path]) {
            this.listeners[path] = [];
        }
        
        this.listeners[path].push(callback);
        
        // 구독 취소 함수 반환
        return () => {
            this.listeners[path] = this.listeners[path].filter(cb => cb !== callback);
        };
    }
    
    /**
     * 알림 추가
     * @param {string} message 알림 메시지
     * @param {string} type 알림 타입 ('info', 'success', 'warning', 'error')
     * @param {number} duration 알림 표시 시간(ms)
     * @returns {string} 알림 ID
     */
    notify(message, type = 'info', duration = 3000) {
        const id = Date.now().toString();
        const notification = {
            id,
            message,
            type,
            timestamp: new Date(),
            duration
        };
        
        // 알림 추가
        const notifications = [...this.state.ui.notifications, notification];
        this.update('ui.notifications', notifications);
        
        // 지정된 시간 후 알림 제거
        if (duration > 0) {
            setTimeout(() => {
                this.dismissNotification(id);
            }, duration);
        }
        
        return id;
    }
    
    /**
     * 알림 제거
     * @param {string} id 알림 ID
     */
    dismissNotification(id) {
        const notifications = this.state.ui.notifications.filter(n => n.id !== id);
        this.update('ui.notifications', notifications);
    }
    
    /**
     * 사용자 설정 로드
     * @private
     */
    loadPreferences() {
        try {
            const preferences = localStorage.getItem('appPreferences');
            if (preferences) {
                const parsed = JSON.parse(preferences);
                
                // 저장된 설정 적용
                if (parsed.connection && parsed.connection.settings) {
                    this.state.connection.settings = {
                        ...this.state.connection.settings,
                        ...parsed.connection.settings
                    };
                }
                
                if (parsed.monitoring) {
                    this.state.monitoring = {
                        ...this.state.monitoring,
                        ...parsed.monitoring
                    };
                }
                
                if (parsed.ui && parsed.ui.theme) {
                    this.state.ui.theme = parsed.ui.theme;
                }
                
                if (parsed.messageSender) {
                    this.state.messageSender = {
                        ...this.state.messageSender,
                        ...parsed.messageSender
                    };
                }
            }
        } catch (error) {
            console.error('설정 로드 오류:', error);
        }
    }
    
    /**
     * 사용자 설정 저장
     * @private
     */
    savePreferences() {
        try {
            // 저장할 설정만 추출
            const preferences = {
                connection: {
                    settings: { ...this.state.connection.settings }
                },
                monitoring: {
                    packetTimeout: this.state.monitoring.packetTimeout,
                    autoScroll: this.state.monitoring.autoScroll,
                    filterType: this.state.monitoring.filterType
                },
                ui: {
                    theme: this.state.ui.theme
                },
                messageSender: {
                    isHexMode: this.state.messageSender.isHexMode,
                    appendCRLF: this.state.messageSender.appendCRLF,
                    sendInterval: this.state.messageSender.sendInterval
                }
            };
            
            localStorage.setItem('appPreferences', JSON.stringify(preferences));
        } catch (error) {
            console.error('설정 저장 오류:', error);
        }
    }
    
    /**
     * 세션 시작
     * @returns {string} 세션 ID
     */
    startSession() {
        const sessionId = Date.now().toString();
        this.update('session', {
            id: sessionId,
            startTime: new Date(),
            packets: [],
            statistics: null
        });
        return sessionId;
    }
    
    /**
     * 세션에 패킷 추가
     * @param {Object} packet 패킷 데이터
     */
    addPacket(packet) {
        const packets = [...this.state.session.packets, packet];
        this.update('session.packets', packets);
        this._updateStatistics();
    }
    
    /**
     * 세션 통계 업데이트
     * @private
     */
    _updateStatistics() {
        const packets = this.state.session.packets;
        
        // 기본 통계 계산
        const statistics = {
            totalPackets: packets.length,
            txPackets: packets.filter(p => p.direction === 'TX').length,
            rxPackets: packets.filter(p => p.direction === 'RX').length,
            validPackets: packets.filter(p => p.isValid).length,
            invalidPackets: packets.filter(p => !p.isValid).length,
            startTime: this.state.session.startTime,
            endTime: new Date(),
            duration: 0
        };
        
        // 세션 지속 시간 계산 (밀리초)
        if (statistics.startTime) {
            statistics.duration = statistics.endTime - statistics.startTime;
        }
        
        this.update('session.statistics', statistics);
    }
    
    /**
     * 중첩된 속성 가져오기
     * @param {Object} obj 객체
     * @param {string} path 속성 경로
     * @returns {any} 속성 값
     * @private
     */
    _getNestedProperty(obj, path) {
        if (!path) return obj;
        
        const parts = path.split('.');
        let current = obj;
        
        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[part];
        }
        
        return current;
    }
    
    /**
     * 중첩된 속성 설정
     * @param {Object} obj 객체
     * @param {string} path 속성 경로
     * @param {any} value 설정할 값
     * @private
     */
    _setNestedProperty(obj, path, value) {
        const parts = path.split('.');
        const lastKey = parts.pop();
        
        // 중간 객체 생성
        const target = parts.reduce((prev, curr) => {
            if (!prev[curr]) prev[curr] = {};
            return prev[curr];
        }, obj);
        
        target[lastKey] = value;
    }
    
    /**
     * 지정된 경로의 모든 리스너에게 알림
     * @param {string} path 상태 경로
     * @private
     */
    _notifyListeners(path) {
        // 특정 경로 리스너에게 알림
        if (this.listeners[path]) {
            this.listeners[path].forEach(callback => {
                callback(this._getNestedProperty(this.state, path));
            });
        }
        
        // 부모 경로 리스너에게 알림
        const parts = path.split('.');
        while (parts.length > 1) {
            parts.pop();
            const parentPath = parts.join('.');
            
            if (this.listeners[parentPath]) {
                this.listeners[parentPath].forEach(callback => {
                    callback(this._getNestedProperty(this.state, parentPath));
                });
            }
        }
        
        // 루트 리스너에게 알림
        if (this.listeners['*']) {
            this.listeners['*'].forEach(callback => {
                callback(this.state);
            });
        }
    }
    
    /**
     * 해당 경로가 영구 저장이 필요한지 확인
     * @param {string} path 상태 경로
     * @returns {boolean} 영구 저장 필요 여부
     * @private
     */
    _shouldPersist(path) {
        const persistPaths = [
            'connection.settings',
            'monitoring.packetTimeout',
            'monitoring.autoScroll',
            'monitoring.filterType',
            'ui.theme',
            'messageSender.isHexMode',
            'messageSender.appendCRLF',
            'messageSender.sendInterval'
        ];
        
        return persistPaths.some(persistPath => {
            // 정확히 일치하거나 하위 경로인 경우
            return path === persistPath || path.startsWith(persistPath + '.');
        });
    }
}
