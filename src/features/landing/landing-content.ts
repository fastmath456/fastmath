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
