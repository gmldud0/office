# 「단순한 새우」 인스타 자동 게시

하루 2번(한국 시간 **오전 9:00**, **오후 8:00**) GitHub Actions가 `queue/`에서 가장 앞에 있는 게시물을 인스타그램에 올립니다.
올린 게시물은 `posted/`로 옮겨지고, 올린 시각과 게시물 번호가 `post.json`에 기록됩니다.

```
instagram/
├── content/      게시물 원고 (주마다 JSON 하나: 캡션 + 카드 문구)
├── queue/        올라갈 게시물 (폴더 이름 순서대로 올라감)
│   └── 2026-11-24-1-tongjang/  01.jpg … 05.jpg + post.json
├── posted/       이미 올라간 게시물
├── tools/        카드 이미지 만드는 도구 (render.mjs)
└── publish.py    인스타그램에 올리는 스크립트
```

**토큰을 넣기 전에는 아무것도 올라가지 않습니다.** 먼저 `queue/`의 게시물을 확인해 주세요.

---

## 처음 한 번만 하는 설정 (약 20~30분)

> Meta 화면의 메뉴 이름은 자주 바뀝니다. 아래 이름과 조금 달라도 비슷한 메뉴를 찾으면 됩니다.

### 1. 인스타 계정을 프로페셔널 계정으로 바꾸기 (무료)
인스타 앱 → 프로필 → 오른쪽 위 ☰ → **계정 유형 및 도구**(또는 설정의 **계정**) → **프로페셔널 계정으로 전환** → **크리에이터** 또는 **비즈니스** 선택.

### 2. Meta 개발자 앱 만들고 토큰 받기
1. https://developers.facebook.com 에 페이스북 계정으로 로그인하고, 개발자로 등록합니다.
2. **내 앱 → 앱 만들기**. 사용 사례에서 **Instagram에서 메시지 및 콘텐츠 관리**(Manage messaging & content on Instagram)를 고릅니다.
3. 앱 대시보드에서 **Instagram → API setup with Instagram login(인스타그램 로그인으로 API 설정)** 으로 갑니다.
4. **Generate access tokens(접근 토큰 생성)** 에서 **계정 추가**를 누르고 「단순한 새우」 인스타 계정으로 로그인해 허용합니다.
   - 권한에 `instagram_business_basic`, `instagram_business_content_publish`(게시 권한)가 들어 있어야 합니다.
   - 계정이 목록에 안 뜨면: **앱 역할 → 역할 → Instagram 테스터**에 인스타 아이디를 추가하고, 인스타 앱(또는 웹)의 **설정 → 앱 및 웹사이트 → 테스터 초대**에서 수락합니다.
5. **토큰 생성**을 누르면 긴 문자열이 나옵니다. 이것이 접근 토큰입니다(약 60일 유효).
   - ⚠️ 토큰은 비밀번호와 같아요. 채팅·메모·스크린샷에 남기지 말고 바로 3번 단계의 GitHub 시크릿에만 넣으세요.

### 3. GitHub에 토큰 넣기
GitHub의 이 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
- 이름: `IG_ACCESS_TOKEN`
- 값: 2번에서 받은 토큰

### 4. 이미지를 공개 주소에 두기 (둘 중 하나)
인스타그램은 **누구나 열 수 있는 주소**에서 이미지를 가져갑니다. 지금 이 저장소는 비공개라 그대로는 안 됩니다.

- **A. 이 저장소를 공개로 바꾸기 (가장 쉬움)**
  Settings → General → 맨 아래 Danger Zone → **Change visibility → Public**.
  `bureau-rapports/`의 보고서도 함께 공개되니, 괜찮을 때만 고르세요.
- **B. 이미지 전용 공개 저장소 쓰기 (이 저장소는 비공개 유지)**
  1. GitHub에서 새 **공개** 저장소를 만듭니다. 예: `insta-images` (README 하나 넣어서 만들기).
  2. 이 저장소 **Settings → Secrets and variables → Actions → Variables** 탭 → `IMAGE_REPO` = `gmldud0/insta-images`
  3. https://github.com/settings/personal-access-tokens 에서 **Fine-grained token**을 만듭니다.
     - 저장소: `office`, `insta-images`
     - 권한: **Contents: Read and write**, **Secrets: Read and write**
  4. 그 토큰을 시크릿 `GH_PAT`로 넣습니다. (토큰 자동 연장에도 쓰입니다.)

### 5. 시험해 보기
1. 저장소 → **Actions → 인스타 자동 게시 → Run workflow**
2. **시험만 하기**에 체크된 채로 실행 → 로그에 이미지 주소와 캡션 첫 줄이 나오면 성공.
3. 로그의 이미지 주소 하나를 브라우저(로그인 안 된 창)에서 열어 보세요. 그림이 보여야 합니다.
4. 체크를 **끄고** 한 번 더 실행하면 실제로 1개가 올라갑니다. 이후로는 하루 2번 자동입니다.

---

## 평소 운영

| 하고 싶은 것 | 방법 |
|---|---|
| 게시물 빼기 | `queue/`에서 그 폴더를 지우기 |
| 순서 바꾸기 | 폴더 이름 앞의 날짜·번호 바꾸기 (이름 순서대로 올라감) |
| 잠시 멈추기 | Variables에 `IG_PAUSED` = `1` (다시 시작: 지우거나 `0`) |
| 시간 바꾸기 | `.github/workflows/instagram-publish.yml`의 `cron` (UTC 기준, 한국 시간 −9시간) |
| 새 게시물 만들기 | `content/`에 원고 JSON 추가 → `cd instagram/tools && npm install && node render.mjs ../content/파일.json` |

- **확인 후 게시**: 새 주 게시물은 별도 브랜치로 만들어 Pull Request로 올립니다. 휴대폰 GitHub 앱에서 카드를 보고 **Merge**하면 그 게시물들이 대기열에 들어갑니다. 머지 전에는 올라가지 않습니다.
- **토큰 만료(60일)**: 매주 월요일 `인스타 토큰 연장`이 기간을 늘립니다. `GH_PAT`가 없으면 새 토큰을 자동 저장하지 못하니, 50일쯤마다 2번 단계에서 토큰을 새로 받아 시크릿을 바꿔 주세요.
- **실패하면**: GitHub가 메일로 알려 줍니다. Actions 로그의 `인스타그램 API 오류` 줄을 복사해 Claude에게 보여 주세요.
- 게시 시각은 GitHub 사정으로 몇 분~수십 분 늦어질 수 있습니다.
