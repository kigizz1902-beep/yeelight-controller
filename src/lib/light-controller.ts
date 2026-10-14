export type PowerState = "on" | "off";

export interface LightStatus {
  power: PowerState;
  rgb: number;
  bright: number;
}

export interface LightController {
  setPower(state: PowerState): Promise<void>;
  setColor(hex: string): Promise<void>;
  blink(times: number, intervalMs: number, hex?: string): Promise<void>;
  getStatus(): Promise<LightStatus>;
}
