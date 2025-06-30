/**
 * Modbus Response Length Calculator
 * Calculates expected response length based on request packet and function code
 * Handles different framing for RTU vs TCP protocols
 */
export class ModbusResponseCalculator {
  
  /**
   * Calculate expected response length for Modbus request
   * @param requestData Request packet data (hex string or Uint8Array)
   * @param connectionType RTU or TCP connection type
   * @returns Expected response length in bytes, or -1 if unknown/variable
   */
  static calculateExpectedResponseLength(
    requestData: string | Uint8Array, 
    connectionType: 'RTU' | 'TCP' | 'TCP_NATIVE'
  ): number {
    try {
      // Convert hex string to Uint8Array if needed
      let data: Uint8Array;
      if (typeof requestData === 'string') {
        data = this.hexStringToUint8Array(requestData);
      } else {
        data = requestData;
      }

      if (data.length < 2) {
        return -1; // Insufficient data
      }

      // Handle different framing structures
      if (connectionType === 'RTU') {
        return this.calculateRtuResponseLength(data);
      } else {
        return this.calculateTcpResponseLength(data, connectionType);
      }
    } catch (error) {
      console.warn('Error calculating expected response length:', error);
      return -1;
    }
  }

  /**
   * Calculate RTU response length
   * RTU Frame: [Device ID][Function Code][Data][CRC16 L][CRC16 H]
   */
  private static calculateRtuResponseLength(data: Uint8Array): number {
    if (data.length < 2) {
      return -1; // Need at least Device ID + Function Code
    }

    const deviceId = data[0];
    const functionCode = data[1];
    
    // Check for exception response (function code with high bit set)
    if (functionCode >= 0x80) {
      return 5; // Device ID + Exception FC + Exception Code + CRC(2)
    }

    // Calculate RTU response based on function code
    switch (functionCode) {
      case 0x01: // Read Coils
      case 0x02: // Read Discrete Inputs
        return this.calculateRtuCoilResponseLength(data);
      
      case 0x03: // Read Holding Registers
      case 0x04: // Read Input Registers
        return this.calculateRtuRegisterResponseLength(data);
      
      case 0x05: // Write Single Coil
      case 0x06: // Write Single Register
        return 8; // Device ID + FC + Address(2) + Value(2) + CRC(2)
      
      case 0x0F: // Write Multiple Coils
      case 0x10: // Write Multiple Registers
        return 8; // Device ID + FC + StartAddr(2) + Quantity(2) + CRC(2)
      
      case 0x07: // Read Exception Status
        return 5; // Device ID + FC + Status(1) + CRC(2)
      
      case 0x08: // Diagnostics
        return 8; // Device ID + FC + SubFunction(2) + Data(2) + CRC(2) - most common case
      
      case 0x0B: // Get Comm Event Counter
        return 8; // Device ID + FC + Status(2) + EventCount(2) + CRC(2)
      
      case 0x0C: // Get Comm Event Log
        return -1; // Variable length response
      
      case 0x11: // Report Server ID
        return -1; // Variable length response
      
      case 0x14: // Read File Record
      case 0x15: // Write File Record
        return -1; // Variable length response
      
      case 0x16: // Mask Write Register
        return 10; // Device ID + FC + Address(2) + ANDMask(2) + ORMask(2) + CRC(2)
      
      case 0x17: // Read/Write Multiple Registers
        return this.calculateRtuReadWriteMultipleResponseLength(data);
      
      case 0x18: // Read FIFO Queue
        return -1; // Variable length response
      
      case 0x2B: // Encapsulated Interface Transport
        return -1; // Variable length response
      
      default:
        return -1; // Unknown function code
    }
  }

  /**
   * Calculate TCP response length
   * TCP Frame: [MBAP Header 6 bytes][Function Code][Data]
   * or for TCP_NATIVE: [Function Code][Data] (no MBAP header)
   */
  private static calculateTcpResponseLength(data: Uint8Array, connectionType: 'TCP' | 'TCP_NATIVE'): number {
    const isNative = connectionType === 'TCP_NATIVE';
    
    if (isNative) {
      // TCP_NATIVE: direct PDU without MBAP header
      if (data.length < 1) {
        return -1; // Need at least Function Code
      }
      
      const functionCode = data[0];
      
      // Check for exception response
      if (functionCode >= 0x80) {
        return 2; // Exception FC + Exception Code
      }
      
      return this.calculateTcpNativePduLength(data, functionCode);
    } else {
      // Standard TCP with MBAP header
      if (data.length < 7) {
        return -1; // Need MBAP header + Function Code
      }
      
      // MBAP Header: Transaction ID(2) + Protocol ID(2) + Length(2)
      const mbapLength = (data[4] << 8) | data[5]; // Length field in MBAP header
      return 6 + mbapLength; // MBAP header + PDU
    }
  }

