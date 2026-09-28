import { collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, writeBatch, onSnapshot, query, orderBy, limit, startAfter, QueryDocumentSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from './config';
import type { Product } from './productService';

export interface SaleItem {
  product: Product;
  quantity: number;
  selectedLevelName?: string;
  levelQuantity?: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  subtotal: number;
  igv: number;
  igvRate: number;
  total: number;
  totalProfit: number;
  date: string;
  paymentMethod: 'efectivo' | 'tarjeta' | 'yape' | 'plin';
  amountPaid?: number;
  change?: number;
  aplicarRedondeo?: boolean;
}

const COLLECTION = 'sales';

export const getAllSales = async (): Promise<Sale[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
};

export const getRecentSales = async (
  pageSize: number = 50,
  cursor?: QueryDocumentSnapshot<DocumentData>
): Promise<{ items: Sale[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> => {
  const q = cursor
    ? query(collection(db, COLLECTION), orderBy('date', 'desc'), startAfter(cursor), limit(pageSize))
    : query(collection(db, COLLECTION), orderBy('date', 'desc'), limit(pageSize));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { items, lastDoc };
};

export const getSaleById = async (id: string): Promise<Sale | null> => {
  const docRef = doc(db, COLLECTION, id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Sale) : null;
};

export const createSale = async (id: string, data: Sale) => {
  await setDoc(doc(db, COLLECTION, id), data);
};

export const updateSale = async (id: string, data: Partial<Sale>) => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteSale = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const subscribeSales = (callback: (sales: Sale[]) => void): (() => void) => {
  return onSnapshot(collection(db, COLLECTION),
    (snapshot: QuerySnapshot<DocumentData>) => {
      const sales = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
      callback(sales);
    },
    (error) => console.error('Firestore subscribe error (sales):', error)
  );
};

export const replaceAllSales = async (sales: Sale[]) => {
  const batch = writeBatch(db);
  const col = collection(db, COLLECTION);
  const existing = await getDocs(col);
  existing.docs.forEach(d => batch.delete(d.ref));
  sales.forEach(s => {
    const { id, ...data } = s;
    batch.set(doc(col, id), data);
  });
  await batch.commit();
};