import { NextResponse } from "next/server";
import { setBright, YeelightError } from "@/lib/yeelight-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const { ip, bright } = body as { ip?: string; bright?: number };

  if (!ip || bright === undefined) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "ip와 bright가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    await setBright(ip, bright);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof YeelightError) {
      const status = err.code === "INVALID_BRIGHTNESS" ? 400 : 502;
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