  /**
   * Calculate TCP Native PDU length (without MBAP header)
   */
  private static calculateTcpNativePduLength(data: Uint8Array, functionCode: number): number {
    switch (functionCode) {
      case 0x01: // Read Coils
      case 0x02: // Read Discrete Inputs
        return this.calculateTcpCoilResponseLength(data);
      
      case 0x03: // Read Holding Registers
      case 0x04: // Read Input Registers
        return this.calculateTcpRegisterResponseLength(data);
      
      case 0x05: // Write Single Coil
      case 0x06: // Write Single Register
        return 5; // FC + Address(2) + Value(2)
      
      case 0x0F: // Write Multiple Coils
      case 0x10: // Write Multiple Registers
        return 5; // FC + StartAddr(2) + Quantity(2)
      
      case 0x07: // Read Exception Status
        return 2; // FC + Status(1)
      
      case 0x08: // Diagnostics
        return 5; // FC + SubFunction(2) + Data(2) - most common case
      
      case 0x0B: // Get Comm Event Counter
        return 5; // FC + Status(2) + EventCount(2)
      
      case 0x0C: // Get Comm Event Log
        return -1; // Variable length response
      
      case 0x11: // Report Server ID
        return -1; // Variable length response
      
      case 0x14: // Read File Record
      case 0x15: // Write File Record
        return -1; // Variable length response
      
      case 0x16: // Mask Write Register
        return 7; // FC + Address(2) + ANDMask(2) + ORMask(2)
      
      case 0x17: // Read/Write Multiple Registers
        return this.calculateTcpReadWriteMultipleResponseLength(data);
      
      case 0x18: // Read FIFO Queue
        return -1; // Variable length response
      
      case 0x2B: // Encapsulated Interface Transport
        return -1; // Variable length response
      
      default:
        return -1; // Unknown function code
    }
  }

  // RTU-specific helper methods
  private static calculateRtuCoilResponseLength(data: Uint8Array): number {
    if (data.length < 6) {
      return -1; // Need DeviceID + FC + StartAddr(2) + Quantity(2)
    }
    
    // RTU Request: Device ID + FC + StartAddr(2) + Quantity(2) + CRC(2)
    const quantity = (data[4] << 8) | data[5]; // Quantity at offset 4-5
    
    if (quantity <= 0 || quantity > 2000) {
      return -1; // Invalid quantity
    }
    
    // Calculate number of bytes needed for coil data
    const coilBytes = Math.ceil(quantity / 8);
    
    // RTU Response: Device ID + FC + ByteCount + CoilData + CRC(2)
    return 1 + 1 + 1 + coilBytes + 2; // = 5 + coilBytes
  }

  private static calculateRtuRegisterResponseLength(data: Uint8Array): number {
    if (data.length < 6) {
      return -1; // Need DeviceID + FC + StartAddr(2) + Quantity(2)
    }
    
    // RTU Request: Device ID + FC + StartAddr(2) + Quantity(2) + CRC(2)
    const quantity = (data[4] << 8) | data[5]; // Quantity at offset 4-5
    
    if (quantity <= 0 || quantity > 125) {
      return -1; // Invalid quantity
    }
    
    // Calculate number of bytes needed for register data (2 bytes per register)
    const registerBytes = quantity * 2;
    
    // RTU Response: Device ID + FC + ByteCount + RegisterData + CRC(2)
    return 1 + 1 + 1 + registerBytes + 2; // = 5 + registerBytes
  }

  private static calculateRtuReadWriteMultipleResponseLength(data: Uint8Array): number {
    if (data.length < 4) {
      return -1; // Need DeviceID + FC + ReadStartAddr(2)
    }
    
    // RTU Request: Device ID + FC + ReadAddr(2) + ReadQty(2) + WriteAddr(2) + WriteQty(2) + ByteCount + WriteData + CRC(2)
    // Read quantity is at offset 4-5
    const readQuantity = (data[4] << 8) | data[5];
    
    if (readQuantity <= 0 || readQuantity > 125) {
      return -1; // Invalid read quantity
    }
    
    // Calculate number of bytes for read data (2 bytes per register)
    const readBytes = readQuantity * 2;
    
    // RTU Response: Device ID + FC + ByteCount + ReadData + CRC(2)
    return 1 + 1 + 1 + readBytes + 2; // = 5 + readBytes
  }

