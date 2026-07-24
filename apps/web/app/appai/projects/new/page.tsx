import Link from "next/link";

import { BriefForm } from "@/components/appai/brief-form";

export default function NewProjectPage() {
  return (
    <main className="flowPage">
      <header className="flowHeader"><Link className="brand" href="/appai"><span className="brandMark">M</span>MotionVideo</Link><span className="stepLabel">Brief · bước 1/3</span></header>
      <div className="flowGrid">
        <section className="flowIntro"><p className="eyebrow">Create with AI</p><h1>Bạn muốn kể câu chuyện gì?</h1><p>Cho AI mục tiêu, đối tượng và thông điệp. Component, animation và bố cục sẽ được chọn từ capability đã kiểm thử.</p><div className="promise"><span>01</span><div><strong>Không sinh primitive chưa hỗ trợ</strong><p>Mọi kết quả phải qua schema và capability registry.</p></div></div><div className="promise"><span>02</span><div><strong>Bạn luôn review trước khi render</strong><p>Nội dung và public props vẫn có thể chỉnh lại.</p></div></div></section>
        <BriefForm />
      </div>
    </main>
  );
}
