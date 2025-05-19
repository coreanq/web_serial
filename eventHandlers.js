// 이벤트 핸들러 모음

// 패킷을 화면에 표시하는 함수
function displayPacket(data, direction) {
  const packetList = document.getElementById('packet-list');
  if (!packetList) return;
  
  const listItem = document.createElement('li');
  const timestamp = new Date().toISOString().substr(11, 12);
  const hexString = Array.from(data, byte => 
    byte.toString(16).padStart(2, '0').toUpperCase()
  ).join(' ');
  
  listItem.textContent = `[${timestamp}] ${direction}: ${hexString}`;
  listItem.classList.add(direction.toLowerCase());
  
  // 최신 메시지가 위로 오도록 추가
  packetList.insertBefore(listItem, packetList.firstChild);
  
  // 최대 표시 개수 제한 (예: 100개)
  while (packetList.children.length > 100) {
    packetList.removeChild(packetList.lastChild);
  }
}

// 시리얼 포트에서 데이터 읽기
export async function startReading(state) {
  const { currentPort, reader, keepReading, packetList } = state;
  
  try {
    while (keepReading && currentPort.value && currentPort.value.readable) {
      try {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = currentPort.value.readable.pipeTo(textDecoder.writable);
        const textReader = textDecoder.readable.getReader();

        while (keepReading) {
          const { value, done } = await textReader.read();
          if (done) {
            textReader.releaseLock();
            break;
          }
          if (value) {
            const listItem = document.createElement('li');
            listItem.textContent = `RX: ${value}`;
            listItem.classList.add('rx');
            packetList.appendChild(listItem);
            // 스크롤을 아래로 유지
            packetList.scrollTop = packetList.scrollHeight;
          }
        }
      } catch (error) {
        console.error('Error reading from serial port:', error);
        // 오류 발생 시 잠시 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('Error in startReading:', error);
  } finally {
    if (reader) {
      reader.releaseLock();
    }
  }
}

export function setupPortButtonHandlers({
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
  currentPort,
  reader,
  startReading
}) {
  // Open Port 버튼 클릭 이벤트 핸들러
  async function handleOpenPort() {
    try {
      // 포트가 선택되지 않은 경우에만 포트 선택 요청
      if (!currentPort.value) {
        try {
          // 사용자에게 시리얼 포트 선택 권한 요청
          const port = await navigator.serial.requestPort();
          
          // 기존 포트가 있으면 정리
          if (currentPort.value) {
            await currentPort.value.close();
            await currentPort.value.forget();
          }
          
          currentPort.value = port;
          statusSpan.textContent = '포트가 선택되었습니다. 연결 중...';
          
          // 포트가 선택되면 바로 연결 시도
          if (currentPort.value) {
            await currentPort.value.open({
              baudRate: parseInt(baudrateInput.value),
              dataBits: parseInt(dataBitsSelect.value),
              parity: paritySelect.value === 'none' ? 'none' : paritySelect.value,
              stopBits: parseInt(stopBitsSelect.value),
              bufferSize: parseInt(bufferInput.value),
              flowControl: flowControlSelect.value === 'none' ? 'none' : flowControlSelect.value
            });

            statusSpan.textContent = '장치가 연결되었습니다.';
            openButton.disabled = true;
            closeButton.disabled = false;
            
            // 설정 비활성화
            baudrateInput.disabled = true;
            dataBitsSelect.disabled = true;
            paritySelect.disabled = true;
            stopBitsSelect.disabled = true;
            bufferInput.disabled = true;
            flowControlSelect.disabled = true;

            // 데이터 읽기 시작
            startReading();
            return; // 성공 시 여기서 종료
          }
        } catch (error) {
          statusSpan.textContent = `포트 선택 실패: ${error.message}`;
          console.error('포트 선택 오류:', error);
          return; // 오류 발생 시 여기서 종료
        }
      }

      // 이미 포트가 있는 경우 (재연결 등)
      await currentPort.value.open({
        baudRate: parseInt(baudrateInput.value),
        dataBits: parseInt(dataBitsSelect.value),
        parity: paritySelect.value === 'none' ? 'none' : paritySelect.value,
        stopBits: parseInt(stopBitsSelect.value),
        bufferSize: parseInt(bufferInput.value),
        flowControl: flowControlSelect.value === 'none' ? 'none' : flowControlSelect.value
      });

      statusSpan.textContent = 'Device Connected';
      openButton.disabled = true;
      closeButton.disabled = false;
      
      // 설정 비활성화
      baudrateInput.disabled = true;
      dataBitsSelect.disabled = true;
      paritySelect.disabled = true;
      stopBitsSelect.disabled = true;
      bufferInput.disabled = true;
      flowControlSelect.disabled = true;

      // 데이터 읽기 시작
      startReading();
    } catch (error) {
      statusSpan.textContent = `상태: 열기 실패 - ${error.message}`;
      console.error('Failed to open serial port:', error);
      // 열기 실패 시 UI 상태 복원
      openButton.disabled = false;
      closeButton.disabled = true;
      
      // 설정 다시 활성화
      baudrateInput.disabled = false;
      dataBitsSelect.disabled = false;
      paritySelect.disabled = false;
      stopBitsSelect.disabled = false;
      bufferInput.disabled = false;
      flowControlSelect.disabled = false;
    }
  }

  // Close Port 버튼 클릭 이벤트 핸들러
  async function handleClosePort() {
    if (currentPort.value) {
      try {
        if (reader) {
          await reader.cancel();
          reader = null;
        }
        
        await currentPort.value.close();
        statusSpan.textContent = 'Device Disconnected';
        openButton.disabled = false;
        closeButton.disabled = true;
        
        // 설정 다시 활성화
        baudrateInput.disabled = false;
        dataBitsSelect.disabled = false;
        paritySelect.disabled = false;
        stopBitsSelect.disabled = false;
        bufferInput.disabled = false;
        flowControlSelect.disabled = false;
        
        currentPort.value = null;
      } catch (error) {
        statusSpan.textContent = `상태: 닫기 실패 - ${error.message}`;
        console.error('Failed to close serial port:', error);
        // 닫기 실패 시 UI 상태 유지
        openButton.disabled = true;
        closeButton.disabled = false;
      }
    }
  }

  // 이벤트 리스너 등록
  openButton.addEventListener('click', handleOpenPort);
  closeButton.addEventListener('click', handleClosePort);
  
  // 초기 상태 설정
  requestPortButton.style.display = 'none';
  openButton.disabled = false;
  closeButton.disabled = true;
  
  // 클린업 함수 반환 (필요 시 이벤트 제거용)
  return () => {
    openButton.removeEventListener('click', handleOpenPort);
    closeButton.removeEventListener('click', handleClosePort);
  };
}
