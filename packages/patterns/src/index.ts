/**
 * @motionvideo/patterns — authoring-time pattern & helper library.
 *
 * Functions ở đây nhận params + theme rồi emit primitive authoring atoms
 * (layer shape / authoring JSON / timing canonicalization). Chúng KHÔNG phải
 * runtime concept: kết quả quy về đúng primitive schema trong
 * @motionvideo/motion-protocol. Runtime/compiler không bao giờ thấy "pattern".
 *
 * Mirrors shadcn/ui — copy pattern source nếu cần custom look.
 */

export * from "./layer-atoms";
export * from "./normalize-authoring";
export * from "./project-timing";
