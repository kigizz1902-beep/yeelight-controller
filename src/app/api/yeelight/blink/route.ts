import { NextResponse } from "next/server";
import { blink, YeelightError } from "@/lib/yeelight-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const { ip, times, intervalMs, hex } = body as {
    ip?: string;
    times?: number;
    intervalMs?: number;
    hex?: string;
  };

  if (!ip || !times || !intervalMs) {
    return NextResponse.json(
      {
        error: "INVALID_INPUT",
        message: "ip, times, intervalMs가 필요합니다.",
      },
      { status: 400 },
    );
  }

  try {
    await blink(ip, times, intervalMs, hex);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof YeelightError) {
      const status = err.code === "INVALID_HEX" ? 400 : 502;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    return NextResponse.json(
      { error: "UNKNOWN", message: String(err) },
      { status: 500 },
    );
  }
}
