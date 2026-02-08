/**
 * ADB over WebUSB
 * Basic ADB protocol implementation for USB communication
 * Reference: https://source.android.com/docs/core/interaction/adb
 */

export type ADBConnection = {
  device: USBDevice;
  connected: boolean;
  sendShellCommand: (cmd: string) => Promise<string>;
  takeScreenshot: () => Promise<Blob>;
  disconnect: () => Promise<void>;
};

// ADB protocol constants
const ADB_PROTOCOL_VERSION = 0x01000000;
const ADB_MAX_PAYLOAD = 4096;

// ADB command constants
const A_CNXN = 0x4e584e43;
const A_OPEN = 0x4e45504f;
const A_OKAY = 0x59414b4f;
const A_CLSE = 0x45534c43;
const A_WRTE = 0x45545257;
const A_AUTH = 0x48545541;

/**
 * Basic ADB message structure
 */
type ADBMessage = {
  command: number;
  arg0: number;
  arg1: number;
  data: Uint8Array;
};

/**
 * Find ADB interface endpoints in USB device
 */
function findADBEndpoints(device: USBDevice): {
  interfaceNumber: number;
  endpointIn: number;
  endpointOut: number;
} | null {
  if (!device.configuration) return null;

  // Find ADB interface (class 0xFF, subclass 0x42, protocol 0x01)
  for (const iface of device.configuration.interfaces) {
    const alt = iface.alternate;
    if (
      alt.interfaceClass === 0xff &&
      alt.interfaceSubclass === 0x42 &&
      alt.interfaceProtocol === 0x01
    ) {
      const endpointIn = alt.endpoints.find((ep: USBEndpoint) => ep.direction === 'in');
      const endpointOut = alt.endpoints.find((ep: USBEndpoint) => ep.direction === 'out');

      if (endpointIn && endpointOut) {
        return {
          interfaceNumber: iface.interfaceNumber,
          endpointIn: endpointIn.endpointNumber,
          endpointOut: endpointOut.endpointNumber,
        };
      }
    }
  }

  // Fallback: use first bulk transfer endpoints
  for (const iface of device.configuration.interfaces) {
    const alt = iface.alternate;
    const endpointIn = alt.endpoints.find(
      (ep: USBEndpoint) => ep.direction === 'in' && ep.type === 'bulk'
    );
    const endpointOut = alt.endpoints.find(
      (ep: USBEndpoint) => ep.direction === 'out' && ep.type === 'bulk'
    );

    if (endpointIn && endpointOut) {
      return {
        interfaceNumber: iface.interfaceNumber,
        endpointIn: endpointIn.endpointNumber,
        endpointOut: endpointOut.endpointNumber,
      };
    }
  }

  return null;
}

/**
 * Calculate ADB message checksum
 */
function calculateChecksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i]!;
  }
  return sum & 0xffffffff;
}

/**
 * Encode ADB message to binary format
 */
function encodeMessage(msg: ADBMessage): Uint8Array {
  const header = new ArrayBuffer(24);
  const view = new DataView(header);

  view.setUint32(0, msg.command, true); // command
  view.setUint32(4, msg.arg0, true); // arg0
  view.setUint32(8, msg.arg1, true); // arg1
  view.setUint32(12, msg.data.length, true); // data length
  view.setUint32(16, calculateChecksum(msg.data), true); // data checksum
  view.setUint32(20, msg.command ^ 0xffffffff, true); // magic

  const result = new Uint8Array(24 + msg.data.length);
  result.set(new Uint8Array(header), 0);
  result.set(msg.data, 24);

  return result;
}

/**
 * Decode binary data to ADB message
 */
function decodeMessage(data: Uint8Array): ADBMessage | null {
  if (data.length < 24) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const command = view.getUint32(0, true);
  const arg0 = view.getUint32(4, true);
  const arg1 = view.getUint32(8, true);
  const dataLength = view.getUint32(12, true);
  const magic = view.getUint32(20, true);

  // Verify magic
  if (magic !== (command ^ 0xffffffff)) {
    return null;
  }

  const messageData = new Uint8Array(dataLength);
  if (data.length >= 24 + dataLength) {
    messageData.set(data.subarray(24, 24 + dataLength));
  }

  return {
    command,
    arg0,
    arg1,
    data: messageData,
  };
}

