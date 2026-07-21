import type { MotionBlock } from "../../types";

function contentCharacter(
  role: string,
  name: string,
  nameVi: string,
  description: string,
): MotionBlock {
  return {
    id: `character.${role}`,
    name,
    nameVi,
    family: "content",
    kind: "character",
    shelf: "character",
    description,
    duration: 0,
    durationMin: 0,
    durationMax: 0,
    tags: ["content", "character", role],
    sampleText: "",
    previewClass: `mv-block-content mv-block-content-character mv-block-content-character-${role}`,
  };
}

export const CHARACTER_PERSON = contentCharacter(
  "person",
  "Person",
  "Người",
  "Nhân vật / silhouette. MVP = illustration tĩnh + Entrance.",
);

export const CHARACTER_HAND = contentCharacter(
  "hand",
  "Hand",
  "Tay",
  "Tay cầm sản phẩm / gesture — thường + media.image SP.",
);

export const CHARACTER_DEVICE = contentCharacter(
  "device",
  "Device",
  "Thiết bị",
  "Thiết bị generic khi chưa chọn laptop/phone.",
);

export const CHARACTER_LAPTOP = contentCharacter(
  "laptop",
  "Laptop",
  "Laptop",
  "Mockup laptop — demo SaaS / dashboard.",
);

export const CHARACTER_PHONE = contentCharacter(
  "phone",
  "Phone",
  "Điện thoại",
  "Mockup phone — app / TikTok-style UI.",
);

export const CHARACTER_BROWSER = contentCharacter(
  "browser",
  "Browser",
  "Trình duyệt",
  "Cửa sổ browser — landing / web app.",
);

export const CHARACTER_CHAT_BUBBLE = contentCharacter(
  "chat-bubble",
  "Chat Bubble",
  "Bong bóng chat",
  "UI hội thoại / tin nhắn. Khác shape.speech-bubble (quote đơn).",
);

export const CHARACTER_ROBOT = contentCharacter(
  "robot",
  "Robot",
  "Robot",
  "Mascot AI / bot — brand tech.",
);

/** Content Character shelf */
export const CHARACTER_BLOCKS: MotionBlock[] = [
  CHARACTER_PERSON,
  CHARACTER_HAND,
  CHARACTER_DEVICE,
  CHARACTER_LAPTOP,
  CHARACTER_PHONE,
  CHARACTER_BROWSER,
  CHARACTER_CHAT_BUBBLE,
  CHARACTER_ROBOT,
];
