import Link from "next/link";

const projects = [
  { id: "demo-summer", name: "Summer Coffee Launch", status: "Sẵn sàng", ratio: "9:16", updated: "Vừa xong" },
  { id: "demo-product", name: "Serum Product Story", status: "Đang tạo", ratio: "1:1", updated: "4 phút trước" },
];

export default function DashboardPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/appai"><span className="brandMark">M</span>MotionVideo</Link>
        <div className="topActions"><span className="environment">Renew preview</span><div className="avatar">AN</div></div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">AI video workspace</p>
          <h1>Biến brief thành motion video<br />sẵn sàng phân phối.</h1>
          <p className="lead">AI sử dụng Component và Template đã kiểm thử. Bạn review nội dung, xem preview và xuất video—không cần chỉnh keyframe.</p>
        </div>
        <Link className="primaryButton" href="/appai/projects/new">Tạo video mới <span>→</span></Link>
      </section>

      <section className="section">
        <div className="sectionHead"><div><p className="eyebrow">Projects</p><h2>Video gần đây</h2></div><button className="quietButton" type="button">Lọc dự án</button></div>
        <div className="projectGrid">
          {projects.map((project, index) => (
            <Link className="projectCard" href={`/appai/projects/${project.id}`} key={project.id}>
              <div className={`thumbnail tone${index + 1}`}><span>{project.ratio}</span><div className="play">▶</div></div>
              <div className="cardBody"><div><h3>{project.name}</h3><p>{project.updated}</p></div><span className={`status ${project.status === "Đang tạo" ? "processing" : ""}`}>{project.status}</span></div>
            </Link>
          ))}
          <Link className="emptyCard" href="/appai/projects/new"><span className="plus">+</span><strong>Bắt đầu từ brief</strong><p>Mô tả video bằng tiếng Việt</p></Link>
        </div>
      </section>
    </main>
  );
}
