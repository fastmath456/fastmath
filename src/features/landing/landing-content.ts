export const landingFacts = [
  { value: '1.7만', label: '유튜브 ‘빠른수학’ 구독자' },
  { value: '연세대', label: '연세대 출신 수학 강사' },
  { value: '17만', label: '‘극상위권 수학 공부법’ 조회수' },
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

export const sourceReview = {
  id: 'youtube-interest',
  author: '@승*-f6r',
  text: "선생님 저 진짜 살면서 유튜브에 처음 댓글 달아봐요. 제가 타과목은 다 전교권이지만 수학이 턱걸이 1등급이라 못한다고 주변에 말을 해도 아무도 믿어주지 않고 기만하지 말라며 장난으로 웃어넘기고 제가 당연히 설명을 이해했을거라고 생각하며 넘어간다고 할 땐 학원을 다니는데도 소극적이라 이해한 척하고 집에 와서 끙끙거리고 풀거나 이해를 포기한 적이 대다수였는데 정말 여러 유명하다는 인강은 다 봤는데도 그렇게 막 가려운 부분을 시원하게 긁어주는 듯한 강의는 없었어요. 그런데 어제 처음 제 알고리즘을 탄 무리함수 시험 정리를 보며 와 하고 육성으로 감탄이 나왔어요□ 이해가 꼭꼭되고 수학은 진짜 저에게 막막한 과목이었는데 이렇게 오늘 영상처럼 다양한 방식으로 처리하는 모습을 보게 되며 시험뿐만을 위해서가 아니더라도 나름 재밌는 학문이라고까지 생각이 들게 되었어요. 그래서 나머지 공통수학2 영상도 다 돌려봤답니다. 좋은 영상 무료로 볼 수 있게 해주시고 열정적 강의 들려주셔서 감사합니다. 앞으로도 응원하며 영상 챙겨볼게요 오래오래 다양하게 올려주세요 ❤️",
  images: Array.from({ length: 6 }, (_, index) => ({
    src: `/assets/landing/review-${index + 1}.png`,
    width: 453,
    height: index === 5 ? 96 : 98,
  })),
};
export type SourceReview = typeof sourceReview;

// 기획서의 세 카드는 동일한 원문을 반복한 시안 예시입니다.
export const landingReviews = [sourceReview, sourceReview, sourceReview];
