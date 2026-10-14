import { NextResponse } from "next/server";
import { getStatus, YeelightError } from "@/lib/yeelight-client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get("ip");

  if (!ip) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "ip 쿼리 파라미터가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const status = await getStatus(ip);
    return NextResponse.json(status);
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
