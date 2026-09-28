import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, writeBatch, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from './config';

export interface DailyClose {
  id: string;
  date: string;
  totalSales: number;
  totalProfit: number;
  totalItems: number;
  salesCount: number;
  paymentMethods: {
    efectivo: number;
    tarjeta: number;
    yape: number;
    plin: number;
  };
  closedBy: string;
  closeTime: string;
  transacciones?: any[];
}

const COLLECTION = 'daily-closes';

export const getAllDailyCloses = async (): Promise<DailyClose[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyClose));
};

export const createDailyClose = async (id: string, data: DailyClose) => {
  await setDoc(doc(db, COLLECTION, id), data);
};

export const updateDailyClose = async (id: string, data: Partial<DailyClose>) => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteDailyClose = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const subscribeDailyCloses = (callback: (closes: DailyClose[]) => void): (() => void) => {
  return onSnapshot(collection(db, COLLECTION),
    (snapshot: QuerySnapshot<DocumentData>) => {
      const closes = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyClose));
      callback(closes);
    },
    (error) => console.error('Firestore subscribe error (daily-closes):', error)
  );
};

export const replaceAllDailyCloses = async (closes: DailyClose[]) => {
  const batch = writeBatch(db);
  const col = collection(db, COLLECTION);
  const existing = await getDocs(col);
  existing.docs.forEach(d => batch.delete(d.ref));
  closes.forEach(c => {
    const { id, ...data } = c;
    batch.set(doc(col, id), data);
  });
  await batch.commit();
};
