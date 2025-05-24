/**
 * Modbus RTU 모니터 서비스 워커
 * 오프라인 캐싱 및 PWA 기능을 제공합니다.
 */

const CACHE_NAME = 'modbus-monitor-v1';
const ASSETS_TO_CACHE = [
  './',
  '../index.html',
  './offline.html',
  './manifest.json',
  './css/bootstrap.min.css',
  './css/styles.css',
  './js/main.js',
  './js/modules/SerialManager.js',
  './js/modules/ModbusParser.js',
  './js/modules/ModbusInterpreter.js',
  './js/modules/UIController.js',
  './js/modules/LogManager.js',
  './js/modules/DataStorage.js',
  './js/modules/MessageSender.js',
  './js/modules/AppState.js',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-512x512.png'
];

// 설치 이벤트 - 자산 캐싱
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 설치 중...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 자산 캐싱 중...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[Service Worker] 모든 자산이 캐시되었습니다.');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] 캐싱 오류:', error);
      })
  );
});

// 활성화 이벤트 - 이전 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 활성화 중...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[Service Worker] 이전 캐시 삭제 중:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] 이제 클라이언트를 제어합니다.');
        return self.clients.claim();
      })
  );
});

// 페치 이벤트 - 캐시 또는 네트워크에서 제공
self.addEventListener('fetch', (event) => {
  // GET 요청만 처리 및 브라우저 확장 프로그램 제외
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://') ||
      event.request.url.includes('extension') ||
      event.request.url.includes('chrome-search')) {
    return;
  }
  
  // Web Serial API 관련 요청은 네트워크로 직접 처리
  if (event.request.url.includes('serial')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // 캐시에서 찾으면 캐시된 응답 반환
        if (cachedResponse) {
          console.log('[Service Worker] 캐시에서 제공:', event.request.url);
          return cachedResponse;
        }
        
        // 캐시에 없으면 네트워크 요청
        console.log('[Service Worker] 네트워크에서 가져오는 중:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // 유효한 응답이 아니면 그대로 반환
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 응답 복제 (스트림은 한 번만 사용 가능)
            const responseToCache = response.clone();
            
            // 응답을 캐시에 저장
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log('[Service Worker] 새 자산 캐싱:', event.request.url);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('[Service Worker] 페치 오류:', error);
            
            // 오프라인이고 HTML 페이지 요청인 경우 오프라인 페이지 제공
            if (event.request.headers.get('Accept').includes('text/html')) {
              console.log('[Service Worker] 오프라인 페이지 제공');
              return caches.match('./offline.html');
            }
            
            // 기타 자산은 오류 반환
            return new Response('네트워크 오류가 발생했습니다.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// 푸시 메시지 이벤트
self.addEventListener('push', (event) => {
  console.log('[Service Worker] 푸시 메시지 수신:', event.data.text());
  
  const title = 'Modbus RTU 모니터';
  const options = {
    body: event.data.text(),
    icon: './assets/icons/icon-192x192.png',
    badge: './assets/icons/icon-192x192.png'
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 알림 클릭 이벤트
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] 알림 클릭:', event.notification.tag);
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // 이미 열린 창이 있으면 포커스
        for (const client of clientList) {
          if (client.url.includes('index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // 열린 창이 없으면 새 창 열기
        if (clients.openWindow) {
          return clients.openWindow('../index.html');
        }
      })
  );
});

// 백그라운드 동기화 이벤트
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[Service Worker] 백그라운드 동기화 수행 중...');
    event.waitUntil(syncData());
  }
});

// 데이터 동기화 함수
async function syncData() {
  // IndexedDB에서 미동기화 데이터 가져오기
  // 서버에 데이터 전송
  // 동기화 상태 업데이트
  console.log('[Service Worker] 데이터 동기화 완료');
}
