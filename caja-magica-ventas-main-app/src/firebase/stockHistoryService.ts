import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, writeBatch, onSnapshot, query, where, orderBy, limit, startAfter, QueryDocumentSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from './config';

export interface StockHistoryItem {
  id: string;
  productId: string;
  productName: string;
  type: 'restock' | 'sale' | 'initial';
  quantity: number;
  resultingStock: number;
  date: string;
  isSummary?: boolean;
  levelQuantities?: { [key: string]: number };
  levelDescription?: string;
  affectedLevelName?: string;
  levelQuantity?: number;
  levelSoldQuantity?: number;
  levelStockAfter?: { [key: string]: number };
  isInitial?: boolean;
}

const COLLECTION = 'stock-history';

export const getAllStockHistory = async (): Promise<StockHistoryItem[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StockHistoryItem));
};

export const getStockHistoryByProduct = async (productId: string): Promise<StockHistoryItem[]> => {
  const q = query(
    collection(db, COLLECTION),
    where('productId', '==', productId),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StockHistoryItem));
};

export const getRecentStockHistory = async (
  pageSize: number = 50,
  cursor?: QueryDocumentSnapshot<DocumentData>
): Promise<{ items: StockHistoryItem[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
  const base = [collection(db, COLLECTION), orderBy('date', 'desc'), limit(pageSize)] as const;
  const q = cursor
    ? query(base[0], base[1], startAfter(cursor), base[2])
    : query(base[0], base[1], base[2]);
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as StockHistoryItem));
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { items, lastDoc };
};

export const createStockHistoryItem = async (id: string, data: StockHistoryItem) => {
  await setDoc(doc(db, COLLECTION, id), data);
};

export const updateStockHistoryItem = async (id: string, data: Partial<StockHistoryItem>) => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteStockHistoryItem = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const subscribeStockHistory = (callback: (items: StockHistoryItem[]) => void): (() => void) => {
  return onSnapshot(collection(db, COLLECTION),
    (snapshot: QuerySnapshot<DocumentData>) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockHistoryItem));
      callback(items);
    },
    (error) => console.error('Firestore subscribe error (stock-history):', error)
  );
};

export const replaceAllStockHistory = async (items: StockHistoryItem[]) => {
  const batch = writeBatch(db);
  const col = collection(db, COLLECTION);
  const existing = await getDocs(col);
  existing.docs.forEach(d => batch.delete(d.ref));
  items.forEach(item => {
    const { id, ...data } = item;
    batch.set(doc(col, id), data);
  });
  await batch.commit();
};