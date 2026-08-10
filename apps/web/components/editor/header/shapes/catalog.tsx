import type { ShapeCategory } from "./types";

const iconCls = "h-7 w-7 fill-none stroke-current stroke-2";

/** Desktop-parity shape catalog (icons + labels from ShapesPanel). */
export const SHAPE_CATEGORIES: ShapeCategory[] = [
  {
    title: "Hình dạng cơ bản",
    items: [
      {
        id: "basic-square",
        label: "Hình vuông",
        shape: "rectangle",
        icon: (
          <div className="h-7 w-7 rounded-none border-2 border-current bg-transparent" />
        ),
      },
      {
        id: "basic-rounded-rect",
        label: "Hình chữ nhật bo góc",
        shape: "rectangle",
        icon: (
          <div className="h-7 w-7 rounded-md border-2 border-current bg-transparent" />
        ),
      },
      {
        id: "basic-circle",
        label: "Hình tròn",
        shape: "ellipse",
        icon: (
          <div className="h-7 w-7 rounded-full border-2 border-current bg-transparent" />
        ),
      },
      {
        id: "basic-triangle",
        label: "Hình tam giác",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon points="12,1.5 22.5,22.5 1.5,22.5" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Đa giác",
    items: [
      {
        id: "poly-pentagon",
        label: "Ngũ giác",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="12,1.5 22.5,9 18.5,22.5 5.5,22.5 1.5,9"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        id: "poly-hexagon-v",
        label: "Lục giác đứng",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="12,1.5 21.5,6.5 21.5,17.5 12,22.5 2.5,17.5 2.5,6.5"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        id: "poly-hexagon-h",
        label: "Lục giác ngang",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="6.5,2.5 17.5,2.5 22.5,12 17.5,21.5 6.5,21.5 1.5,12"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        id: "poly-octagon",
        label: "Bát giác",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="7.5,1.5 16.5,1.5 22.5,7.5 22.5,16.5 16.5,22.5 7.5,22.5 1.5,16.5 1.5,7.5"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Hình ngôi sao",
    items: [
      {
        id: "star-4",
        label: "Ngôi sao 4 cánh",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="12,1.5 15,9 22.5,12 15,15 12,22.5 9,15 1.5,12 9,9"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        id: "star-5",
        label: "Ngôi sao 5 cánh",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="12,1.5 15.2,8.5 22.5,9.2 17.2,14.2 18.8,22.5 12,18.2 5.2,22.5 6.8,14.2 1.5,9.2 8.8,8.5"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        id: "star-6",
        label: "Ngôi sao 6 cánh",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="12,1.5 14.8,7.2 21,5.2 18.2,11.8 22.5,16 15.8,16 13,22.5 10.2,16 3.5,16 7.8,11.8 5,5.2 11.2,7.2"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        id: "star-8",
        label: "Ngôi sao 8 cánh",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="12,1.5 14.5,7 20,4.2 17.2,9.8 22.5,12 17.2,14.2 20,19.8 14.5,17 12,22.5 9.5,17 4,19.8 6.8,14.2 1.5,12 6.8,9.8 4,4.2 9.5,7"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Mũi tên khối",
    items: [
      {
        id: "arrow-right",
        label: "Mũi tên phải",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="1.5,8 13.5,8 13.5,2.5 22.5,12 13.5,21.5 13.5,16 1.5,16"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        id: "arrow-left",
        label: "Mũi tên trái",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="22.5,8 10.5,8 10.5,2.5 1.5,12 10.5,21.5 10.5,16 22.5,16"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        id: "arrow-up",
        label: "Mũi tên lên",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="8,22.5 8,10.5 2.5,10.5 12,1.5 21.5,10.5 16,10.5 16,22.5"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        id: "arrow-down",
        label: "Mũi tên xuống",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <polygon
              points="8,1.5 8,13.5 2.5,13.5 12,22.5 21.5,13.5 16,13.5 16,1.5"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Đường thẳng & Đường nét",
    items: [
      {
        id: "line-straight",
        label: "Đường thẳng",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <line x1="2" y1="12" x2="22" y2="12" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        id: "line-arrow",
        label: "Đường mũi tên",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <line x1="2" y1="12" x2="21" y2="12" strokeLinecap="round" />
            <polyline
              points="15,6 21,12 15,18"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        id: "line-dashed",
        label: "Đường nét đứt",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <line
              x1="2"
              y1="12"
              x2="22"
              y2="12"
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        id: "line-double-arrow",
        label: "Mũi tên hai đầu",
        shape: "polygon",
        icon: (
          <svg className={iconCls} viewBox="0 0 24 24">
            <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
            <polyline
              points="8,6 2,12 8,18"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="16,6 22,12 16,18"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
];
