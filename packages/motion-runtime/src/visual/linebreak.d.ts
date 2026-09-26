declare module "linebreak" {
  export type LineBreak = { position: number; required: boolean };
  export default class LineBreaker {
    constructor(text: string);
    nextBreak(): LineBreak | null;
  }
}
