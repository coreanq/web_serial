/**
 * DataStorage.js
 * IndexedDB를 사용하여 세션 및 패킷 데이터를 저장하고 내보내는 모듈
 */
export class DataStorage {
    /**
     * DataStorage 생성자
     * @param {AppState} appState 애플리케이션 상태 관리자 (선택적)
     */
    constructor(appState = null) {
        this.db = null;
        this.dbName = 'ModbusSerialMonitor';
        this.dbVersion = 1;
        this.appState = appState;
        
        // 데이터베이스 초기화
        this.initDatabase();
        
        // 애플리케이션 상태가 있는 경우 세션 관리 구독
        if (this.appState) {
            // 세션 시작 구독
            this.appState.subscribe('session.id', async (sessionId) => {
                if (sessionId) {
                    // 새 세션이 시작되면 데이터베이스에 저장
                    const session = {
                        id: sessionId,
                        name: `세션 ${new Date().toLocaleString()}`,
                        description: '',
                        timestamp: this.appState.get('session.startTime'),
                        packetCount: 0
                    };
                    
                    try {
                        await this._saveSessionToDb(session);
                        this.appState.notify('새 세션이 시작되었습니다.', 'info');
                    } catch (error) {
                        console.error('세션 저장 오류:', error);
                        this.appState.notify('세션 저장 오류', 'error');
                    }
                }
            });
            
            // 패킷 추가 구독
            this.appState.subscribe('session.packets', async (packets) => {
                if (packets && packets.length > 0) {
                    const sessionId = this.appState.get('session.id');
                    if (sessionId) {
                        // 통계 업데이트
                        const statistics = this.calculateStatistics(packets);
                        this.appState.update('session.statistics', statistics);
                    }
                }
            });
        }
    }
    
