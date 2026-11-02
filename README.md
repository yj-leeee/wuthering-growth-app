# 명조 육성 관리 앱

React Native + Expo 기반 개인용 Android 시제품이다. 목록 → 상세 → 육성 분석 화면을 제공하고, Expo SQLite에 합성 샘플 계정을 저장한다. 실제 계정 조회·로그인·에코 상세 분석은 아직 없다. 모든 육성 목표는 테스트 예시이며 공식 권장 기준이 아니다.

## 설치와 실행

Windows PowerShell:

```powershell
Set-Location 'D:\idea_codex\wuthering-growth-app'
npm ci
npm start
```

Expo 58.0.22, React 19.3.0, React Native 0.88.1, expo-sqlite ~58.0.15를 사용한다. Expo 공식 호환표에 맞췄다. TypeScript는 SDK 권장 ~6.0.3이다. Node는 프로젝트 개발 의존성 22.23.4를 사용하며 npm 스크립트는 로컬 bin을 우선한다. 시스템 Node 22.12로 초기 npm 설치 시 엔진 경고가 나올 수 있다. 시스템 Node 설정은 수정하지 않았다.

Galaxy S23 Ultra와 PC를 같은 Wi-Fi에 연결하고 Expo Go에서 터미널 QR을 스캔한다. Expo Go는 SDK 58 지원 버전이 필요하다. 지원 버전은 https://expo.dev/go 에서 확인한다. 연결되지 않으면 같은 네트워크인지 먼저 확인하고, Windows의 해당 앱 네트워크 권한을 확인한다. 방화벽을 전체 해제하지 않는다. 에뮬레이터보다 실기기를 우선해 메모리 부담을 줄인다.

## Galaxy 확인 순서

1. 목록에서 샘플 공명자의 레벨과 충족·부족·미확인 개수를 확인한다.
2. 상세에서 무기와 5종 스킬을 확인하고 육성 분석으로 이동한다.
3. 예시 목표와 현재값, 부족·미확인 구분을 확인한다. Android 뒤로 가기로 상세·목록으로 돌아간다.
4. 앱을 완전히 종료하고 다시 열어 샘플이 1개로 유지되는지 확인한다. Expo Go 데이터 삭제·앱 제거 시 로컬 DB는 사라질 수 있다.

실기기 실행·APK 빌드는 아직 수행하지 않았다. `export:android`는 JavaScript 번들 검증이며 APK가 아니다. 네이티브 개발 빌드나 APK 제작은 Android SDK/JDK 준비 이후 별도 작업이다.

## 검사

```powershell
npm run typecheck
npm test
npm run export:android
```

strict 검사 및 Expo 의존성 호환 검사 통과. 기존 18개와 실제 SQLite 기반 신규 3개를 합해 21개 테스트 통과. Node SQLite는 실험 기능 경고가 나올 수 있다. 테스트 어댑터는 Node SQLite이며 Android Expo SQLite 네이티브 실행과 구분한다.

## 코드 구조

- `App.tsx`, `index.ts`, `app.json`: 앱 진입·기본 3개 화면·Expo 설정.
- `src/model.ts`, `src/validation.ts`, `src/analysis.ts`, `src/sample.ts`: 기존 공통 타입·엄격 입력 검증·순수 분석·합성 데이터.
- `src/storage.ts`: SQL 포트, 버전 마이그레이션, 최초 샘플 삽입, 스냅샷 저장·조회.
- `tests/core.test.ts`, `tests/storage.test.ts`: 분석·입력 무결성 및 DB 파일 재열기 테스트.

화면은 저장된 스냅샷에서 기존 분석기를 호출한다. 미확인 값과 확인되지 않은 OCR 값·버전 불일치는 미확인으로 남긴다. 무기 ID 누락은 미확인, null은 확인된 미장착이다. 충족 개수는 실제 전투력·성장률이 아니다.

DB는 `growth.db`의 `snapshots` 테이블 한 행에 검증된 공통 스냅샷 JSON을 저장한다. `PRAGMA user_version=1`로 관리하고 초기화 트랜잭션·INSERT OR IGNORE로 재실행 시 중복이나 덮어쓰기를 방지한다. 더 높은 DB 버전·불량 데이터는 삭제하지 않고 오류를 알린다. 미래 가져오기는 `saveSnapshot`을 재사용할 수 있다. 현재 UI에는 편집·가져오기·DB 초기화 버튼을 추가하지 않았다.

정적 게임 도감, 돌파·공명 체인, 실제 육성 기준, 에코 조합 검증은 후속 작업이다. 저장 데이터는 서버로 전송하지 않는다. 백엔드 필요 시 Spring Boot Java를 우선 검토한다.

## 알려진 제한과 개발 이력

2026-11-03 기준 npm audit는 Expo CLI 계열 glob/minimatch 관련 moderate 취약점 11개를 보고했다. 전체 수정 제안은 Expo 51로의 큰 버전 변경이므로 강제 수정하지 않았다. 외부에서 받은 파일을 처리하는 기능은 아직 없으며, 기능 확대 전 SDK 패치와 advisory를 다시 검토한다.

초기 기반 커밋은 b1fc183, strict 검사 환경 커밋은 3aaaadd다. 당시에는 테스트 18개만 있었고 화면·저장은 없었다. 초기 npm DNS 오류는 샌드박스 안 접근 거부와 밖 정상 응답으로 구분했다. 시스템 프록시·DNS 설정은 변경하지 않았다. 공식 진행 기록은 지정 Obsidian 폴더의 프로젝트 노트에서 관리한다.

출처: https://docs.expo.dev/versions/latest/sdk/sqlite/ · https://expo.dev/sdk · 설치된 Expo의 bundledNativeModules.json 및 npm 공식 메타데이터(2026-11-03 확인).
