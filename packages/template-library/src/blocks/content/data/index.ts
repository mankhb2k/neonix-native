import type { MotionBlock } from "../../types";

function contentData(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  sampleText = "",
): MotionBlock {
  return {
    id: `data.${role}`,
    name,
    nameVi,
    family: "content",
    kind: "data",
    shelf: "data",
    description,
    duration: 0,
    durationMin: 0,
    durationMax: 0,
    tags: ["content", "data", role, "infographic"],
    sampleText,
    previewClass: `mv-block-content mv-block-content-data mv-block-content-data-${role}`,
  };
}

export const DATA_BAR_CHART = contentData(
  "bar-chart",
  "Bar Chart",
  "Biểu đồ cột",
  "So sánh giá trị theo cột — animate sau bằng bar-grow.",
);

export const DATA_PIE_CHART = contentData(
  "pie-chart",
  "Pie Chart",
  "Biểu đồ tròn",
  "Tỷ lệ phần trăm — reveal/fill pha sau.",
);

export const DATA_LINE_CHART = contentData(
  "line-chart",
  "Line Chart",
  "Biểu đồ đường",
  "Xu hướng theo thời gian — draw-line pha sau.",
);

export const DATA_PROGRESS = contentData(
  "progress",
  "Progress Bar",
  "Thanh tiến độ",
  "Thanh 0–100% fill. Core infographic.",
  "72%",
);

export const DATA_COUNTER = contentData(
  "counter",
  "Counter",
  "Ô đếm",
  "Content ô số. Motion đếm dùng Number Animation text.counter.",
  "100",
);

export const DATA_TIMELINE = contentData(
  "timeline",
  "Timeline",
  "Timeline",
  "Các mốc thời gian / quy trình.",
);

export const DATA_TABLE = contentData(
  "table",
  "Table",
  "Bảng",
  "Bảng hàng/cột — so sánh chi tiết.",
);

export const DATA_COMPARISON = contentData(
  "comparison",
  "Comparison",
  "So sánh",
  "2 cột A vs B hoặc trước/sau.",
);

export const DATA_STATISTIC = contentData(
  "statistic",
  "Statistic",
  "Chỉ số",
  "Khối số lớn + nhãn. Thường ghép text.number + text.label.",
  "95%",
);

export const DATA_GAUGE = contentData(
  "gauge",
  "Gauge",
  "Đồng hồ",
  "Gauge / speedometer theo % — pha sau.",
  "80%",
);

/** Content Data shelf — order = README */
export const DATA_BLOCKS: MotionBlock[] = [
  DATA_BAR_CHART,
  DATA_PIE_CHART,
  DATA_LINE_CHART,
  DATA_PROGRESS,
  DATA_COUNTER,
  DATA_TIMELINE,
  DATA_TABLE,
  DATA_COMPARISON,
  DATA_STATISTIC,
  DATA_GAUGE,
];

/** @deprecated — dùng DATA_BLOCKS */
export const CHART_BLOCKS = DATA_BLOCKS;
