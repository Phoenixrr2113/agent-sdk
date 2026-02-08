import type {
  DeviceAction,
  ActionResult,
  DeviceCapabilities,
  UIElement,
} from '../types/device';

export type DeviceDriver = {
  execute(action: DeviceAction): Promise<ActionResult>;
  getCapabilities(): Promise<DeviceCapabilities>;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  getUITree?(): Promise<UIElement>;
};

export type DeviceDriverFactory<TOptions = unknown> = (
  options?: TOptions
) => DeviceDriver;
