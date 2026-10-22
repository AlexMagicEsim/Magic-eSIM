// The Korean guides: /ko/guides/<slug>/ (I18N KO-1, 2026-10-22). Data only; seo/build-locale-pages.mjs renders them.
// Standard South Korean, formal polite style — statements in ‑습니다, requests in ‑하세요 (owner D1); 표준어 spelling
// and spacing; half-width punctuation; “ ” around a name the reader gives (D6). Every section carries an ASCII `id`
// (a Hangul heading makes no usable anchor). A particle after a quoted label follows that label's last syllable
// («설정을», «셀룰러를», «데이터 로밍을», «이 SIM 사용을»).
//
// FACT POLICY — the English guides' policy (seo/guides-en.mjs), unchanged: menu paths are typical and said to vary;
// nothing about what Magic eSIM will deliver or how; no pointer to a card row the plan cards do not show; the
// start-of-term advice is the one safe for every plan (install on the day you travel, over Wi-Fi); no network-quality
// promise, no hotspot / APN / calls / SMS / 2FA guarantee, no device-model list, no payment method; a QR code «may be
// single-use». seo/claim-guards.mjs (ko) enforces these on the rendered pages. AI-assisted draft; its quality gate is the
// three-stage AI review (localization-qa skill) — nothing here may say more than the English guide it mirrors.
//
// SOURCES — every Korean menu label below was read on the vendor's own Korean page on 2026-10-22; a label not found
// there is NOT quoted (the action is described in plain words instead):
//   Apple ko-kr support.apple.com/ko-kr/118669 (설정 앱 → ‘셀룰러’ 또는 ‘모바일 데이터’ → ‘eSIM 추가’ / ‘셀룰러 요금제 추가’ →
//               ‘세부사항 직접 입력’; 카메라 앱 → ‘셀룰러 요금제가 감지됨’ 알림 → ‘계속’; iOS 17.4+: QR 코드를 길게 탭 →
//               ‘eSIM 추가’), /ko-kr/118227 (설정 → ‘일반’ → ‘정보’: ‘이동통신사 잠금’ 옆에 ‘SIM 제한 없음’), /ko-kr/109317
//               (‘데이터 로밍’ named, no path; 설정 → ‘셀룰러’ 또는 ‘모바일 데이터’ → ‘셀룰러 데이터’ chooses the number for
//               data), /ko-kr/HT201415 (status ‘서비스 없음’).
//   Google ko   support.google.com/pixelphone/answer/16115470?hl=ko (네트워크 및 인터넷 → SIM → SIM 추가 → eSIM 설정), 9449293
//               (네트워크 및 인터넷 → SIM → 모바일 데이터; 네트워크 및 인터넷 → 모바일 네트워크 → the SIM → 이 SIM 사용),
//               2926415 (네트워크 및 인터넷 → SIM: ‘로밍’, ‘액세스포인트 네임(APN)’), 10402530 (휴대전화 정보 → SIM 상태 → EID;
//               «eSIM을 사용하려면 휴대전화에 EID(Embedded Identity Document) 번호가 필요합니다»).
//   Samsung     samsungsvc.co.kr/solution/1071978 (Samsung Electronics Service, 2022-11-14: 설정 → 연결 → SIM 관리자 → eSIM 추가;
//               support «depends on the carrier, country and device»). The page names no QR, activation-code or roaming
//               label (owner D12): those Samsung steps are described, never quoted.

const P = '/ko';

