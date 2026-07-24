import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from './config';

export type AuthCallback = (user: User | null) => void;

export const onAuthChange = (callback: AuthCallback) => {
  return onAuthStateChanged(auth, callback);
};

export const loginWithEmail = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const registerWithEmail = async (email: string, password: string) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const createUserWithoutSignIn = async (email: string, password: string): Promise<string> => {
  const apiKey = auth.app.options.apiKey;
  if (!apiKey) throw new Error('API key not found');

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false })
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.localId;
};

export const logout = async () => {
  await signOut(auth);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
