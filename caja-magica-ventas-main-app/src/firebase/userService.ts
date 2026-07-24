import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './config';

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  name: string;
  role: 'admin' | 'empleado';
  createdAt: string;
  createdBy?: string;
  isActive: boolean;
}

const COLLECTION = 'users';

export const createUserProfile = async (uid: string, data: Omit<UserProfile, 'uid'>) => {
  await setDoc(doc(db, COLLECTION, uid), data);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as UserProfile;
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
  await updateDoc(doc(db, COLLECTION, uid), data);
};

export const deleteUserProfile = async (uid: string) => {
  await deleteDoc(doc(db, COLLECTION, uid));
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
};

export const getUserByUsername = async (username: string): Promise<UserProfile | null> => {
  const q = query(collection(db, COLLECTION), where('username', '==', username));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() } as UserProfile;
};

export const getUserByEmail = async (email: string): Promise<UserProfile | null> => {
  const q = query(collection(db, COLLECTION), where('email', '==', email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() } as UserProfile;
};
