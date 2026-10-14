# Yeelight Controller

Yeelight 조명을 로컬 네트워크에서 직접 제어할 수 있는지 검증하기 위한 Next.js 기반 PoC(기술 검증 프로젝트)입니다.

이 프로젝트는 도깨비불 앱에 조명 연동을 적용하기 전에 Yeelight LAN Control의 실제 동작과 네트워크 제약을 확인하는 용도로 만들었습니다.

## 검증된 기능

실제 Yeelight 기기에서 다음 기능의 동작을 확인했습니다.

- 전원 켜기 / 끄기
- RGB 색상 변경
- 밝기 조절(1~100%)
- 지정한 색상과 횟수로 깜빡이기
- 전원, RGB, 밝기 상태 조회
- 기기 IP를 브라우저 localStorage에 저장
- 최근 명령과 응답 로그 표시
- 연결 실패 및 3초 타임아웃 처리

## 동작 구조

```text
[브라우저 테스트 페이지]
          │ HTTP
          ▼
[Next.js API Route / Node.js]
          │ TCP 55443
          ▼
[같은 로컬 네트워크의 Yeelight]
```

브라우저는 Yeelight의 TCP 소켓에 직접 연결할 수 없으므로 Next.js 서버가 중계 역할을 합니다.

## 사전 준비

- Node.js 20 이상
- LAN Control을 지원하는 Yeelight 기기
- 개발 컴퓨터와 Yeelight가 연결된 동일한 로컬 네트워크
- Yeelight 기기의 로컬 IP 주소

Yeelight 앱의 기기 설정에서 **LAN Control**을 활성화해야 합니다. 공유기의 게스트 Wi-Fi나 공공 Wi-Fi는 기기 간 통신을 차단할 수 있습니다.

## 설치 및 실행

저장소를 복제하고 패키지를 설치합니다.

```bash
git clone https://github.com/kigizz1902-beep/yeelight-controller.git
cd yeelight-controller
npm install
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:3000/dev/yeelight
```

테스트 페이지에 Yeelight의 IP 주소를 입력하고 저장한 뒤 각 기능을 실행합니다.

## 핸드폰에서 테스트하기

핸드폰, 개발 컴퓨터, Yeelight를 동일한 Wi-Fi에 연결합니다. 개발 서버가 로컬 네트워크의 접속을 받을 수 있도록 실행합니다.

```bash
npm run dev -- --hostname 0.0.0.0
```

개발 컴퓨터의 로컬 IP가 `192.168.0.10`이라면 핸드폰 브라우저에서 다음 주소로 접속합니다.

```text
http://192.168.0.10:3000/dev/yeelight
```

운영체제 방화벽이 네트워크 접근을 요청하면 Node.js의 로컬 네트워크 접속을 허용해야 합니다.

## API

| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | `/api/yeelight/power` | 전원 ON/OFF |
| POST | `/api/yeelight/color` | RGB 색상 변경 |
| POST | `/api/yeelight/bright` | 밝기 변경 |
| POST | `/api/yeelight/blink` | 깜빡임 실행 |
| GET | `/api/yeelight/status?ip=...` | 현재 상태 조회 |

Yeelight 통신은 요청마다 TCP 포트 `55443`에 연결하여 JSON 명령을 전송합니다. API Route는 TCP 소켓을 사용할 수 있도록 Node.js 런타임에서 실행됩니다.

## 주요 파일

```text
src/
├── app/
│   ├── api/yeelight/       # 기능별 API Route
│   └── dev/yeelight/       # 개발자용 테스트 페이지
└── lib/
    ├── light-controller.ts # 조명 제어 인터페이스
    └── yeelight-client.ts  # Yeelight TCP 통신
```

상세 요구사항은 [PRD_yeelight_test.md](./PRD_yeelight_test.md)에서 확인할 수 있습니다.

## 현재 제약

- Yeelight 자동 검색 기능은 구현하지 않았으므로 IP를 직접 입력해야 합니다.
- Yeelight와 Next.js 서버가 서로 통신 가능한 동일한 로컬 네트워크에 있어야 합니다.
- Vercel 같은 외부 서버에서는 가정이나 교실 내부의 사설 IP를 가진 조명에 직접 연결할 수 없습니다.
- 핸드폰 브라우저만으로는 Yeelight에 직접 TCP 연결할 수 없으므로 현재 구조에서는 Next.js 서버를 실행하는 컴퓨터가 필요합니다.
- 슬라이더의 실시간 변화는 Yeelight 공식 앱만큼 부드럽지 않을 수 있습니다.

## 프로젝트 범위

이 저장소는 Yeelight 제어 가능성을 확인하기 위한 PoC입니다. 도깨비불의 최종 화면과 이야기 경험은 포함하지 않습니다.

향후 모바일 앱에서 핸드폰이 조명에 직접 연결하도록 구현하면 개인 공유기, 핸드폰, Yeelight만으로 시연할 수 있습니다. 현재 검증된 명령과 오류 처리 방식은 해당 모바일 구현의 기준 자료로 사용할 예정입니다.
