// Main entry point for Web Serial Monitor
import { SerialManager } from './modules/SerialManager.js';
import { ModbusParser } from './modules/ModbusParser.js';
import { ModbusInterpreter } from './modules/ModbusInterpreter.js';
import { UIController } from './modules/UIController.js';

// Check for Web Serial API support
if (!('serial' in navigator)) {
    alert('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
}

// 엔트리 포인트
document.addEventListener('DOMContentLoaded', () => {
    // 클래스 인스턴스 생성
    const serialManager = new SerialManager();
    const modbusParser = new ModbusParser();
    const modbusInterpreter = new ModbusInterpreter();
    
    // UI 컨트롤러 초기화
    const uiController = new UIController(serialManager, modbusParser, modbusInterpreter);
    uiController.init();

    // Handle page unload
    window.addEventListener('beforeunload', async () => {
        if (serialManager.isConnected()) {
            await serialManager.disconnect();
        }
    });
});
