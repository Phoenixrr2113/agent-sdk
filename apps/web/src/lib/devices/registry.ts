import type {
  DeviceConnection,
  DeviceCapabilities,
  ConnectionStatus,
} from '../types/device';
import type { DeviceDriver } from './driver';

type RegisteredDevice = {
  connection: DeviceConnection;
  driver: DeviceDriver;
};

type DeviceRegistry = {
  register(
    deviceId: string,
    userId: string,
    driver: DeviceDriver,
    capabilities: DeviceCapabilities
  ): Promise<DeviceConnection>;
  unregister(deviceId: string): Promise<boolean>;
  getDevice(deviceId: string): RegisteredDevice | undefined;
  getDevicesByUser(userId: string): RegisteredDevice[];
  getAllDevices(): RegisteredDevice[];
  updateStatus(deviceId: string, status: ConnectionStatus, error?: string): boolean;
  isConnected(deviceId: string): boolean;
  clear(): void;
};

export function createDeviceRegistry(): DeviceRegistry {
  const devices = new Map<string, RegisteredDevice>();

  return {
    async register(
      deviceId: string,
      userId: string,
      driver: DeviceDriver,
      capabilities: DeviceCapabilities
    ): Promise<DeviceConnection> {
      const now = new Date().toISOString();

      const connection: DeviceConnection = {
        deviceId,
        userId,
        status: 'connected',
        capabilities,
        lastSeenAt: now,
        connectedAt: now,
      };

      devices.set(deviceId, { connection, driver });

      return connection;
    },

    async unregister(deviceId: string): Promise<boolean> {
      const device = devices.get(deviceId);
      if (!device) {
        return false;
      }

      if (device.driver.disconnect) {
        await device.driver.disconnect();
      }

      devices.delete(deviceId);
      return true;
    },

    getDevice(deviceId: string): RegisteredDevice | undefined {
      const device = devices.get(deviceId);
      if (device) {
        device.connection.lastSeenAt = new Date().toISOString();
      }
      return device;
    },

    getDevicesByUser(userId: string): RegisteredDevice[] {
      const result: RegisteredDevice[] = [];
      for (const device of devices.values()) {
        if (device.connection.userId === userId) {
          result.push(device);
        }
      }
      return result;
    },

    getAllDevices(): RegisteredDevice[] {
      return Array.from(devices.values());
    },

    updateStatus(deviceId: string, status: ConnectionStatus, error?: string): boolean {
      const device = devices.get(deviceId);
      if (!device) {
        return false;
      }

      device.connection.status = status;
      device.connection.lastSeenAt = new Date().toISOString();
      if (error) {
        device.connection.error = error;
      } else {
        delete device.connection.error;
      }

      return true;
    },

    isConnected(deviceId: string): boolean {
      const device = devices.get(deviceId);
      return device?.connection.status === 'connected';
    },

    clear(): void {
      devices.clear();
    },
  };
}

export type { DeviceRegistry, RegisteredDevice };
