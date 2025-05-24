// Main entry point for Web Serial Monitor
import { SerialManager } from './modules/SerialManager.js';
import { ModbusParser } from './modules/ModbusParser.js';
import { ModbusInterpreter } from './modules/ModbusInterpreter.js';
import { UIController } from './modules/UIController.js';
import { MessageSender } from './modules/MessageSender.js';
import { DataStorage } from './modules/DataStorage.js';
import { AppState } from './modules/AppState.js';

// 서비스 워커 등록
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./src/service-worker.js')
            .then((registration) => {
                console.log('ServiceWorker 등록 성공:', registration.scope);
            })
            .catch((error) => {
                console.error('ServiceWorker 등록 실패:', error);
            });
    });
}

// Check for Web Serial API support
if (!('serial' in navigator)) {
    alert('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
}

// 엔트리 포인트
document.addEventListener('DOMContentLoaded', () => {
    // 애플리케이션 상태 관리자 초기화
    const appState = new AppState();
    
    // 클래스 인스턴스 생성
    const serialManager = new SerialManager(appState);
    const modbusParser = new ModbusParser();
    const modbusInterpreter = new ModbusInterpreter();
    const dataStorage = new DataStorage(appState);
    
    // 초기 알림 표시
    appState.notify('애플리케이션이 초기화되었습니다.', 'info');
    
    // 테마 적용
    document.body.classList.toggle('dark-theme', appState.get('ui.theme') === 'dark');
    
    // PWA 설치 관련 초기화
    initPwaInstallPrompt();
    
    // UI 컨트롤러 초기화
    const uiController = new UIController(serialManager, modbusParser, modbusInterpreter, dataStorage, appState);
    uiController.init();
    
    // 메시지 센더 초기화
    const messageSender = new MessageSender(serialManager, document.getElementById('messageInput'), {
        statusElement: document.getElementById('messageStatus'),
        sendButton: document.getElementById('sendBtn'),
        quickSendButton: document.getElementById('quickSendBtn'),
        hexCheckbox: document.getElementById('hexSend'),
        crlfCheckbox: document.getElementById('appendCRLF'),
        loopCheckbox: document.getElementById('loopSend'),
        intervalInput: document.getElementById('sendInterval')
    });
    messageSender.init();
    
    // 상태 변경 구독 예시
    appState.subscribe('connection.isConnected', (isConnected) => {
        console.log('연결 상태 변경:', isConnected);
        // 연결 상태에 따른 UI 업데이트 로직
    });
    
    appState.subscribe('monitoring.filterType', (filterType) => {
        console.log('필터 타입 변경:', filterType);
        // 필터 변경에 따른 로그 표시 업데이트
    });
    
    // 알림 시스템 초기화
    initNotificationSystem(appState);

    // Handle page unload
    window.addEventListener('beforeunload', async () => {
        if (serialManager.isConnected()) {
            await serialManager.disconnect();
        }
    });
});

/**
 * PWA 설치 프롬프트 초기화
 */
function initPwaInstallPrompt() {
    let deferredPrompt;
    const installButton = document.createElement('button');
    installButton.id = 'installButton';
    installButton.className = 'btn btn-outline-primary btn-sm pwa-install-button';
    installButton.textContent = '앱 설치';
    installButton.style.display = 'none';
    
    // 네비게이션 바에 버튼 추가
    const navbarNav = document.querySelector('.navbar-nav');
    if (navbarNav) {
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.appendChild(installButton);
        navbarNav.appendChild(li);
    } else {
        document.body.appendChild(installButton);
    }
    
    // beforeinstallprompt 이벤트 캡처
    window.addEventListener('beforeinstallprompt', (e) => {
        // 기본 프롬프트 표시 방지
        e.preventDefault();
        // 프롬프트 저장
        deferredPrompt = e;
        // 설치 버튼 표시
        installButton.style.display = 'block';
    });
    
    // 설치 버튼 클릭 이벤트
    installButton.addEventListener('click', () => {
        // 버튼 숨김
        installButton.style.display = 'none';
        // 프롬프트 표시
        deferredPrompt.prompt();
        // 사용자 선택 결과 처리
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('PWA 설치 승인');
            } else {
                console.log('PWA 설치 거부');
            }
            // 프롬프트 초기화
            deferredPrompt = null;
        });
    });
    
    // 이미 설치된 경우 처리
    window.addEventListener('appinstalled', (e) => {
        console.log('PWA 설치 완료');
        // 설치 버튼 숨김
        installButton.style.display = 'none';
        // 프롬프트 초기화
        deferredPrompt = null;
    });
}

/**
 * 알림 시스템 초기화
 * @param {AppState} appState 애플리케이션 상태 관리자
 */
function initNotificationSystem(appState) {
    // 알림 컨테이너 생성
    let notificationContainer = document.getElementById('notificationContainer');
    
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }
    
    // 알림 상태 변경 구독
    appState.subscribe('ui.notifications', (notifications) => {
        // 컨테이너 초기화
        notificationContainer.innerHTML = '';
        
        // 최신 5개의 알림만 표시
        const recentNotifications = notifications.slice(-5);
        
        recentNotifications.forEach(notification => {
            const notificationElement = document.createElement('div');
            notificationElement.className = `notification notification-${notification.type}`;
            notificationElement.dataset.id = notification.id;
            
            notificationElement.innerHTML = `
                <div class="notification-content">
                    <div class="notification-message">${notification.message}</div>
                    <button class="notification-close">&times;</button>
                </div>
            `;
            
            // 닫기 버튼 클릭 이벤트
            const closeButton = notificationElement.querySelector('.notification-close');
            closeButton.addEventListener('click', () => {
                appState.dismissNotification(notification.id);
            });
            
            notificationContainer.appendChild(notificationElement);
            
            // 애니메이션 효과
            setTimeout(() => {
                notificationElement.classList.add('show');
            }, 10);
        });
    });
}
