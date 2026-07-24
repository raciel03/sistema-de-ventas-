import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, writeBatch, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from './config';

export interface AppUser {
  id: string;
  username: string;
  password: string;
  email: string;
  role: 'admin' | 'empleado';
  name: string;
  createdAt: string;
  firebaseUid?: string;
}

const COLLECTION = 'local-users';

export const getAllLocalUsers = async (): Promise<AppUser[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
};

export const getLocalUserById = async (id: string): Promise<AppUser | null> => {
  const snap = await getDocs(collection(db, COLLECTION));
  const docSnap = snap.docs.find(d => d.id === id);
  return docSnap ? ({ id: docSnap.id, ...docSnap.data() } as AppUser) : null;
};

export const createLocalUser = async (id: string, data: AppUser) => {
  await setDoc(doc(db, COLLECTION, id), data);
};

export const updateLocalUser = async (id: string, data: Partial<AppUser>) => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteLocalUser = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const subscribeLocalUsers = (callback: (users: AppUser[]) => void): (() => void) => {
  return onSnapshot(collection(db, COLLECTION),
    (snapshot: QuerySnapshot<DocumentData>) => {
      const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
      callback(users);
    },
    (error) => console.error('Firestore subscribe error (local-users):', error)
  );
};

export const replaceAllLocalUsers = async (users: AppUser[]) => {
  const batch = writeBatch(db);
  const col = collection(db, COLLECTION);
  const existing = await getDocs(col);
  existing.docs.forEach(d => batch.delete(d.ref));
  users.forEach(u => {
    const { id, ...data } = u;
    batch.set(doc(col, id), data);
  });
  await batch.commit();
};
