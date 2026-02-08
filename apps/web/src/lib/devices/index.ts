export type { DeviceDriver, DeviceDriverFactory } from './driver';
export { createDeviceRegistry } from './registry';
export type { DeviceRegistry, RegisteredDevice } from './registry';

export {
  createDesktopDriver,
  createAndroidDriver,
  createWebDriver,
  discoverChromeSession,
} from './drivers/index';

export type {
  DesktopDriverOptions,
  AndroidDriverOptions,
  WebDriverOptions,
} from './drivers/index';

import { createDeviceRegistry } from './registry';
export const sharedDeviceRegistry = createDeviceRegistry();
