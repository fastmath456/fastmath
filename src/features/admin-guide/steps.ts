import type { DriveStep } from 'driver.js';

const step = (element: string, title: string, description: string) => ({ element, popover: { title, description, side: 'right', align: 'start' } } satisfies DriveStep);

export const adminGuides = {
  'course-actions': [
    step('[data-guide="edit-course"]', '해당 강의 편집하기', '현재 강의의 기본정보, 상세이미지, 후기와 커리큘럼을 수정합니다.'),
    step('[data-guide="new-course"]', '새로운 강의 등록하기', '새 클래스를 등록하는 화면으로 이동합니다. 기본정보를 입력한 뒤 커리큘럼과 영상을 구성합니다.'),
  ],
  'course-basic': [
    step('#course-thumbnail', '클래스 대표이미지', '강의·교재 목록과 상세 화면에 표시할 대표이미지를 등록하거나 교체합니다.'),
    step('#course-detailImage', '클래스 상세이미지', '여러 이미지를 한 번에 선택할 수 있습니다. 선택한 순서대로 표시되며, 첨부된 이미지는 개별 삭제할 수 있습니다.'),
    step('#course-title', '클래스명', '목록과 상세 화면에 표시할 이름을 입력합니다.'),
    step('#course-materials', '교재파일', '제공할 PDF 교재를 여러 개 첨부할 수 있습니다. 첨부된 파일은 개별 삭제하거나 업로드에 실패했을 때 재시도할 수 있습니다.'),
    step('#course-basePrice', '원가', '할인 전 가격을 원 단위로 입력합니다.'),
    step('#course-price', '할인가', '실제 판매할 가격을 원 단위로 입력합니다.'),
    step('#course-license-days', '수강 가능 기간', '수강 신청일부터 이용할 수 있는 일수를 입력합니다. 비워두면 60일이 적용됩니다.'),
    step('#course-displayOrder', '정렬 순서', '목록을 열고 카드를 드래그해 순서를 정하세요. 저장한 순서는 클래스 등록 시 반영됩니다.'),
    step('[data-guide="course-reviews"]', '후기 등록', '학생이 남긴 별점, 후기 내용과 이름을 입력합니다. 후기를 추가하거나 삭제할 수 있고, 공개 화면에서는 이름이 마스킹됩니다.'),
    step('[data-guide="save-draft"]', '임시저장', '작성 중인 내용을 저장합니다. 저장 후 현재 주소를 보관하면 이어서 작성할 수 있습니다.'),
    step('[data-guide="course-next"]', '상세정보로 이동', '필수 기본정보를 입력한 뒤 다음으로를 누르면 커리큘럼과 영상을 등록할 수 있습니다.'),
  ],
  'course-curriculum': [
    step('[data-guide="course-steps"]', '기본정보 다시 편집', '기본정보를 누르면 이미지, 가격, 후기 등의 입력 화면으로 돌아갑니다.'),
    step('[data-guide="curriculum"]', '챕터와 차시 구성', '챕터 추가로 큰 단원을 만듭니다. 각 챕터의 카테고리 추가로 차시를 추가하고, ⋯ 메뉴에서 이름을 바꾸거나 삭제합니다.'),
    step('[data-guide="video-editor"]', '영상 연결', '차시를 선택한 뒤 Vimeo 영상 링크를 붙여 넣고 등록을 누릅니다. 영상 연결 상태와 미리보기를 확인할 수 있습니다.'),
    step('[data-guide="save-draft"]', '임시저장', '현재 커리큘럼과 연결한 영상 정보를 저장하고 나중에 이어서 작성할 수 있습니다.'),
    step('[data-guide="course-next"]', '클래스 등록', '입력 내용과 영상 연결을 확인한 뒤 등록하기를 누릅니다. 최종 확인창에서 내용을 확인하고 등록을 완료합니다.'),
  ],
  'landing-reviews': [
    step('[data-guide="landing-review-manage"]', '랜딩 리뷰 관리', '홈 화면의 유튜브 시청자 리뷰를 관리합니다. 리뷰 관리에서 기존 리뷰를 수정하거나 새 리뷰를 추가할 수 있습니다.'),
  ],
  'landing-review-editor': [
    step('[data-guide="landing-review-list"]', '리뷰 선택과 추가', '목록에서 수정할 리뷰를 선택합니다. 리뷰 추가를 누르면 새로운 리뷰를 작성할 수 있습니다.'),
    step('#review-author', '작성자', '리뷰 작성자의 이름을 입력합니다. 공개 화면에는 마스킹된 이름이 표시됩니다.'),
    step('#review-text', '후기 본문', '랜딩 화면에 표시할 리뷰 내용을 입력합니다.'),
    step('[data-guide="landing-review-image"]', '원문 이미지', '후기 원문 이미지를 등록하거나 교체합니다. 새 리뷰에는 원문 이미지가 필요합니다.'),
    step('[data-guide="landing-review-save"]', '리뷰 저장', '저장을 누르면 입력한 내용이 랜딩 리뷰에 반영됩니다. 닫기를 누르면 편집창을 닫습니다.'),
  ],
  'refunds-list': [
    step('[data-guide="refund-alert"]', '결제사 응답 확인', '취소를 요청했지만 결과를 받지 못한 환불이 있으면 표시됩니다. 해당 건 보기를 누르면 처리 중인 건만 모아 봅니다.'),
    step('[data-guide="refund-filters"]', '상태별 보기', '확인 필요, 처리 중, 완료, 거절로 나눠 봅니다. 숫자는 상태별 건수입니다.'),
    step('[data-guide="refund-search"]', '환불 요청 검색', '회원 이름, 이메일, 주문번호, 상품명으로 찾습니다.'),
    step('[data-guide="refund-table"]', '환불 요청 처리', '이용 내역과 환불금액을 확인한 뒤 확인하기를 눌러 승인하거나 거절합니다. 응답 확인 필요 건은 다시 확인으로 마무리합니다.'),
  ],
  'refund-review': [
    step('[data-guide="refund-usage"]', '이용 내역', '중복과 무료 미리보기를 뺀 시청 분량, 자료·전자책 다운로드 여부를 확인합니다.'),
    step('[data-guide="refund-summary"]', '환불 금액', '결제금액에서 이용분을 뺀 계산 금액과 결제사의 부분취소 가능 여부를 확인합니다. 나이스페이에서 직접 취소한 건은 취소된 금액이 표시됩니다.'),
    step('#refund-amount', '승인 금액', '실제로 환불할 금액입니다. 계산된 금액이 기본으로 들어가며, 0원이면 결제 취소 없이 수강 권한만 회수합니다. 나이스페이에서 직접 취소한 건은 그 금액으로 고정됩니다.'),
    step('#refund-reason', '처리 사유', '승인과 거절 모두 사유가 필요합니다. 내부 기록용이라 회원에게 보이지 않습니다.'),
    step('[data-guide="refund-decision"]', '거절 또는 승인', '거절하면 주문이 결제완료로 돌아가 계속 이용할 수 있습니다. 승인하면 확인창을 거쳐 결제가 바로 취소되고 수강 권한이 회수됩니다.'),
  ],
  'refund-recover': [
    step('[data-guide="refund-recover-steps"]', '응답을 받지 못한 환불', '결제사에 취소를 요청했지만 결과를 받지 못한 건입니다. 실제로 취소됐는지 결제사 기록으로 확인해야 합니다.'),
    step('[data-guide="refund-recover"]', '다시 확인', '나이스페이에서 결제 상태를 조회해 이미 취소됐으면 완료로 처리하고, 취소되지 않았으면 취소를 다시 요청합니다. 첫 요청 후 35초가 지나야 다시 요청할 수 있습니다.'),
  ],
} satisfies Record<string, DriveStep[]>;

export type AdminGuideId = keyof typeof adminGuides;
