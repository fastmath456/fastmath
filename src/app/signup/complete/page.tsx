import { ResultScreen } from '@/components/site';

export default function Page() {
  return <ResultScreen title="회원가입을 완료했습니다" lines={["빠른수학에 오신 것을 환영합니다!","이제 여러분의 수학 공부 시간을 1초라도 줄여드릴게요."]} image="/assets/complete-imgRectangle5.png" actions={[{"label":"로그인","href":"/login"},{"label":"강의 둘러보기","href":"/courses"}]} mobileTitle="회원가입" mobileBackHref="/signup" mobileContent={{ title: "회원가입을 완료했습니다", lines: ["빠른수학에 오신 것을 환영합니다!", "이제 여러분의 수학 공부 시간을 1초라도 줄여드릴게요."], actions: [{ label: "로그인", href: "/login", variant: "primary" }, { label: "강의 둘러보기", href: "/courses", variant: "outline" }] }} />;
}
