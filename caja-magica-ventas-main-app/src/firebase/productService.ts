import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, writeBatch, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from './config';

export interface SaleLevel {
  id: string;
  name: string;
  baseUnitsContained: number;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  initialStock: number;
}

export interface Product {
  id: string;
  name: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  initialStock: number;
  category: string;
  type: 'unidad' | 'peso' | 'mayorista';
  imageUrl?: string;
  purchasePricePerKg?: number;
  salePricePerKg?: number;
  equivalentGrams?: number;
  minWeightGrams?: number;
  baseUnit?: string;
  unitsPerBase?: number;
  saleLevels?: SaleLevel[];
  weightInGrams?: number;
}

const COLLECTION = 'products';

export const getAllProducts = async (): Promise<Product[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
};

export const getProductById = async (id: string): Promise<Product | null> => {
  const snap = await getDocs(collection(db, COLLECTION));
  const doc = snap.docs.find(d => d.id === id);
  return doc ? ({ id: doc.id, ...doc.data() } as Product) : null;
};

export const createProduct = async (id: string, data: Product) => {
  await setDoc(doc(db, COLLECTION, id), data);
};

export const updateProduct = async (id: string, data: Partial<Product>) => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteProduct = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const subscribeProducts = (callback: (products: Product[]) => void): (() => void) => {
  return onSnapshot(collection(db, COLLECTION),
    (snapshot: QuerySnapshot<DocumentData>) => {
      const products = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      callback(products);
    },
    (error) => console.error('Firestore subscribe error (products):', error)
  );
};

export const replaceAllProducts = async (products: Product[]) => {
  const batch = writeBatch(db);
  const col = collection(db, COLLECTION);
  const existing = await getDocs(col);
  existing.docs.forEach(d => batch.delete(d.ref));
  products.forEach(p => {
    const { id, ...data } = p;
    batch.set(doc(col, id), data);
  });
  await batch.commit();
};