  // TCP-specific helper methods
  private static calculateTcpCoilResponseLength(data: Uint8Array): number {
    if (data.length < 5) {
      return -1; // Need FC + StartAddr(2) + Quantity(2)
    }
    
    // TCP Request: FC + StartAddr(2) + Quantity(2)
    const quantity = (data[3] << 8) | data[4]; // Quantity at offset 3-4
    
    if (quantity <= 0 || quantity > 2000) {
      return -1; // Invalid quantity
    }
    
    // Calculate number of bytes needed for coil data
    const coilBytes = Math.ceil(quantity / 8);
    
    // TCP Response: FC + ByteCount + CoilData
    return 1 + 1 + coilBytes; // = 2 + coilBytes
  }

  private static calculateTcpRegisterResponseLength(data: Uint8Array): number {
    if (data.length < 5) {
      return -1; // Need FC + StartAddr(2) + Quantity(2)
    }
    
    // TCP Request: FC + StartAddr(2) + Quantity(2)
    const quantity = (data[3] << 8) | data[4]; // Quantity at offset 3-4
    
    if (quantity <= 0 || quantity > 125) {
      return -1; // Invalid quantity
    }
    
    // Calculate number of bytes needed for register data (2 bytes per register)
    const registerBytes = quantity * 2;
    
    // TCP Response: FC + ByteCount + RegisterData
    return 1 + 1 + registerBytes; // = 2 + registerBytes
  }

  private static calculateTcpReadWriteMultipleResponseLength(data: Uint8Array): number {
    if (data.length < 5) {
      return -1; // Need FC + ReadStartAddr(2) + ReadQty(2)
    }
    
    // TCP Request: FC + ReadAddr(2) + ReadQty(2) + WriteAddr(2) + WriteQty(2) + ByteCount + WriteData
    // Read quantity is at offset 3-4
    const readQuantity = (data[3] << 8) | data[4];
    
    if (readQuantity <= 0 || readQuantity > 125) {
      return -1; // Invalid read quantity
    }
    
    // Calculate number of bytes for read data (2 bytes per register)
    const readBytes = readQuantity * 2;
    
    // TCP Response: FC + ByteCount + ReadData
    return 1 + 1 + readBytes; // = 2 + readBytes
  }

  private static hexStringToUint8Array(hex: string): Uint8Array {
    // Remove spaces and convert hex string to Uint8Array
    const cleanHex = hex.replace(/\s+/g, '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    
    return bytes;
  }

  /**
   * Get function code from request data
   * @param requestData Request packet data
   * @param connectionType Connection type
   * @returns Function code or -1 if invalid
   */
  static getFunctionCode(requestData: string | Uint8Array, connectionType: 'RTU' | 'TCP' | 'TCP_NATIVE'): number {
    try {
      let data: Uint8Array;
      if (typeof requestData === 'string') {
        data = this.hexStringToUint8Array(requestData);
      } else {
        data = requestData;
      }

      if (data.length < 1) {
        return -1;
      }

      const isRtu = connectionType === 'RTU';
      return isRtu ? (data.length > 1 ? data[1] : -1) : data[0];
    } catch (error) {
      return -1;
    }
  }

  /**
   * Check if function code supports length prediction
   * @param functionCode Modbus function code
   * @returns True if length can be predicted
   */
  static isFunctionCodePredictable(functionCode: number): boolean {
    const predictableCodes = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x0B, 0x0F, 0x10, 0x16, 0x17];
    return predictableCodes.includes(functionCode) || functionCode >= 0x80; // Include exception responses
  }

  /**
   * Validate if response length matches expected length
   * @param responseData Received response data
   * @param expectedLength Expected length
   * @param tolerance Tolerance in bytes (default: 0)
   * @returns True if length is valid
   */
  static isResponseLengthValid(responseData: string | Uint8Array, expectedLength: number, tolerance: number = 0): boolean {
    if (expectedLength <= 0) {
      return true; // Cannot validate variable length responses
    }

    let actualLength: number;
    if (typeof responseData === 'string') {
      actualLength = responseData.replace(/\s+/g, '').length / 2;
    } else {
      actualLength = responseData.length;
    }

    return Math.abs(actualLength - expectedLength) <= tolerance;
  }
}