    /**
     * IndexedDB 데이터베이스 초기화
     * @returns {Promise<IDBDatabase>} 데이터베이스 객체
     */
    async initDatabase() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }
            
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            // 데이터베이스 업그레이드 필요 시 (새로 생성 또는 버전 변경)
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 세션 저장소 (메타데이터)
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                    sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
                    sessionStore.createIndex('name', 'name', { unique: false });
                }
                
                // 패킷 저장소
                if (!db.objectStoreNames.contains('packets')) {
                    const packetStore = db.createObjectStore('packets', { keyPath: 'id', autoIncrement: true });
                    packetStore.createIndex('sessionId', 'sessionId', { unique: false });
                    packetStore.createIndex('timestamp', 'timestamp', { unique: false });
                    packetStore.createIndex('direction', 'direction', { unique: false });
                }
                
                // 통계 저장소
                if (!db.objectStoreNames.contains('statistics')) {
                    const statsStore = db.createObjectStore('statistics', { keyPath: 'sessionId' });
                    statsStore.createIndex('sessionId', 'sessionId', { unique: true });
                }
            };
            
            // 성공 시
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('데이터베이스 연결 성공:', this.dbName);
                resolve(this.db);
            };
            
            // 오류 시
            request.onerror = (event) => {
                console.error('데이터베이스 연결 오류:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 새 세션 생성
     * @param {string} name 세션 이름
     * @param {string} description 세션 설명
     * @returns {Promise<string>} 생성된 세션 ID
     */
    async createSession(name, description = '') {
        await this.initDatabase();
        
        const sessionId = this._generateId();
        const timestamp = new Date();
        
        const session = {
            id: sessionId,
            name: name || `세션 ${timestamp.toLocaleString()}`,
            description: description,
            timestamp: timestamp,
            packetCount: 0
        };
        
        try {
            await this._saveSessionToDb(session);
            
            // 애플리케이션 상태 업데이트
            if (this.appState) {
                this.appState.update('session', {
                    id: sessionId,
                    startTime: timestamp,
                    packets: [],
                    statistics: null
                });
                
                this.appState.notify(`새 세션이 생성되었습니다: ${session.name}`, 'success');
            }
            
            return sessionId;
        } catch (error) {
            console.error('세션 생성 오류:', error);
            if (this.appState) {
                this.appState.notify('세션 생성 오류', 'error');
            }
            throw error;
        }
    }
    
    /**
     * 세션을 데이터베이스에 저장
     * @param {Object} session 세션 객체
     * @returns {Promise<void>}
     * @private
     */
    async _saveSessionToDb(session) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.add(session);
            
            request.onsuccess = () => {
                console.log('세션 저장 성공:', session.id);
                resolve();
            };
            
            request.onerror = (event) => {
                console.error('세션 저장 오류:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 세션 정보 가져오기
     * @param {string} sessionId 세션 ID
     * @returns {Promise<Object>} 세션 정보
     */
    async getSession(sessionId) {
        await this.initDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const request = store.get(sessionId);
            
            request.onsuccess = (event) => {
                if (event.target.result) {
                    resolve(event.target.result);
                } else {
                    reject(new Error(`세션을 찾을 수 없음: ${sessionId}`));
                }
            };
            
            request.onerror = (event) => {
                console.error('세션 조회 오류:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 모든 세션 목록 가져오기
     * @returns {Promise<Array>} 세션 목록
     */
    async getAllSessions() {
        await this.initDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const request = store.index('timestamp').openCursor(null, 'prev'); // 최신순 정렬
            
            const sessions = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    sessions.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(sessions);
                }
            };
            
            request.onerror = (event) => {
                console.error('세션 목록 조회 오류:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 세션 삭제
     * @param {string} sessionId 세션 ID
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async deleteSession(sessionId) {
        await this.initDatabase();
        
        // 세션 관련 패킷 및 통계 삭제
        await this.deletePackets(sessionId);
        await this.deleteStatistics(sessionId);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.delete(sessionId);
            
            request.onsuccess = () => {
                console.log('세션 삭제 성공:', sessionId);
                resolve(true);
            };
            
            request.onerror = (event) => {
                console.error('세션 삭제 오류:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 패킷 저장
     * @param {string} sessionId 세션 ID
     * @param {Array} packets 패킷 배열
     * @returns {Promise<number>} 저장된 패킷 수
     */
    async savePackets(sessionId, packets) {
        if (!sessionId || !packets || packets.length === 0) {
            return 0;
        }
        
        await this.initDatabase();
        
        // 세션 정보 업데이트 (패킷 수 증가)
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions', 'packets'], 'readwrite');
            const sessionStore = transaction.objectStore('sessions');
            const packetStore = transaction.objectStore('packets');
            
            // 세션 정보 가져오기
            const getSessionRequest = sessionStore.get(sessionId);
            
            getSessionRequest.onsuccess = () => {
                const session = getSessionRequest.result;
                if (!session) {
                    reject(new Error('세션을 찾을 수 없습니다.'));
                    return;
                }
                
                // 패킷 수 업데이트
                session.packetCount += packets.length;
                sessionStore.put(session);
            };
            
            getSessionRequest.onerror = (event) => {
                console.error('세션 정보 가져오기 오류:', event.target.error);
                reject(event.target.error);
            };
            
            // 패킷 저장
            let savedCount = 0;
            
            packets.forEach(packet => {
                // 세션 ID 추가
                const packetToSave = { ...packet, sessionId };
                const addRequest = packetStore.add(packetToSave);
                
                addRequest.onsuccess = (event) => {
                    savedCount++;
                };
            });
            
            transaction.oncomplete = () => {
                console.log(`패킷 저장 완료: ${savedCount} 개`);
                
                // 애플리케이션 상태 업데이트
                if (this.appState) {
                    // 통계 업데이트
                    const currentPackets = this.appState.get('session.packets') || [];
                    const statistics = this.calculateStatistics(currentPackets);
                    this.appState.update('session.statistics', statistics);
                    
                    this.appState.notify(`${savedCount}개의 패킷이 저장되었습니다.`, 'success');
                }
                
                resolve(savedCount);
            };
            
            transaction.onerror = (event) => {
                console.error('패킷 저장 오류:', event.target.error);
                
                if (this.appState) {
                    this.appState.notify('패킷 저장 오류', 'error');
                }
                
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 세션의 모든 패킷 가져오기
     * @param {string} sessionId 세션 ID
     * @returns {Promise<Array>} 패킷 배열
     */
    async getPackets(sessionId) {
        await this.initDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['packets'], 'readonly');
            const store = transaction.objectStore('packets');
            const index = store.index('sessionId');
            const request = index.getAll(sessionId);
            
            request.onsuccess = (event) => {
                const packets = event.target.result || [];
                resolve(packets);
            };
            
            request.onerror = (event) => {
                console.error('패킷 조회 오류:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 세션의 패킷 삭제
     * @param {string} sessionId 세션 ID
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async deletePackets(sessionId) {
        await this.initDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['packets'], 'readwrite');
            const store = transaction.objectStore('packets');
            const index = store.index('sessionId');
            const request = index.openCursor(sessionId);
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
            
            transaction.oncomplete = () => {
                console.log('패킷 삭제 완료:', sessionId);
                resolve(true);
            };
            
            transaction.onerror = (event) => {
                console.error('패킷 삭제 오류:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 통계 정보 저장
     * @param {string} sessionId 세션 ID
     * @param {Object} statistics 통계 정보
     * @returns {Promise<boolean>} 저장 성공 여부
     */
    async saveStatistics(sessionId, statistics) {
        await this.initDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['statistics'], 'readwrite');
            const store = transaction.objectStore('statistics');
            
            const statsData = {
                sessionId,
                ...statistics,
                timestamp: new Date()
            };
            
            const request = store.put(statsData);
            
            request.onsuccess = () => {
                console.log('통계 저장 성공:', sessionId);
                resolve(true);
            };
            
            request.onerror = (event) => {
                console.error('통계 저장 오류:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 통계 정보 가져오기
     * @param {string} sessionId 세션 ID
     * @returns {Promise<Object>} 통계 정보
     */
    async getStatistics(sessionId) {
        await this.initDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['statistics'], 'readonly');
            const store = transaction.objectStore('statistics');
            const request = store.get(sessionId);
            
            request.onsuccess = (event) => {
                const statistics = event.target.result;
                resolve(statistics || null);
            };
            
            request.onerror = (event) => {
                console.error('통계 조회 오류:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 통계 정보 삭제
     * @param {string} sessionId 세션 ID
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async deleteStatistics(sessionId) {
        await this.initDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['statistics'], 'readwrite');
            const store = transaction.objectStore('statistics');
            const request = store.delete(sessionId);
            
            request.onsuccess = () => {
                console.log('통계 삭제 성공:', sessionId);
                resolve(true);
            };
            
            request.onerror = (event) => {
                console.error('통계 삭제 오류:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * 패킷 데이터를 CSV 형식으로 내보내기
     * @param {string} sessionId 세션 ID
     * @returns {Promise<string>} CSV 데이터
     */
    async exportToCSV(sessionId) {
        const packets = await this.getPackets(sessionId);
        const session = await this.getSession(sessionId);
        
        if (!packets || packets.length === 0) {
            return '';
        }
        
        // CSV 헤더
        let csv = '타임스탬프,방향,데이터(HEX),데이터(ASCII),유효성,함수 코드,설명\n';
        
        // 패킷 데이터 추가
        packets.forEach(packet => {
            const timestamp = new Date(packet.timestamp).toLocaleString();
            const direction = packet.direction === 'TX' ? '송신' : '수신';
            const hexData = Array.from(packet.data)
                .map(byte => byte.toString(16).padStart(2, '0'))
                .join(' ');
            
            // ASCII 변환 (출력 가능한 문자만)
            const asciiData = Array.from(packet.data)
                .map(byte => (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.')
                .join('');
            
            const isValid = packet.parsedData?.isValid ? '유효함' : '유효하지 않음';
            const functionCode = packet.parsedData?.functionCode || 'N/A';
            const description = packet.parsedData?.description || '';
            
            // 쉼표가 포함된 필드는 따옴표로 묶음
            const escapedDescription = `"${description.replace(/"/g, '""')}"`;
            
            csv += `${timestamp},${direction},${hexData},${asciiData},${isValid},${functionCode},${escapedDescription}\n`;
        });
        
        return csv;
    }
    
    /**
     * 패킷 데이터를 JSON 형식으로 내보내기
     * @param {string} sessionId 세션 ID
     * @returns {Promise<string>} JSON 데이터
     */
    async exportToJSON(sessionId) {
        const packets = await this.getPackets(sessionId);
        const session = await this.getSession(sessionId);
        const statistics = await this.getStatistics(sessionId) || this.calculateStatistics(packets);
        
        if (!packets || !session) {
            return '{}';
        }
        
        // Uint8Array를 일반 배열로 변환하여 JSON 직렬화 가능하게 함
        const processedPackets = packets.map(packet => {
            const processed = {...packet};
            if (packet.data instanceof Uint8Array) {
                processed.data = Array.from(packet.data);
            }
            return processed;
        });
        
        const exportData = {
            session: session,
            statistics: statistics,
            packets: processedPackets,
            exportDate: new Date()
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    /**
     * 패킷 데이터를 다운로드 가능한 파일로 내보내기
     * @param {string} sessionId 세션 ID
     * @param {string} format 파일 형식 ('csv' 또는 'json')
     * @returns {Promise<string>} 다운로드 URL
     */
    async exportToFile(sessionId, format) {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error('세션을 찾을 수 없습니다.');
        }
        
        let data, mimeType, extension;
        
        if (format.toLowerCase() === 'csv') {
            data = await this.exportToCSV(sessionId);
            mimeType = 'text/csv';
            extension = 'csv';
        } else if (format.toLowerCase() === 'json') {
            data = await this.exportToJSON(sessionId);
            mimeType = 'application/json';
            extension = 'json';
        } else {
            throw new Error('지원하지 않는 파일 형식입니다.');
        }
        
        // 파일명 생성
        const fileName = `${session.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.${extension}`;
        
        // Blob 생성 및 다운로드 URL 반환
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // 다운로드 링크 생성 및 클릭
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // 정리
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        return fileName;
    }
    
    /**
     * 패킷 데이터로부터 통계 정보 계산
     * @param {Array} packets 패킷 배열
     * @returns {Object} 통계 정보
     */
    calculateStatistics(packets) {
        if (!packets || packets.length === 0) {
            return {
                totalPackets: 0,
                txPackets: 0,
                rxPackets: 0,
                validPackets: 0,
                invalidPackets: 0,
                errorRate: '0%',
                avgResponseTime: '0ms',
                minResponseTime: 'N/A',
                maxResponseTime: 'N/A',
                startTime: null,
                endTime: null,
                duration: '0ms'
            };
        }
        
        // 기본 통계
        const totalPackets = packets.length;
        const txPackets = packets.filter(p => p.direction === 'TX').length;
        const rxPackets = packets.filter(p => p.direction === 'RX').length;
        const validPackets = packets.filter(p => p.isValid).length;
        const invalidPackets = totalPackets - validPackets;
        const errorRate = totalPackets > 0 ? (invalidPackets / totalPackets) * 100 : 0;
        
        // 응답 시간 계산 (TX 패킷 이후 RX 패킷 사이의 시간)
        const responseTimes = [];
        for (let i = 0; i < packets.length - 1; i++) {
            if (packets[i].direction === 'TX' && packets[i+1].direction === 'RX') {
                const responseTime = new Date(packets[i+1].timestamp) - new Date(packets[i].timestamp);
                responseTimes.push(responseTime);
            }
        }
        
        // 시간 관련 통계
        const startTime = packets.length > 0 ? new Date(packets[0].timestamp) : null;
        const endTime = packets.length > 0 ? new Date(packets[packets.length - 1].timestamp) : null;
        const duration = startTime && endTime ? endTime - startTime : 0;
        
        // 응답 시간 통계
        const avgResponseTime = responseTimes.length > 0 ? 
            responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
        const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : null;
        const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : null;
        
        // 함수 코드별 통계
        const functionCodes = {};
        packets.forEach(packet => {
            if (packet.functionCode) {
                const fc = packet.functionCode;
                functionCodes[fc] = (functionCodes[fc] || 0) + 1;
            }
        });
        
        const result = {
            totalPackets,
            txPackets,
            rxPackets,
            validPackets,
            invalidPackets,
            errorRate: errorRate.toFixed(2) + '%',
            avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
            minResponseTime: minResponseTime !== null ? minResponseTime.toFixed(2) + 'ms' : 'N/A',
            maxResponseTime: maxResponseTime !== null ? maxResponseTime.toFixed(2) + 'ms' : 'N/A',
            startTime,
            endTime,
            duration: duration + 'ms',
            functionCodes
        };
        
        // 애플리케이션 상태에 통계 저장
        if (this.appState && this.appState.get('session.id')) {
            this.saveStatistics(this.appState.get('session.id'), result)
                .catch(error => console.error('통계 저장 오류:', error));
        }
        
        return result;
    }
    
    /**
     * 고유 ID 생성
     * @returns {string} 고유 ID
     * @private
     */
    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}
