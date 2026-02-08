/**
 * WebUSB Device Hook
 * React hook for managing WebUSB device state
 */

import { useState, useCallback, useEffect } from 'react';
import { isWebUSBSupported, requestDevice, listDevices, connect, disconnect } from '@/lib/webusb';
import { createADBConnection, type ADBConnection } from '@/lib/adb-webusb';

export type ConnectedWebUSBDevice = {
  device: USBDevice;
  connection: ADBConnection;
  name: string;
  serialNumber?: string;
};

export type UseWebUSBReturn = {
  isSupported: boolean;
  connectedDevices: ConnectedWebUSBDevice[];
  isConnecting: boolean;
  error: string | null;
  pairDevice: () => Promise<void>;
  sendCommand: (deviceId: string, command: string) => Promise<string>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  clearError: () => void;
};

/**
 * Hook for managing WebUSB devices
 */
export function useWebUSB(): UseWebUSBReturn {
  const [isSupported] = useState(() => isWebUSBSupported());
  const [connectedDevices, setConnectedDevices] = useState<ConnectedWebUSBDevice[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Pair and connect to a new USB device
   */
  const pairDevice = useCallback(async () => {
    if (!isSupported) {
      setError('WebUSB is not supported in this browser');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request user to select device
      const device = await requestDevice();
      if (!device) {
        setIsConnecting(false);
        return; // User cancelled
      }

      // Check if device already connected
      const existingDevice = connectedDevices.find(
        (d) => d.device.serialNumber === device.serialNumber
      );
      if (existingDevice) {
        setError('Device is already connected');
        setIsConnecting(false);
        return;
      }

      // Connect to device
      await connect(device);

      // Create ADB connection
      const connection = await createADBConnection(device);

      // Add to connected devices
      const newDevice: ConnectedWebUSBDevice = {
        device,
        connection,
        name: device.productName || `USB Device ${device.productId}`,
        serialNumber: device.serialNumber,
      };

      setConnectedDevices((prev) => [...prev, newDevice]);
    } catch (err) {
      console.error('Failed to pair USB device:', err);
      setError(err instanceof Error ? err.message : 'Failed to pair USB device');
    } finally {
      setIsConnecting(false);
    }
  }, [isSupported, connectedDevices]);

  /**
   * Send shell command to a connected device
   */
  const sendCommand = useCallback(
    async (deviceId: string, command: string): Promise<string> => {
      const device = connectedDevices.find((d) => d.device.serialNumber === deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      if (!device.connection.connected) {
        throw new Error('Device not connected');
      }

      try {
        const result = await device.connection.sendShellCommand(command);
        return result;
      } catch (err) {
        console.error('Failed to send command:', err);
        throw err;
      }
    },
    [connectedDevices]
  );

  /**
   * Disconnect a device
   */
  const disconnectDevice = useCallback(
    async (deviceId: string) => {
      const device = connectedDevices.find((d) => d.device.serialNumber === deviceId);
      if (!device) {
        return;
      }

      try {
        await device.connection.disconnect();
        await disconnect(device.device);

        setConnectedDevices((prev) =>
          prev.filter((d) => d.device.serialNumber !== deviceId)
        );
      } catch (err) {
        console.error('Failed to disconnect device:', err);
        setError(err instanceof Error ? err.message : 'Failed to disconnect device');
      }
    },
    [connectedDevices]
  );

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Load previously paired devices on mount
   */
  useEffect(() => {
    if (!isSupported) return;

    async function loadPairedDevices() {
      try {
        const devices = await listDevices();

        for (const device of devices) {
          try {
            await connect(device);
            const connection = await createADBConnection(device);

            const newDevice: ConnectedWebUSBDevice = {
              device,
              connection,
              name: device.productName || `USB Device ${device.productId}`,
              serialNumber: device.serialNumber,
            };

            setConnectedDevices((prev) => {
              // Avoid duplicates
              if (prev.some((d) => d.device.serialNumber === device.serialNumber)) {
                return prev;
              }
              return [...prev, newDevice];
            });
          } catch (err) {
            console.error('Failed to connect to paired device:', err);
          }
        }
      } catch (err) {
        console.error('Failed to load paired devices:', err);
      }
    }

    loadPairedDevices();
  }, [isSupported]);

  /**
   * Handle device disconnect events
   */
  useEffect(() => {
    if (!isSupported || !navigator.usb) return;

    function handleDisconnect(event: USBConnectionEvent) {
      const device = event.device;
      setConnectedDevices((prev) =>
        prev.filter((d) => d.device.serialNumber !== device.serialNumber)
      );
    }

    navigator.usb.addEventListener('disconnect', handleDisconnect);

    return () => {
      navigator.usb?.removeEventListener('disconnect', handleDisconnect);
    };
  }, [isSupported]);

  return {
    isSupported,
    connectedDevices,
    isConnecting,
    error,
    pairDevice,
    sendCommand,
    disconnectDevice,
    clearError,
  };
}
