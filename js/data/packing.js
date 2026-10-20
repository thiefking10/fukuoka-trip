// Packing lists. "family" items are shared gear one person packs for everyone;
// "each" is what every traveller needs; ROLE_EXTRA adds what fits each person.

export const FAMILY = [
  {
    group: '서류·돈',
    items: [
      { id: 'tickets', t: '항공권 예약 확인서 (폰 캡처 + 종이 1장)' },
      { id: 'hotel-conf', t: '호텔 예약 확인서' },
      { id: 'passport-copy', t: '여권 사진 페이지 사본 (폰 사진 + 종이)', note: '여권을 잃어버렸을 때 대사관에서 빨리 처리됩니다.' },
      { id: 'vjw-qr', t: 'Visit Japan Web QR 캡처 (4명)' },
      { id: 'insurance-doc', t: '여행자 보험 가입 증명 (폰 캡처)' },
      { id: 'yen', t: '엔화 현금', note: '1,000엔 지폐를 섞어서 받으세요.' },
      { id: 'emergency', t: '비상금 3만 엔 (봉투에 따로)' },
      { id: 'cards', t: '해외 결제 카드 2장 (서로 다른 사람이)' },
      { id: 'coin', t: '동전 지갑' },
    ],
  },
  {
    group: '전자기기',
    items: [
      { id: 'adapter', t: '돼지코 어댑터 2~3개', note: '일본은 110V 납작한 11자 콘센트입니다.' },
      { id: 'multitap', t: '작은 멀티탭', note: '호텔 콘센트가 적어서 네 명 폰을 한 번에 충전할 때 편합니다.' },
      { id: 'powerbank', t: '보조 배터리 1~2개', note: '부치는 짐에 넣으면 안 됩니다. 기내에서는 선반에 올리지 말고 몸에 지니세요(항공사 안내 확인).' },
      { id: 'esim', t: 'eSIM·로밍 준비 확인' },
    ],
  },
  {
    group: '가족 상비약',
    items: [
      { id: 'med-digest', t: '소화제' },
      { id: 'med-pain', t: '진통·해열제 (어른용)' },
      { id: 'med-diarrhea', t: '지사제' },
      { id: 'med-band', t: '밴드·상처 연고' },
      { id: 'med-motion', t: '멀미약 (배 탈 때)', note: '둘째 날 배를 20분씩 두 번 탑니다. 어린이용은 따로 챙기세요.' },
      { id: 'med-cold', t: '감기약 성분 확인', note: '코감기약 중 슈도에페드린이 많이 든 약은 일본 반입이 제한될 수 있습니다. 꼭 필요하면 현지 약국에서 사세요.' },
    ],
  },
  {
    group: '생활용품',
    items: [
      { id: 'umbrella', t: '접는 우산 2개' },
      { id: 'wipes', t: '물티슈 · 휴대용 휴지' },
      { id: 'ziplock', t: '지퍼백 여러 장', note: '젖은 수건, 간식, 영수증 정리에 씁니다.' },
      { id: 'laundry-bag', t: '빨랫감 넣을 비닐봉지' },
      { id: 'shopping-bag', t: '접이식 장바구니 · 보조 가방', note: '돌아올 때 쇼핑한 물건을 담습니다. 1인 15kg을 넘지 않게요.' },
      { id: 'onsen-towel', t: '온천용 작은 수건 (안 가져가면 현지 대여 500엔)' },
      { id: 'pen', t: '볼펜 1자루' },
    ],
  },
];

