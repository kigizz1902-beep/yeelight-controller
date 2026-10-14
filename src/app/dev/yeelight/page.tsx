"use client";

import { useState } from "react";

const IP_STORAGE_KEY = "yeelight_dev_ip";
const HEX_PATTERN = /^#?[0-9a-fA-F]{6}$/;

function readSavedIp(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(IP_STORAGE_KEY) ?? "";
}

interface LogEntry {
  time: string;
  label: string;
  request: unknown;
  result: "ok" | "error";
  detail: string;
}

export default function YeelightDevPage() {
  const [ip, setIp] = useState(readSavedIp);
  const [ipSaved, setIpSaved] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [hex, setHex] = useState("#FFFFFF");
  const [blinkTimes, setBlinkTimes] = useState(5);
  const [blinkInterval, setBlinkInterval] = useState(500);
  const [deviceStatus, setDeviceStatus] = useState<{
    power: string;
    rgb: number;
    bright: number;
  } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  function saveIp() {
    window.localStorage.setItem(IP_STORAGE_KEY, ip);
    setIpSaved(true);
    setTimeout(() => setIpSaved(false), 1500);
  }

  function addLog(entry: Omit<LogEntry, "time">) {
    setLogs((prev) =>
      [{ ...entry, time: new Date().toLocaleTimeString() }, ...prev].slice(
        0,
        20,
      ),
    );
  }

  async function runCommand(
    label: string,
    path: string,
    init: RequestInit,
    onSuccess?: (data: unknown) => void,
  ) {
    setLoading(true);
    setStatus(`${label} 전송 중...`);
    try {
      const res = await fetch(path, init);
      const data = await res.json();
      if (!res.ok) {
        setStatus(`에러: ${data.message}`);
        addLog({
          label,
          request: init.body ? JSON.parse(init.body as string) : { path },
          result: "error",
          detail: data.message,
        });
      } else {
        setStatus(`성공: ${label}`);
        addLog({
          label,
          request: init.body ? JSON.parse(init.body as string) : { path },
          result: "ok",
          detail: JSON.stringify(data),
        });
        onSuccess?.(data);
      }
    } catch (err) {
      const message = String(err);
      setStatus(`요청 실패: ${message}`);
      addLog({
        label,
        request: init.body ? JSON.parse(init.body as string) : { path },
        result: "error",
        detail: message,
      });
    } finally {
      setLoading(false);
    }
  }

  function sendPower(state: "on" | "off") {
    return runCommand(`전원 ${state === "on" ? "켜기" : "끄기"}`, "/api/yeelight/power", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, state }),
    });
  }

  function sendColor() {
    if (!HEX_PATTERN.test(hex)) {
      setStatus(`에러: 색상 형식이 잘못되었습니다 (예: #FF8800)`);
      return;
    }
    return runCommand("색상 변경", "/api/yeelight/color", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, hex }),
    });
  }

  function sendBlink() {
    if (blinkTimes < 1 || blinkInterval < 100) {
      setStatus("에러: 횟수는 1 이상, 간격은 100ms 이상이어야 합니다.");
      return;
    }
    return runCommand("깜빡이기", "/api/yeelight/blink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ip,
        times: blinkTimes,
        intervalMs: blinkInterval,
        hex,
      }),
    });
  }

  function fetchStatus() {
    return runCommand(
      "상태 조회",
      `/api/yeelight/status?ip=${encodeURIComponent(ip)}`,
      { method: "GET" },
      (data) => setDeviceStatus(data as typeof deviceStatus),
    );
  }

  const ipValid = ip.trim().length > 0;

  return (
    <main style={{ padding: 24, maxWidth: 560, fontFamily: "sans-serif" }}>
      <p style={{ background: "#fef08a", padding: 8, borderRadius: 4 }}>
        개발자 전용 테스트 페이지입니다.
      </p>
      <h1>Yeelight 제어 테스트</h1>

      <label style={{ display: "block", marginTop: 16 }}>
        기기 IP
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="192.168.0.23"
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={saveIp} disabled={!ipValid}>
            {ipSaved ? "저장됨" : "저장"}
          </button>
        </div>
      </label>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button disabled={loading || !ipValid} onClick={() => sendPower("on")}>
          ON
        </button>
        <button disabled={loading || !ipValid} onClick={() => sendPower("off")}>
          OFF
        </button>
        <button disabled={loading || !ipValid} onClick={fetchStatus}>
          상태 조회
        </button>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>색상</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="color"
            value={HEX_PATTERN.test(hex) ? hex : "#ffffff"}
            onChange={(e) => setHex(e.target.value)}
          />
          <input
            type="text"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            style={{ width: 100, padding: 8 }}
          />
          <button
            disabled={loading || !ipValid || !HEX_PATTERN.test(hex)}
            onClick={sendColor}
          >
            적용
          </button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>깜빡이기</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label>
            횟수
            <input
              type="number"
              min={1}
              value={blinkTimes}
              onChange={(e) => setBlinkTimes(Number(e.target.value))}
              style={{ width: 60, marginLeft: 4, padding: 8 }}
            />
          </label>
          <label>
            간격(ms)
            <input
              type="number"
              min={100}
              step={100}
              value={blinkInterval}
              onChange={(e) => setBlinkInterval(Number(e.target.value))}
              style={{ width: 80, marginLeft: 4, padding: 8 }}
            />
          </label>
          <button disabled={loading || !ipValid} onClick={sendBlink}>
            깜빡이기
          </button>
        </div>
      </section>

      {deviceStatus && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16 }}>현재 상태</h2>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span>전원: {deviceStatus.power}</span>
            <span>밝기: {deviceStatus.bright}%</span>
            <span
              style={{
                display: "inline-block",
                width: 20,
                height: 20,
                borderRadius: 4,
                border: "1px solid #ccc",
                backgroundColor: `#${deviceStatus.rgb.toString(16).padStart(6, "0")}`,
              }}
            />
          </div>
        </section>
      )}

      <p style={{ marginTop: 16 }}>{status}</p>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>명령 로그</h2>
        <div
          style={{
            marginTop: 8,
            maxHeight: 240,
            overflowY: "auto",
            border: "1px solid #ddd",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "monospace",
          }}
        >
          {logs.length === 0 && (
            <p style={{ padding: 8, color: "#888" }}>아직 명령이 없습니다.</p>
          )}
          {logs.map((log, i) => (
            <div
              key={i}
              style={{
                padding: 8,
                borderBottom: "1px solid #eee",
                color: log.result === "error" ? "#b91c1c" : "#15803d",
              }}
            >
              <div>
                [{log.time}] {log.label} — {log.result.toUpperCase()}
              </div>
              <div>req: {JSON.stringify(log.request)}</div>
              <div>res: {log.detail}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
