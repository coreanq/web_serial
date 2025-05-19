// 모듈 임포트
import { setupPortButtonHandlers, startReading } from './eventHandlers.js';

// 전역 상태
const state = {
  currentPort: null,
  reader: null,
  keepReading: true,
  packetList: null,
  cleanupHandlers: null,
  statusSpan: null
};

// 브라우저가 시리얼 포트를 지원하는지 확인
if (!("serial" in navigator)) {
  alert("The current browser does not support serial port operation. Please use Edge or Chrome browser");
  console.error("Serial API is not supported in this browser");
} else {
  console.log("The current browser supports serial port operation.");
  
  // DOM이 로드되면 실행
  document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 가져오기
    const requestPortButton = document.getElementById('request-port-button');
    const openButton = document.getElementById('open-button');
    const closeButton = document.getElementById('close-button');
    const statusSpan = document.getElementById('status');
    const baudrateInput = document.getElementById('baudrate-input');
    const dataBitsSelect = document.getElementById('data-bits-select');
    const stopBitsSelect = document.getElementById('stop-bits-select');
    const paritySelect = document.getElementById('parity-select');
    const bufferInput = document.getElementById('buffer-input');
    const flowControlSelect = document.getElementById('flow-control-select');
    
    // 전역 상태에 DOM 요소 저장
    state.packetList = document.getElementById('packet-list');
    state.statusSpan = statusSpan;

    // 이벤트 핸들러 설정
    state.cleanupHandlers = setupPortButtonHandlers({
      openButton,
      closeButton,
      requestPortButton,
      statusSpan,
      baudrateInput,
      dataBitsSelect,
      paritySelect,
      stopBitsSelect,
      bufferInput,
      flowControlSelect,
      currentPort: { value: state },
      reader: { value: state },
      startReading: () => startReading(state)
    });

    // 페이지 언로드 시 정리
    window.addEventListener('beforeunload', () => {
      if (state.cleanupHandlers) {
        state.cleanupHandlers();
      }
      
      // 포트가 열려있으면 닫기
      if (state.currentPort) {
        state.keepReading = false;
        if (state.reader) {
          state.reader.cancel().catch(console.error);
        }
        state.currentPort.close().catch(console.error);
      }
    });
  });
}

// TODO: Modbus-RTU 패킷 파싱 및 CRC 검사 함수 추가 (3.2 기능)
// TODO: Modbus-RTU 명령 전송 기능 추가 (3.2 선택 사항)
// TODO: 패킷 필터링/검색 기능 추가 (3.3 선택 사항)
// TODO: 데이터 파일 저장 기능 추가 (3.3 선택 사항)
