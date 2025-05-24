/**
 * DataStorage.js
 * IndexedDB를 사용하여 세션 및 패킷 데이터를 저장하는 모듈
 */
export class DataStorage {
    constructor() {
        this.db = null;
        this.dbName = 'ModbusSerialMonitor';
        this.dbVersion = 1;
        this.initDatabase();
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
        
        const session = {
            id: this._generateId(),
            name: name || `세션 ${new Date().toLocaleString()}`,
            description: description,
            timestamp: new Date(),
            packetCount: 0
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.add(session);
            
            request.onsuccess = () => {
                console.log('세션 생성 성공:', session.id);
                resolve(session.id);
            };
            
            request.onerror = (event) => {
                console.error('세션 생성 오류:', event.target.error);
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
        await this.initDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['packets', 'sessions'], 'readwrite');
            const packetStore = transaction.objectStore('packets');
            const sessionStore = transaction.objectStore('sessions');
            
            let count = 0;
            
            // 각 패킷에 세션 ID 추가
            packets.forEach(packet => {
                const packetData = {
                    ...packet,
                    sessionId,
                    timestamp: packet.timestamp || new Date()
                };
                
                const request = packetStore.add(packetData);
                request.onsuccess = () => {
                    count++;
                };
                
                request.onerror = (event) => {
                    console.error('패킷 저장 오류:', event.target.error);
                };
            });
            
            // 세션 정보 업데이트 (패킷 수 증가)
            const sessionRequest = sessionStore.get(sessionId);
            sessionRequest.onsuccess = (event) => {
                const session = event.target.result;
                if (session) {
                    session.packetCount = (session.packetCount || 0) + packets.length;
                    sessionStore.put(session);
                }
            };
            
            transaction.oncomplete = () => {
                console.log(`패킷 저장 완료: ${count}개`);
                resolve(count);
            };
            
            transaction.onerror = (event) => {
                console.error('패킷 저장 트랜잭션 오류:', event.target.error);
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
     * 고유 ID 생성
     * @returns {string} 고유 ID
     * @private
     */
    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}
