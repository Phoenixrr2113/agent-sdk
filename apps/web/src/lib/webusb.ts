/**
 * WebUSB Utility
 * Wrapper around navigator.usb API for device management
 */

export type WebUSBDevice = {
  vendorId: number;
  productId: number;
  productName?: string;
  serialNumber?: string;
};

/**
 * Check if WebUSB is supported in the current browser
 */
export function isWebUSBSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/**
 * Request user to select a USB device
 * Opens browser's device picker dialog
 */
export async function requestDevice(): Promise<USBDevice | null> {
  if (!isWebUSBSupported() || !navigator.usb) {
    throw new Error('WebUSB is not supported in this browser');
  }

  try {
    // Android devices typically have vendorId 0x18d1 (Google) or device-specific
    const device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: 0x18d1 }, // Google
        { vendorId: 0x04e8 }, // Samsung
        { vendorId: 0x22b8 }, // Motorola
        { vendorId: 0x0bb4 }, // HTC
        { vendorId: 0x1004 }, // LG
        { vendorId: 0x0fce }, // Sony Ericsson
        { vendorId: 0x2717 }, // Xiaomi
        { vendorId: 0x2a45 }, // OnePlus
      ],
    });

    return device;
  } catch (error) {
    // User cancelled or error occurred
    console.error('Failed to request USB device:', error);
    return null;
  }
}

/**
 * List all paired USB devices
 */
export async function listDevices(): Promise<USBDevice[]> {
  if (!isWebUSBSupported() || !navigator.usb) {
    return [];
  }

  try {
    const devices = await navigator.usb.getDevices();
    return devices;
  } catch (error) {
    console.error('Failed to list USB devices:', error);
    return [];
  }
}

/**
 * Connect to a USB device
 * Opens the device and claims the interface
 */
export async function connect(device: USBDevice): Promise<void> {
  try {
    if (!device.opened) {
      await device.open();
    }

    // Select first configuration if not already selected
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Find and claim ADB interface (class 0xFF, subclass 0x42, protocol 0x01)
    const adbInterface = device.configuration?.interfaces.find(
      (iface: USBInterface) =>
        iface.alternate.interfaceClass === 0xff &&
        iface.alternate.interfaceSubclass === 0x42 &&
        iface.alternate.interfaceProtocol === 0x01
    );

    if (adbInterface) {
      await device.claimInterface(adbInterface.interfaceNumber);
    } else {
      // Fallback: claim first available interface
      if (device.configuration?.interfaces[0]) {
        await device.claimInterface(device.configuration.interfaces[0].interfaceNumber);
      }
    }
  } catch (error) {
    console.error('Failed to connect to USB device:', error);
    throw error;
  }
}

/**
 * Disconnect from a USB device
 * Releases claimed interfaces and closes the device
 */
export async function disconnect(device: USBDevice): Promise<void> {
  try {
    if (device.opened) {
      // Release all claimed interfaces
      if (device.configuration) {
        for (const iface of device.configuration.interfaces) {
          if (iface.claimed) {
            await device.releaseInterface(iface.interfaceNumber);
          }
        }
      }

      await device.close();
    }
  } catch (error) {
    console.error('Failed to disconnect USB device:', error);
    throw error;
  }
}

/**
 * Convert USBDevice to WebUSBDevice info object
 */
export function getDeviceInfo(device: USBDevice): WebUSBDevice {
  return {
    vendorId: device.vendorId,
    productId: device.productId,
    productName: device.productName,
    serialNumber: device.serialNumber,
  };
}
