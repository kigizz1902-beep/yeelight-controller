import { NextResponse } from "next/server";
import { setPower } from "@/lib/yeelight-client";
import { YeelightError } from "@/lib/yeelight-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const { ip, state } = body as { ip?: string; state?: "on" | "off" };

  if (!ip || (state !== "on" && state !== "off")) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "ip와 state('on'|'off')가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    await setPower(ip, state);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof YeelightError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "UNKNOWN", message: String(err) },
      { status: 500 },
    );
  }
}
