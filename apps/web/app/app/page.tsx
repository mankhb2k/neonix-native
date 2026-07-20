import { AppLink } from "@/components/AppLink";
import { marketingUrl } from "@/lib/hosts";
import { ProjectList } from "@/components/hub/ProjectList";

export default function AppHomePage() {
  return (
    <div className="mv-hub">
      <header className="mv-hub-header">
        <AppLink href="/" className="mv-hub-brand">
          MotionVideo
        </AppLink>
        <nav className="mv-hub-nav">
          <AppLink href="/projects/new">Tạo TVC</AppLink>
          <a href={marketingUrl("/")}>Landing</a>
        </nav>
      </header>
      <main className="mv-hub-main">
        <p className="mv-hub-kicker">Workspace</p>
        <h1 className="mv-hub-title">Tạo TVC motion 2D tiếng Việt</h1>
        <p className="mv-hub-lead">
          Chọn template, chỉnh timeline và nhờ AI copilot sửa chữ / màu / CTA —
          rồi xuất video khi sẵn sàng.
        </p>
        <AppLink href="/projects/new" className="mv-btn mv-btn-primary">
          Tạo dự án mới
        </AppLink>
        <ProjectList />
      </main>
    </div>
  );
}
