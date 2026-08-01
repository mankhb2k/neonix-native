import type { ReactNode } from "react";

type Props = {
  media: ReactNode;
};

/** Media tab — renders AssetPanel (or other media UI) passed from the shell. */
export function MediaPanel({ media }: Props) {
  return media;
}
