import net from "node:net";

const YEELIGHT_PORT = 55443;
const COMMAND_TIMEOUT_MS = 3000;

export type YeelightErrorCode =
  | "CONNECTION_TIMEOUT"
  | "DEVICE_REFUSED"
  | "INVALID_RESPONSE"
  | "INVALID_HEX"
  | "INVALID_BRIGHTNESS";

export class YeelightError extends Error {
  code: YeelightErrorCode;

  constructor(code: YeelightErrorCode, message: string) {
    super(message);
    this.name = "YeelightError";
    this.code = code;
  }
}

interface YeelightResponse {
  id: number;
  result?: unknown[];
  error?: { code: number; message: string };
}

let nextId = 1;

function sendCommand(
  ip: string,
  method: string,
  params: (string | number)[],
): Promise<YeelightResponse> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const socket = new net.Socket();
    let buffer = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn();
    };

    socket.setTimeout(COMMAND_TIMEOUT_MS);

    socket.on("timeout", () => {
      finish(() =>
        reject(
          new YeelightError(
            "CONNECTION_TIMEOUT",
            `${ip}:${YEELIGHT_PORT} 응답이 ${COMMAND_TIMEOUT_MS}ms 내에 없습니다. 같은 Wi-Fi인지, LAN Control이 켜져 있는지 확인하세요.`,
          ),
        ),
      );
    });

    socket.on("error", (err) => {
      finish(() =>
        reject(
          new YeelightError(
            "DEVICE_REFUSED",
            `${ip}:${YEELIGHT_PORT} 연결에 실패했습니다: ${err.message}`,
          ),
        ),
      );
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      const newlineIndex = buffer.indexOf("\r\n");
      if (newlineIndex === -1) return;

      const line = buffer.slice(0, newlineIndex);
      try {
        const parsed = JSON.parse(line) as YeelightResponse;
        finish(() => resolve(parsed));
      } catch {
        finish(() =>
          reject(
            new YeelightError(
              "INVALID_RESPONSE",
              `기기 응답을 해석할 수 없습니다: ${line}`,
            ),
          ),
        );
      }
    });

    socket.connect(YEELIGHT_PORT, ip, () => {
      const payload = JSON.stringify({ id, method, params }) + "\r\n";
      socket.write(payload);
    });
  });
}

export async function setPower(ip: string, state: "on" | "off"): Promise<void> {
  const response = await sendCommand(ip, "set_power", [state, "smooth", 500]);
  if (response.error) {
    throw new YeelightError(
      "DEVICE_REFUSED",
      `기기가 명령을 거부했습니다: ${response.error.message}`,
    );
  }
}

export function hexToYeelightRgb(hex: string): number {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) {
    throw new YeelightError(
      "INVALID_HEX",
      `색상 형식이 잘못되었습니다: "${hex}" (예: #FF8800)`,
    );
  }
  return parseInt(match[1], 16);
}

export async function setColor(ip: string, hex: string): Promise<void> {
  const rgb = hexToYeelightRgb(hex);
  const response = await sendCommand(ip, "set_rgb", [rgb, "smooth", 500]);
  if (response.error) {
    throw new YeelightError(
      "DEVICE_REFUSED",
      `기기가 명령을 거부했습니다: ${response.error.message}`,
    );
  }
}

export async function setBright(ip: string, bright: number): Promise<void> {
  if (!Number.isInteger(bright) || bright < 1 || bright > 100) {
    throw new YeelightError(
      "INVALID_BRIGHTNESS",
      `밝기 값이 잘못되었습니다: ${bright} (1~100 사이 정수만 허용)`,
    );
  }
  const response = await sendCommand(ip, "set_bright", [bright, "smooth", 300]);
  if (response.error) {
    throw new YeelightError(
      "DEVICE_REFUSED",
      `기기가 명령을 거부했습니다: ${response.error.message}`,
    );
  }
}

export async function getStatus(ip: string): Promise<{
  power: "on" | "off";
  rgb: number;
  bright: number;
}> {
  const response = await sendCommand(ip, "get_prop", [
    "power",
    "rgb",
    "bright",
  ]);
  if (response.error || !response.result) {
    throw new YeelightError(
      "DEVICE_REFUSED",
      `상태 조회에 실패했습니다: ${response.error?.message ?? "결과 없음"}`,
    );
  }
  const [power, rgb, bright] = response.result as [string, string, string];
  return {
    power: power === "on" ? "on" : "off",
    rgb: Number(rgb),
    bright: Number(bright),
  };
}

export async function blink(
  ip: string,
  times: number,
  intervalMs: number,
  hex: string = "#FFFFFF",
): Promise<void> {
  const rgb = hexToYeelightRgb(hex);
  const half = Math.max(1, Math.floor(intervalMs / 2));
  const flowExpression = Array.from({ length: times })
    .map(() => `${half},1,${rgb},100,${half},1,${rgb},1`)
    .join(",");

  const response = await sendCommand(ip, "start_cf", [
    times * 2,
    0,
    flowExpression,
  ]);
  if (response.error) {
    throw new YeelightError(
      "DEVICE_REFUSED",
      `기기가 명령을 거부했습니다: ${response.error.message}`,
    );
  }
}
