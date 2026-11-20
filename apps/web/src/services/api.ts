import {ApiClient} from '@/services/apiClient';
import {firebaseTokens} from '@/plugins/firebase';

/** The API client the app uses, signed in with the current Firebase user. */
export const api = new ApiClient(firebaseTokens);
