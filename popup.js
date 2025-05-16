document.addEventListener('DOMContentLoaded', () => {
  if (!("serial" in navigator)) {
    alert("The current browser does not support serial port operation. Please replace the Edge or Chrome browser");
  }
  else { 
    console.log("The current browser supports serial port operation.");
  }
  // Get UI elements
  const baudrateInput = document.getElementById('baudrate-input');
  const dataBitsSelect = document.getElementById('data-bits-select');
  const paritySelect = document.getElementById('parity-select');
  const stopBitsSelect = document.getElementById('stop-bits-select');
  const bufferInput = document.getElementById('buffer-input');
  const flowControlSelect = document.getElementById('flow-control-select');

  const requestPortButton = document.getElementById('request-port-button'); // Select Serial Port 버튼
  const openButton = document.getElementById('open-button');
  const closeButton = document.getElementById('close-button');
  const statusSpan = document.getElementById('status');
  const packetList = document.getElementById('packet-list');

  let currentPort = null;
  let reader = null;
  let keepReading = true;

  // "Select Serial Port" 버튼 클릭 이벤트 - 시리얼 포트 권한 요청 및 포트 설정
  requestPortButton.addEventListener('click', async () => {
    try {
      // 사용자에게 시리얼 포트 선택 권한 요청
      // currentPort = await navigator.serial.requestPort();
      await navigator.serial.requestPort().then(async (port) => {
        //关闭旧的串口
        console.log("requestPort");
        currentPort?.close();
        await currentPort?.forget();
        currentPort = port;
      });
      statusSpan.textContent = 'Device Selected. Click Open Serial Port.';
      openButton.disabled = false; // Enable open button after port is selected
      requestPortButton.disabled = true; // Disable select button after port is selected

    } catch (error) {
      statusSpan.textContent = `상태: 포트 선택 실패 - ${error.message}`;
      console.error('Failed to request serial port:', error);
    }
  });

  // 포트 열기 버튼 클릭 이벤트
  openButton.addEventListener('click', async () => {
    if (!currentPort) {
      statusSpan.textContent = '상태: 시리얼 포트를 먼저 선택하세요.';
      return;
    }

    try {
      await currentPort.open({
        baudRate: parseInt(baudrateInput.value),
        dataBits: parseInt(dataBitsSelect.value),
        parity: paritySelect.value === 'none' ? 'none' : paritySelect.value,
        stopBits: parseInt(stopBitsSelect.value),
        bufferSize: parseInt(bufferInput.value),
        flowControl: flowControlSelect.value === 'none' ? 'none' : flowControlSelect.value
      });

      statusSpan.textContent = 'Device Connected'; // Update status text
      openButton.disabled = true;
      closeButton.disabled = false;
      // Disable all setting inputs/selects after opening
      baudrateInput.disabled = true;
      dataBitsSelect.disabled = true;
      paritySelect.disabled = true;
      stopBitsSelect.disabled = true;
      bufferInput.disabled = true;
      flowControlSelect.disabled = true;
      requestPortButton.disabled = true; // Disable select button

      // 데이터 읽기 시작
      startReading();

    } catch (error) {
      statusSpan.textContent = `상태: 열기 실패 - ${error.message}`;
      console.error('Failed to open serial port:', error);
      // 열기 실패 시 UI 상태 복원
      openButton.disabled = false;
      closeButton.disabled = true; // Keep close disabled if open failed
      // Re-enable setting inputs/selects
      baudrateInput.disabled = false;
      dataBitsSelect.disabled = false;
      paritySelect.disabled = false;
      stopBitsSelect.disabled = false;
      bufferInput.disabled = false;
      flowControlSelect.disabled = false;
      requestPortButton.disabled = false; // Re-enable select button
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
        statusSpan.textContent = 'Device Disconnected'; // Update status text
        openButton.disabled = false; // Re-enable open button
        closeButton.disabled = true; // Disable close button
        // Re-enable setting inputs/selects
        baudrateInput.disabled = false;
        dataBitsSelect.disabled = false;
        paritySelect.disabled = false;
        stopBitsSelect.disabled = false;
        bufferInput.disabled = false;
        flowControlSelect.disabled = false;
        requestPortButton.disabled = false; // Re-enable select button
        currentPort = null;
        reader = null;
      } catch (error) {
        statusSpan.textContent = `상태: 닫기 실패 - ${error.message}`;
        console.error('Failed to close serial port:', error);
        // 닫기 실패 시 UI 상태 복원 (필요하다면)
        openButton.disabled = true; // Keep open disabled if close failed
        closeButton.disabled = false; // Keep close enabled if close failed
        baudrateInput.disabled = true; // Keep settings disabled
        dataBitsSelect.disabled = true;
        paritySelect.disabled = true;
        stopBitsSelect.disabled = true;
        bufferInput.disabled = true;
        flowControlSelect.disabled = true;
        requestPortButton.disabled = true; // Keep select disabled
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
        statusSpan.textContent = 'Device Disconnected'; // Update status text
        openButton.disabled = false; // Re-enable open button
        closeButton.disabled = true; // Disable close button
        // Re-enable setting inputs/selects
        baudrateInput.disabled = false;
        dataBitsSelect.disabled = false;
        paritySelect.disabled = false;
        stopBitsSelect.disabled = false;
        bufferInput.disabled = false;
        flowControlSelect.disabled = false;
        requestPortButton.disabled = false; // Re-enable select button
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

  // Initial state setup
  openButton.disabled = true; // Open button is disabled until a port is selected
  closeButton.disabled = true; // Close button is disabled initially

  // TODO: Modbus-RTU 패킷 파싱 및 CRC 검사 함수 추가 (3.2 기능)
  // TODO: Modbus-RTU 명령 전송 기능 추가 (3.2 선택 사항)
  // TODO: 패킷 필터링/검색 기능 추가 (3.3 선택 사항)
  // TODO: 데이터 파일 저장 기능 추가 (3.3 선택 사항)

});