/**
 * Create ADB connection to USB device
 * NOTE: Simplified implementation - does not handle full authentication
 */
export async function createADBConnection(device: USBDevice): Promise<ADBConnection> {
  const endpoints = findADBEndpoints(device);
  if (!endpoints) {
    throw new Error('No ADB endpoints found on device');
  }

  let connected = false;
  let localId = 1;

  /**
   * Send ADB message to device
   */
  async function sendMessage(msg: ADBMessage): Promise<void> {
    const data = encodeMessage(msg);
    await device.transferOut(endpoints!.endpointOut, data as BufferSource);
  }

  /**
   * Receive ADB message from device
   */
  async function receiveMessage(): Promise<ADBMessage | null> {
    try {
      const result = await device.transferIn(endpoints!.endpointIn, ADB_MAX_PAYLOAD);
      if (result.data) {
        return decodeMessage(new Uint8Array(result.data.buffer));
      }
    } catch (error) {
      console.error('Failed to receive ADB message:', error);
    }
    return null;
  }

  /**
   * Initialize ADB connection (CNXN handshake)
   * Simplified - skips full authentication for demo
   */
  async function connect(): Promise<void> {
    const systemIdentity = new TextEncoder().encode(
      'host::features=shell_v2,cmd,stat_v2,ls_v2,fixed_push_mkdir,apex,abb,fixed_push_symlink_timestamp,abb_exec,remount_shell,track_app,sendrecv_v2,sendrecv_v2_brotli,sendrecv_v2_lz4,sendrecv_v2_zstd,sendrecv_v2_dry_run_send'
    );

    // Send CNXN message
    await sendMessage({
      command: A_CNXN,
      arg0: ADB_PROTOCOL_VERSION,
      arg1: ADB_MAX_PAYLOAD,
      data: systemIdentity,
    });

    // Wait for response (AUTH or CNXN)
    const response = await receiveMessage();
    if (!response) {
      throw new Error('No response from device');
    }

    // If AUTH required, send dummy signature (simplified - won't work with all devices)
    if (response.command === A_AUTH) {
      // In production, implement proper RSA authentication
      // For now, just mark as connected for demo purposes
      console.warn('ADB authentication required - simplified demo mode');
    }

    connected = true;
  }

  /**
   * Send shell command to device
   */
  async function sendShellCommand(cmd: string): Promise<string> {
    if (!connected) {
      throw new Error('Not connected to device');
    }

    const shellService = new TextEncoder().encode(`shell:${cmd}`);
    const currentLocalId = localId++;

    // Open shell service
    await sendMessage({
      command: A_OPEN,
      arg0: currentLocalId,
      arg1: 0,
      data: shellService,
    });

    // Wait for OKAY response
    const openResponse = await receiveMessage();
    if (!openResponse || openResponse.command !== A_OKAY) {
      throw new Error('Failed to open shell service');
    }

    const remoteId = openResponse.arg0;
    const responses: string[] = [];

    // Read response data
    while (true) {
      const msg = await receiveMessage();
      if (!msg) break;

      if (msg.command === A_WRTE) {
        // Send OKAY to acknowledge
        await sendMessage({
          command: A_OKAY,
          arg0: currentLocalId,
          arg1: remoteId,
          data: new Uint8Array(0),
        });

        // Collect response data
        const text = new TextDecoder().decode(msg.data);
        responses.push(text);
      } else if (msg.command === A_CLSE) {
        // Connection closed
        break;
      }
    }

    return responses.join('');
  }

  /**
   * Take screenshot from device
   */
  async function takeScreenshot(): Promise<Blob> {
    // Use screencap command to capture screen
    const output = await sendShellCommand('screencap -p');

    // Convert base64 or raw bytes to Blob
    // Note: screencap -p outputs PNG format
    const bytes = new TextEncoder().encode(output);
    return new Blob([bytes], { type: 'image/png' });
  }

  /**
   * Disconnect from device
   */
  async function disconnect(): Promise<void> {
    connected = false;
    // Send disconnect if needed
  }

  // Initialize connection
  await connect();

  return {
    device,
    connected,
    sendShellCommand,
    takeScreenshot,
    disconnect,
  };
}
