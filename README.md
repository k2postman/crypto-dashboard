# CryptoDash

Altrady 스타일의 레이아웃을 참고해 **직접 구현한** 개인용 암호화폐 통합 대시보드입니다.
(원본 코드·디자인 복제 없음 — 레이아웃 구조만 참고한 독자 구현)

## 특징

- **봇 카피 탭** — 리더 트레이더 현황판 + 실시간 시그널 피드 (데모 시뮬레이션)
- **시세 탭** — 바이낸스 WebSocket 실시간 티커, OKX 공개 API 가격 비교
- **포트폴리오 탭** — 보유 자산을 실시간 가격으로 평가 (데모 수량)
- **알림 탭** — 목표가 도달 시 브라우저 알림
- **설정 탭** — API 키는 브라우저 localStorage에만 저장 (서버 전송 없음)
- **TradingView lightweight-charts** 캔들 차트 (BTC/ETH)

## 실행 방법

정적 사이트라 빌드가 필요 없습니다.

```bash
# 아무 정적 서버나 사용 (예: python)
cd crypto-dashboard
python3 -m http.server 8080
# http://localhost:8080 접속
```

GitHub Pages 배포도 그대로 동작합니다 (`Settings → Pages → main / root`).

## 데이터 소스

| 데이터 | 소스 | 인증 |
|---|---|---|
| 실시간 시세·차트 | Binance `data-api.binance.vision` (공개 미러) | 불필요 |
| OKX 가격 | OKX public REST `/api/v5/market/ticker` | 불필요 |
| 내 잔고/주문 | 미구현 — settings에서 키 저장 후 확장 가능 | 읽기 전용 키 권장 |

> 일부 지역/IP에서는 OKX 직접 호출이 차단될 수 있습니다. 이 경우 대시보드가 자동으로 OKX 열을 "차단됨"으로 표시하고 나머지 기능은 정상 동작합니다. 서버 프록시를 추가하면 해제됩니다.

## 안전 주의사항

- **거래 권한이 없는 읽기 전용 API 키만** 사용하세요.
- 데모 버전은 secret을 저장하지 않습니다. 정식 구현 시 백엔드 비밀 저장소(KMS 등)를 사용하세요.
- 카피트레이딩 기능은 **실제 주문을 보내지 않는 시뮬레이션**입니다.

## 라이선스

MIT