export const EACH = [
  {
    group: '꼭 챙길 것',
    items: [
      { id: 'passport', t: '여권', note: '유효기간 확인. 들고 타는 가방에.' },
      { id: 'phone', t: '휴대폰 · 충전 케이블' },
      { id: 'wallet', t: '지갑' },
    ],
  },
  {
    group: '옷 (10월 말 후쿠오카: 낮 20도 안팎, 아침저녁 15도 안팎)',
    items: [
      { id: 'tops', t: '상의 2~3벌' },
      { id: 'bottoms', t: '하의 2벌' },
      { id: 'jacket', t: '얇은 겉옷 (아침저녁·바닷바람)' },
      { id: 'under', t: '속옷 · 양말 3벌' },
      { id: 'pajama', t: '잠옷 (호텔 잠옷이 있으면 생략)' },
      { id: 'shoes', t: '편한 운동화 (신고 가기)' },
    ],
  },
  {
    group: '세면·개인용품',
    items: [
      { id: 'toothbrush', t: '칫솔 · 치약 (일본 호텔은 기본 비치가 줄어드는 추세)' },
      { id: 'skincare', t: '스킨·로션 소용량', note: '기내에 들고 탈 액체는 100ml 이하 용기에 담아 투명 지퍼백 하나에.' },
      { id: 'mask', t: '마스크 1~2장' },
    ],
  },
];

export const ROLE_EXTRA = {
  senior: [
    {
      group: '어머니께 필요한 것',
      items: [
        { id: 'rx', t: '평소 드시는 약 (여행일 + 2~3일분)', note: '원래 약통이나 처방 봉투째 가져가면 공항에서 설명하기 쉽습니다.' },
        { id: 'glasses', t: '돋보기 · 안경' },
        { id: 'knee', t: '무릎·허리 보호대 또는 파스' },
        { id: 'warm', t: '목도리나 얇은 카디건 (배 위, 냉방)' },
        { id: 'neck-pillow', t: '목베개 (새벽 비행)' },
        { id: 'font', t: '앱 글씨 "크게"로 설정' },
      ],
    },
  ],
  dad: [
    {
      group: '인솔하는 사람이 챙길 것',
      items: [
        { id: 'kakaot-card', t: '카카오 T 해외 결제 카드 등록 확인' },
        { id: 'kid-docs', t: '아이 여권 함께 보관' },
        { id: 'charger-hub', t: '여러 구 충전기' },
        { id: 'contact', t: '가족 연락처 서로 저장 (카톡 그룹방)' },
        { id: 'airport-ride', t: '인천공항 가는 교통편 예약 확인 (05:00 도착)' },
      ],
    },
  ],
  young: [
    {
      group: '따로 챙기면 좋은 것',
      items: [
        { id: 'makeup', t: '화장품 소용량 (액체는 100ml 이하)' },
        { id: 'hairtool', t: '고데기·드라이기 전압 확인', note: '프리볼트가 아니면 일본에서 쓸 수 없습니다. 호텔 드라이기를 쓰세요.' },
        { id: 'shopping-list', t: '사 올 물건 목록 (드럭스토어·돈키호테)' },
        { id: 'hair-tie', t: '머리끈 (온천)' },
      ],
    },
  ],
  kid: [
    {
      group: '아이에게 필요한 것',
      items: [
        { id: 'id-card', t: '연락처 카드', note: '부모 전화번호와 "ホテルニューオータニ博多"를 적어 주머니에 넣어 두세요. 길을 잃으면 직원에게 보여주게 합니다.' },
        { id: 'kid-med', t: '어린이 해열제 · 어린이 멀미약' },
        { id: 'snacks', t: '간식 (비행기·배에서)' },
        { id: 'bottle', t: '물통' },
        { id: 'spare', t: '여벌 옷 한 벌 (수족관·물놀이)' },
        { id: 'toy', t: '책이나 작은 장난감 하나 (새벽 비행·대기)' },
        { id: 'earphones', t: '이어폰' },
        { id: 'mission', t: '미션북 확인하기 (앱)' },
      ],
    },
  ],
};

// Family members are stored by how they are called in the family, so map those to roles.
export function roleOf(name = '') {
  if (/엄마|할머니|어머니/.test(name)) return 'senior';
  if (/손자|손녀|아이/.test(name)) return 'kid';
  if (/아들|아빠/.test(name)) return 'dad';
  if (/딸|이모|고모/.test(name)) return 'young';
  return null;
}
