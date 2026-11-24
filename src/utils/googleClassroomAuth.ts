import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials',
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/classroom.topics',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'consent',
});

export const CLASSROOM_OWNER_EMAIL = 'carolinavitaliano1@gmail.com';
export const OFFICIAL_CLASSROOM_INVITE_LINK =
  'https://classroom.google.com/c/OTAwOTg5MDU4NTY0?cjc=f26my4bk';

export const isClassroomOwner = (user: User | null | undefined): boolean =>
  Boolean(user?.email && user.email.toLowerCase() === CLASSROOM_OWNER_EMAIL.toLowerCase());

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token strictly in memory (never localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

interface AuthSubscriber {
  onSuccess?: (user: User, token: string) => void;
  onFailure?: () => void;
}

const subscribers = new Set<AuthSubscriber>();

const notifySuccess = (user: User, token: string) => {
  for (const sub of subscribers) {
    sub.onSuccess?.(user, token);
  }
};

const notifyFailure = () => {
  for (const sub of subscribers) {
    sub.onFailure?.();
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const subscriber: AuthSubscriber = {
    onSuccess: onAuthSuccess,
    onFailure: onAuthFailure,
  };
  subscribers.add(subscriber);

  if (auth.currentUser && cachedAccessToken) {
    onAuthSuccess?.(auth.currentUser, cachedAccessToken);
  }

  const unsubscribeFirebase = onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });

  return () => {
    subscribers.delete(subscriber);
    unsubscribeFirebase();
  };
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google Classroom.');
    }

    cachedAccessToken = credential.accessToken;
    notifySuccess(result.user, cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  notifyFailure();
};
