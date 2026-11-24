import {defineStore} from 'pinia';

export interface ViewAsState {
  /** The instructor whose schedule an admin is looking at, or null for everyone's. */
  instructorSlug: string | null;
}

export interface ViewAsOption {
  slug: string | null;
  name: string;
}

/** Which instructor an admin is viewing as. A filter the API applies, not a different sign-in. */
export const useViewAsStore = defineStore('viewAs', {
  state: (): ViewAsState => ({
    instructorSlug: null,
  }),
});
