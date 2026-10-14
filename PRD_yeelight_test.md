# PRD: Yeelight 실기기 제어 테스트 기능

## 1. 배경 및 목적
- 현재 `src/lib/light-controller.ts`는 조명 서비스를 추상화한 인터페이스(`LightController`)만 정의되어 있고, 실제 구현체(Hue든 Yeelight든)는 없는 상태다.
- 사용자는 Yeelight 기기를 로컬 Wi-Fi에 이미 연결했고, 개발 중인 앱에서 **켜기 / 끄기 / 깜빡이기(blink) / RGB 색상 변경**을 실제로 테스트하려 한다.
- 이 PRD는 "도깨비불" 앱의 감성 UX와는 별개로, **조명 제어 동작을 검증하기 위한 개발자용 테스트 화면 + Yeelight 연동 레이어**를 만드는 것을 목표로 한다.

## 2. 범위
### In Scope
- Yeelight LAN Control(로컬 네트워크 UDP/TCP) 기반 연동
- 기능: 전원 ON/OFF, 깜빡임(blink/flash), RGB 색상 지정(hex 입력 → Yeelight RGB 변환)
- Next.js 서버(API Route)에서 기기와 직접 통신, 클라이언트는 API 호출만 수행
- `/dev/yeelight` 같은 개발자 전용 테스트 페이지(버튼 + 색상 입력 UI)
- 기기 1대 기준 수동 IP 설정(자동 디스커버리는 Out of Scope, 단 스트레치 목표로 언급)

### Out of Scope
- Yeelight 클라우드 API 연동 (LAN Control만 사용)
- 다중 기기 그룹 제어, 씬(scene) 저장
- "도깨비불" 메인 스토리보드 UX에 실제 조명 연동을 끼워넣는 작업 (이번엔 테스트 레이어만)
- 조명 자동 디스커버리(SSDP) — 필요 시 후속 과제

## 3. 전제조건
- Yeelight 기기에서 "LAN Control" 모드가 켜져 있어야 함 (Yeelight 앱 → 기기 설정 → LAN Control 활성화).
- 앱 서버와 Yeelight 기기가 **동일 로컬 네트워크(같은 서브넷)** 에 있어야 함.
- 기기 IP는 공유기 관리 화면 또는 Yeelight 앱에서 확인하여 수동 입력(환경변수 또는 테스트 페이지 입력창).

## 4. Yeelight LAN Control 프로토콜 요약
- 통신: 기기의 TCP 포트 **55443**으로 JSON 커맨드 전송, `\r\n`으로 종료.
- 명령 포맷 예시:
  ```json
  {"id":1,"method":"set_power","params":["on","smooth",500]}
  {"id":2,"method":"set_power","params":["off","smooth",500]}
  {"id":3,"method":"set_rgb","params":[16711680,"smooth",500]}
  {"id":4,"method":"start_cf","params":[4,0,"500,1,16711680,100,500,1,16711680,1,500,1,16711680,100,500,1,16711680,1"]}
  ```
  - `set_rgb`의 색상 값은 24bit 정수(`R*65536 + G*256 + B`)이므로 hex(`#RRGGBB`) → int 변환 필요.
  - 깜빡임은 `start_cf`(color flow) 또는 `set_power` on/off를 짧은 간격으로 반복 호출하는 방식 중 택1. 권장: `start_cf`로 자연스러운 flash 구현.
- 응답: `{"id":1,"result":["ok"]}` 형태로 TCP 소켓에 돌아옴. Node 런타임에서 `net.Socket`으로 직접 구현 (브라우저에서 TCP 소켓 불가 → 반드시 서버 사이드).

## 5. 기능 요구사항

| ID | 기능 | 설명 | 우선순위 |
|----|------|------|----------|
| F1 | 전원 ON | 기기 IP로 `set_power on` 전송 | P0 |
| F2 | 전원 OFF | 기기 IP로 `set_power off` 전송 | P0 |
| F3 | 깜빡이기 | N회, 간격(ms) 지정 가능한 flash 트리거 | P0 |
| F4 | 색상 변경 | hex 입력(`#RRGGBB`) → `set_rgb` 변환 전송 | P0 |
| F5 | 상태 조회 | 현재 전원/색상 상태를 `get_prop`으로 조회해 테스트 화면에 표시 | P1 |
| F6 | 기기 IP 설정 UI | 테스트 페이지에서 IP 입력/저장(localStorage or env) | P1 |
| F7 | 에러 핸들링 | 연결 실패, LAN Control 꺼짐, 타임아웃 시 명확한 에러 메시지 | P0 |

## 6. 아키텍처

