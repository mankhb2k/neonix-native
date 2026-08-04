export type AudioCategoryKey = "import" | "music" | "sfx";

export type AudioItem = {
  id: string;
  title: string;
  artist?: string;
  duration: number; // in seconds
  category: AudioCategoryKey;
  subCategory?: string;
  assetId?: string;
  uri?: string;
  isPro?: boolean;
  isFavorite?: boolean;
};

export type AudioCategoryDef = {
  key: AudioCategoryKey;
  label: string;
  hasDropdown?: boolean;
  subCategories?: string[];
};
