import type {Me} from '@hde/shared';

/** What `requireSignedIn` gives the routes behind it. */
export interface SignedInEnv {
  Variables: {me: Me};
}
