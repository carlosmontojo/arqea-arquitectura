export type Photo = {
  /** `ph://…` on iOS, `content://…` on Android. Usable directly as an image URI. */
  id: string;
  filename: string | null;
  width: number | null;
  height: number | null;
  /** UNIX timestamp in ms. */
  creationTime: number | null;
};

export type SwipeAction = 'keep' | 'delete';

export type Decision = {
  photo: Photo;
  action: SwipeAction;
};

export type SortOrder = 'newest' | 'oldest';
