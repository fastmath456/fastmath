export const landingFacts = [
  { value: '1.7만', countTo: 1.7, label: '유튜브 ‘빠른수학’ 구독자' },
  { value: '연세대', label: '연세대 출신 수학 강사' },
  { value: '17만', countTo: 17, label: '‘극상위권 수학 공부법’ 조회수' },
];

export const philosophySteps = [
  { number: '01', title: '정의부터 정확하게', description: '문제의 출발점을 이해합니다.' },
  { number: '02', title: '스스로 오래 고민하기', description: '‘왜?’를 끝까지 생각합니다.' },
  { number: '03', title: '풀이로 연결하기', description: '이해한 원리를 문제에 적용합니다.' },
];

export const teachingPoints = [
  {
    number: '01', label: '사고과정을 따라가다',
    title: ['계산하기 전에,', '조건부터.'],
    description: '근호 안의 조건과 오른쪽의 부호를 함께 확인합니다. 계산에 앞서 원래 식이 요구하는 조건부터 읽습니다.',
    board: {
      title: '풀이의 시작은, 정의를 읽는 것.',
      description: '왼쪽이 0 이상이므로 오른쪽도 0 이상. 계산 전에 x가 만족해야 할 조건을 찾습니다.',
      image: '/assets/landing/board-desktop.png',
      alt: '√(x+1)=x−1에서 x+1≥0과 x−1≥0을 함께 확인하여 x≥1을 얻습니다.',
    },
  },
  {
    number: '02', label: '문제의 핵심을 잡다',
    title: ['조건을 연결하면,', '풀이가 짧아집니다.'],
    description: '양변을 제곱해 식을 정리하고, 계산의 핵심을 찾습니다.',
    // shortcut: S02의 손글씨 수식 보드 시안이 제공되면 해당 이미지와 보드 문구를 연결합니다.
    board: null,
  },
  {
    number: '03', label: '실수까지 줄이다',
    title: ['마지막은,', '원래 식으로.'],
    description: '얻은 값을 처음 조건과 원래 식에 다시 대입합니다.',
    board: null,
  },
];

export const landingReviews = [
  {
    id: 'youtube-score',
    author: '@오이야묵아야',
    text: '선생님 오늘 시험보고 온 학생입니다 ㅎㅎ 등차 등비 관련 영상들 다 보고 계속 연습했었는데,,, 연습한 보람이 있었어욕ㅠㅠㅠ 학원 끊고 독학으로 했는데 점수가 10점이 올랐습니다. 정말 감사해요ㅜㅜ',
    images: [{ src: '/assets/landing/review-comment-1.png', width: 512, height: 213 }],
  },
  {
    id: 'youtube-interest',
    author: '@승연-f6r',
    text: '선생님 저 진짜 살면서 유튜브에 첨은 댓글 달아봐요. 제가 타과목은 다 전교권이지만 수학이 턱걸이 1등급이라 못한다고 주변에 말을 해도 아무도 믿어주지 않고 기만하지 말라며 장난으로 웃어넘기고 제가 당연히 설명을 이해했을거라고 생각하며 넘어간다고 할 땐 학원을 다니는데도 소극적이라 이해한 척하고 집에 와서 끙끙거리고 풀거나 이해를 포기한 적이 대다수였는데 정말 여러 유명하다는 인강은 다 봤는데도 그렇게 막 가려운 부분을 시원하게 긁어주는 듯한 강의는 없었어요. 그런데 어제 처음 제 알고리즘을 탄 무리함수 시험 정리를 보며 와 하고 육성으로 감탄이 나왔어요□ 이해가 꼭꼭되고 수학은 진짜 저에게 막막한 과목이였는데 이렇게 오늘 영상처럼 다양한 방식으로 처리하는 모습을 보게 되며 시험뿐만을 위해서가 아니더라도 나름 재밌는 학문이라고까지 생각이 들게 되었어요. 그래서 나머지 공통수학2 영상도 다 돌려봤답니다. 좋은 영상 무료로 볼 수 있게 해주시고 열정적 강의 들려주셔서 감사합니다. 앞으로도 응원하며 영상 챙겨볼게요 오래오래 다양하게 올려주세요 ❤️',
    images: [{ src: '/assets/landing/review-comment-2.png', width: 512, height: 656 }],
  },
  {
    id: 'youtube-perspective',
    author: '@양파쿵야-d9n',
    text: '선생님 진짜 감사합니다 ❤️❤️ 비록 점수는 잘 안나왔지만 영상보면서 발상의 전환??을 할 수 있어서ㅠ너무 좋았어요ㅠㅠ 어려워 보이던 문제도 자신있게 풀어서 맞았는데 원래 다 찍던 문제도 더 효율적으로 찍고 풀어서 맞았다는거에 너무 기뻤어요 정말 감사합니다 ❤️ ❤️ ❤️',
    images: [{ src: '/assets/landing/review-comment-3.png', width: 512, height: 186 }],
  },
];
export type SourceReview = (typeof landingReviews)[number];
