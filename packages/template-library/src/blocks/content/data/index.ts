import type { MotionBlock } from "../../types";

function contentData(
  role: string,
  name: string,
  nameVi: string,
  description: string,
  sampleText: string,
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
  "So sánh giá trị — animate sau bằng bar-grow.",
  "Bars",
);

export const DATA_PIE_CHART = contentData(
  "pie-chart",
  "Pie Chart",
  "Biểu đồ tròn",
  "Tỷ lệ phần — pha sau.",
  "Pie",
);

export const DATA_LINE_CHART = contentData(
  "line-chart",
  "Line Chart",
  "Biểu đồ đường",
  "Xu hướng theo thời gian.",
  "Line",
);

export const DATA_PROGRESS = contentData(
  "progress",
  "Progress Bar",
  "Thanh tiến độ",
  "0–100% fill. Core infographic.",
  "72%",
);

export const DATA_TIMELINE = contentData(
  "timeline",
  "Timeline",
  "Timeline",
  "Các mốc thời gian / process.",
  "2024 → 2026",
);

export const DATA_COMPARISON = contentData(
  "comparison",
  "Comparison",
  "So sánh",
  "2 cột trước/sau hoặc A/B.",
  "A vs B",
);

export const DATA_STATISTIC = contentData(
  "statistic",
  "Statistic",
  "Chỉ số",
  "Khối số + nhãn. Ghép text.number + text.label.",
  "95% hài lòng",
);

export const DATA_BLOCKS: MotionBlock[] = [
  DATA_BAR_CHART,
  DATA_PIE_CHART,
  DATA_LINE_CHART,
  DATA_PROGRESS,
  DATA_TIMELINE,
  DATA_COMPARISON,
  DATA_STATISTIC,
];

/** @deprecated — dùng DATA_BLOCKS */
export const CHART_BLOCKS = DATA_BLOCKS;
