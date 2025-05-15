document.addEventListener('DOMContentLoaded', () => {
  const portSelect = document.getElementById('port-select');
  const baudrateSelect = document.getElementById('baudrate-select');
  const dataBitsSelect = document.getElementById('data-bits-select');
  const paritySelect = document.getElementById('parity-select');
  const stopBitsSelect = document.getElementById('stop-bits-select');
  const openButton = document.getElementById('open-button');
  const closeButton = document.getElementById('close-button');
  const statusSpan = document.getElementById('status');
  const packetList = document.getElementById('packet-list');
  const requestPortButton = document.getElementById('request-port-button'); // 새 버튼 추가

  let currentPort = null;
  let reader = null;
  let keepReading = true;

  // 사용 가능한 시리얼 포트 목록 가져오기 및 UI 업데이트
  async function populatePortList() {
    const ports = await navigator.serial.getPorts();
    portSelect.innerHTML = ''; // 기존 목록 초기화
    if (ports.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '사용 가능한 포트 없음';
      portSelect.appendChild(option);
      openButton.disabled = true;
    } else {
      ports.forEach(port => {
        const option = document.createElement('option');
        // port.getInfo()를 사용하여 포트 정보를 표시합니다.
        const portInfo = port.getInfo();
        option.value = portInfo.usbProductId ? `${portInfo.usbVendorId}:${portInfo.usbProductId}` : 'unknown'; // 예시 값
        option.textContent = portInfo.usbProductId ? `USB ${portInfo.usbVendorId}:${portInfo.usbProductId}` : 'Serial Port'; // 더 유용한 정보 표시
        option.port = port; // 포트 객체를 option 요소에 저장하여 나중에 사용
        portSelect.appendChild(option);
      });
      openButton.disabled = false;
    }
  }

  // 페이지 로드 시 이미 권한이 부여된 포트 목록 로드
  populatePortList();

  // "포트 권한 요청" 버튼 클릭 이벤트 (새로 추가)
  requestPortButton.addEventListener('click', async () => {
    try {
      // 사용자에게 시리얼 포트 선택 권한 요청
      const port = await navigator.serial.requestPort();
      // 권한 부여 후 포트 목록 새로고침
      populatePortList();
      statusSpan.textContent = '상태: 포트 권한 부여됨. 목록에서 선택하세요.';
    } catch (error) {
      statusSpan.textContent = `상태: 포트 권한 요청 실패 - ${error.message}`;
      console.error('Failed to request serial port:', error);
    }
  });


  // 포트 열기 버튼 클릭 이벤트
  openButton.addEventListener('click', async () => {
    const selectedOption = portSelect.options[portSelect.selectedIndex];
    if (!selectedOption || !selectedOption.port) {
      statusSpan.textContent = '상태: 유효한 포트를 선택하세요.';
      return;
    }

    currentPort = selectedOption.port; // option 요소에 저장된 포트 객체 사용

    try {
      await currentPort.open({
        baudRate: parseInt(baudrateSelect.value),
        dataBits: parseInt(dataBitsSelect.value),
        parity: paritySelect.value,
        stopBits: parseInt(stopBitsSelect.value)
      });

      statusSpan.textContent = '상태: 열림';
      openButton.disabled = true;
      closeButton.disabled = false;
      portSelect.disabled = true;
      baudrateSelect.disabled = true;
      dataBitsSelect.disabled = true;
      paritySelect.disabled = true;
      stopBitsSelect.disabled = true;
      requestPortButton.disabled = true; // 포트 열리면 권한 요청 버튼 비활성화

      // 데이터 읽기 시작
      startReading();

    } catch (error) {
      statusSpan.textContent = `상태: 열기 실패 - ${error.message}`;
      console.error('Failed to open serial port:', error);
      // 열기 실패 시 UI 상태 복원
      openButton.disabled = false;
      closeButton.disabled = true;
      portSelect.disabled = false;
      baudrateSelect.disabled = false;
      dataBitsSelect.disabled = false;
      paritySelect.disabled = false;
      stopBitsSelect.disabled = false;
      requestPortButton.disabled = false;
    }
  });

  // 포트 닫기 버튼 클릭 이벤트
  closeButton.addEventListener('click', async () => {
    if (currentPort) {
      keepReading = false; // 읽기 중지 플래그 설정
      if (reader) {
        await reader.cancel(); // 읽기 작업 취소
      }
      try {
        await currentPort.close();
        statusSpan.textContent = '상태: 닫힘';
        openButton.disabled = false;
        closeButton.disabled = true;
        portSelect.disabled = false;
        baudrateSelect.disabled = false;
        dataBitsSelect.disabled = false;
        paritySelect.disabled = false;
        stopBitsSelect.disabled = false;
        requestPortButton.disabled = false; // 포트 닫히면 권한 요청 버튼 활성화
        currentPort = null;
        reader = null;
        // 포트 닫은 후 목록 새로고침 (선택 사항)
        // populatePortList();
      } catch (error) {
        statusSpan.textContent = `상태: 닫기 실패 - ${error.message}`;
        console.error('Failed to close serial port:', error);
        // 닫기 실패 시 UI 상태 복원 (필요하다면)
        openButton.disabled = true;
        closeButton.disabled = false;
        portSelect.disabled = true;
        baudrateSelect.disabled = true;
        dataBitsSelect.disabled = true;
        paritySelect.disabled = true;
        stopBitsSelect.disabled = true;
        requestPortButton.disabled = true;
      }
    }
  });

  // 시리얼 포트에서 데이터 읽기
  async function startReading() {
    keepReading = true;
    while (currentPort && currentPort.readable && keepReading) {
      reader = currentPort.readable.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            // Reader has been canceled or port closed
            break;
          }
          const receivedData = new Uint8Array(value);
          displayPacket(receivedData, 'RX');
          // TODO: Modbus-RTU 패킷 파싱 및 처리 로직 추가 (3.2 기능)
        }
      } catch (error) {
        if (keepReading) { // 사용자가 닫은 경우가 아니면 오류 처리
           statusSpan.textContent = `상태: 읽기 오류 - ${error.message}`;
           console.error('Error reading from serial port:', error);
        }
      } finally {
        reader.releaseLock();
      }
    }
    if (!keepReading) {
        statusSpan.textContent = '상태: 닫힘';
        openButton.disabled = false;
        closeButton.disabled = true;
        portSelect.disabled = false;
        baudrateSelect.disabled = false;
        dataBitsSelect.disabled = false;
        paritySelect.disabled = false;
        stopBitsSelect.disabled = false;
        requestPortButton.disabled = false; // 포트 닫히면 권한 요청 버튼 활성화
        currentPort = null;
        reader = null;
    }
  }

  // 패킷 모니터링 UI에 표시
  function displayPacket(data, direction) {
    const li = document.createElement('li');
    const timestamp = new Date().toLocaleTimeString();
    const hexData = Array.from(data).map(byte => byte.toString(16).padStart(2, '0')).join(' ');
    li.classList.add(direction.toLowerCase());
    li.textContent = `[${timestamp}] ${direction}: ${hexData}`;
    packetList.appendChild(li);
    // 스크롤을 최신 패킷으로 이동
    packetList.scrollTop = packetList.scrollHeight;
  }

  // TODO: Modbus-RTU 패킷 파싱 및 CRC 검사 함수 추가 (3.2 기능)
  // TODO: Modbus-RTU 명령 전송 기능 추가 (3.2 선택 사항)
  // TODO: 패킷 필터링/검색 기능 추가 (3.3 선택 사항)
  // TODO: 데이터 파일 저장 기능 추가 (3.3 선택 사항)

});