export const KO_GUIDES = [
  {
    slug: 'iphone',
    nav: 'iPhone',
    title: 'iPhone에 eSIM 설치하기: 단계별 안내 | Magic eSIM',
    description: 'QR 코드나 직접 입력으로 iPhone에 여행용 eSIM을 설치하고, 여행지에서 사용할 데이터를 켜는 방법을 안내합니다.',
    h1: 'iPhone에 eSIM 설치하기',
    blurb: 'QR 코드 또는 직접 입력으로 설치하는 방법과 도착 후 켜야 할 설정.',
    lead: '설치는 몇 분이면 끝나며 인터넷 연결이 필요합니다. 가장 간단한 방법은 Wi-Fi를 이용하는 것입니다. iPhone이 eSIM을 지원하는지 확인하고, 프로필을 설치한 다음, 여행지에 도착하면 셀룰러 데이터를 켜는 순서로 진행합니다.',
    sections: [
      { h2: 'iPhone이 eSIM을 지원하는지 확인하기', id: 'check', html: `
        <p><strong>설정 → 셀룰러</strong>(또는 <strong>모바일 데이터</strong>)를 엽니다. <strong>eSIM 추가</strong> 또는 <strong>셀룰러 요금제 추가</strong>가 보이면 iPhone이 eSIM을 지원하는 것입니다.</p>
        <p>또한 iPhone에 이동통신사 잠금이 없어야 합니다. <a href="${P}/guides/compatibility/">지원 여부 확인 방법</a>을 참고하세요.</p>` },
      { h2: '방법 1: QR 코드 스캔하기', id: 'qr', html: `
        <ol class="steps">
          <li>eSIM의 QR 코드를 다른 화면에 띄웁니다. 컴퓨터, 태블릿 또는 다른 휴대전화를 이용하세요.</li>
          <li>iPhone에서 <strong>카메라</strong> 앱을 열고 QR 코드를 스캔합니다.</li>
          <li><strong>셀룰러 요금제가 감지됨</strong> 알림이 표시되면 알림을 탭합니다.</li>
          <li><strong>계속</strong>을 탭한 다음 <strong>셀룰러 요금제 추가</strong>를 탭합니다. 확인 코드를 입력하라는 메시지가 나오면 eSIM과 함께 받은 확인 코드를 입력하세요.</li>
          <li>기본 SIM과 헷갈리지 않도록 회선에 “여행”처럼 알아보기 쉬운 이름을 붙이세요.</li>
        </ol>
        <p class="note">iOS 17.4 이상에서 QR 코드가 이 iPhone의 이메일이나 웹 페이지에 있다면 QR 코드를 길게 탭한 다음 <strong>eSIM 추가</strong>를 탭하세요.</p>` },
      { h2: '방법 2: 정보 직접 입력하기', id: 'manual', html: `
        <ol class="steps">
          <li>eSIM과 함께 받은 수동 설치 정보를 준비합니다.</li>
          <li><strong>설정 → 셀룰러</strong>(또는 <strong>모바일 데이터</strong>)를 열고 <strong>셀룰러 요금제 추가</strong>를 탭합니다.</li>
          <li><strong>세부사항 직접 입력</strong>을 탭하고 정보를 입력합니다.</li>
          <li>확인한 다음 설치가 끝날 때까지 기다립니다.</li>
        </ol>
        <p class="note">스캔할 QR 코드가 없을 때 편리한 방법입니다.</p>` },
      { h2: '도착 후: 데이터 켜기', id: 'data', html: `
        <ol class="steps">
          <li><strong>설정 → 셀룰러</strong>에서 eSIM 회선이 켜져 있는지 확인합니다.</li>
          <li><strong>셀룰러 데이터</strong>를 탭하고 eSIM 회선을 선택합니다. 기본 SIM은 통화와 문자에 계속 사용할 수 있습니다.</li>
          <li>eSIM 회선을 열고 <strong>데이터 로밍</strong>을 켭니다. 여행용 eSIM은 보통 제휴 네트워크로 연결되며, 휴대전화는 이를 로밍으로 인식합니다.</li>
          <li>기존 이동통신사의 요금이 부과되지 않게 하려면 기본 SIM의 데이터 로밍을 끄세요.</li>
          <li>휴대전화가 현지 네트워크에 등록될 때까지 1~2분 기다립니다.</li>
        </ol>
        <p class="note">메뉴 이름은 iOS 버전에 따라 조금 다를 수 있습니다.</p>` },
      { h2: '작동하지 않을 때', id: 'help', html: `
        <p>eSIM이 데이터용 회선으로 선택되어 있고 데이터 로밍이 켜져 있는지 확인한 다음 휴대전화를 다시 시작하세요. 전체 점검 목록은 <a href="${P}/guides/troubleshooting/">eSIM이 작동하지 않을 때</a> 가이드에서 확인할 수 있습니다.</p>
        <p>문제를 해결하는 동안 <strong>eSIM을 삭제하지 마세요</strong>. QR 코드는 한 번만 사용할 수 있는 경우가 있어 다시 설치하지 못할 수 있습니다.</p>` },
    ],
    faq: [
      { q: 'iPhone에 eSIM을 설치하려면 Wi-Fi가 필요한가요?', a: '프로필을 내려받으려면 인터넷 연결이 필요하며, 가장 간단한 방법은 Wi-Fi입니다. 출발 당일 집에서 떠나기 전이나 공항 Wi-Fi로 eSIM을 설치하면 이용 기간이 언제 시작되는 요금제든 문제없습니다.' },
      { q: 'QR 코드가 이 iPhone에 있습니다. 그래도 설치할 수 있나요?', a: '네. iOS 17.4 이상에서는 이메일이나 웹 페이지의 QR 코드를 길게 탭한 다음 ‘eSIM 추가’를 탭하세요. ‘세부사항 직접 입력’을 선택해 eSIM과 함께 받은 정보를 입력할 수도 있습니다.' },
      { q: '기존 번호는 어떻게 되나요?', a: '기존 번호는 그대로 켜져 있습니다. 기존 번호로 오는 전화와 문자는 기존 이동통신사의 로밍 조건을 따르며, 여행용 eSIM은 셀룰러 데이터에 사용합니다.' },
      { q: 'eSIM에서 데이터 로밍을 켜야 하는 이유는 무엇인가요?', a: '여행용 eSIM은 보통 제휴 네트워크로 연결되며, 휴대전화는 이를 로밍으로 인식합니다. eSIM 회선의 데이터 로밍을 켜는 것은 정상적인 설정이며, 기본 SIM의 데이터 로밍은 꺼 두어도 됩니다.' },
    ],
    related: ['android', 'compatibility', 'activation', 'troubleshooting'],
  },
  {
    slug: 'android',
    nav: 'Android',
    title: 'Android에 eSIM 설치하기 | Magic eSIM',
    description: 'QR 코드나 직접 입력으로 Android 휴대전화에 여행용 eSIM을 설치하고, 모바일 데이터용으로 선택한 뒤 도착 후 로밍을 켜는 방법을 안내합니다.',
    h1: 'Android에 eSIM 설치하기',
    blurb: '브랜드별 eSIM 설정 위치와 해외 도착 후 첫 단계.',
    lead: 'Android 브랜드마다 설정 이름은 다르지만 단계는 같습니다. SIM을 관리하는 메뉴를 찾고, QR 코드나 직접 입력으로 eSIM을 추가한 뒤, 여행지에서 모바일 데이터용으로 선택합니다. 설치에는 인터넷 연결이 필요하며 가장 간단한 방법은 Wi-Fi입니다.',
    sections: [
      { h2: 'SIM을 관리하는 메뉴 찾기', id: 'find', html: `
        <p>SIM 설정은 보통 다음 중 한 곳에 있습니다. 이름은 브랜드와 Android 버전에 따라 다릅니다.</p>
        <ul class="list">
          <li><strong>Google Pixel:</strong> 설정 → 네트워크 및 인터넷 → SIM → <strong>SIM 추가</strong> → <strong>eSIM 설정</strong>.</li>
          <li><strong>Samsung Galaxy:</strong> 설정 → 연결 → SIM 관리자 → <strong>eSIM 추가</strong>(이전 One UI 버전에서는 메뉴 이름이 다를 수 있습니다).</li>
          <li><strong>다른 브랜드:</strong> 설정에서 모바일 네트워크, SIM 또는 연결과 관련된 메뉴를 찾아보세요.</li>
        </ul>
        <p>어디에서도 eSIM을 추가하는 옵션이 보이지 않으면 <a href="${P}/guides/compatibility/">휴대전화가 eSIM을 지원하는지</a> 확인하세요.</p>` },
      { h2: 'eSIM 설치하기', id: 'install', html: `
        <ol class="steps">
          <li>eSIM의 QR 코드를 다른 화면에 띄웁니다.</li>
          <li>위에서 안내한 대로 eSIM 추가를 시작합니다. <strong>Samsung:</strong> QR 코드를 스캔하는 옵션을 선택하고 코드를 스캔합니다. <strong>Pixel:</strong> 화면의 안내를 따릅니다.</li>
          <li>스캔할 QR 코드가 없나요? Samsung에서는 활성화 코드를 입력하는 옵션을 선택하고 eSIM과 함께 받은 정보를 입력하세요. 옵션 이름은 One UI 버전에 따라 다릅니다.</li>
          <li>확인한 다음 설치가 끝날 때까지 기다립니다.</li>
          <li>eSIM 이름을 “여행”처럼 바꿔 두세요.</li>
        </ol>` },
      { h2: '도착 후: 데이터 켜기', id: 'data', html: `
        <ol class="steps">
          <li>eSIM이 켜져 있는지 확인합니다. Pixel: 설정 → 네트워크 및 인터넷 → 모바일 네트워크 → eSIM → <strong>이 SIM 사용</strong>.</li>
          <li>eSIM을 <strong>모바일 데이터</strong>용 SIM으로 선택합니다. Pixel: 설정 → 네트워크 및 인터넷 → SIM → <strong>모바일 데이터</strong>. 기본 SIM은 통화와 문자에 계속 사용할 수 있습니다.</li>
          <li>eSIM의 <strong>로밍</strong>을 켭니다. Samsung: 연결 아래의 모바일 네트워크 설정에서 찾아보세요. 정확한 이름은 모델에 따라 다릅니다. 여행용 eSIM은 보통 제휴 네트워크로 연결되며, 휴대전화는 이를 로밍으로 인식합니다.</li>
          <li>기존 이동통신사의 요금이 부과되지 않게 하려면 기본 SIM의 데이터 로밍을 끄세요.</li>
          <li>휴대전화가 현지 네트워크에 등록될 때까지 1~2분 기다립니다.</li>
        </ol>` },
      { h2: '작동하지 않을 때', id: 'help', html: `
        <p>데이터용으로 선택된 SIM과 eSIM의 로밍 설정을 확인하고, 비행기 탑승 모드를 켰다가 끈 다음 휴대전화를 다시 시작하세요. 전체 점검 목록은 <a href="${P}/guides/troubleshooting/">eSIM이 작동하지 않을 때</a> 가이드에서 확인할 수 있습니다.</p>
        <p>문제를 해결하는 동안 <strong>eSIM을 삭제하지 마세요</strong>. QR 코드는 한 번만 사용할 수 있는 경우가 있습니다.</p>` },
    ],
    faq: [
      { q: 'Android 휴대전화에 eSIM을 추가하는 옵션이 없습니다. 어떻게 해야 하나요?', a: 'SIM과 관련된 메뉴를 모두 확인하세요. 메뉴 이름은 브랜드마다 다릅니다. 어느 메뉴에도 eSIM을 추가하거나 내려받는 옵션이 없다면 그 휴대전화(또는 해당 지역 모델)는 eSIM을 지원하지 않을 가능성이 높습니다.' },
      { q: 'eSIM과 실물 SIM을 함께 쓸 수 있나요?', a: 'eSIM을 지원하는 듀얼 SIM 휴대전화라면 가능합니다. eSIM을 모바일 데이터용으로 선택하고 실물 SIM은 통화와 문자에 사용하세요.' },
      { q: 'APN을 설정해야 하나요?', a: '요금제 정보에 APN이 적혀 있는 경우에만 필요합니다. 이때는 eSIM 설정의 APN이 적힌 값과 같은지 확인하세요.' },
    ],
    related: ['iphone', 'compatibility', 'activation', 'troubleshooting'],
  },
  {
    slug: 'compatibility',
    nav: '지원 기기',
    title: '내 휴대전화는 eSIM을 지원할까요? 확인 방법 | Magic eSIM',
    description: '요금제를 고르기 전에 eSIM 지원 여부를 확인하세요. iPhone과 Android에서 찾아야 할 설정, 이동통신사 잠금, 지역별 모델을 안내합니다.',
    h1: '휴대전화가 eSIM을 지원하나요?',
    blurb: '요금제를 고르기 전에 1분이면 확인할 수 있습니다.',
    lead: '가장 간단한 확인 방법은 SIM 설정을 열어 eSIM을 추가하는 옵션을 찾는 것입니다. 옵션이 있으면 eSIM을 지원합니다. 이때 휴대전화에 이동통신사 잠금이 있는지, 어느 지역용 모델인지도 함께 확인하세요.',
    sections: [
      { h2: '확인 1: 설정', id: 'setting', html: `
        <p><strong>iPhone:</strong> 설정 → 셀룰러(또는 모바일 데이터). <strong>eSIM 추가</strong> 또는 <strong>셀룰러 요금제 추가</strong>가 보이면 eSIM을 지원합니다.</p>
        <p><strong>Android:</strong> SIM 설정을 열고 eSIM을 추가하는 방법을 찾으세요. Pixel에서는 네트워크 및 인터넷 → SIM → <strong>SIM 추가</strong> → <strong>eSIM 설정</strong>, Samsung에서는 연결 → SIM 관리자 → <strong>eSIM 추가</strong>입니다(이전 One UI 버전에서는 메뉴 이름이 다를 수 있습니다).</p>
        <p>Pixel에서 확인할 수 있는 또 다른 단서도 있습니다. eSIM을 사용하려면 휴대전화에 <strong>EID</strong> 번호가 있어야 하며, 설정 → 휴대전화 정보 → SIM 상태에서 찾을 수 있습니다. 다만 판단 기준은 eSIM을 추가하는 설정입니다.</p>` },
      { h2: '확인 2: 이동통신사 잠금이 있나요?', id: 'lock', html: `
        <p>약정으로 구매한 휴대전화는 이동통신사 잠금이 걸려 있어, 잠금이 해제될 때까지 다른 SIM과 eSIM을 사용할 수 없을 수 있습니다.</p>
        <p>iPhone에서는 <strong>설정 → 일반 → 정보</strong>를 열고 <strong>이동통신사 잠금</strong> 옆에 ‘SIM 제한 없음’이 표시되는지 확인하세요. Android에서는 휴대전화를 판매한 이동통신사에 문의하세요.</p>` },
      { h2: '확인 3: 지역별 모델', id: 'region', html: `
        <p>같은 모델이라도 어떤 국가에서는 eSIM을 지원하고 다른 국가에서는 지원하지 않을 수 있습니다. 지원 여부는 모델 이름만이 아니라 어느 시장용으로 만들어졌는지에 따라 달라집니다. 그래서 저희는 “지원 기기” 목록을 따로 게시하지 않습니다. 판단 기준은 사용하시는 휴대전화의 설정입니다.</p>` },
      { h2: '조건을 충족한다면: 다음 단계', id: 'next', html: `
        <p><a href="${P}/esim/">여행지 목록</a>에서 여행지를 고르고 <a href="${P}/guides/iphone/">iPhone</a> 또는 <a href="${P}/guides/android/">Android</a>에 eSIM을 설치하는 방법을 확인하세요.</p>` },
    ],
    faq: [
      { q: 'SIM 카드가 두 장 들어가는 휴대전화라면 eSIM도 지원하나요?', a: '꼭 그렇지는 않습니다. 실물 SIM 슬롯이 두 개이고 eSIM은 없는 휴대전화도 있습니다. SIM 설정에서 eSIM을 추가하는 옵션을 찾아보세요.' },
      { q: 'EID를 찾을 수 없습니다. eSIM을 지원하지 않는다는 뜻인가요?', a: '꼭 그렇지는 않습니다. 판단 기준은 설정에 eSIM을 추가하는 옵션이 있는지입니다.' },
      { q: '휴대전화가 eSIM을 지원하지 않으면 어떻게 하나요?', a: '그 휴대전화에서는 여행용 eSIM을 사용할 수 없습니다. eSIM을 지원하는 다른 휴대전화를 이용하거나 여행지에서 현지 실물 SIM을 구매해야 합니다.' },
    ],
    related: ['iphone', 'android', 'activation', 'troubleshooting'],
  },
  {
    slug: 'activation',
    nav: '설치 시기',
    title: '여행용 eSIM을 설치하고 켜는 시기 | Magic eSIM',
    description: 'eSIM 설치와 이용 기간 시작은 다릅니다. 언제 설치하고 언제 회선과 로밍을 켜야 하는지, 출국 당일 점검 목록을 안내합니다.',
    h1: 'eSIM을 설치하고 켜는 시기',
    blurb: '프로필 설치와 요금제 시작은 서로 다른 시점입니다.',
    lead: 'eSIM을 설치하는 것과 이용 기간이 시작되는 것은 다르며, 이용 기간이 시작되는 시점은 요금제마다 다릅니다. 모든 요금제에 맞는 방법은 출발 당일 Wi-Fi로 eSIM을 설치하고 도착한 뒤 데이터를 켜는 것입니다.',
    sections: [
      { h2: '서로 다른 네 단계', id: 'steps', html: `
        <ol class="steps">
          <li><strong>설치</strong>: 휴대전화가 QR 코드로 eSIM 프로필을 내려받습니다. 인터넷 연결이 필요합니다.</li>
          <li><strong>회선 켜기</strong>: SIM 목록에서 eSIM이 켜진 상태로 표시됩니다.</li>
          <li><strong>모바일 데이터용으로 선택</strong>: 인터넷이 eSIM을 통해 연결됩니다.</li>
          <li><strong>데이터 로밍 켜기</strong>: eSIM에서 로밍을 켜면 해외의 제휴 네트워크를 사용할 수 있습니다.</li>
        </ol>` },
      { h2: '이용 기간은 언제 시작되나요?', id: 'validity', html: `
        <p>요금제에 따라 다릅니다. 여행지에서 eSIM이 처음 네트워크에 연결되거나 처음 데이터를 사용할 때 시작되는 요금제도 있고, eSIM을 설치하는 순간 시작되는 요금제도 있습니다.</p>
        <p>그래서 날짜를 손해 보지 않는 방법은 <strong>출발 당일에 eSIM을 설치하고</strong>(집에서 떠나기 전이나 공항 Wi-Fi로) 도착한 뒤 데이터를 켜는 것입니다.</p>` },
      { h2: '출국 당일 점검 목록', id: 'checklist', html: `
        <ul class="list">
          <li>휴대전화가 eSIM을 지원하고 이동통신사 잠금이 없습니다(<a href="${P}/guides/compatibility/">확인하기</a>).</li>
          <li>eSIM의 QR 코드나 수동 설치 정보를 오프라인에서도 열 수 있는 곳에 저장해 두었습니다.</li>
          <li>Wi-Fi로 eSIM을 설치합니다(<a href="${P}/guides/iphone/">iPhone</a>, <a href="${P}/guides/android/">Android</a>).</li>
          <li>도착할 때까지는 기본 SIM으로 데이터를 사용합니다.</li>
        </ul>` },
      { h2: '도착한 후', id: 'landed', html: `
        <ol class="steps">
          <li>eSIM 회선이 꺼져 있으면 켭니다.</li>
          <li>eSIM을 모바일 데이터용으로 선택합니다.</li>
          <li>eSIM의 데이터 로밍을 켭니다.</li>
          <li>1~3분 기다립니다. 신호가 없다면 비행기 탑승 모드를 켰다가 끕니다.</li>
          <li>그래도 안 되면 <a href="${P}/guides/troubleshooting/">eSIM이 작동하지 않을 때</a> 가이드를 확인하세요.</li>
        </ol>` },
      { h2: 'eSIM을 설치하지 않고 도착했는데 Wi-Fi가 없다면?', id: 'no-wifi', html: `
        <p>프로필을 내려받으려면 인터넷이 필요합니다. 공항의 무료 Wi-Fi를 이용하거나 동행인의 휴대전화에서 공유하는 인터넷을 이용할 수 있습니다. 정보를 직접 입력하는 경우에도 프로필을 내려받으려면 인터넷이 필요합니다.</p>` },
    ],
    faq: [
      { q: '여행 일주일 전에 eSIM을 설치했습니다. 요금제 이용 기간이 이미 시작되었나요?', a: '요금제에 따라 다릅니다. 설치할 때 시작되는 요금제도 있고, 여행지에서 처음 연결하거나 처음 데이터를 사용할 때 시작되는 요금제도 있습니다. 모든 요금제에서 안심하려면 출발 당일에 eSIM을 설치하세요.' },
      { q: '집에서 데이터 로밍을 켜면 요금이 나오나요?', a: '스위치를 켜는 것만으로는 요금이 나오지 않습니다. 회선이 제휴 네트워크를 사용할 수 있게 해 줄 뿐입니다. 중요한 것은 어느 회선이 모바일 데이터에 선택되어 있는지와 요금제 조건입니다.' },
      { q: '도착했는데 인터넷이 안 됩니다. 얼마나 기다려야 하나요?', a: 'eSIM의 데이터와 로밍을 켠 뒤 네트워크 등록에는 보통 1~2분이 걸립니다. 비행기 탑승 모드를 켰다가 끄면 도움이 되는 경우가 많습니다. 10~15분이 지나도 네트워크가 없다면 문제 해결 점검 목록을 따라 해 보세요.' },
    ],
    related: ['iphone', 'android', 'troubleshooting', 'compatibility'],
  },
  {
    slug: 'troubleshooting',
    nav: '문제 해결',
    title: '해외에서 eSIM이 작동하지 않을 때 확인할 사항 | Magic eSIM',
    description: '여행용 eSIM에 신호나 인터넷이 없을 때의 단계별 점검 목록: 데이터 회선, 로밍, 비행기 탑승 모드, 네트워크 선택, eSIM을 삭제하면 안 되는 경우.',
    h1: 'eSIM이 작동하지 않을 때 확인할 사항',
    blurb: '대부분의 문제를 해결하는 순서대로 정리한 점검 목록입니다.',
    lead: '대부분의 문제는 설정 하나 때문에 생깁니다. 순서대로 확인하고 단계마다 인터넷을 테스트하세요. 문제를 해결하는 동안 eSIM을 삭제하지 마세요.',
    sections: [
      { h2: '점검 목록', id: 'checklist', html: `
        <ol class="steps">
          <li><strong>eSIM 회선이 켜져 있나요?</strong> SIM 설정에서 확인하세요.</li>
          <li><strong>eSIM이 모바일 데이터용으로 선택되어 있나요?</strong> 인터넷이 기본 SIM이 아니라 eSIM을 통해 연결되어야 합니다.</li>
          <li><strong>eSIM의 데이터 로밍이 켜져 있나요?</strong> 여행용 eSIM은 보통 제휴 네트워크로 연결되며, 휴대전화는 이를 로밍으로 인식합니다.</li>
          <li><strong>비행기 탑승 모드를 켜고</strong> 10초 뒤에 끄세요.</li>
          <li><strong>휴대전화를 다시 시작하세요.</strong></li>
          <li><strong>네트워크를 직접 선택하세요.</strong> eSIM의 네트워크 설정에서 자동 선택을 끄고 목록에서 다른 네트워크를 고르세요.</li>
          <li><strong>APN을 확인하세요.</strong> 요금제 정보에 APN이 적혀 있는 경우에만 해당하며, eSIM 설정의 값과 같아야 합니다.</li>
          <li><strong>요금제 이용 국가에 계신가요?</strong> 지금 있는 국가가 요금제 이용 국가에 포함되는지 확인하세요.</li>
        </ol>` },
      { h2: '신호는 있는데 인터넷이 안 될 때', id: 'no-internet', html: `
        <p>휴대전화가 네트워크에 등록되었지만 데이터가 전송되지 않는 상태입니다. 가장 흔한 원인은 eSIM이 모바일 데이터용 회선으로 선택되지 않았거나 데이터 로밍이 꺼져 있는 것입니다. 두 가지를 확인한 다음 비행기 탑승 모드를 켰다가 끄세요.</p>` },
      { h2: 'eSIM을 삭제하지 마세요', id: 'dont-delete', html: `
        <p>eSIM을 삭제해도 문제가 해결되는 경우는 거의 없으며, QR 코드는 한 번만 사용할 수 있는 경우가 있어 다시 설치하지 못할 수 있습니다. 점검 목록을 따라 하는 동안 eSIM을 그대로 두세요.</p>` },
      { h2: '그래도 연결되지 않나요?', id: 'contact', html: `
        <p>점검 목록을 모두 확인했는데도 eSIM이 작동하지 않으면 <a href="mailto:support@magicesim.store">support@magicesim.store</a>로 문의하세요.</p>` },
    ],
    faq: [
      { q: 'eSIM에 ‘서비스 없음’이 표시됩니다. 먼저 무엇을 해야 하나요?', a: 'eSIM의 데이터 로밍이 켜져 있는지 확인하고, 비행기 탑승 모드를 켰다가 끈 다음 몇 분 기다리세요. 그다음 네트워크를 직접 선택해 보세요.' },
      { q: '같은 QR 코드로 eSIM을 다시 설치할 수 있나요?', a: '다시 설치할 수 없는 경우가 많습니다. QR 코드는 한 번만 사용할 수 있는 경우가 있습니다. 그래서 점검 목록에서 eSIM을 삭제하지 말라고 안내합니다.' },
      { q: '문제를 해결하는 동안 기본 SIM에서 요금이 나올 수 있나요?', a: '기본 SIM이 모바일 데이터용으로 선택되어 있고 데이터 로밍이 켜져 있다면 기존 이동통신사의 요금이 부과될 수 있습니다. eSIM을 데이터 회선으로 유지하거나 기본 SIM의 데이터 로밍을 끄세요.' },
    ],
    related: ['iphone', 'android', 'activation', 'compatibility'],
  },
];
