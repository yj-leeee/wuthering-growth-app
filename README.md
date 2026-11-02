# 명조 육성 분석 기반

샘플 계정의 캐릭터·무기·스킬 상태를 예시 목표와 비교하는 순수 TypeScript 모듈이다. A단계 기반이며 에코 분석은 후속 구현 대상이다.

## 실행

Windows PowerShell에서 Node.js 22.12 이상으로 실행한다. 현재 확인한 환경은 Node 22.12.0, npm 11.6.2다.

```powershell
Set-Location 'D:\idea_codex\wuthering-growth-app'
npm test
```

외부 의존성 설치는 필요하지 않다. Node 22의 `--experimental-strip-types` 경고는 예상된다. 이 기능은 타입 검사기가 아니므로 테스트 통과와 정적 타입 검사 완료를 구분한다.

## 구조와 사용

- `src/model.ts`: 스냅샷·캐릭터·무기·스킬·에코·추천 기준·분석 결과 타입.
- `src/validation.ts`: 외부 입력 검증. `parseSnapshot(json)` 및 `validateRecommendation(value)`를 통과한 데이터만 분석기로 전달한다.
- `src/analysis.ts`: `analyzeCharacter(snapshot, character, recommendation)` 순수 비교 함수. 전달하는 캐릭터는 해당 스냅샷의 캐릭터를 선택한다.
- `src/sample.ts`: 합성 샘플과 테스트용 추천 기준. 실제 게임 조언으로 사용하면 안 된다.
- `tests/core.test.ts`: 경계값·입력 무결성·분석 상태 검증.

```typescript
import { parseSnapshot, validateRecommendation } from './src/validation.ts';
import { analyzeCharacter } from './src/analysis.ts';
import { sampleSnapshot, sampleRecommendation } from './src/sample.ts';

const snapshot = parseSnapshot(JSON.stringify(sampleSnapshot));
const rule = validateRecommendation(sampleRecommendation);
const result = analyzeCharacter(snapshot, snapshot.characters[0]!, rule);
// summary: { met: 2, deficit: 1, unknown: 2 }, exampleOnly: true
```

`weaponId` 누락은 미확인, `null`은 확인된 미장착이다. `value: null` 또는 `confirmed: false`는 미확인이다. 관찰·추천의 게임 버전이 다르면 비교를 보류한다. 분석 결과의 충족 개수는 실제 성장률이나 전투력 점수가 아니다.

## 현재 제한

- 프레임워크·DB·백엔드·수집 방식은 확정하지 않았다. 실제 계정 요청과 인증 처리는 구현하지 않았다.
- 정적 게임 도감, 돌파별 상한, 무기 종류 호환성, 에코 비용 합계·세트 효과·추천 우선순위는 아직 검증하지 않는다.
- 출처는 스냅샷 단위, 확인 여부와 신뢰도는 값 단위다. 여러 출처 병합 및 원본 수정 이력은 후속 설계가 필요하다.
- JSON 파서는 프로젝트 자체 형식만 검증한다. 다른 도구의 내보내기 형식과 호환된다고 가정하지 않는다.
- 검증기는 알려진 필드만 허용한다. 추천 기준의 `verified` 표시는 근거를 자동 검증한다는 의미가 아니다.
- TypeScript 컴파일러 미설치로 정적 타입 검사는 미완료다. 개발 의존성 설치와 `tsc --noEmit` 구성을 다음 작업으로 남겼다.

공식 진행 기록은 지정 Obsidian 프로젝트 폴더의 메인 노트와 연결된 상세 노트에 유지한다. 커밋과 원격 푸시는 수행하지 않았다.