```
[Dev Test Page]  src/app/dev/yeelight/page.tsx
      │  fetch(POST)
      ▼
[API Route]      src/app/api/yeelight/[action]/route.ts
      │  TCP (net.Socket, port 55443)
      ▼
[Yeelight 기기]   로컬 네트워크 내 실기기
```

- `src/lib/yeelight-client.ts`: TCP 커맨드 전송 공통 로직 (connect → send JSON → read response → close)
- `src/lib/light-controller.ts`의 `LightController` 인터페이스를 Yeelight로 구현한 `YeelightController` 클래스 추가 (기존 추상화 재사용)
- API Route는 Node.js 런타임 강제 (`export const runtime = "nodejs"`) — Edge 런타임은 TCP 소켓 미지원
- 기기 IP/포트는 환경변수(`YEELIGHT_DEVICE_IP`) 기본값 + 테스트 페이지에서 오버라이드 가능

## 7. API 설계

### `POST /api/yeelight/power`
```json
{ "ip": "192.168.0.23", "state": "on" | "off" }
```

### `POST /api/yeelight/color`
```json
{ "ip": "192.168.0.23", "hex": "#FF8800" }
```

### `POST /api/yeelight/blink`
```json
{ "ip": "192.168.0.23", "times": 5, "intervalMs": 500, "hex": "#FFFFFF" }
```

### `GET /api/yeelight/status?ip=192.168.0.23`
```json
{ "power": "on", "rgb": 16711680, "bright": 100 }
```

모든 응답 공통 실패 포맷:
```json
{ "error": "CONNECTION_TIMEOUT" | "DEVICE_REFUSED" | "INVALID_HEX" | ... , "message": "사람이 읽을 설명" }
```

## 8. 테스트 페이지 UI (`/dev/yeelight`)
- 기기 IP 입력 필드 + "저장" 버튼 (localStorage)
- ON / OFF 버튼
- "깜빡이기" 버튼 + 횟수/간격 입력
- 색상 피커 또는 hex 텍스트 입력 + "적용" 버튼
- 현재 상태 표시(F5 연동): 전원, RGB 미리보기 스와치
- 최근 전송한 명령/응답 로그 영역 (디버깅용)
- shadcn/ui 기존 컴포넌트(`src/components/ui`) 재사용, 디자인은 디자인 시스템 따를 필요 없이 기능 우선(개발자 전용 페이지임을 안내 배너로 표시)

## 9. 비기능 요구사항
- 명령 전송 타임아웃: 3초 (연결/응답 모두)
- 동시에 여러 명령이 들어와도 소켓 충돌 없도록 요청마다 새 TCP 연결 생성 후 종료 (keep-alive 불필요, 단순성 우선)
- 민감정보(기기 IP) 클라이언트 localStorage 저장은 허용(로컬 네트워크 내부 정보이므로), `.env`에는 기본값만

## 10. 수용 기준 (Acceptance Criteria)
1. `/dev/yeelight` 페이지에서 저장한 IP로 ON 버튼 클릭 시 실제 기기가 2초 이내 켜진다.
2. OFF 버튼 클릭 시 기기가 꺼진다.
3. "깜빡이기" 버튼 클릭 시 설정한 횟수만큼 기기가 점멸한다.
4. hex 색상 입력(`#00FF00` 등) 후 적용 시 기기 색이 해당 RGB로 변경된다.
5. 기기 IP가 틀리거나 LAN Control이 꺼져 있을 때, 타임아웃 후 화면에 에러 메시지가 표시된다(무한 로딩 없음).
6. 상태 조회 버튼/자동 폴링으로 현재 전원 상태가 화면에 반영된다.

## 11. 리스크 및 주의사항
- TCP 소켓은 Node.js 런타임에서만 동작 → Vercel Edge Functions, 브라우저에서는 불가. 반드시 Node 런타임 API Route로 구현.
- Yeelight 기기가 DHCP로 IP가 바뀔 수 있음 → 공유기에서 고정 IP(또는 IP 예약) 권장 안내 문구 추가.
- 기기가 같은 네트워크에 없으면(테더링, VPN 등) 연결 실패 → 안내 메시지에 "같은 Wi-Fi인지 확인" 문구 포함.
- color flow(`start_cf`) 중 다른 명령이 들어오면 flow가 충돌할 수 있음 → blink 실행 중에는 버튼 비활성화 처리.

## 12. 향후 과제 (Out of Scope, 메모만)
- SSDP 기반 자동 디바이스 디스커버리
- 다중 기기 관리 및 "도깨비불" 메인 UX에 실제 조명 연동 통합
- 색온도(색상 아닌 K값) 제어, 밝기 슬라이더 추가
