import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { uploadProductImage, uploadBase64ToCloudinary } from "@/lib/cloudinary";
import LoaderFerro from "@/components/LoaderFerro";
import { esAdminActual } from "@/lib/permisos";
import { InfoProductoNiveles } from "@/components/InfoProductoNiveles";
import { EMPRESA } from "@/config/empresa";
import qz from "qz-tray";
import QRCode from "qrcode";
import { loginWithEmail, logout as firebaseLogout, onAuthChange, getCurrentSupabaseUser, enviarResetPassword, cambiarPassword, crearUsuarioPorAdmin, adminCambiarPassword } from "@/supabase/auth";
import { createUserProfile, getUserProfile, getUserByEmail, updateUserProfile, deleteUserProfile } from "@/supabase/userService";
import type { UserProfile } from "@/supabase/userService";
import { getAllProducts, createProduct, updateProduct, deleteProduct, subscribeProducts, getProductById } from "@/supabase/productService";
import { getAllSales, createSale, updateSale, deleteSale, subscribeSales } from "@/supabase/saleService";
import { getAllStockHistory, createStockHistoryItem, updateStockHistoryItem, subscribeStockHistory, deleteStockHistoryItem, getStockHistoryByProduct } from "@/supabase/stockHistoryService";
import { getAllDailyCloses, createDailyClose, updateDailyClose, deleteDailyClose, subscribeDailyCloses } from "@/supabase/dailyCloseService";
import { getAllLocalUsers, createLocalUser, updateLocalUser, deleteLocalUser, subscribeLocalUsers } from "@/supabase/localUserService";
import { getAllClients, createClient, updateClient, deleteClient, subscribeClients, consultarRuc } from "@/supabase/clientService";
import type { Cliente } from "@/supabase/clientService";
import { getAllComprobantes, emitirComprobante, anularComprobante, subscribeComprobantes, updateComprobanteSunat } from "@/supabase/comprobanteService";
import type { Comprobante } from "@/supabase/comprobanteService";
import { getEmisor, saveEmisor } from "@/supabase/emisorService";
import type { Emisor } from "@/supabase/emisorService";
import { emitirSunat } from "@/supabase/sunatService";
import { supabase } from "@/supabase/client";
import { 
  ShoppingCart, 
  Package, 
  History, 
  Plus, 
  Minus, 
  Trash2, 
  Search,
  Calculator,
  CreditCard,
  Banknote,
  LogIn,
  User,
  Store,
  Edit,
  Smartphone,
  TrendingUp,
  Calendar,
  Download,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  UserPlus,
  AlertTriangle,
  Clock,
  Layers,
  Settings,
  CloudUpload,
  RefreshCw,
  CheckCircle2,
  Mail,
  X,
  Lock,
  Users,
  ReceiptText,
  Building2,
  Copy,
  Phone,
  MapPin,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Printer
} from "lucide-react";

interface SaleLevel {
  id: string;
  name: string;
  baseUnitsContained: number;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  initialStock: number;
}

interface Product {
  id: string;
  name: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  initialStock: number;
  category: string;
  type: 'unidad' | 'peso' | 'mayorista' | 'metro';
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

interface SaleItem {
  product: Product;
  quantity: number;
  selectedLevelName?: string;
  levelQuantity?: number;
  levelId?: number;
  /** Total de la linea tal como lo guardo la base (mas fiable que recalcularlo). */
  totalLinea?: number;
}

interface Sale {
  id: string;
  items: SaleItem[];
  subtotal: number;
  igv: number;
  igvRate: number;
  total: number;
  totalProfit: number;
  date: string;
  localDate?: string;
  clientId?: string;
  /** uuid del usuario que atendio (ventas.usuario_id), lo pone la base. */
  userId?: string;
  paymentMethod: 'efectivo' | 'tarjeta' | 'yape' | 'plin';
  amountPaid?: number;
  change?: number;
  aplicarRedondeo?: boolean;
}

interface DailyClose {
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
  transacciones?: Sale[];
}

interface StockHistoryItem {
  id: string;
  saleId?: string;
  productId: string;
  productName: string;
  type: 'restock' | 'sale' | 'initial' | 'price_change';
  quantity: number;
  resultingStock: number;
  date: string;
  isSummary?: boolean;
  isInitial?: boolean;
  // Campos para productos mayoristas
  levelQuantities?: { [key: string]: number };
  levelDescription?: string;
  affectedLevelName?: string;
  levelQuantity?: number;
  levelSoldQuantity?: number;
  levelStockAfter?: { [key: string]: number };
  // Campos para cambios de precio
  priceChanges?: { levelName: string; oldSalePrice?: number; newSalePrice?: number; oldPurchasePrice?: number; newPurchasePrice?: number }[];
}

interface StockHistoryDisplayRow {
  id: string;
  date: string;
  stockActual: number;
  soldQuantity: number | null;
  addedQuantity: number | null;
  resultingStock: number;
  isInitial: boolean;
}

interface AppUser {
  id: string;
  password: string;
  email: string;
  role: 'admin' | 'empleado';
  name: string;
  createdAt: string;
  firebaseUid?: string;
}

const normalizeText = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeSearch = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Convierte un monto a letras en español: 110.40 -> "CIENTO DIEZ CON 40/100". */
const numeroALetras = (valor: number): string => {
  const numero = Number.isFinite(valor) ? Math.abs(valor) : 0;
  const entero = Math.floor(numero);
  const centavos = Math.round((numero - entero) * 100);
  const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const ESPECIALES = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  const decenas = (n: number): string => {
    if (n < 10) return UNIDADES[n];
    if (n < 20) return ESPECIALES[n - 10];
    if (n === 20) return 'VEINTE';
    if (n < 30) return 'VEINTI' + UNIDADES[n - 20];
    const d = Math.floor(n / 10);
    const u = n % 10;
    return DECENAS[d] + (u ? ' Y ' + UNIDADES[u] : '');
  };
  const centenas = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return CENTENAS[c] + (resto ? ' ' + decenas(resto) : '');
  };
  const miles = (n: number): string => {
    if (n === 0) return 'CERO';
    const m = Math.floor(n / 1000);
    const resto = n % 1000;
    let texto = '';
    if (m > 0) texto += m === 1 ? 'MIL' : centenas(m) + ' MIL';
    if (resto > 0) texto += (texto ? ' ' : '') + centenas(resto);
    return texto;
  };
  return `${miles(entero)} CON ${String(centavos).padStart(2, '0')}/100`;
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

let _saleIdCounter = 0;
const generateSaleId = (): string => {
  _saleIdCounter++;
  return `${Date.now()}${_saleIdCounter}`;
};

const dedupeBySaleId = (lista: Sale[]): Sale[] => {
  const vistos = new Map<string, Sale>();
  for (const s of lista) { if (s && s.id !== undefined && s.id !== null) vistos.set(s.id, s); }
  return Array.from(vistos.values());
};

const stripUndefined = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (obj instanceof Date) return obj.toISOString();
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)])
  );
};

const WEIGHT_DECIMAL_PATTERN = /^\d*(?:[.,]\d{0,3})?$/;

/**
 * Peso en gramos -> texto legible en tickets.
 * 1000 g -> "1.00 kg" | 250 g -> "0.25 kg" | 500 g -> "500 g"
 * Se usa "kg" con 2 decimales para que nunca se lea como 1000 kg.
 */
const formatearPeso = (gramos: number): string => {
  const g = Number.isFinite(gramos) ? gramos : 0;
  if (g < 1000) return `${Math.round(g)} g`;
  return `${(g / 1000).toFixed(2)} kg`;
};

// Pending sync helpers: localStorage tracks items created offline that haven't reached Firebase yet
const PENDING = {
  PRODUCTS: 'pos-products-pending',
  SALES: 'pos-sales-pending',
  USERS: 'pos-users-pending',
  CLOSES: 'pos-daily-closes-pending',
  HISTORY: 'pos-stock-history-pending',
};
const addPendingId = (key: string, id: string) => {
  try { const arr = JSON.parse(localStorage.getItem(key) || '[]'); if (!arr.includes(id)) { arr.push(id); safeSetItem(key, JSON.stringify(arr)); } } catch (e) { /* ignore */ }
};
const removePendingId = (key: string, id: string) => {
  try { const arr: string[] = JSON.parse(localStorage.getItem(key) || '[]'); const f = arr.filter(x => x !== id); safeSetItem(key, JSON.stringify(f)); } catch (e) { /* ignore */ }
};
const isPendingId = (key: string, id: string): boolean => {
  try { return (JSON.parse(localStorage.getItem(key) || '[]') as string[]).includes(id); } catch (e) { return false; }
};
const leerPendientes = (key: string): string[] => {
  try { const arr = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(arr) ? arr : []; } catch { return []; }
};
const leerLista = <T,>(key: string): T[] => {
  try { const arr = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(arr) ? arr : []; } catch { return []; }
};
/** Une lo que llego de la base con los registros locales aun pendientes de subir. */
const unirPendientes = <T extends { id: string }>(locales: T[], base: T[], clave: string): T[] => {
  const pendientes = new Set(leerPendientes(clave));
  const porId = new Map(base.map((x) => [x.id, x] as const));
  for (const l of locales) {
    if (pendientes.has(l.id) && !porId.has(l.id)) porId.set(l.id, l);
  }
  return Array.from(porId.values());
};
const safeSetItem = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch (e) { console.warn('localStorage quota exceeded:', key); }
};
const LOCAL_KEYS = ['pos-products', 'pos-sales', 'pos-users', 'pos-daily-closes', 'pos-stock-history'];
const getLocalBytes = () => {
  let total = 0;
  for (const k of Object.keys(localStorage)) total += (localStorage.getItem(k)?.length || 0) * 2;
  return total;
};
let lastCleanupTime = 0;

const autoCleanupLocal = () => {
  const now = Date.now();
  if (getLocalBytes() < 4 * 1024 * 1024 && now - lastCleanupTime < 300000) return;
  lastCleanupTime = now;
  const pending = new Set<string>();
  for (const pk of [PENDING.PRODUCTS, PENDING.SALES, PENDING.USERS, PENDING.CLOSES, PENDING.HISTORY]) {
    try { (JSON.parse(localStorage.getItem(pk) || '[]') as string[]).forEach(id => pending.add(id)); } catch {}
  }
  for (const key of LOCAL_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let items = JSON.parse(raw);
      if (!Array.isArray(items)) continue;
      const keepPending = items.filter((i: any) => pending.has(i.id));
      if (key === 'pos-sales') {
        const recent = items.filter((i: any) => !pending.has(i.id)).slice(-500);
        items = [...keepPending, ...recent];
        safeSetItem(key, JSON.stringify(items));
      } else if (key === 'pos-stock-history') {
        const recent = items.filter((i: any) => !pending.has(i.id)).slice(-2000);
        items = [...keepPending, ...recent];
        safeSetItem(key, JSON.stringify(items));
      } else if (key === 'pos-daily-closes') {
        const recent = items.filter((i: any) => !pending.has(i.id)).slice(-100);
        items = [...keepPending, ...recent];
        safeSetItem(key, JSON.stringify(items));
      }
    } catch {}
  }
};

const Index = () => {
  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  };
  const formatearFechaLocal = (fechaStr: string) => {
    const [y, m, d] = fechaStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString();
  };
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("ventas");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [dailyCloses, setDailyCloses] = useState<DailyClose[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentSale, setCurrentSale] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [mayoristaSearch, setMayoristaSearch] = useState("");
  const [transaccionesSearch, setTransaccionesSearch] = useState("");
  const [resumenSearch, setResumenSearch] = useState("");
  const [salesSearch, setSalesSearch] = useState("");
  const [inventoryView, setInventoryView] = useState<'todos' | 'unidad' | 'peso' | 'metro'>('todos');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'yape' | 'plin'>('efectivo');
  const [amountPaid, setAmountPaid] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [userRole, setUserRole] = useState<'admin' | 'empleado'>('empleado');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditWeightProductOpen, setIsEditWeightProductOpen] = useState(false);
  const [editingWeightProduct, setEditingWeightProduct] = useState<Product | null>(null);
  const [isEditMetroProductOpen, setIsEditMetroProductOpen] = useState(false);
  const [editingMetroProduct, setEditingMetroProduct] = useState<Product | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  // Modal de confirmacion antes de bloquear un empleado
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<AppUser | null>(null);
  const [isCloseCashOpen, setIsCloseCashOpen] = useState(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedCloseDetail, setSelectedCloseDetail] = useState<DailyClose | null>(null);
  const [isCloseDetailOpen, setIsCloseDetailOpen] = useState(false);
  const [isProductosVendidosOpen, setIsProductosVendidosOpen] = useState(false);
  const [isVentasIndividualesOpen, setIsVentasIndividualesOpen] = useState(false);
  const [showIndividualSales, setShowIndividualSales] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [isChangingUserPassword, setIsChangingUserPassword] = useState(false);
  // Mensaje del overlay de carga (null = oculto).
  const [cargando, setCargando] = useState<string | null>(null);
  const [viewUser, setViewUser] = useState<AppUser | null>(null);
  const [addProductMode, setAddProductMode] = useState<'unidad' | 'peso' | 'metro' | 'mayorista'>('unidad');
  const [newWeightProduct, setNewWeightProduct] = useState({ name: "", purchasePrice: 0, salePrice: 0, purchasePricePerKg: 0, salePricePerKg: 0, equivalentGrams: 0, stock: 0, initialStock: 0, minWeightGrams: 0, category: "" });
  const [newMetroProduct, setNewMetroProduct] = useState({ name: "", purchasePrice: 0, salePrice: 0, initialStockCm: 0, category: "" });
  const [metroPurchaseInput, setMetroPurchaseInput] = useState('');
  const [metroSaleInput, setMetroSaleInput] = useState('');
  const [metroStockInput, setMetroStockInput] = useState('');
  // Manejo de input como string para permitir ceros y decimales (e.g., "0.020")
  const [equivalentGramsInput, setEquivalentGramsInput] = useState('');
  const [equivalentGramsError, setEquivalentGramsError] = useState('');
  const [minWeightInput, setMinWeightInput] = useState('');
  const [minWeightError, setMinWeightError] = useState('');
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockQuantities, setRestockQuantities] = useState<{ [key: string]: string }>({});
  const [stockHistory, setStockHistory] = useState<StockHistoryItem[]>([]);
  // Recuerdan qué IDs de ventas/historial YA están confirmados (sin cambios) en Firestore,
  // para no reescribir/redescargar todo en cada venta. No afecta el fix de borrado (sigue desactivado).
  const syncedSaleIds = useRef<Set<string>>(new Set());
  const syncedHistoryIds = useRef<Set<string>>(new Set());
  const ventasEnviandoseRef = useRef<Set<string>>(new Set());
  // Ya no se necesita seguimiento de IDs sincronizados — cada sync escribe todo via setDoc (upsert)
  const [modalProductHistory, setModalProductHistory] = useState<StockHistoryItem[]>([]);
  // Pestaña activa del nuevo diseño del modal de información (niveles sin Unidad)
  const [infoLevelTab, setInfoLevelTab] = useState(0);
  // Se incrementa cuando una venta termina de guardarse en Supabase para que el
  // modal de información recargue el historial con la venta recién registrada.
  const [tickHistorial, setTickHistorial] = useState(0);
  // IDs de historial que ya están viajando a Supabase (aunque su pendiente se
  // quite en el camino): el modal debe mostrarlos igual para que la primera
  // venta nunca aparezca sin su contorno "Stock Inicial".
  const historialEnVueloRef = useRef<Set<string>>(new Set());
  const [isStockHistoryModalOpen, setIsStockHistoryModalOpen] = useState(false);
  const [selectedStockHistoryProduct, setSelectedStockHistoryProduct] = useState<Product | null>(null);
  const [isDeleteStockHistoryOpen, setIsDeleteStockHistoryOpen] = useState(false);
  const [showStockRestockForm, setShowStockRestockForm] = useState(false);
  const [selectedHistoryLevel, setSelectedHistoryLevel] = useState<string>('');
const [stockHistoryRestockQuantity, setStockHistoryRestockQuantity] = useState('');
const [isDeleteSaleOpen, setIsDeleteSaleOpen] = useState(false);
const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  // Estados para reposición mayorista
  const [selectedMayoristaRestockLevel, setSelectedMayoristaRestockLevel] = useState('');
  const [mayoristaRestockQuantity, setMayoristaRestockQuantity] = useState('');

  // Estados para registro de producto mayorista
  const [newMayoristaProduct, setNewMayoristaProduct] = useState({
    name: '',
    category: '',
    initialStock: 0
  });
  const [newMayoristaLevels, setNewMayoristaLevels] = useState<SaleLevel[]>([]);
  const [newLevelDropdown, setNewLevelDropdown] = useState('Paquete');
  const [newLevelCustomName, setNewLevelCustomName] = useState('');
  const [newLevelContains, setNewLevelContains] = useState('');
  const [newLevelPurchasePrice, setNewLevelPurchasePrice] = useState('');
  const [newLevelSalePrice, setNewLevelSalePrice] = useState('');
  const [newLevelStockInput, setNewLevelStockInput] = useState('');
  const [editingNewLevelId, setEditingNewLevelId] = useState<string | null>(null);
  const [editNewTempStock, setEditNewTempStock] = useState('');
  const [editNewTempPurchasePrice, setEditNewTempPurchasePrice] = useState('');
  const [editNewTempSalePrice, setEditNewTempSalePrice] = useState('');
  const [editNewTempContains, setEditNewTempContains] = useState('');

  // Estados para modal de venta mayorista
  const [inventorySubTab, setInventorySubTab] = useState<'general' | 'mayorista'>('general');
  const [ventaMode, setVentaMode] = useState<'regular' | 'mayor'>('regular');
  const [igvRateStr, setIgvRateStr] = useState("18");
  const [aplicarRedondeo, setAplicarRedondeo] = useState<boolean>(true);
  const [isMayoristaModalOpen, setIsMayoristaModalOpen] = useState(false);
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [newProductImagePreview, setNewProductImagePreview] = useState<string>('');
  const [editProductImage, setEditProductImage] = useState<File | null>(null);
  const [editProductImagePreview, setEditProductImagePreview] = useState<string>('');

  const [selectedMayoristaProduct, setSelectedMayoristaProduct] = useState<Product | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [mayoristaQuantity, setMayoristaQuantity] = useState<number | string>(1);

  // Inputs controlados como string para decimales
  const [unitPurchaseInput, setUnitPurchaseInput] = useState('');
  const [unitSaleInput, setUnitSaleInput] = useState('');
  const [purchasePerKgInput, setPurchasePerKgInput] = useState('');
  const [salePerKgInput, setSalePerKgInput] = useState('');
  // Edit weight product inputs
  const [editPurchasePerKgInput, setEditPurchasePerKgInput] = useState('');
  const [editSalePerKgInput, setEditSalePerKgInput] = useState('');
  // Edit metro product inputs
  const [editMetroPurchaseInput, setEditMetroPurchaseInput] = useState('');
  const [editMetroSaleInput, setEditMetroSaleInput] = useState('');
  const [editMetroStockInput, setEditMetroStockInput] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);

  // Sincronización en tiempo real entre pestañas y actualización visual
  const [pricePulse, setPricePulse] = useState(false);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pos-products' && e.newValue) {
        try {
          setProducts(JSON.parse(e.newValue));
        } catch (err) {
          void err;
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  

  const formatCurrency = (n: number) =>
    `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const normalizeDecimalInput = (value: string) => value.replace(',', '.');

  const getWeightInputError = useCallback((raw: string, fieldLabel: string, maxValue?: number) => {
    if (raw === '') return '';
    if (!WEIGHT_DECIMAL_PATTERN.test(raw)) return `${fieldLabel}: solo se permiten numeros con hasta 3 decimales.`;

    const parsed = parseFloat(normalizeDecimalInput(raw));
    if (!Number.isFinite(parsed) || parsed <= 0) return `${fieldLabel}: debe ser mayor a 0.`;
    if (maxValue !== undefined && parsed > maxValue) return `${fieldLabel}: no puede ser mayor al stock inicial.`;

    return '';
  }, []);

  const isWeightFormInvalid = (
    !newWeightProduct.name.trim() ||
    !newWeightProduct.category.trim() ||
    newWeightProduct.purchasePrice <= 0 ||
    newWeightProduct.salePrice <= 0 ||
    newWeightProduct.initialStock <= 0 ||
    newWeightProduct.equivalentGrams <= 0 ||
    newWeightProduct.minWeightGrams <= 0 ||
    !!equivalentGramsError ||
    !!minWeightError
  );

  const isMetroFormInvalid = (
    !newMetroProduct.name.trim() ||
    !newMetroProduct.category.trim() ||
    newMetroProduct.purchasePrice <= 0 ||
    newMetroProduct.salePrice <= 0 ||
    newMetroProduct.initialStockCm <= 0 ||
    newMetroProduct.purchasePrice >= newMetroProduct.salePrice
  );

  const isMayoristaFormInvalid = (
    !newMayoristaProduct.name.trim() ||
    !newMayoristaProduct.category.trim() ||
    newMayoristaLevels.length === 0 ||
    (newMayoristaLevels.some(l => l.name === 'Unidad') && newMayoristaLevels.length < 2) ||
    newMayoristaLevels.some(l => l.name === 'Unidad'
      ? (!l.stock || l.stock <= 0)
      : (!newMayoristaLevels.some(lu => lu.name === 'Unidad') && (!l.stock || l.stock <= 0))
    )
  );

  // Estados para edición rápida de productos
  const [editingQuickProduct, setEditingQuickProduct] = useState<Product | null>(null);
  const [isEditQuickProductOpen, setIsEditQuickProductOpen] = useState(false);
  // Estados para modal de peso
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [selectedWeightProduct, setSelectedWeightProduct] = useState<Product | null>(null);
  const [weightQuantities, setWeightQuantities] = useState<{ [key: string]: number }>({});
  const [customWeight, setCustomWeight] = useState('');
  const [customMoney, setCustomMoney] = useState('');
  const [weightInputMode, setWeightInputMode] = useState<'grams' | 'money'>('grams');

  // Estados para modal de venta por metro
  const [isMetroModalOpen, setIsMetroModalOpen] = useState(false);
  const [selectedMetroProduct, setSelectedMetroProduct] = useState<Product | null>(null);
  const [metroQuantities, setMetroQuantities] = useState<{ [key: string]: number }>({});
  const [customMeters, setCustomMeters] = useState('');
  const [customMetroMoney, setCustomMetroMoney] = useState('');
  const [metroInputMode, setMetroInputMode] = useState<'meters' | 'money'>('meters');

  useEffect(() => {
    if (selectedWeightProduct) {
      const updated = products.find(p => p.id === selectedWeightProduct.id);
      if (updated) {
        setSelectedWeightProduct(updated);
        setPricePulse(true);
        const t = setTimeout(() => setPricePulse(false), 300);
        return () => clearTimeout(t);
      }
    }
  }, [products]);

  useEffect(() => {
    if (!isWeightModalOpen) {
      setWeightQuantities({});
      setCustomWeight('');
      setCustomMoney('');
      setWeightInputMode('grams');
    }
  }, [isWeightModalOpen]);

  useEffect(() => {
    if (selectedMetroProduct) {
      const updated = products.find(p => p.id === selectedMetroProduct.id);
      if (updated) {
        setSelectedMetroProduct(updated);
      }
    }
  }, [products]);

  useEffect(() => {
    if (!isMetroModalOpen) {
      setMetroQuantities({});
      setCustomMeters('');
      setCustomMetroMoney('');
      setMetroInputMode('meters');
    }
  }, [isMetroModalOpen]);

  useEffect(() => {
    if (!isMayoristaModalOpen) {
      setSelectedMayoristaProduct(null);
      setSelectedLevelId('');
      setMayoristaQuantity(1);
    }
  }, [isMayoristaModalOpen]);

  useEffect(() => {
    if (addProductMode !== 'peso') {
      setEquivalentGramsError('');
      setMinWeightError('');
      return;
    }

    const nextError = getWeightInputError(equivalentGramsInput, 'Equivale por gramo');
    const nextValue = nextError || equivalentGramsInput === ''
      ? 0
      : parseFloat(normalizeDecimalInput(equivalentGramsInput)) || 0;

    setEquivalentGramsError(nextError);
    setNewWeightProduct(prev =>
      prev.equivalentGrams === nextValue ? prev : { ...prev, equivalentGrams: nextValue }
    );
  }, [addProductMode, equivalentGramsInput, getWeightInputError]);

  useEffect(() => {
    if (addProductMode !== 'peso') {
      setMinWeightError('');
      return;
    }

    const nextError = getWeightInputError(minWeightInput, 'Peso minimo', newWeightProduct.stock || undefined);
    const nextValue = nextError || minWeightInput === ''
      ? 0
      : parseFloat(normalizeDecimalInput(minWeightInput)) || 0;

    setMinWeightError(nextError);
    setNewWeightProduct(prev =>
      prev.minWeightGrams === nextValue ? prev : { ...prev, minWeightGrams: nextValue }
    );
  }, [addProductMode, minWeightInput, newWeightProduct.stock, getWeightInputError]);

  // Estados para eliminar cierre de caja
  const [isDeleteCloseOpen, setIsDeleteCloseOpen] = useState(false);
  const [closeToDelete, setCloseToDelete] = useState<DailyClose | null>(null);
  const [adminPassword, setAdminPassword] = useState('');

  // Login form states
  const [password, setPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  // Flujo "¿Olvidaste tu contraseña?": tras el enlace de recuperacion se pide la nueva.
  const [showResetPasswordForm, setShowResetPasswordForm] = useState(false);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [nuevaPassword2, setNuevaPassword2] = useState('');
  const [isRecuperando, setIsRecuperando] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<UserProfile | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Estado para vista previa de boleta
  const [isBoletaPreviewOpen, setIsBoletaPreviewOpen] = useState(false);
  const [selectedBoletaSale, setSelectedBoletaSale] = useState<Sale | null>(null);
  const [boletaPreviewHTML, setBoletaPreviewHTML] = useState<string>('');

  // Estado para configuración de impresión QZ Tray
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [useQzPrint, setUseQzPrint] = useState(() => localStorage.getItem('qz-print') === 'true');
  const [qzConnected, setQzConnected] = useState(false);
  const [qzPrinters, setQzPrinters] = useState<string[]>([]);
  const [selectedQzPrinter, setSelectedQzPrinter] = useState(() => localStorage.getItem('qz-printer') || '');
  const [isQzTesting, setIsQzTesting] = useState(false);

  const [companyLogo, setCompanyLogo] = useState<string>(
    () => localStorage.getItem('pos-company-logo') || ''
  );

  // Estados para agregar/editar productos
  const [newProductType, setNewProductType] = useState<'general' | 'mayorista'>('general');
  const [isViewMayoristaProductOpen, setIsViewMayoristaProductOpen] = useState(false);
  const [viewingMayoristaProduct, setViewingMayoristaProduct] = useState<Product | null>(null);
  const [isStockCriticoOpen, setIsStockCriticoOpen] = useState(false);
  const [stockCriticoLevels, setStockCriticoLevels] = useState<{ productName: string; levelName: string; stock: number }[]>([]);
  const [isClearSalesOpen, setIsClearSalesOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    purchasePrice: 0,
    salePrice: 0,
    stock: 0,
    category: ''
  });

  // Estados para almacenamiento
  const [storageAlert, setStorageAlert] = useState<'none' | 'warning' | 'critical'>('none');
  const lastVisibleTimeRef = useRef(Date.now());

  // Estados para modo de eliminación
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedProductsToDelete, setSelectedProductsToDelete] = useState<string[]>([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productsToDelete, setProductsToDelete] = useState<Product[]>([]);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteProductConfirmOpen, setIsDeleteProductConfirmOpen] = useState(false);

  // Estados para agregar usuarios
  const [newUser, setNewUser] = useState({
    password: '',
    email: '',
    name: '',
    role: 'empleado' as 'admin' | 'empleado'
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const upsertProductFB = useCallback(async (p: Product) => {
    try { await createProduct(p.id, stripUndefined(p)); } catch (e) { console.error('ERROR upsertProductFB:', e); }
  }, []);
  const removeProductFB = useCallback(async (id: string) => {
    try { await deleteProduct(id); } catch (e) { console.error('ERROR removeProductFB:', e); }
  }, []);
  const updateProductFB = useCallback(async (id: string, data: Partial<Product>) => {
    try { await updateProduct(id, stripUndefined(data)); } catch (e) { console.error('ERROR updateProductFB:', e); }
  }, []);
  const syncProductsToFirestore = useCallback(async (data: Product[]): Promise<boolean> => {
    // Sube a Supabase los productos creados o editados desde la ultima vez que
    // llegaron a la base. Si el producto ya existe se actualiza; si es nuevo se
    // crea y el id real de la base reemplaza al temporal (UUID) en el estado y
    // en el historial. Antes esto era un no-op: el alta se quedaba solo en
    // localStorage y al recargar la pagina se perdia.
    const pendientes = leerPendientes(PENDING.PRODUCTS);
    if (pendientes.length === 0) return true;
    const guardados = leerLista<Product>('pos-products');
    let todoOk = true;
    for (const id of pendientes) {
      const base = guardados.find((x) => x?.id === id) ?? data.find((x) => x.id === id);
      if (!base) continue;
      try {
        const existe = await getProductById(base.id).catch(() => null);
        let subido: Product = base;
        if (existe) {
          await updateProduct(base.id, stripUndefined(base));
        } else {
          const creado = await createProduct(base.id, stripUndefined(base));
          subido = { ...base, ...creado, saleLevels: base.saleLevels?.length ? base.saleLevels : creado.saleLevels };
        }
        if (subido.id !== id) {
          const viejoId = id;
          const nuevoId = subido.id;
          setProducts((prev) => prev.map((x) => (x.id === viejoId ? subido : x)));
          setStockHistory((prev) => prev.map((h) => (h.productId === viejoId ? { ...h, productId: nuevoId } : h)));
          setSelectedStockHistoryProduct((prev) => (prev && prev.id === viejoId ? { ...prev, id: nuevoId } : prev));
          setViewingMayoristaProduct((prev) => (prev && prev.id === viejoId ? { ...prev, id: nuevoId } : prev));
          safeSetItem('pos-products', JSON.stringify(
            leerLista<Product>('pos-products').filter((x) => x?.id !== viejoId).concat(subido)
          ));
          safeSetItem('pos-stock-history', JSON.stringify(
            leerLista<StockHistoryItem>('pos-stock-history').map((x) => (x?.productId === viejoId ? { ...x, productId: nuevoId } : x))
          ));
        }
        removePendingId(PENDING.PRODUCTS, id);
      } catch (e) {
        todoOk = false;
        console.error('ERROR syncProducts pendiente:', id, e);
        const detalle = e instanceof Error ? e.message : String(e);
        toast({
          title: 'No se pudo guardar en Supabase',
          description: `${base.name}: ${detalle}. Queda pendiente y se reintentara al recargar.`,
          variant: 'destructive',
          duration: 10000,
        });
      }
    }
    return todoOk;
  }, []);
  const syncSalesToFirestore = useCallback(async (_data: any[]) => {
    // Sin espejo: ver syncProductsToFirestore.
  }, []);
  const syncClosesToFirestore = useCallback(async (data: DailyClose[]): Promise<boolean> => {
    // Sube los cierres que quedaron pendientes. Un cierre nuevo trae id temporal
    // (Date.now()); al insertarse se reemplaza por el id real de la base, igual
    // que hacen los productos. Antes esto era un no-op y el Historial Diario se
    // perdia al recargar porque el cierre nunca llegaba a `cierres_diarios`.
    const pendientes = leerPendientes(PENDING.CLOSES);
    if (pendientes.length === 0) return true;
    const guardados = leerLista<DailyClose>('pos-daily-closes');
    let todoOk = true;
    for (const id of pendientes) {
      const base = guardados.find((x) => x?.id === id) ?? data.find((x) => x.id === id);
      if (!base) continue;
      try {
        const esFilaExistente = /^\d+$/.test(base.id);
        const devuelto = esFilaExistente
          ? await updateDailyClose(base.id, stripUndefined(base))
          : await createDailyClose(base.id, stripUndefined(base));
        const fusionado: DailyClose = {
          ...base,
          ...devuelto,
          id: devuelto.id,
          closedBy: base.closedBy || devuelto.closedBy,
          transacciones: base.transacciones ?? devuelto.transacciones,
        };
        if (fusionado.id !== id) {
          const viejoId = id;
          setDailyCloses((prev) => prev.map((x) => (x.id === viejoId ? fusionado : x)));
          setSelectedCloseDetail((prev) => (prev && prev.id === viejoId ? fusionado : prev));
          safeSetItem('pos-daily-closes', JSON.stringify(
            leerLista<DailyClose>('pos-daily-closes').filter((x) => x?.id !== viejoId).concat(fusionado)
          ));
        }
        removePendingId(PENDING.CLOSES, id);
      } catch (e) {
        todoOk = false;
        console.error('ERROR syncCloses pendiente:', id, e);
      }
    }
    return todoOk;
  }, []);
  const syncHistoryToFirestore = useCallback(async (data: StockHistoryItem[]) => {
    // Sube los movimientos de stock pendientes. Los ids numericos ya son filas
    // de la base (se actualizan); los nuevos se insertan y toman el id real.
    // Sin esto el historial (initial, restock, cambios de precio) vivia solo en
    // localStorage y desaparecia al recargar, y "Ventas por Restock" no tenia
    // datos.
    const pendientes = leerPendientes(PENDING.HISTORY);
    if (pendientes.length === 0) return;
    const guardados = leerLista<StockHistoryItem>('pos-stock-history');
    for (const id of pendientes) {
      const item = guardados.find((x) => x?.id === id) ?? data.find((x) => x.id === id);
      if (!item) continue;
      // Se quita el pendiente mientras viaja: si no, el subMerge en vivo podria
      // subirlo a la vez y quedarian dos filas para el mismo movimiento. El ref
      // de vuelo permite que el modal de información siga viéndolo en el camino.
      removePendingId(PENDING.HISTORY, id);
      historialEnVueloRef.current.add(id);
      try {
        const esFilaExistente = /^\d+$/.test(item.id);
        const devuelto = esFilaExistente
          ? await updateStockHistoryItem(item.id, stripUndefined({
              quantity: item.quantity,
              resultingStock: item.resultingStock,
              date: item.date,
              levelDescription: item.levelDescription,
              levelStockAfter: item.levelStockAfter,
              levelQuantities: item.levelQuantities,
              isInitial: item.isInitial,
              levelSoldQuantity: item.levelSoldQuantity,
            }))
          : await createStockHistoryItem(item.id, stripUndefined(item));
        const fusionado: StockHistoryItem = {
          ...devuelto,
          isSummary: item.isSummary,
          isInitial: item.isInitial,
          levelQuantities: item.levelQuantities ?? devuelto.levelQuantities,
          levelStockAfter: item.levelStockAfter ?? devuelto.levelStockAfter,
          levelSoldQuantity: item.levelSoldQuantity ?? devuelto.levelSoldQuantity,
          affectedLevelName: item.affectedLevelName ?? devuelto.affectedLevelName,
          levelQuantity: item.levelQuantity ?? devuelto.levelQuantity,
          levelDescription: item.levelDescription ?? devuelto.levelDescription,
          priceChanges: item.priceChanges ?? devuelto.priceChanges,
        };
        setStockHistory((prev) =>
          prev.some((x) => x.id === id) ? prev.map((x) => (x.id === id ? fusionado : x))
            : prev.some((x) => x.id === fusionado.id) ? prev
            : [...prev, fusionado]
        );
        safeSetItem('pos-stock-history', JSON.stringify(
          leerLista<StockHistoryItem>('pos-stock-history')
            .filter((x) => x?.id !== id && x?.id !== fusionado.id)
            .concat(fusionado)
        ));
        removePendingId(PENDING.HISTORY, id);
        historialEnVueloRef.current.delete(id);
      } catch (e) {
        console.error('ERROR syncHistory pendiente:', id, e);
        historialEnVueloRef.current.delete(id);
        addPendingId(PENDING.HISTORY, id);
      }
    }
  }, []);
  const syncUsersToFirestore = useCallback(async (_data: any[]) => {
    // Ver syncProductsToFirestore: ya no hay espejo a la nube.
  }, []);

  // Reintento de arranque: si un producto (p. ej. uno por metro) o un movimiento
  // quedaron pendientes porque la base los rechazo en su momento, se vuelven a
  // subir solos al cargar la app en vez de esperar a que el usuario edite algo.
  const reintentoPendientesRef = useRef(false);
  useEffect(() => {
    if (reintentoPendientesRef.current) return;
    if (products.length === 0 && stockHistory.length === 0 && dailyCloses.length === 0) return;
    reintentoPendientesRef.current = true;
    void syncProductsToFirestore(products).then((ok) => {
      if (ok) void syncHistoryToFirestore(stockHistory);
    });
    void syncClosesToFirestore(dailyCloses);
  }, [products, stockHistory, dailyCloses, syncProductsToFirestore, syncHistoryToFirestore, syncClosesToFirestore]);


  // Supabase es la fuente de verdad, pero las colas locales de pendientes
  // (pos-*-pending) NO se borran: son la red de seguridad de lo que aun no sube.
  // Antes se borraban en cada arranque y por eso desaparecian productos, ventas
  // y cierres creados sin conexion.
  useEffect(() => {
    (async () => {
      setCargando('Cargando sistema…');
      try {
        const [dbProducts, dbSales, dbUsers, dbCloses, dbHistory] = await Promise.all([
          getAllProducts().catch(() => null as any),
          getAllSales().catch(() => null as any),
          getAllLocalUsers().catch(() => null as any),
          getAllDailyCloses().catch(() => null as any),
          getAllStockHistory().catch(() => null as any),
        ]);
        if (dbProducts) {
          const normalizados = dbProducts.map(p => ({
            ...p,
            initialStock: (p.initialStock ?? 0) < p.stock ? p.stock : p.initialStock,
            saleLevels: p.saleLevels?.map(l => ({
              ...l,
              initialStock: (l.initialStock ?? 0) < l.stock ? l.stock : l.initialStock
            })) ?? p.saleLevels
          }));
          setProducts(prev => unirPendientes(prev, normalizados, PENDING.PRODUCTS));
        }
        if (dbSales) {
          const normalizadas = dedupeBySaleId(dbSales.map(item => (
            item.localDate ? item : { ...item, localDate: getLocalDateStr(new Date(item.date)) }
          )));
          setSales(prev => unirPendientes(prev, normalizadas, PENDING.SALES));
        }
        if (dbUsers) setUsers(dbUsers);
        if (dbCloses) setDailyCloses(prev => unirPendientes(prev, dbCloses, PENDING.CLOSES));
        if (dbHistory) setStockHistory(prev => unirPendientes(prev, dbHistory, PENDING.HISTORY));
      } catch {
      } finally {
        setCargando(null);
      }
    })();
  }, []);

  // Sincronización en tiempo real desde Firestore (local-first para datos, Firebase para red)
  useEffect(() => {
    if (!isAuthenticated) return;
    const subMergeProducts = (fb: Product[]) => {
      const local: Product[] = [];
      try { const s = localStorage.getItem('pos-products'); if (s) local.push(...JSON.parse(s)); } catch {}
      let merged: Product[] = [...local];
      for (const item of fb) {
        const idx = merged.findIndex(x => x.id === item.id);
        if (idx >= 0) {
          if (!isPendingId(PENDING.PRODUCTS, merged[idx].id)) {
            merged[idx] = item;
          }
          removePendingId(PENDING.PRODUCTS, item.id);
        } else {
          merged.push(item);
        }
      }
      for (const item of local) {
        if (!fb.find(x => x.id === item.id) && isPendingId(PENDING.PRODUCTS, item.id)) {
          createProduct(item.id, stripUndefined(item)).then(() => removePendingId(PENDING.PRODUCTS, item.id)).catch(e => { console.error('ERROR subMerge createProduct:', e); });
        }
      }
      merged = merged.filter(item => isPendingId(PENDING.PRODUCTS, item.id) || fb.find(x => x.id === item.id));
      const fixedProds = merged.map(p => ({
        ...p,
        initialStock: (p.initialStock ?? 0) < p.stock ? p.stock : p.initialStock,
        saleLevels: p.saleLevels?.map(l => ({
          ...l,
          initialStock: (l.initialStock ?? 0) < l.stock ? l.stock : l.initialStock
        })) ?? p.saleLevels
      }));
      setProducts(fixedProds);
      try { localStorage.setItem('pos-products', JSON.stringify(fixedProds)); } catch {}
    };
    const subMergeSales = (fb: Sale[]) => {
      const local: Sale[] = [];
      try { const s = localStorage.getItem('pos-sales'); if (s) local.push(...JSON.parse(s)); } catch {}
      for (const s of fb) { if (!s.localDate) { try { (s as any).localDate = getLocalDateStr(new Date(s.date)); } catch {} } }
      fb.forEach(item => syncedSaleIds.current.add(item.id));
      const fbIds = new Set(fb.map(x => x.id));
      let merged: Sale[] = [...local];
      for (const item of fb) {
        const idx = merged.findIndex(x => x.id === item.id);
        if (idx >= 0) {
          if (!isPendingId(PENDING.SALES, item.id)) {
            merged[idx] = item;
          }
          removePendingId(PENDING.SALES, item.id);
        } else {
          merged.push(item);
        }
      }
      for (const item of local) {
        if (!fb.find(x => x.id === item.id) && isPendingId(PENDING.SALES, item.id) && !ventasEnviandoseRef.current.has(item.id)) {
          ventasEnviandoseRef.current.add(item.id);
          createSale(item.id, stripUndefined(item))
            .then(() => removePendingId(PENDING.SALES, item.id))
            .catch(e => { console.error('ERROR subMerge createSale:', e); })
            .finally(() => ventasEnviandoseRef.current.delete(item.id));
        }
      }
      // Las ventas locales solo cuentan mientras estan pendientes de envio a
      // Supabase. Al confirmarse, la unica version real tiene el id de la base;
      // conservar la copia local con id temporal era lo que generaba VENTAS
      // DUPLICADAS en "Ventas del Día" (misma venta, dos ids).
      // dedupeBySaleId: una sola fila por id (prefiere la canonica que llego al final).
      merged = dedupeBySaleId(merged);
      merged = merged.filter(item => fbIds.has(item.id) || isPendingId(PENDING.SALES, item.id));
      setSales(merged);
      try { localStorage.setItem('pos-sales', JSON.stringify(merged)); } catch {}
    };
    const subMergeUsers = (fb: AppUser[]) => {
      const local: AppUser[] = [];
      try { const s = localStorage.getItem('pos-users'); if (s) local.push(...JSON.parse(s)); } catch {}
      let merged: AppUser[] = [...local];
      for (const item of fb) {
        const idx = merged.findIndex(x => x.id === item.id);
        if (idx >= 0) {
          if (!isPendingId(PENDING.USERS, merged[idx].id)) {
            merged[idx] = item;
          }
          removePendingId(PENDING.USERS, item.id);
        } else {
          merged.push(item);
        }
      }
      for (const item of local) {
        if (!fb.find(x => x.id === item.id) && isPendingId(PENDING.USERS, item.id)) {
          createLocalUser(item.id, stripUndefined(item)).then(() => removePendingId(PENDING.USERS, item.id)).catch(e => { console.error('ERROR subMerge createUser:', e); });
        }
      }
      merged = merged.filter(item => isPendingId(PENDING.USERS, item.id) || fb.find(x => x.id === item.id));
      setUsers(merged);
      try { localStorage.setItem('pos-users', JSON.stringify(merged)); } catch {}
    };
    const subMergeCloses = (fb: DailyClose[]) => {
      const local: DailyClose[] = [];
      try { const s = localStorage.getItem('pos-daily-closes'); if (s) local.push(...JSON.parse(s)); } catch {}
      let merged: DailyClose[] = [...local];
      for (const item of fb) {
        const idx = merged.findIndex(x => x.id === item.id);
        if (idx >= 0) {
          if (!isPendingId(PENDING.CLOSES, item.id)) {
            merged[idx] = item;
          }
          removePendingId(PENDING.CLOSES, item.id);
        } else {
          merged.push(item);
        }
      }
      for (const item of local) {
        if (!fb.find(x => x.id === item.id) && isPendingId(PENDING.CLOSES, item.id)) {
          createDailyClose(item.id, stripUndefined(item)).then(() => removePendingId(PENDING.CLOSES, item.id)).catch(e => { console.error('ERROR subMerge createClose:', e); });
        }
      }
      merged = merged.filter(item => isPendingId(PENDING.CLOSES, item.id) || fb.find(x => x.id === item.id));
      setDailyCloses(merged);
      try { localStorage.setItem('pos-daily-closes', JSON.stringify(merged)); } catch {}
    };
    const subMergeHistory = (fb: StockHistoryItem[]) => {
      const local: StockHistoryItem[] = [];
      try { const s = localStorage.getItem('pos-stock-history'); if (s) local.push(...JSON.parse(s)); } catch {}
      fb.forEach(item => syncedHistoryIds.current.add(item.id));
      let merged: StockHistoryItem[] = [...local];
      for (const item of fb) {
        const idx = merged.findIndex(x => x.id === item.id);
        if (idx >= 0) {
          if (!isPendingId(PENDING.HISTORY, item.id)) {
            merged[idx] = item;
          }
          removePendingId(PENDING.HISTORY, item.id);
        } else {
          merged.push(item);
        }
      }
      for (const item of local) {
        if (!fb.find(x => x.id === item.id) && isPendingId(PENDING.HISTORY, item.id)) {
          createStockHistoryItem(item.id, stripUndefined(item)).then(() => removePendingId(PENDING.HISTORY, item.id)).catch(e => { console.error('ERROR subMerge createHistory:', e); });
        }
      }
      merged = merged.filter(item => isPendingId(PENDING.HISTORY, item.id) || fb.find(x => x.id === item.id));
      setStockHistory(merged);
      try { localStorage.setItem('pos-stock-history', JSON.stringify(merged)); } catch {}
    };
    const unsubProducts = subscribeProducts(subMergeProducts);
    const unsubSales = subscribeSales(subMergeSales);
    const unsubLocalUsers = subscribeLocalUsers(subMergeUsers);
    const unsubDailyCloses = subscribeDailyCloses(subMergeCloses);
    const unsubStockHistory = subscribeStockHistory(subMergeHistory);
    return () => {
      unsubProducts(); unsubSales(); unsubLocalUsers(); unsubDailyCloses(); unsubStockHistory();
    };
  }, [isAuthenticated]);

  // Force logout si la URL tiene ?forceLogout=true (para TestSprite)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('forceLogout') === 'true') {
      firebaseLogout().then(() => {
        window.history.replaceState({}, '', window.location.pathname);
      });
    }
  }, []);

  // Auth: escuchar cambios de sesión de Firebase
  const authInitializedRef = useRef(false);
  const usersRef = useRef(users);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => {
    const unsubscribe = onAuthChange(async (user, evento) => {
      if (evento === 'PASSWORD_RECOVERY') {
        // Llego el enlace de recuperacion: pedir la nueva contrasena antes de entrar.
        setShowResetPasswordForm(true);
        setIsAuthenticated(false);
        setFirebaseUser(null);
        if (!authInitializedRef.current) {
          authInitializedRef.current = true;
          setAuthInitialized(true);
        }
        return;
      }
      if (user) {
        let found = false;
        try {
          let profile = await getUserByEmail(user.email);
          if (!profile) profile = await getUserProfile(user.id);
          if (profile) {
            setFirebaseUser(profile);
            setIsAuthenticated(true);
            setUserRole(profile.role);
            found = true;
          }
        } catch (e) { /* permiso denegado o red */ }
        if (!found) {
          // Fallback: buscar en usuarios locales (offline o rules bloquean)
          const localUser = usersRef.current.find(u => u.email === user.email);
          if (localUser) {
            setFirebaseUser(null);
            setIsAuthenticated(true);
            setUserRole(localUser.role);
          } else {
            setFirebaseUser(null);
          }
        }
      } else {
        setFirebaseUser(null);
        if (authInitializedRef.current) {
          setIsAuthenticated(false);
        }
      }
      if (!authInitializedRef.current) {
        authInitializedRef.current = true;
        setAuthInitialized(true);
      }
    });
    return unsubscribe;
  }, []);

  // Cargar logo por defecto si no hay uno guardado
  useEffect(() => {
    if (!localStorage.getItem('pos-company-logo')) {
      fetch('/logo.jpg')
        .then(res => {
          if (res.ok) return res.blob();
          throw new Error('no logo file');
        })
        .then(blob => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 300;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
            const resized = canvas.toDataURL('image/jpeg', 0.8);
            setCompanyLogo(resized);
            safeSetItem('pos-company-logo', resized);
          };
          img.src = URL.createObjectURL(blob);
        })
        .catch(() => {});
    }
  }, []);

  // Online/offline listeners + auto-sync
  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => {
      setIsOnline(true);
      const syncData = async () => {
        // Ya no hay cola offline que reenviar. Cada escritura va directo a
        // Supabase; al volver la conexion basta recargar para ver lo nuevo.
        // Reenviar la cola arrastraria datos viejos de localStorage.
        autoCleanupLocal();
        try {
          const [p, s, c, h] = await Promise.all([
            getAllProducts(), getAllSales(), getAllDailyCloses(), getAllStockHistory(),
          ]);
          // Merge, no reemplazo: si reemplazaramos, lo pendiente de subir
          // desapareceria de la pantalla al volver la conexion.
          setProducts(prev => unirPendientes(prev, p, PENDING.PRODUCTS));
          setSales(prev => unirPendientes(prev, s, PENDING.SALES));
          setDailyCloses(prev => unirPendientes(prev, c, PENDING.CLOSES));
          setStockHistory(prev => unirPendientes(prev, h, PENDING.HISTORY));
          void syncProductsToFirestore(p).then((ok) => {
            if (ok) void syncHistoryToFirestore(h);
          });
          void syncClosesToFirestore(c);
          toast({ title: "Modo online", description: "Datos sincronizados con Supabase." });
        } catch (e) { console.error('ERROR online-sync outer:', e); }
      };
      syncData();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncProductsToFirestore, syncHistoryToFirestore, syncClosesToFirestore]);

  // Eliminado: cambio forzado de tab al perder conexión

  // Eliminado: recarga forzada al desbloquear pantalla (causaba pérdida de estado)

  const checkStorage = useCallback(() => {
    try {
      autoCleanupLocal();
      let totalSize = 0;
      for (const key of LOCAL_KEYS) {
        const val = localStorage.getItem(key);
        if (val) totalSize += key.length + val.length;
      }
      const usedMB = totalSize / (1024 * 1024);
      if (usedMB > 4.9) setStorageAlert('critical');
      else if (usedMB > 4.5) setStorageAlert('warning');
      else setStorageAlert('none');
    } catch { setStorageAlert('none'); }
  }, []);
  useEffect(() => {
    checkStorage();
    window.addEventListener('storage', checkStorage);
    const interval = setInterval(checkStorage, 30000);
    return () => {
      window.removeEventListener('storage', checkStorage);
      clearInterval(interval);
    };
  }, [checkStorage]);

  const getLowStockThreshold = (product: Product) => {
    if (product.type === 'peso') return 500;
    if (product.type === 'metro') return 1000;
    return 20;
  };

  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock > 0 && p.stock <= getLowStockThreshold(p));
  }, [products]);

  const currentStockHistoryProduct = useMemo(() => {
    if (!selectedStockHistoryProduct) return null;
    return products.find(product => product.id === selectedStockHistoryProduct.id) ?? selectedStockHistoryProduct;
  }, [products, selectedStockHistoryProduct]);

  useEffect(() => {
    const activeProductId = currentStockHistoryProduct?.id || viewingMayoristaProduct?.id;
    if (!activeProductId) {
      setModalProductHistory([]);
      return;
    }
    getStockHistoryByProduct(activeProductId)
      .then((db) => {
        // Ademas de lo que ya esta en la base se muestra lo que acaba de
        // registrarse y todavia viaja a Supabase: el modal nunca debe salir
        // vacio justo despues de un alta o un restock. Tambien se incluyen los
        // IDs que estan volando aunque su pendiente ya se haya quitado.
        const enTransito = stockHistory.filter(
          (h) => h.productId === activeProductId
            && (isPendingId(PENDING.HISTORY, h.id) || historialEnVueloRef.current.has(h.id))
            && !db.some((d) => d.id === h.id)
        );
        setModalProductHistory([...enTransito, ...db]);
      })
      .catch((err) => {
        console.error('Error cargando historial del producto:', err);
        setModalProductHistory([]);
      });
  }, [currentStockHistoryProduct, viewingMayoristaProduct, stockHistory, tickHistorial]);

  const productStockHistoryEntries = useMemo(() => {
    if (!currentStockHistoryProduct) return [];
    return stockHistory
      .filter(item => item.productId === currentStockHistoryProduct.id)
      .filter(item => item.type !== 'price_change')
      .sort((a, b) => {
        const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (Math.abs(timeDiff) > 5000) return timeDiff;

        const priority = { sale: 0, restock: 1, initial: 2 };
        return priority[a.type] - priority[b.type];
      });
  }, [currentStockHistoryProduct, stockHistory]);

  const stockHistoryDisplayRows = useMemo<StockHistoryDisplayRow[]>(() => {
    const rows: StockHistoryDisplayRow[] = [];

    // Movimiento en unidades generales (productos mayoristas usan la equivalencia del nivel).
    const movementOf = (item: StockHistoryItem) => {
      if (item.type === 'sale' && item.affectedLevelName) {
        const level = currentStockHistoryProduct?.saleLevels?.find(l => l.name === item.affectedLevelName);
        return item.quantity * (level?.baseUnitsContained ?? 1);
      }
      return item.quantity;
    };

    productStockHistoryEntries.forEach((item) => {
      if (item.type === 'initial') {
        rows.push({
          id: item.id,
          date: item.date,
          stockActual: item.quantity,
          soldQuantity: null,
          addedQuantity: item.quantity,
          resultingStock: item.resultingStock,
          isInitial: true
        });
        return;
      }

      if (item.type === 'sale') {
        return;
      }

      // Reposición
      const prevSale = productStockHistoryEntries
        .filter(h => h.type === 'sale' && h.isSummary)
        .find(h => Math.abs(new Date(h.date).getTime() - new Date(item.date).getTime()) < 5000);

      const saleMatch = productStockHistoryEntries
        .filter(h => h.type === 'sale' && h.isSummary && new Date(h.date).getTime() < new Date(item.date).getTime())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      let soldQty: number | null = null;
      const saleEntry = prevSale || saleMatch;
      if (saleEntry) {
        soldQty = movementOf(saleEntry);
      }

      rows.push({
        id: item.id,
        date: item.date,
        stockActual: item.resultingStock - item.quantity,
        soldQuantity: soldQty,
        addedQuantity: item.quantity,
        resultingStock: item.resultingStock,
        isInitial: false
      });
    });

    return rows.reverse();
  }, [productStockHistoryEntries, currentStockHistoryProduct]);

  const stockHistoryCurrentDate = new Date().toLocaleDateString('es-PE');
  
  const getLastStockBaseEntry = useCallback((productId: string) => {
    return [...stockHistory]
      .filter(item => item.productId === productId && (item.type === 'initial' || item.type === 'restock'))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [stockHistory]);

  // Función para obtener categorías más utilizadas (usadas más de 2 veces)
  const getFrequentCategories = useMemo(() => {
    const categoryCount: { [key: string]: number } = {};
    
    products.forEach(product => {
      if (product.category) {
        categoryCount[product.category] = (categoryCount[product.category] || 0) + 1;
      }
    });
    
    // Retornar solo las categorías que se han usado más de 2 veces
    return Object.entries(categoryCount)
      .filter(([_, count]) => count > 2)
      .sort(([_, a], [__, b]) => b - a) // Ordenar por frecuencia descendente
      .map(([category, _]) => category);
  }, [products]);

  const handleRestockChange = (productId: string, quantity: string) => {
    setRestockQuantities(prev => ({ ...prev, [productId]: quantity }));
  };

  const handleApplyRestock = () => {
    const newHistoryItems: StockHistoryItem[] = [];
    
    const updatedProducts = products.map(p => {
      const rawRestock = restockQuantities[p.id] || '0';
      const restockAmount = p.type === 'metro'
        ? Math.round((parseFloat(normalizeDecimalInput(rawRestock)) || 0) * 100)
        : parseInt(rawRestock);
      if (restockAmount > 0) {
        const lastBaseEntry = getLastStockBaseEntry(p.id);
        const isFirstEntry = !lastBaseEntry;
        const previousBaseStock = lastBaseEntry?.resultingStock ?? 0;
        const soldAmount = isFirstEntry ? 0 : Math.max(previousBaseStock - p.stock, 0);

        let newStock: number;
        let updatedProduct: Product;
        let isLevelBased = p.type === 'mayorista' || (p.type === 'unidad' && p.saleLevels?.length);
        let unitsInMin = 0;
        let restockLevelName: string | undefined;

        if (p.type === 'mayorista' && p.saleLevels?.length) {
          const sortedLevels = [...p.saleLevels].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; });
          const minLevel = sortedLevels[0];
          if (restockAmount < minLevel.baseUnitsContained) {
            toast({
              title: "Cantidad insuficiente",
              description: `El mínimo para este producto es ${minLevel.baseUnitsContained} unidades (1 ${minLevel.name})`,
              variant: "destructive"
            });
            return p;
          }
          unitsInMin = Math.floor(restockAmount / minLevel.baseUnitsContained);
          if (unitsInMin > 0) {
            restockLevelName = minLevel.name;
            const updatedLevels = p.saleLevels.map(l =>
              l.name === minLevel.name ? { ...l, stock: l.stock + unitsInMin, initialStock: l.stock + unitsInMin } : l
            );
            newStock = updatedLevels.reduce((sum, l) => sum + l.stock * l.baseUnitsContained, 0);
            updatedProduct = { ...p, saleLevels: updatedLevels, stock: newStock, initialStock: newStock };
          } else {
            newStock = p.stock + restockAmount;
            updatedProduct = { ...p, stock: newStock };
          }
        } else if (p.type === 'unidad' && p.saleLevels?.length) {
          // Modelo A: el stock general (unidades) y el nivel "Unidad" comparten el mismo stock.
          newStock = p.stock + restockAmount;
          if (p.saleLevels.some(l => l.name === 'Unidad')) {
            unitsInMin = restockAmount;
            restockLevelName = 'Unidad';
            const updatedLevels = p.saleLevels.map(l =>
              l.name === 'Unidad' ? { ...l, stock: l.stock + restockAmount, initialStock: l.stock + restockAmount } : l
            );
            updatedProduct = { ...p, stock: newStock, saleLevels: updatedLevels };
          } else {
            updatedProduct = { ...p, stock: newStock };
          }
        } else {
          newStock = p.stock + restockAmount;
          updatedProduct = { ...p, stock: newStock };
        }
        if (isFirstEntry) {
          const initialLevelStockAfter = isLevelBased && updatedProduct.saleLevels
            ? updatedProduct.saleLevels.reduce((acc, l) => ({ ...acc, [l.name]: l.initialStock }), {})
            : undefined;

          newHistoryItems.push({
            id: generateId(),
            productId: p.id,
            productName: p.name,
            type: 'initial',
            quantity: restockAmount,
            resultingStock: newStock,
            date: new Date().toISOString(),
            levelStockAfter: initialLevelStockAfter,
            levelQuantities: initialLevelStockAfter
          });
          return updatedProduct;
        }
        if (soldAmount > 0) {
          newHistoryItems.push({
            id: generateId(),
            productId: p.id,
            productName: p.name,
            type: 'sale',
            quantity: soldAmount,
            resultingStock: p.stock,
            date: new Date().toISOString(),
            isSummary: true
          });
        }
        const levelStockAfter = isLevelBased && updatedProduct.saleLevels
          ? updatedProduct.saleLevels.reduce((acc, l) => ({ ...acc, [l.name]: l.stock }), {})
          : undefined;
        newHistoryItems.push({
          id: generateId(),
          productId: p.id,
          productName: p.name,
          type: 'restock',
          quantity: restockAmount,
          resultingStock: newStock,
          date: new Date().toISOString(),
          affectedLevelName: restockLevelName,
          levelQuantity: restockLevelName ? unitsInMin : undefined,
          levelStockAfter
        });
          return updatedProduct;
      }
      return p;
    });

    if (newHistoryItems.length > 0) {
      const updatedHistory = [...stockHistory, ...newHistoryItems];
      setStockHistory(updatedHistory);
      safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
      newHistoryItems.forEach(h => addPendingId(PENDING.HISTORY, h.id));
      syncHistoryToFirestore(updatedHistory);
    }

    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    syncProductsToFirestore(updatedProducts);
    toast({
      title: "Stock Repuesto",
      description: "El stock de los productos ha sido actualizado.",
    });
    setIsRestockModalOpen(false);
    setRestockQuantities({});
  };

  const handleAddStockHistoryRestock = () => {
    if (!currentStockHistoryProduct) return;

    const restockAmount = currentStockHistoryProduct.type === 'metro'
      ? Math.round((parseFloat(normalizeDecimalInput(stockHistoryRestockQuantity)) || 0) * 100)
      : parseInt(stockHistoryRestockQuantity || '0');
    if (!restockAmount || restockAmount <= 0) {
      toast({
        title: "Cantidad inválida",
        description: "Ingresa una cantidad válida para la reposición.",
        variant: "destructive"
      });
      return;
    }

    const lastBaseEntry = getLastStockBaseEntry(currentStockHistoryProduct.id);
    const isFirstEntry = !lastBaseEntry;
    const updatedProducts = products.map(product => {
      if (product.id !== currentStockHistoryProduct.id) return product;
      const hasUnidadLevel = product.saleLevels?.some(l => l.name === 'Unidad');
      const isLevelBased = product.type === 'mayorista' || (product.type === 'unidad' && product.saleLevels?.length);
      return {
        ...product,
        stock: product.stock + restockAmount,
        initialStock: product.stock + restockAmount,
        saleLevels: isLevelBased
          ? product.saleLevels?.map(l =>
              l.name === 'Unidad' || (product.type === 'mayorista' && !hasUnidadLevel)
                ? { ...l, stock: l.stock + restockAmount, initialStock: l.stock + restockAmount }
                : l)
          : product.saleLevels
      };
    });

    const updatedProduct = updatedProducts.find(product => product.id === currentStockHistoryProduct.id);
    if (!updatedProduct) return;

    const previousBaseStock = lastBaseEntry?.resultingStock ?? 0;
    const soldAmount = isFirstEntry ? 0 : Math.max(previousBaseStock - currentStockHistoryProduct.stock, 0);
    const newHistoryItems: StockHistoryItem[] = [];

    const levelStockAfter = updatedProduct.saleLevels
      ? updatedProduct.saleLevels.reduce((acc, l) => ({ ...acc, [l.name]: l.stock }), {})
      : undefined;

    if (isFirstEntry) {
      newHistoryItems.push({
        id: generateId(),
        productId: currentStockHistoryProduct.id,
        productName: currentStockHistoryProduct.name,
        type: 'initial',
        quantity: restockAmount,
        resultingStock: updatedProduct.stock,
        date: new Date().toISOString(),
        levelStockAfter
      });
    } else if (soldAmount > 0) {
      newHistoryItems.push({
        id: generateId(),
        productId: currentStockHistoryProduct.id,
        productName: currentStockHistoryProduct.name,
        type: 'sale',
        quantity: soldAmount,
        resultingStock: currentStockHistoryProduct.stock,
        date: new Date().toISOString(),
        isSummary: true,
        levelStockAfter
      });
    }

    if (!isFirstEntry) {
      newHistoryItems.push({
        id: generateId(),
        productId: currentStockHistoryProduct.id,
        productName: currentStockHistoryProduct.name,
        type: 'restock',
        quantity: restockAmount,
        resultingStock: updatedProduct.stock,
        date: new Date().toISOString(),
        levelStockAfter
      });
    }

    const updatedHistory = [...stockHistory, ...newHistoryItems];
    setProducts(updatedProducts);
    setStockHistory(updatedHistory);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    syncProductsToFirestore(updatedProducts);
    safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
    newHistoryItems.forEach(h => addPendingId(PENDING.HISTORY, h.id));
      syncHistoryToFirestore(updatedHistory);
    setSelectedStockHistoryProduct(updatedProduct);
    setStockHistoryRestockQuantity('');
    setShowStockRestockForm(false);

    toast({
      title: "Reposición guardada",
      description: `Se agregó stock a ${currentStockHistoryProduct.name}.`,
    });
  };

  const handleMigrateImages = async () => {
    setIsMigrating(true);
    setCargando('Migrando imágenes…');
    const productsWithBase64 = products.filter(p => p.imageUrl && p.imageUrl.startsWith('data:'));
    let success = 0, errors = 0;
    let updatedProducts = [...products];
    for (let i = 0; i < productsWithBase64.length; i++) {
      const p = productsWithBase64[i];
      try {
        const url = await uploadBase64ToCloudinary(p.imageUrl!, p.id);
        updatedProducts = updatedProducts.map(pr => pr.id === p.id ? { ...pr, imageUrl: url } : pr);
        setProducts(updatedProducts);
        safeSetItem('pos-products', JSON.stringify(updatedProducts));
        try { await updateProduct(p.id, stripUndefined({ imageUrl: url })); } catch {}
        success++;
        toast({ title: `Migrando ${i + 1} de ${productsWithBase64.length}`, description: `${p.name} → OK` });
      } catch {
        errors++;
        toast({ title: `Error ${p.name}`, variant: "destructive" });
      }
    }
    toast({ title: "Migración completada", description: `Éxito: ${success}, Errores: ${errors}` });
    setIsMigrating(false);
    setCargando(null);
  };

  // Funciones para modal de peso
  const handleWeightQuantityChange = (weight: string, quantity: number) => {
    setWeightQuantities(prev => ({ ...prev, [weight]: quantity }));
    // Limpiar peso manual cuando se selecciona peso predefinido
    if (quantity > 0) {
      setCustomWeight('');
    }
  };

  const handleAddMayoristaToCart = () => {
    if (!selectedMayoristaProduct || !selectedLevelId) return;

    const level = selectedMayoristaProduct.saleLevels?.find(l => l.id === selectedLevelId);
    if (!level) return;

    const product = selectedMayoristaProduct;
    const qty = typeof mayoristaQuantity === 'number' ? mayoristaQuantity : (parseInt(mayoristaQuantity) || 1);
    const isUnidadBased = product.saleLevels?.some(l => l.name === 'Unidad');
    const stockBase = isUnidadBased
      ? (product.saleLevels?.find(l => l.name === 'Unidad')?.stock ?? 0)
      : product.stock;

    const maxAvailable = isUnidadBased
      ? Math.floor(stockBase / level.baseUnitsContained)
      : level.stock;

    if (qty < 1 || qty > maxAvailable) {
      toast({
        title: "Stock insuficiente",
        description: isUnidadBased
          ? `Stock disponible: ${stockBase} unid. (máx ${maxAvailable} ${level.name}(s))`
          : `Solo hay ${level.stock} ${level.name}(s) disponibles`,
        variant: "destructive"
      });
      return;
    }

    const existingItem = currentSale.find(item =>
      item.product.id === product.id && item.selectedLevelName === level.name
    );

    if (existingItem) {
      const levelName = existingItem.selectedLevelName!;
      const currentLevel = product.saleLevels?.find(l => l.name === levelName);
      const maxLevels = currentLevel
        ? (isUnidadBased ? Math.floor(stockBase / currentLevel.baseUnitsContained) : currentLevel.stock)
        : 0;
      const newQty = existingItem.quantity + qty;
      if (newQty > maxLevels) {
        toast({
          title: "Stock insuficiente",
          description: isUnidadBased
            ? `Stock disponible: ${stockBase} unid. (máx ${maxLevels} ${level.name}(s))`
            : `Solo hay ${maxLevels} ${level.name}(s) disponibles`,
          variant: "destructive"
        });
        return;
      }
      setCurrentSale(currentSale.map(item =>
        item.product.id === product.id && item.selectedLevelName === level.name
          ? { ...item, quantity: newQty }
          : item
      ));
    } else {
      const tempProduct: Product = {
        ...product,
        salePrice: level.salePrice,
        purchasePrice: level.purchasePrice,
        stock: level.baseUnitsContained * qty,
      };
      setCurrentSale([...currentSale, {
        product: tempProduct,
        quantity: qty,
        selectedLevelName: level.name,
        levelQuantity: qty
      }]);
    }

    setIsMayoristaModalOpen(false);

    toast({
      title: "Producto agregado",
      description: `${qty} ${level.name}(s) de ${product.name} agregado al carrito`,
    });
  };

  const handleAddWeightToCart = () => {
    if (!selectedWeightProduct) return;

    const pricePerKg = selectedWeightProduct.salePricePerKg ?? selectedWeightProduct.salePrice ?? 0;

    if (weightInputMode === 'money' && pricePerKg <= 0) {
      toast({
        title: "Precio no válido",
        description: "Este producto no tiene precio por kilo; usa el modo por peso",
        variant: "destructive"
      });
      return;
    }

    let totalWeight = 0;
    let totalPrice = 0;

    // Calcular peso total de las cantidades seleccionadas
    Object.entries(weightQuantities).forEach(([weight, quantity]) => {
      const weightGrams = parseInt(weight);
      totalWeight += weightGrams * quantity;
    });

    // Agregar peso personalizado o dinero según el modo
    if (weightInputMode === 'grams') {
      if (customWeight && parseFloat(customWeight) > 0) {
        totalWeight += parseFloat(customWeight);
      }
    } else {
      if (customMoney && parseFloat(customMoney) > 0) {
        totalWeight += Math.round((parseFloat(customMoney) * 1000) / pricePerKg);
      }
    }

    if (totalWeight <= 0) {
      toast({
        title: "Entrada requerida",
        description: "Debes seleccionar un peso o ingresar un monto válido para agregar al carrito",
        variant: "destructive"
      });
      return;
    }

    const minWeight = selectedWeightProduct.minWeightGrams || 0;
    if (minWeight > 0 && totalWeight < minWeight) {
      toast({
        title: "Peso mínimo no alcanzado",
        description: `El mínimo de venta es ${formatWeight(minWeight)}`,
        variant: "destructive"
      });
      return;
    }

    if (totalWeight > selectedWeightProduct.stock) {
      toast({
        title: "Stock insuficiente",
        description: `Solo hay ${formatWeight(selectedWeightProduct.stock)} disponibles`,
        variant: "destructive"
      });
      return;
    }

    // Calcular precio total usando siempre salePricePerKg
    totalPrice = pricePerKg * (totalWeight / 1000);

    // Crear un producto temporal para la venta (sin mutar salePrice)
    const tempProduct: Product = {
      ...selectedWeightProduct,
      salePrice: pricePerKg,
      stock: totalWeight,
      weightInGrams: totalWeight,
    };

    const existingItem = currentSale.find(item => item.product.id === selectedWeightProduct.id);
    
    if (existingItem) {
      // Si ya existe, actualizar cantidad
      const newQuantity = existingItem.quantity + totalWeight;
      if (newQuantity <= selectedWeightProduct.stock) {
        actualizarCantidad(selectedWeightProduct.id, newQuantity);
      } else {
        toast({
          title: "Stock insuficiente",
          description: `No hay suficiente stock disponible`,
          variant: "destructive"
        });
        return;
      }
    } else {
      // Agregar nuevo item
      setCurrentSale([...currentSale, { product: tempProduct, quantity: totalWeight }]);
    }

    setIsWeightModalOpen(false);
    setSelectedWeightProduct(null);
    setWeightQuantities({});
    setCustomWeight('');
    setCustomMoney('');
    setWeightInputMode('grams');
    
    toast({
      title: "Producto agregado",
      description: `${totalWeight}g de ${selectedWeightProduct.name} agregado al carrito`,
    });
  };

  const handleMetroQuantityChange = (centimeters: number, quantity: number) => {
    setMetroQuantities(prev => {
      const next = { ...prev };
      if (quantity <= 0) delete next[String(centimeters)];
      else next[String(centimeters)] = quantity;
      return next;
    });
    if (quantity > 0) setCustomMeters('');
  };

  const handleAddMetroToCart = () => {
    if (!selectedMetroProduct) return;

    const pricePerMeter = selectedMetroProduct.salePrice ?? 0;

    if (metroInputMode === 'money' && pricePerMeter <= 0) {
      toast({
        title: "Precio no válido",
        description: "Este producto no tiene precio por metro; usa el modo por longitud",
        variant: "destructive"
      });
      return;
    }

    let totalCm = 0;

    Object.entries(metroQuantities).forEach(([centimeters, quantity]) => {
      totalCm += Number(centimeters) * quantity;
    });

    if (metroInputMode === 'meters') {
      const meters = parseFloat(normalizeDecimalInput(customMeters));
      if (Number.isFinite(meters) && meters > 0) totalCm += Math.round(meters * 100);
    } else {
      const money = parseFloat(normalizeDecimalInput(customMetroMoney));
      if (Number.isFinite(money) && money > 0) {
        totalCm += Math.round((money / pricePerMeter) * 100);
      }
    }

    if (totalCm <= 0) {
      toast({
        title: "Entrada requerida",
        description: "Selecciona una longitud o ingresa un monto válido para agregar al carrito",
        variant: "destructive"
      });
      return;
    }

    if (totalCm > selectedMetroProduct.stock) {
      toast({
        title: "Stock insuficiente",
        description: `Solo hay ${formatLength(selectedMetroProduct.stock)} disponibles`,
        variant: "destructive"
      });
      return;
    }

    const tempProduct: Product = {
      ...selectedMetroProduct,
      salePrice: pricePerMeter,
      stock: totalCm,
    };

    const existingItem = currentSale.find(item => item.product.id === selectedMetroProduct.id);

    if (existingItem) {
      const newQuantity = existingItem.quantity + totalCm;
      if (newQuantity <= selectedMetroProduct.stock) {
        actualizarCantidad(selectedMetroProduct.id, newQuantity);
      } else {
        toast({
          title: "Stock insuficiente",
          description: `Solo hay ${formatLength(selectedMetroProduct.stock)} disponibles`,
          variant: "destructive"
        });
        return;
      }
    } else {
      setCurrentSale([...currentSale, { product: tempProduct, quantity: totalCm }]);
    }

    setIsMetroModalOpen(false);
    setSelectedMetroProduct(null);
    setMetroQuantities({});
    setCustomMeters('');
    setCustomMetroMoney('');
    setMetroInputMode('meters');

    toast({
      title: "Producto agregado",
      description: `${formatLength(totalCm)} de ${selectedMetroProduct.name} agregado al carrito`,
    });
  };

  const handleLogin = async () => {
    if (!loginEmail || !password) {
      toast({
        title: "Campos requeridos",
        description: "Por favor ingresa correo y contraseña",
        variant: "destructive"
      });
      return;
    }

    setIsAuthLoading(true);
    setCargando('Verificando credenciales…');

    try {
      await loginWithEmail(loginEmail, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast({
        title: "Error de autenticación",
        description: "Verifica tu conexión a internet o credenciales: " + msg,
        variant: "destructive"
      });
    } finally {
      setIsAuthLoading(false);
      setCargando(null);
    }
  };

  const handleForgotPassword = async () => {
    const correo = loginEmail.trim();
    if (!correo) {
      toast({
        title: "Escribe tu correo primero",
        description: "Pon tu correo en el formulario para enviarte el enlace de recuperación.",
        variant: "destructive",
      });
      return;
    }
    setIsRecuperando(true);
    try {
      await enviarResetPassword(correo);
      toast({
        title: "Correo enviado",
        description: `Revisa ${correo}: llegó un enlace para crear una nueva contraseña.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast({ title: "No se pudo enviar el enlace", description: msg, variant: "destructive" });
    } finally {
      setIsRecuperando(false);
    }
  };

  const handleGuardarNuevaPassword = async () => {
    if (nuevaPassword.length < 6) {
      toast({ title: "Contraseña muy corta", description: "Usa al menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (nuevaPassword !== nuevaPassword2) {
      toast({ title: "No coinciden", description: "La confirmación no coincide con la nueva contraseña.", variant: "destructive" });
      return;
    }
    setIsRecuperando(true);
    try {
      await cambiarPassword(nuevaPassword);
      await firebaseLogout();
      setShowResetPasswordForm(false);
      setNuevaPassword('');
      setNuevaPassword2('');
      toast({
        title: "Contraseña actualizada",
        description: "Ahora inicia sesión con tu nueva contraseña.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast({ title: "No se pudo actualizar", description: msg, variant: "destructive" });
    } finally {
      setIsRecuperando(false);
    }
  };

  const handleForceSync = async () => {
    toast({ title: "Sincronizando...", description: "Obteniendo datos desde Supabase" });
    try {
      const [fbProducts, fbSales, fbUsers, fbCloses, fbHistory] = await Promise.all([
        getAllProducts().catch(() => null as any),
        getAllSales().catch(() => null as any),
        getAllLocalUsers().catch(() => null as any),
        getAllDailyCloses().catch(() => null as any),
        getAllStockHistory().catch(() => null as any),
      ]);
      if (fbProducts) {
        const local: Product[] = []; try { const s = localStorage.getItem('pos-products'); if (s) local.push(...JSON.parse(s)); } catch {}
        for (const item of fbProducts) { if (!local.find(x => x.id === item.id)) local.push(item); }
        setProducts(local); try { localStorage.setItem('pos-products', JSON.stringify(local)); } catch {}
      }
      if (fbSales) {
        const local: Sale[] = []; try { const s = localStorage.getItem('pos-sales'); if (s) local.push(...JSON.parse(s)); } catch {}
        for (const item of fbSales) {
          if (!item.localDate) { try { (item as any).localDate = getLocalDateStr(new Date(item.date)); } catch {} }
          if (!local.find(x => x.id === item.id)) local.push(item);
        }
        fbSales.forEach(item => syncedSaleIds.current.add(item.id));
        setSales(local); try { localStorage.setItem('pos-sales', JSON.stringify(local)); } catch {}
      }
      if (fbUsers) {
        const local: AppUser[] = []; try { const s = localStorage.getItem('pos-users'); if (s) local.push(...JSON.parse(s)); } catch {}
        for (const item of fbUsers) { if (!local.find(x => x.id === item.id)) local.push(item); }
        setUsers(local); try { localStorage.setItem('pos-users', JSON.stringify(local)); } catch {}
      }
      if (fbCloses) {
        const local: DailyClose[] = []; try { const s = localStorage.getItem('pos-daily-closes'); if (s) local.push(...JSON.parse(s)); } catch {}
        for (const item of fbCloses) { if (!local.find(x => x.id === item.id)) local.push(item); }
        setDailyCloses(local); try { localStorage.setItem('pos-daily-closes', JSON.stringify(local)); } catch {}
      }
      if (fbHistory) {
        const local: StockHistoryItem[] = []; try { const s = localStorage.getItem('pos-stock-history'); if (s) local.push(...JSON.parse(s)); } catch {}
        for (const item of fbHistory) { if (!local.find(x => x.id === item.id)) local.push(item); }
        setStockHistory(local); try { localStorage.setItem('pos-stock-history', JSON.stringify(local)); } catch {}
        fbHistory.forEach(item => syncedHistoryIds.current.add(item.id));
      }
      toast({ title: "Sincronización completa", description: "Datos actualizados desde Supabase" });
    } catch {
      toast({ title: "Error de sincronización", description: "No se pudo conectar con Supabase", variant: "destructive" });
    }
  };

  const calcularIGV = (subtotal: number) => {
    const rate = parseFloat(igvRateStr) || 18;
    return subtotal * rate / (100 + rate);
  };

  const agregarProductoVenta = (product: Product) => {
    const stockValido = product.saleLevels?.some(l => l.name === 'Unidad')
      ? (product.saleLevels.find(l => l.name === 'Unidad')?.stock ?? 0)
      : product.stock;
    if (stockValido <= 0) {
      toast({
        title: "Sin stock",
        description: "Este producto no tiene stock disponible",
        variant: "destructive"
      });
      return;
    }

    if (product.type === 'peso') {
      setSelectedWeightProduct(product);
      setWeightQuantities({});
      setCustomWeight('');
      setIsWeightModalOpen(true);
      return;
    }

    if (product.type === 'metro') {
      setSelectedMetroProduct(product);
      setMetroQuantities({});
      setCustomMeters('');
      setCustomMetroMoney('');
      setMetroInputMode('meters');
      setIsMetroModalOpen(true);
      return;
    }

    if (product.type === 'mayorista') {
      setSelectedMayoristaProduct(product);
      setSelectedLevelId(product.saleLevels?.[0]?.id || '');
      setMayoristaQuantity(1);
      setIsMayoristaModalOpen(true);
      return;
    }

    if (product.type === 'unidad' && product.saleLevels && product.saleLevels.length > 0) {
      setSelectedMayoristaProduct(product);
      const unidadLevel = product.saleLevels.find(l => l.name === 'Unidad');
      setSelectedLevelId(unidadLevel?.id || product.saleLevels[0].id);
      setMayoristaQuantity(1);
      setIsMayoristaModalOpen(true);
      return;
    }

    const existingItem = currentSale.find(item => item.product.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        actualizarCantidad(product.id, existingItem.quantity + 1);
      } else {
        toast({
          title: "Stock insuficiente",
          description: `Solo hay ${product.stock} unidades disponibles`,
          variant: "destructive"
        });
      }
    } else {
      setCurrentSale([...currentSale, { product, quantity: 1 }]);
    }
  };

  const actualizarCantidad = (productId: string, newQuantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const saleItem = currentSale.find(item => item.product.id === productId);
    const levelName = saleItem?.selectedLevelName;

    if (product.type === 'mayorista' || levelName) {
      const level = product.saleLevels?.find(l => l.name === levelName);
      if (!level) {
        toast({ title: "Producto no encontrado", description: "No se encontró el nivel de venta", variant: "destructive" });
        return;
      }
      const maxLevels = level.stock > 0
        ? level.stock
        : Math.floor(product.stock / level.baseUnitsContained);
      if (newQuantity > maxLevels) {
        toast({
          title: "Stock insuficiente",
          description: `Solo hay ${maxLevels} ${level.name}(s) disponibles`,
          variant: "destructive"
        });
        return;
      }
    } else if (newQuantity > product.stock) {
      toast({
        title: "Stock insuficiente",
        description: product.type === 'peso'
          ? `Solo hay ${formatWeight(product.stock)} disponibles`
          : product.type === 'metro'
            ? `Solo hay ${formatLength(product.stock)} disponibles`
            : `Solo hay ${product.stock} unidades disponibles`,
        variant: "destructive"
      });
      return;
    }

    if (newQuantity <= 0) {
      eliminarProductoVenta(productId, levelName);
      return;
    }

    setCurrentSale(currentSale.map(item => {
      if (item.product.id === productId && (item.selectedLevelName ?? null) === (levelName ?? null)) {
        if (item.product.type === 'peso') {
          return {
            ...item,
            quantity: newQuantity,
          };
        }
        if ((item.product.type === 'mayorista' || item.selectedLevelName) && item.selectedLevelName) {
          const level = item.product.saleLevels?.find(l => l.name === item.selectedLevelName);
          if (level) {
            return {
              ...item,
              quantity: newQuantity,
              product: {
                ...item.product,
                salePrice: level.salePrice,
                purchasePrice: level.purchasePrice
              }
            };
          }
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const eliminarProductoVenta = (productId: string, selectedLevelName?: string) => {
    setCurrentSale(currentSale.filter(item =>
      !(item.product.id === productId && (item.selectedLevelName ?? null) === (selectedLevelName ?? null))
    ));
  };

  const calcularSubtotal = () => {
    return currentSale.reduce((total, item) => {
      if (item.product.type === 'peso') {
        return total + ((item.product.salePricePerKg || 0) * (item.quantity / 1000));
      }
      if (item.product.type === 'metro') {
        return total + ((item.product.salePrice || 0) * (item.quantity / 100));
      }
      const level = item.selectedLevelName ? item.product.saleLevels?.find(l => l.name === item.selectedLevelName) : undefined;
      const price = level?.salePrice ?? item.product.salePrice ?? 0;
      return total + (price * item.quantity);
    }, 0);
  };

  const calcularTotal = () => {
    return calcularSubtotal();
  };

  const calcularCambio = () => {
    const paid = parseFloat(amountPaid) || 0;
    if (paymentMethod === 'efectivo' && paid > 0) {
      const totalFinal = aplicarRedondeo ? redondearTotalEfectivo(calcularTotal()) : calcularTotal();
      return Math.max(0, paid - totalFinal);
    }
    return 0;
  };

  const redondearTotalEfectivo = (total: number) => {
    const centimos = Math.round(total * 100);
    const decimoCentimo = centimos % 10;
    let redondeadoCentimos: number;
    
    if (decimoCentimo < 5) {
      redondeadoCentimos = centimos - decimoCentimo;
    } else {
      redondeadoCentimos = centimos + (10 - decimoCentimo);
    }
    
    return redondeadoCentimos / 100;
  };

  const formatWeight = (grams: number) => {
    if (grams === undefined || isNaN(grams)) return '0g';
    const kg = Math.floor(grams / 1000);
    const g = grams % 1000;
    if (kg > 0 && g > 0) {
      return `${kg}kg ${g}g`;
    } else if (kg > 0) {
      return `${kg}kg`;
    } else {
      return `${g}g`;
    }
  };

  const formatLength = (cm: number) => {
    if (cm === undefined || isNaN(cm)) return '0.00 m';
    return `${(cm / 100).toFixed(2)} m`;
  };

  const confirmarVenta = async () => {
    if (currentSale.length === 0) {
      toast({
        title: "Venta vacía",
        description: "Agrega productos antes de confirmar la venta",
        variant: "destructive"
      });
      return;
    }

    const rawSubtotal = calcularSubtotal();
    const subtotal = Math.round(rawSubtotal * 100) / 100;
    const igv = calcularIGV(subtotal);
    const total = subtotal;
    const totalRedondeado = (paymentMethod === 'efectivo' && aplicarRedondeo) ? redondearTotalEfectivo(total) : total;
    const totalProfit = currentSale.reduce((total, item) => {
      if (item.product.type === 'peso') {
        const totalKg = item.quantity / 1000;
        const profitPerKg = (item.product.salePricePerKg || 0) - (item.product.purchasePricePerKg || 0);
        return total + (profitPerKg * totalKg);
      }
      if (item.product.type === 'metro') {
        const totalMeters = item.quantity / 100;
        return total + (((item.product.salePrice || 0) - (item.product.purchasePrice || 0)) * totalMeters);
      }
      const level = item.selectedLevelName ? item.product.saleLevels?.find(l => l.name === item.selectedLevelName) : undefined;
      const salePrice = level?.salePrice ?? item.product.salePrice ?? 0;
      const purchasePrice = level?.purchasePrice ?? item.product.purchasePrice ?? 0;
      return total + ((salePrice - purchasePrice) * item.quantity);
    }, 0);
    
    if (paymentMethod === 'efectivo') {
      if (!amountPaid || amountPaid.trim() === '') {
        toast({
          title: "Monto requerido",
          description: "Debe ingresar el monto recibido para ventas en efectivo",
          variant: "destructive"
        });
        return;
      }
      
      const paidAmount = parseFloat(amountPaid);
      if (isNaN(paidAmount) || paidAmount < totalRedondeado) {
        toast({
          title: "Pago insuficiente",
          description: `El monto pagado es menor al total (S/ ${totalRedondeado.toFixed(2)})`,
          variant: "destructive"
        });
        return;
      }
    }

    const updatedProducts = products.map(product => {
      const saleItems = currentSale.filter(item => item.product.id === product.id);
      if (saleItems.length === 0) return product;

      const hasUnidadLevel = product.saleLevels?.some(l => l.name === 'Unidad');

      if (hasUnidadLevel) {
        const totalUnits = saleItems.reduce((sum, item) => {
          const level = product.saleLevels?.find(l => l.name === item.selectedLevelName);
          return sum + ((level?.baseUnitsContained || 1) * item.quantity);
        }, 0);
        return {
          ...product,
          stock: Math.max(0, product.stock - totalUnits),
          saleLevels: product.saleLevels?.map(l =>
            l.name === 'Unidad'
              ? { ...l, stock: Math.max(0, l.stock - totalUnits) }
              : l
          )
        };
      }

      if (product.type === 'mayorista') {
        let updatedLevels = product.saleLevels ? [...product.saleLevels] : [];
        for (const saleItem of saleItems) {
          if (saleItem.selectedLevelName) {
            updatedLevels = updatedLevels.map(l => {
              if (l.name === saleItem.selectedLevelName) {
                return { ...l, stock: Math.max(0, l.stock - saleItem.quantity) };
              }
              return l;
            });
          }
        }
        const newTotalStock = updatedLevels.reduce((sum, l) => sum + l.stock * l.baseUnitsContained, 0);
        return { ...product, saleLevels: updatedLevels, stock: newTotalStock };
      }

      const totalUnits = saleItems.reduce((sum, item) => {
        if (product.type === 'mayorista' && item.selectedLevelName) {
          const level = product.saleLevels?.find(l => l.name === item.selectedLevelName);
          return sum + ((level?.baseUnitsContained || 1) * item.quantity);
        }
        return sum + item.quantity;
      }, 0);
      return { ...product, stock: product.stock - totalUnits };
    });

    // Validar stock antes de confirmar (evita sobreventa con 2 pestañas o cajas)
    for (const product of products) {
      const saleItems = currentSale.filter(item => item.product.id === product.id);
      if (saleItems.length === 0) continue;
      const hasUnidadLevel = product.saleLevels?.some(l => l.name === 'Unidad');

      if (hasUnidadLevel) {
        // Modelo A: stock general en unidades compartido entre los niveles
        const totalUnits = saleItems.reduce((sum, item) => {
          const level = product.saleLevels?.find(l => l.name === item.selectedLevelName);
          return sum + ((level?.baseUnitsContained || 1) * item.quantity);
        }, 0);
        if (product.stock - totalUnits < 0) {
          toast({
            title: "Stock insuficiente",
            description: `${product.name}: solo quedan ${product.stock} unidades`,
            variant: "destructive"
          });
          return;
        }
      } else if (product.type === 'mayorista') {
        // Modelo B: cada nivel tiene su propio stock
        for (const saleItem of saleItems) {
          if (!saleItem.selectedLevelName) {
            if (product.stock - saleItem.quantity < 0) {
              toast({
                title: "Stock insuficiente",
                description: `${product.name}: solo quedan ${product.stock} unidades`,
                variant: "destructive"
              });
              return;
            }
            continue;
          }
          const level = product.saleLevels?.find(l => l.name === saleItem.selectedLevelName);
          if (level && level.stock - saleItem.quantity < 0) {
            toast({
              title: "Stock insuficiente",
              description: `${product.name} (${level.name}): solo quedan ${level.stock} disponibles`,
              variant: "destructive"
            });
            return;
          }
        }
      } else {
        // Unidad simple o Peso (cantidad en gramos vs stock en gramos)
        const totalQty = saleItems.reduce((sum, item) => sum + item.quantity, 0);
        if (product.stock - totalQty < 0) {
          toast({
            title: "Stock insuficiente",
            description: product.type === 'peso'
              ? `${product.name}: solo quedan ${formatWeight(product.stock)}`
              : product.type === 'metro'
                ? `${product.name}: solo quedan ${formatLength(product.stock)}`
                : `${product.name}: solo quedan ${product.stock} unidades`,
            variant: "destructive"
          });
          return;
        }
      }
    }

    const newSaleId = generateSaleId();

    // Agregar registros de ventas al historial de stock
    const newHistoryItems: StockHistoryItem[] = currentSale.flatMap(item => {
      const product = products.find(p => p.id === item.product.id);
      const updatedProduct = updatedProducts.find(p => p.id === item.product.id);
      if (!product || !updatedProduct) return [];

      if (item.product.type === 'mayorista' || (item.product.type === 'unidad' && product.saleLevels?.length)) {
        const level = product.saleLevels?.find(l => l.name === item.selectedLevelName);
        if (level) {
          return {
            id: generateId(),
            saleId: newSaleId,
            productId: product.id,
            productName: product.name,
            type: 'sale' as const,
            quantity: item.quantity,
            resultingStock: updatedProduct.stock,
            date: new Date().toISOString(),
            affectedLevelName: item.selectedLevelName,
            levelQuantity: item.quantity
          };
        }
        if (item.product.type === 'mayorista') return [];
      }

      return {
        id: generateId(),
        saleId: newSaleId,
        productId: product.id,
        productName: product.name,
        type: 'sale' as const,
        quantity: item.quantity,
        resultingStock: updatedProduct.stock,
        date: new Date().toISOString()
      };
    });

    const updatedHistory = [...stockHistory, ...newHistoryItems];

    const newSale: Sale = {
      id: newSaleId,
      items: currentSale.map(item => ({
        ...item,
          product: {
            id: item.product.id,
            name: item.product.name,
            salePrice: item.product.salePrice,
            purchasePrice: item.product.purchasePrice,
            type: item.product.type,
            stock: item.product.stock,
            initialStock: item.product.initialStock,
            category: item.product.category,
            salePricePerKg: item.product.salePricePerKg,
            purchasePricePerKg: item.product.purchasePricePerKg
          }
      })),
      subtotal,
      igv,
      igvRate: parseFloat(igvRateStr) || 18,
      total: totalRedondeado,
      totalProfit,
      date: new Date().toISOString(),
      localDate: getLocalDateStr(new Date()),
      paymentMethod,
      amountPaid: paymentMethod === 'efectivo' ? parseFloat(amountPaid) : totalRedondeado,
      change: paymentMethod === 'efectivo' ? calcularCambio() : 0,
      aplicarRedondeo
    };

    const productsToUpdate = updatedProducts.filter(p => {
      const old = products.find(ex => ex.id === p.id);
      return old && (old.stock !== p.stock || old.salePrice !== p.salePrice || old.purchasePrice !== p.purchasePrice || JSON.stringify(old.saleLevels) !== JSON.stringify(p.saleLevels));
    });
    const productsToCreate = updatedProducts.filter(p => !products.find(ex => ex.id === p.id));

    // Marcar venta y productos como "EN CAMINO" ANTES de guardar en el navegador,
    // para que el merge en tiempo real jamás los oculte antes de llegar a Firebase.
    addPendingId(PENDING.SALES, newSale.id);
    productsToUpdate.forEach(p => addPendingId(PENDING.PRODUCTS, p.id));
    productsToCreate.forEach(p => addPendingId(PENDING.PRODUCTS, p.id));

    setProducts(updatedProducts);
    setSales([...sales, newSale]);
    setStockHistory(updatedHistory);
    setCurrentSale([]);
    setAmountPaid("");

    // Guardar a localStorage ANTES de Firebase (protege contra recargas)
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    safeSetItem('pos-sales', JSON.stringify([...sales, newSale]));
    safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));

    toast({
      title: "Venta confirmada",
      description: `Venta por S/ ${totalRedondeado.toFixed(2)} registrada exitosamente`,
    });

    imprimirTicket(newSale, sales.length + 1);

    // Intentar sync a Firebase directo (tiempo real); quitar "EN CAMINO" al confirmar
    ventasEnviandoseRef.current.add(newSale.id);
    createSale(newSale.id, stripUndefined(newSale))
      .then((ventaGuardada: Sale) => {
        removePendingId(PENDING.SALES, newSale.id);
        // Refresca el modal de información de producto si está abierto: la venta
        // recién insertada por el RPC debe verse de inmediato en el registro.
        setTickHistorial(t => t + 1);
        // La venta real de Supabase tiene su propio id (e items). Reemplazar la
        // copia local (id temporal) para que nunca aparezca duplicada en "Ventas del Día".
        setSales(prev => dedupeBySaleId(prev.map(s => s.id === newSale.id ? ventaGuardada : s)));
        try {
          const lista = JSON.parse(localStorage.getItem('pos-sales') || '[]');
          if (Array.isArray(lista)) {
            const limpia = lista.filter((x: any) => x?.id !== newSale.id).concat(ventaGuardada);
            safeSetItem('pos-sales', JSON.stringify(limpia));
          }
        } catch {}
      })
      .catch(e => { console.error('ERROR createSale:', e); addPendingId(PENDING.SALES, newSale.id); })
      .finally(() => ventasEnviandoseRef.current.delete(newSale.id));
    Promise.all([
      ...productsToUpdate.map(p => {
        const updateData: any = {};
        if (p.salePrice !== undefined) updateData.salePrice = p.salePrice;
        if (p.purchasePrice !== undefined) updateData.purchasePrice = p.purchasePrice;
        if (p.saleLevels !== undefined) updateData.saleLevels = p.saleLevels;
        if (p.category !== undefined) updateData.category = p.category;
        if (p.imageUrl !== undefined) updateData.imageUrl = p.imageUrl;
        if (p.name !== undefined) updateData.name = p.name;
        if (Object.keys(updateData).length === 0) {
          removePendingId(PENDING.PRODUCTS, p.id);
          return Promise.resolve();
        }
        return updateProduct(p.id, stripUndefined(updateData))
          .then(() => removePendingId(PENDING.PRODUCTS, p.id))
          .catch(e => { console.error('ERROR updateProduct:', e); addPendingId(PENDING.PRODUCTS, p.id); });
      }),
      ...productsToCreate.map(p => createProduct(p.id, stripUndefined(p))
        .then(() => removePendingId(PENDING.PRODUCTS, p.id))
        .catch(e => { console.error('ERROR createProduct:', e); addPendingId(PENDING.PRODUCTS, p.id); })),
    ]);
    syncHistoryToFirestore(updatedHistory).catch(e => { console.error('ERROR syncHistory:', e); newHistoryItems.forEach(h => addPendingId(PENDING.HISTORY, h.id)); });
    autoCleanupLocal();
  };
  
  useEffect(() => {
    safeSetItem('qz-print', String(useQzPrint));
  }, [useQzPrint]);

  useEffect(() => {
    if (selectedQzPrinter) safeSetItem('qz-printer', selectedQzPrinter);
  }, [selectedQzPrinter]);

  const conectarQZTray = async () => {
    try {
      await qz.websocket.connect();
      const printers = await qz.printers.find();
      const printerNames = printers.map((p: any) => p.name || p);
      setQzPrinters(printerNames);
      setQzConnected(true);
      if (!selectedQzPrinter && printerNames.length > 0) {
        setSelectedQzPrinter(printerNames[0]);
      }
      return printerNames;
    } catch (e) {
      setQzConnected(false);
      setQzPrinters([]);
      return [];
    }
  };

  const desconectarQZTray = async () => {
    try { await qz.websocket.disconnect(); } catch {}
    setQzConnected(false);
    setQzPrinters([]);
  };

  const probarQZTray = async () => {
    setIsQzTesting(true);
    try {
      const printers = qzConnected ? qzPrinters : await conectarQZTray();
      if (printers.length > 0 && selectedQzPrinter) {
        const config = qz.configs.create(selectedQzPrinter);
        toast({ title: "Conexión exitosa", description: "QZ Tray está configurado correctamente." });
      }
    } catch (e) { console.error('ERROR probarQZTray:', e); toast({ title: "Error de impresión", description: "No se pudo imprimir. Verifica QZ Tray.", variant: "destructive" }); }
    setIsQzTesting(false);
  };

  const formatearProductoTicket = (item: SaleItem) => {
    const nombre = item.product.name;
    let result = '';
    if (item.product.type === 'peso') {
      const kgDisplay = formatearPeso(item.quantity);
      const precioUnitario = item.product.salePricePerKg || 0;
      const totalItem = precioUnitario * (item.quantity / 1000);
      result += `${nombre}\n`;
      result += `       ${kgDisplay} x S/ ${precioUnitario.toFixed(2)}/kg = S/ ${totalItem.toFixed(2).padStart(7)}`;
    } else if (item.product.type === 'metro') {
      const precioUnitario = item.product.salePrice || 0;
      const totalItem = precioUnitario * (item.quantity / 100);
      result += `${nombre}\n`;
      result += `       ${formatLength(item.quantity)} x S/ ${precioUnitario.toFixed(2)}/m = S/ ${totalItem.toFixed(2).padStart(7)}`;
    } else if (item.product.type === 'mayorista') {
      const nivel = item.selectedLevelName || 'Und';
      const cantDisplay = `${item.quantity} ${nivel}(s)`;
      const precioUnitario = item.product.salePrice || 0;
      const totalItem = precioUnitario * item.quantity;
      const level = item.product.saleLevels?.find(l => l.name === item.selectedLevelName);
      const totalUnits = (level?.baseUnitsContained || 1) * item.quantity;
      result += `${nombre}\n`;
      result += `       ${cantDisplay} x S/ ${precioUnitario.toFixed(2)} = S/ ${totalItem.toFixed(2).padStart(7)}\n`;
      result += `       → ${totalUnits} unidades`;
    } else {
      const totalItem = (item.product.salePrice || 0) * item.quantity;
      result += `${nombre}\n`;
      result += `       ${item.quantity} x S/ ${(item.product.salePrice || 0).toFixed(2)} = S/ ${totalItem.toFixed(2).padStart(7)}`;
    }
    return result;
  };

  const generarBoletaHTML = (venta: Sale, previewMode = false, numeroTicket?: number) => {
    const fecha = new Date(venta.date);
    const fechaStr = fecha.toLocaleDateString('es-PE');
    const horaStr = fecha.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true });
    const metodosPago: Record<string, string> = {
      efectivo: 'EFECTIVO',
      tarjeta: 'TARJETA',
      yape: 'YAPE',
      plin: 'PLIN'
    };
    const igvCalc = venta.igv || 0;
    const totalSinRedondeo = venta.subtotal;
    const redondeo = (isFinite(venta.total) && isFinite(totalSinRedondeo)) ? venta.total - totalSinRedondeo : 0;
    const mostrarRedondeo = venta.paymentMethod === 'efectivo' && venta.aplicarRedondeo && Math.abs(redondeo) >= 0.01;
    const logoHtml = companyLogo
      ? `<img src="${companyLogo}" alt="Logo" style="width: 160px; height: auto; display: block; margin: 0 auto 4mm auto; max-height: 80px; object-fit: contain; background: white; padding: 6px; border-radius: 6px; filter: contrast(1.3) brightness(0.95);" />`
      : '';

    const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.4; width: ${previewMode ? '100%' : '74mm'}; max-width: ${previewMode ? '520px' : 'none'}; margin: ${previewMode ? '0 auto' : '0'}; padding: 3mm 2mm; }
    .logo { text-align: center; margin-bottom: 3mm; }
    .header { text-align: center; margin-bottom: 3mm; }
    .header .empresa { font-size: 14px; font-weight: bold; letter-spacing: 0.5px; }
    .header .ruc { font-size: 10px; font-weight: 600; margin-top: 1mm; color: #000; }
    .header .direccion { font-size: 9px; font-weight: 600; color: #000; margin-top: 1mm; }
    .header .celular { font-size: 9px; font-weight: 600; color: #000; margin-top: 0.5mm; }
    .ticket-title { text-align: center; font-size: 12px; font-weight: bold; margin: 2mm 0 1.5mm 0; letter-spacing: 2px; }
    .info-line { display: flex; justify-content: space-between; font-size: 10px; font-weight: 600; margin: 0.5mm 0; }
    .divider { border-top: 1px dashed #888; margin: 1.5mm 0; }
    .solid-divider { border-top: 2px solid #000; margin: 1.5mm 0; }
    .product-header { text-align: left; display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; margin-bottom: 0.5mm; }
    .product-row { text-align: left; margin: 0.3mm 0; }
    .total-section { margin-top: 1.5mm; }
    .total-line { display: flex; justify-content: space-between; font-size: 10px; font-weight: 600; margin: 0.3mm 0; }
    .total-line.bold { font-weight: bold; }
    .total-pagar { font-size: 14px; font-weight: bold; text-align: center; margin: 1.5mm 0; }
    .payment-line { font-size: 10px; font-weight: 600; margin: 0.3mm 0; }
    .footer { text-align: center; margin-top: 3mm; font-size: 10px; font-weight: bold; }
    `;

    const bodyContent = `
  ${logoHtml}
  <div class="header">
    <div class="empresa">${(emisorForm.razonSocial || EMPRESA.razonSocial || 'FERRETERIA EBENEZER').toUpperCase()}</div>
    <div class="ruc">${(emisorForm.ruc || EMPRESA.ruc) ? `RUC ${(emisorForm.ruc || EMPRESA.ruc)}` : ''}</div>
    <div class="direccion">${emisorForm.direccion || EMPRESA.direccion || ''}</div>
    <div class="celular">${(() => {
      const t1 = (emisorForm.telefono || EMPRESA.telefono || '998315845').trim();
      const t2 = ((emisorForm as any).telefono2 || (EMPRESA as any).telefono2 || '983746124').trim();
      const tels = t2 ? `${t1} / ${t2}` : t1;
      return tels ? `CEL: ${tels}` : (t1 ? `CEL: ${t1}` : '');
    })()}</div>
  </div>

  <div class="ticket-title">TICKET DE COMPRA</div>

  <div class="divider"></div>

  <div class="info-line"><span>ID:</span><span>#${numeroTicket ?? ticketNumberOf(venta.id)}</span></div>
  <div class="info-line"><span>Emisión:</span><span>${fechaStr} ${horaStr}</span></div>

  <div class="divider"></div>

  <div class="product-header">
    <span>Cant. x Producto</span>
    <span>Total</span>
  </div>

  ${(() => {
    const regularItems = venta.items.filter(item => !item.selectedLevelName || item.selectedLevelName === 'Unidad');
    const levelItems = venta.items.filter(item => item.selectedLevelName && item.selectedLevelName !== 'Unidad');
    return [
      ...regularItems.map(item => `
        <div class="product-row">
          ${formatearProductoTicketHTML(item)}
        </div>
      `),
      ...(levelItems.length > 0 ? [
        `<div class="divider"></div>`,
        `<div style="font-size: 10px; font-weight: 900; text-align: center; padding: 4px 0; color: #000; letter-spacing: 1px;">=== POR MAYOR ===</div>`,
        ...levelItems.map(item => `
          <div class="product-row">
            ${formatearProductoTicketHTML(item)}
          </div>
        `)
      ] : [])
    ].join('');
  })()}

  <div class="divider"></div>

  <div class="total-section">
    <div class="total-line">
      <span>SUBTOTAL:</span>
      <span>S/ ${venta.subtotal.toFixed(2).padStart(7)}</span>
    </div>
    <div class="total-line">
      <span>IGV (${venta.igvRate || 18}%) incluido:</span>
      <span>S/ ${igvCalc.toFixed(2).padStart(7)}</span>
    </div>
    ${mostrarRedondeo ? `
    <div class="total-line">
      <span>REDONDEO:</span>
      <span>S/ ${redondeo.toFixed(2).padStart(7)}</span>
    </div>
    ` : ''}
  </div>

  <div class="solid-divider"></div>

  <div class="total-pagar">
    TOTAL A PAGAR: S/ ${venta.total.toFixed(2)}
  </div>

  <div class="solid-divider"></div>

  <div class="payment-line">MÉTODO DE PAGO: ${metodosPago[venta.paymentMethod]}</div>
  ${venta.paymentMethod === 'efectivo' ? `
  <div class="payment-line">Recibido: S/ ${(venta.amountPaid || 0).toFixed(2)}</div>
  <div class="payment-line">Cambio:   S/ ${(venta.change || 0).toFixed(2)}</div>
  ` : ''}

  <div class="solid-divider"></div>

  <div class="footer">¡GRACIAS POR SU COMPRA!</div>
  `;

    if (previewMode) {
      const scopedCss = css
        .split('\n')
        .map(line => {
          const l = line.trim();
          if (!l || l.startsWith('body')) return '';
          return '.boleta-preview ' + l;
        })
        .join('\n');
      return `<style>${scopedCss}</style><div class="boleta-preview" style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:10px;line-height:1.4;padding:3mm 2mm">${bodyContent}</div>`;
    }
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title></title>
  <style>
    @media print {
      @page { size: 80mm auto; margin: 0; orientation: portrait; }
      body { margin: 0; padding: 5mm 3mm; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
    ${css}
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
  };

  const imprimirHTML = (html: string) => {
    const w = window.open('', 'PRINT', 'height=900,width=760');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();

    // El HTML del comprobante carga Tailwind desde CDN y el QR es una imagen
    // data-URL. Si se llama print() demasiado pronto la ventana aun esta en
    // blanco (solo el <title>) y el PDF sale vacio. Se espera al evento load
    // y se deja un margen extra para que el navegador pinte.
    let impreso = false;
    const lanzar = () => {
      if (impreso) return;
      impreso = true;
      setTimeout(() => {
        try {
          w.focus();
          w.print();
        } catch { /* ventana cerrada por el usuario */ }
      }, 600);
    };

    if (w.document.readyState === 'complete') {
      lanzar();
    } else {
      w.addEventListener('load', lanzar, { once: true });
    }
    // Red de seguridad: si load nunca dispara (CDN bloqueado), imprimir igual.
    setTimeout(lanzar, 4000);
  };

  const generarComprobanteElectronicoHTML = async (params: {
    tipoDocumento: '01' | '03';
    numero: string;
    fecha: string;
    emisor: Emisor | null;
    cliente: Cliente | null;
    venta: Sale;
    igvRate: number;
    logo?: string;
    xmlUrl?: string;
    pdfUrl?: string;
  }): Promise<string> => {
    const { tipoDocumento, numero, fecha, emisor, cliente, venta, igvRate } = params;
    const logo = params.logo || emisor?.logoUrl || companyLogo;
    const xmlUrl = params.xmlUrl;
    const pdfUrl = params.pdfUrl;
    const esFactura = tipoDocumento === '01';
    const titulo = esFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
    const serieCorrelativo = numero || '';
    const fechaEmision = new Date(fecha);
    const fechaStr = isNaN(fechaEmision.getTime())
      ? new Date().toLocaleDateString('es-PE')
      : fechaEmision.toLocaleDateString('es-PE');
    const fechaVenc = fechaStr;

    const total = Number(venta.total) || 0;
    const tasa = Number(igvRate) || 18;
    // SUBTOTAL = suma de los importes de linea SIN IGV (V/U x cantidad).
    // IGV = lo que falta para llegar al total cobrado, asi el cuadre es exacto.
    const subtotalSinIgv = venta.items.reduce((sum, item) => {
      const cantidad = item.product.type === 'peso' ? item.quantity / 1000
        : item.product.type === 'metro' ? item.quantity / 100
        : Number(item.quantity) || 0;
      const precio = Number(item.product.salePrice || 0);
      return sum + (precio / (1 + tasa / 100)) * cantidad;
    }, 0);
    const base = venta.items.length > 0
      ? Math.round(subtotalSinIgv * 100) / 100
      : (Number(venta.subtotal) || total / (1 + tasa / 100));
    const igv = Math.round((total - base) * 100) / 100;
    const gravada = base;

    const nombreCliente = cliente ? cliente.razonSocial : 'CLIENTES VARIOS';
    const rucCliente = cliente ? cliente.numeroDocumento : '-';
    const dirCliente = cliente?.direccion || '-';

    const logoHtml = logo
      ? `<img src="${logo}" alt="Logo" style="max-height:64px;max-width:180px;object-fit:contain" />`
      : '';

    const filasItems = venta.items.map((item, idx) => {
      let cant: number;
      let um = 'NIU';
      let desc = item.product.name || '';
      if (item.product.type === 'peso') {
        cant = Number((item.quantity / 1000).toFixed(3));
        um = 'KGM';
      } else if (item.product.type === 'metro') {
        cant = Number((item.quantity / 100).toFixed(2));
        um = 'MTR';
      } else {
        cant = Number(item.quantity) || 0;
        um = 'NIU';
      }
      if (item.selectedLevelName) {
        desc = desc + ' (' + item.selectedLevelName + ')';
      }
      const pu = Number(item.product.salePrice || 0);
      // V/U es el valor unitario SIN IGV (convencion SUNAT); P/U es con IGV.
      const valorUnitario = pu / (1 + (Number(igvRate) || 18) / 100);
      const importe = Number((pu * cant).toFixed(2));
      return `<tr class="h-6"><td class="text-center py-1">${cant}</td><td class="text-center py-1">${escapeHtml(um)}</td><td class="text-left py-1">${escapeHtml(desc)}</td><td class="text-right py-1">${valorUnitario.toFixed(3)}</td><td class="text-right py-1">${pu.toFixed(3)}</td><td class="text-right py-1 pr-2">${importe.toFixed(2)}</td></tr>`;
    }).join('');

    // Cadena del QR segun especificacion SUNAT
    const qrContenido = [
      emisor?.ruc || '',
      tipoDocumento,
      (serieCorrelativo.split('-')[0] || ''),
      (serieCorrelativo.split('-')[1] || '0'),
      igv.toFixed(2),
      total.toFixed(2),
      fechaStr,
      cliente?.tipoDocumento || '',
      rucCliente,
      '',
    ].join('|');
    const qrDataUrl = await QRCode
      .toDataURL(qrContenido, { width: 200, margin: 1, errorCorrectionLevel: 'M' })
      .catch(() => '');

    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titulo} - ${serieCorrelativo}</title><script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script><style>@media print{body{background:#fff!important;padding:0!important}.invoice-page{box-shadow:none!important;margin:0!important;width:100%!important;max-width:100%!important;border:none!important;padding:15mm!important}}.invoice-page{width:210mm;min-height:297mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}.qr-container{width:110px;height:110px;padding:6px;background:white;border:1px solid #94a3b8;border-radius:4px}</style></head><body class="bg-slate-700 min-h-screen py-8 text-neutral-900 flex flex-col items-center"><main class="invoice-page bg-white shadow-2xl p-12 text-[10px] leading-tight flex flex-col justify-between"><div><section class="flex justify-between items-start mb-6"><div class="w-[62%] pr-4"><div class="mb-2"><div class="flex items-center"><span class="text-3xl font-extrabold tracking-tight text-[#4F46E5]">FERRETERIA</span><span class="text-3xl font-extrabold tracking-tight text-[#3f454d]"> EBENEZER</span></div>${emisor?.nombreComercial ? `<p class="text-[9px] text-[#1c1c1c] mt-1">${escapeHtml(emisor.nombreComercial)}</p>` : ''}</div><div class="text-[9px] text-[#1c1c1c] space-y-0.5 mt-3"><p>Dirección: ${escapeHtml(emisor?.direccion||'-')}</p><p>Teléfono: ${escapeHtml(emisor?.telefono||'-')}</p></div></div><div class="w-[36%] border-[1.5px] border-neutral-400 bg-[#f4f4f4] rounded-2xl p-4 text-center flex flex-col justify-center items-center"><p class="text-sm font-bold">RUC ${escapeHtml(emisor?.ruc||'')}</p><p class="text-base font-extrabold my-1 uppercase">${titulo.replace('ELECTRÓNICA','<br>ELECTRÓNICA')}</p><p class="text-sm font-bold">${escapeHtml(serieCorrelativo)}</p></div></section><section class="grid grid-cols-12 gap-3 mb-4"><div class="col-span-8 border-[1.5px] border-neutral-400 rounded-xl p-3 text-[9px] min-h-[75px]"><p class="font-bold text-[9.5px] mb-1">DATOS DEL CLIENTE</p><div class="grid grid-cols-[100px_1fr] gap-y-0.5"><span class="font-bold">${esFactura?'RUC':'DNI/DOC'}</span><span>: ${escapeHtml(rucCliente)}</span><span class="font-bold">DENOMINACIÓN</span><span class="font-bold">: ${escapeHtml(nombreCliente)}</span><span class="font-bold">DIRECCIÓN</span><span>: ${escapeHtml(dirCliente)}</span></div></div><div class="col-span-4 border-[1.5px] border-neutral-400 rounded-xl p-3 text-[9px] min-h-[75px]"><div class="grid grid-cols-[85px_1fr] gap-y-1 pt-1"><span class="font-bold">FECHA EMISIÓN</span><span>: ${fechaStr}</span><span class="font-bold">FECHA DE VENC.</span><span>: ${fechaVenc}</span><span class="font-bold">MONEDA</span><span>: SOLES</span></div></div></section><section class="mb-3"><div class="w-full border-t border-b border-neutral-400"><table class="w-full border-collapse text-[9px]"><thead><tr class="bg-[#e9ecef] border-b border-neutral-400 text-neutral-800 font-bold uppercase text-center h-7"><th class="py-1 px-1.5 w-[7%]">CANT.</th><th class="py-1 px-1.5 w-[8%]">UM</th><th class="py-1 px-2 text-left w-[56%]">DESCRIPCIÓN</th><th class="py-1 px-1.5 w-[10%] text-right">V/U</th><th class="py-1 px-1.5 w-[10%] text-right">P/U</th><th class="py-1 px-2 w-[10%] text-right">IMPORTE</th></tr></thead><tbody class="divide-y divide-neutral-200">${filasItems}<tr class="h-5"><td colspan="6"></td></tr><tr class="h-5"><td colspan="6"></td></tr><tr class="h-5"><td colspan="6"></td></tr><tr class="h-5"><td colspan="6"></td></tr><tr class="h-5"><td colspan="6"></td></tr></tbody><tfoot><tr><td colspan="5" class="text-right font-bold py-0.5">SUBTOTAL</td><td class="text-right font-bold py-0.5 pr-2">S/ ${gravada.toFixed(2)}</td></tr><tr><td colspan="5" class="text-right font-bold py-0.5">IGV ${(igvRate||18).toFixed(2)} %</td><td class="text-right font-bold py-0.5 pr-2">S/ ${igv.toFixed(2)}</td></tr><tr><td colspan="5" class="text-right font-bold py-0.5 border-t border-neutral-300">TOTAL</td><td class="text-right font-bold py-0.5 pr-2 border-t border-neutral-300 text-[10px]">S/ ${total.toFixed(2)}</td></tr></tfoot></table></div></section><section class="space-y-2.5 mb-5"><div class="border-[1.5px] border-neutral-400 rounded-lg px-3 py-1.5 text-center text-[9px] font-bold">IMPORTE EN LETRAS : ${numeroALetras(total)} SOLES</div>${xmlUrl ? `<div class="flex justify-center"><a href="${xmlUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center px-3 py-1.5 rounded-lg border border-blue-500 text-blue-700 text-[9px] font-bold hover:bg-blue-50">Descargar XML</a></div>` : ''}</section></div><footer class="border-[1.5px] border-neutral-400 rounded-xl p-3 flex justify-between items-center"><div class="w-[74%] space-y-1.5 text-[8.5px]"><p>Representación impresa de la <span class="font-bold">${titulo}</span></p><p class="font-bold">Autorizado mediante Resolución de Intendencia</p></div><div class="w-[24%] flex justify-end"><div class="qr-container flex items-center justify-center">${qrDataUrl?'<img src="'+qrDataUrl+'" style="width:98px;height:98px" />':''}</div></div></footer></main></body></html>`;
  };

  const imprimirPorNavegador = (venta: Sale, numeroTicket?: number) => {
    const ventanaImpresion = window.open('', 'PRINT', 'height=800,width=400');
    if (ventanaImpresion) {
      ventanaImpresion.document.write(generarBoletaHTML(venta, false, numeroTicket));
      ventanaImpresion.document.close();
      ventanaImpresion.focus();
      setTimeout(() => {
        ventanaImpresion.print();
      }, 200);
    }
  };

  const formatearProductoTicketHTML = (item: any) => {
    const cantidad = item.product.type === 'peso' 
      ? formatearPeso(item.quantity)
      : item.product.type === 'metro'
        ? formatLength(item.quantity)
        : `${item.quantity}`;
    const precio = (item.product.salePrice || 0).toFixed(2);
    let totalItem: number;
    if (item.product.type === 'peso') {
      totalItem = (item.product.salePricePerKg || 0) * (item.quantity / 1000);
    } else if (item.product.type === 'metro') {
      totalItem = (item.product.salePrice || 0) * (item.quantity / 100);
    } else {
      totalItem = (item.product.salePrice || 0) * item.quantity;
    }
    const nombre = escapeHtml((item.product.name || '').substring(0, 18));
    const nivel = item.selectedLevelName ? ` (${escapeHtml(item.selectedLevelName)})` : '';
    const linea = `${cantidad} x ${nombre}${nivel}`;
    const dots = '.'.repeat(Math.max(1, 28 - linea.length));
    return `
      <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 600; line-height: 1.5;">
        <span>${linea}</span>
        <span>${dots} S/ ${totalItem.toFixed(2).padStart(7)}</span>
      </div>
    `;
  };

  const imprimirTicket = async (venta: Sale, numeroTicket?: number) => {
    if (useQzPrint) {
      try {
        const printers = qzConnected ? qzPrinters : await conectarQZTray();
        if (printers.length === 0) throw new Error('QZ Tray no conectado');
        const printerName = selectedQzPrinter || printers[0];
        if (!printerName) throw new Error('No hay impresora seleccionada');
        const htmlData = generarBoletaHTML(venta, false, numeroTicket);
        const config = qz.configs.create(printerName, {
          orientation: 0,
          paperSize: { width: '80mm', height: 'auto' }
        });
        const data = [{ type: 'html', format: 'plain', data: htmlData }];
        await qz.print(config, data);
        toast({ title: "Boleta impresa", description: "Impresión directa exitosa" });
      } catch (e) {
        toast({
          title: "Error de impresión directa",
          description: "Usando impresión por navegador",
          variant: "destructive"
        });
        imprimirPorNavegador(venta, numeroTicket);
      }
    } else {
      imprimirPorNavegador(venta, numeroTicket);
    }
  };

  const buscarProductoPorNombre = (name: string, excludeId?: string): Product | undefined => {
    const normalizado = name.trim().toLowerCase();
    return products.find(p => p.id !== excludeId && p.name.trim().toLowerCase() === normalizado);
  };

  const agregarProducto = async () => {
    if (!newProduct.name || newProduct.salePrice <= 0 || newProduct.purchasePrice <= 0 || newProduct.stock <= 0) {
      toast({
        title: "Datos incompletos",
        description: "Completa todos los campos del producto",
        variant: "destructive"
      });
      return;
    }
    if (newProduct.purchasePrice >= newProduct.salePrice) {
      toast({ title: "Precios inválidos", description: "El precio de compra debe ser menor al precio de venta", variant: "destructive" });
      return;
    }
    const duplicado = buscarProductoPorNombre(newProduct.name);
    if (duplicado) {
      toast({
        title: "Producto ya existe",
        description: `Ya existe "${duplicado.name}" (${duplicado.saleLevels?.length ? 'Mayorista' : 'General'}). Edítalo en vez de crear uno nuevo.`,
        variant: "destructive"
      });
      return;
    }

    let imageUrl: string | undefined = undefined;
    const nuevoProductoId = generateId();

    setCargando('Guardando producto…');
    if (newProductImage) {
      try {
        imageUrl = await uploadProductImage(newProductImage, nuevoProductoId);
      } catch (error) {
        setCargando(null);
        toast({
          title: "Error al procesar imagen",
          description: "Ocurrió un error al procesar la imagen.",
          variant: "destructive"
        });
        return;
      }
    }

    const producto: Product = {
      id: nuevoProductoId,
      name: newProduct.name,
      purchasePrice: newProduct.purchasePrice,
      salePrice: newProduct.salePrice,
      stock: newProduct.stock,
      initialStock: newProduct.stock,
      category: newProduct.category,
      type: 'unidad',
      imageUrl
    };

    const updatedProducts = [...products, producto];
    const updatedHistory = [...stockHistory, {
      id: generateId(),
      productId: producto.id,
      productName: producto.name,
      type: 'initial' as const,
      quantity: producto.initialStock ?? producto.stock,
      resultingStock: producto.stock,
      date: new Date().toISOString()
    }];
    addPendingId(PENDING.PRODUCTS, producto.id);
    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    setStockHistory(updatedHistory);
    safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
    addPendingId(PENDING.HISTORY, updatedHistory[updatedHistory.length - 1].id);
    // El historial se sube cuando el producto ya tiene su id real en la base:
    // el movimiento apunta al producto por id y el temporal todavia no existe.
    void syncProductsToFirestore(updatedProducts).then(() => syncHistoryToFirestore(updatedHistory));
    setCargando(null);
    
    setNewProduct({ name: '', purchasePrice: 0, salePrice: 0, stock: 0, category: '' });
    setIsAddProductOpen(false);
    setNewProductImage(null);
    setNewProductImagePreview('');
    
    toast({
      title: "Producto agregado",
      description: `${producto.name} agregado al inventario`,
    });
  };

  const editarProducto = (product: Product) => {
    if (product.type === 'peso') {
      const purchasePriceToUse = product.purchasePrice ?? product.purchasePricePerKg ?? 0;
      const salePriceToUse = product.salePrice ?? product.salePricePerKg ?? 0;
      setEditingWeightProduct({
        ...product,
        purchasePrice: purchasePriceToUse,
        salePrice: salePriceToUse,
        purchasePricePerKg: purchasePriceToUse,
        salePricePerKg: salePriceToUse
      });
      setEditPurchasePerKgInput(purchasePriceToUse.toFixed(2));
      setEditSalePerKgInput(salePriceToUse.toFixed(2));
      setIsEditWeightProductOpen(true);
    } else if (product.type === 'metro') {
      setEditingMetroProduct(product);
      setEditMetroPurchaseInput((product.purchasePrice || 0).toFixed(2));
      setEditMetroSaleInput((product.salePrice || 0).toFixed(2));
      setEditMetroStockInput((product.stock / 100).toFixed(2));
      setEditProductImage(null);
      setEditProductImagePreview(product.imageUrl || '');
      setIsEditMetroProductOpen(true);
    } else if (product.type === 'unidad' && product.saleLevels && product.saleLevels.length > 0) {
      editarProductoMayorista(product);
    } else {
      setEditingProduct(product);
      setIsEditProductOpen(true);
    }
  };

  const [editingMayoristaProduct, setEditingMayoristaProduct] = useState<Product | null>(null);
  const [isEditMayoristaOpen, setIsEditMayoristaOpen] = useState(false);
  const [editMayoristaName, setEditMayoristaName] = useState('');
  const [editMayoristaCategory, setEditMayoristaCategory] = useState('');
  const [editMayoristaLevels, setEditMayoristaLevels] = useState<SaleLevel[]>([]);
  const [editLevelStockInput, setEditLevelStockInput] = useState('');
  const [editLevelDropdown, setEditLevelDropdown] = useState('Paquete');
  const [editLevelCustomName, setEditLevelCustomName] = useState('');
  const [editLevelContains, setEditLevelContains] = useState('');
  const [editLevelPurchasePrice, setEditLevelPurchasePrice] = useState('');
  const [editLevelSalePrice, setEditLevelSalePrice] = useState('');
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [editLevelTempStock, setEditLevelTempStock] = useState('');
  const [editLevelTempSalePrice, setEditLevelTempSalePrice] = useState('');
  const [editLevelTempPurchasePrice, setEditLevelTempPurchasePrice] = useState('');

  const editarProductoMayorista = (product: Product) => {
    setEditingMayoristaProduct(product);
    setEditMayoristaName(product.name);
    setEditMayoristaCategory(product.category);
    setEditMayoristaLevels(product.saleLevels ? [...product.saleLevels].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; }) : []);
    setEditLevelDropdown('');
    setEditLevelContains('');
    setEditLevelPurchasePrice('');
    setEditLevelSalePrice('');
    setEditLevelStockInput('');
    setEditingLevelId(null);
    setEditLevelTempStock('');
    setEditLevelTempSalePrice('');
    setEditLevelTempPurchasePrice('');
    setIsEditMayoristaOpen(true);
  };

  const guardarEdicionMayorista = async () => {
    if (!editingMayoristaProduct) return;
    if (!editMayoristaName.trim()) {
      toast({ title: "Nombre requerido", description: "El nombre del producto no puede estar vacío", variant: "destructive" });
      return;
    }
    if (editMayoristaLevels.length === 0) {
      toast({ title: "Niveles requeridos", description: "Agrega al menos un nivel de venta", variant: "destructive" });
      return;
    }

    const hasSales = stockHistory.some(h => h.productId === editingMayoristaProduct.id && h.type === 'sale');
    const originalLevels = editingMayoristaProduct.saleLevels || [];

    if (hasSales) {
      const stockChanged = editMayoristaLevels.some(lvl => {
        const original = originalLevels.find(o => o.name === lvl.name);
        return original && original.stock !== lvl.stock;
      });
      if (stockChanged) {
        toast({ title: "Stock bloqueado", description: "No puedes editar el stock después de haber ventas. Usa 'Restock' en el Historial de Stock para ajustar el inventario.", variant: "destructive" });
        return;
      }
    }

    if (editingLevelId) {
      const lvl = editMayoristaLevels.find(l => l.id === editingLevelId);
      if (lvl) {
        const hasUnidadE = editMayoristaLevels.some(l => l.name === 'Unidad');
        const stockEditable = lvl.name === 'Unidad' || !hasUnidadE;
        const newStock = stockEditable ? parseInt(editLevelTempStock) : lvl.stock;
        const newSP = parseFloat(editLevelTempSalePrice);
        const newPP = parseFloat(editLevelTempPurchasePrice);
        if (!isNaN(newSP) && !isNaN(newPP) && (!stockEditable || (!isNaN(newStock) && newStock >= 0))) {
          const updatedLevels = editMayoristaLevels.map(l =>
            l.id === editingLevelId
              ? { ...l, stock: newStock, salePrice: newSP, purchasePrice: newPP }
              : l
          );
          setEditMayoristaLevels(updatedLevels);
          setEditingLevelId(null);
        }
      }
    }

    let imageUrl = editingMayoristaProduct.imageUrl;

    if (editProductImage) {
      try {
        imageUrl = await uploadProductImage(editProductImage, editingMayoristaProduct.id);
      } catch (error) {
        toast({
          title: "Error al procesar imagen",
          description: "Ocurrió un error al procesar la imagen",
          variant: "destructive"
        });
        return;
      }
    }

    const sortedLevels = [...editMayoristaLevels].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; });
    const hasUnidad = sortedLevels.some(l => l.name === 'Unidad');
    let totalUnits: number;
    if (hasUnidad) {
      const unidadLevel = sortedLevels.find(l => l.name === 'Unidad')!;
      totalUnits = sortedLevels.reduce((sum, l) => sum + l.stock * l.baseUnitsContained, 0);
    } else {
      totalUnits = sortedLevels.reduce((sum, l) => sum + l.stock * l.baseUnitsContained, 0);
    }
    const minLevel = sortedLevels.find(l => l.name === 'Unidad') || sortedLevels[0];
    const updatedProducts = products.map(p =>
      p.id === editingMayoristaProduct.id ? {
        ...p,
        name: editMayoristaName.trim(),
        category: editMayoristaCategory.trim(),
        saleLevels: sortedLevels.map(l => ({ ...l, initialStock: l.stock })),
        purchasePrice: minLevel?.purchasePrice || 0,
        salePrice: minLevel?.salePrice || 0,
        baseUnit: minLevel?.name || '',
        unitsPerBase: minLevel?.baseUnitsContained || 1,
        stock: totalUnits,
        initialStock: totalUnits,
        imageUrl,
        type: 'mayorista'
      } : p
    ) as Product[];
    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    addPendingId(PENDING.PRODUCTS, editingMayoristaProduct.id);
    syncProductsToFirestore(updatedProducts);

    if (!hasSales) {
      const levelStockAfterMap = sortedLevels.reduce((acc, l) => ({ ...acc, [l.name]: l.stock }), {});
      const updatedHistory = stockHistory.map(item =>
        item.productId === editingMayoristaProduct.id && item.type === 'initial'
          ? { ...item, quantity: totalUnits, resultingStock: totalUnits, levelStockAfter: levelStockAfterMap, levelQuantities: levelStockAfterMap }
          : item
      );
      if (JSON.stringify(updatedHistory) !== JSON.stringify(stockHistory)) {
        setStockHistory(updatedHistory);
        safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
        const inicialEditado = updatedHistory.find(x => x.productId === editingMayoristaProduct.id && x.type === 'initial');
        if (inicialEditado) addPendingId(PENDING.HISTORY, inicialEditado.id);
        syncHistoryToFirestore(updatedHistory);
      }
    }

    setIsEditMayoristaOpen(false);
    setEditingMayoristaProduct(null);
    setEditProductImage(null);
    setEditProductImagePreview('');
    toast({
      title: "Producto mayorista actualizado",
      description: "Los cambios se guardaron correctamente",
    });
  };

  const guardarEdicionProductoPeso = async () => {
    if (!editingWeightProduct) return;

    if (!editingWeightProduct.name.trim()) {
      toast({ title: "Nombre requerido", description: "El nombre del producto no puede estar vacío", variant: "destructive" });
      return;
    }
    if ((editingWeightProduct.salePrice ?? editingWeightProduct.salePricePerKg ?? 0) <= 0) {
      toast({ title: "Precio de venta inválido", description: "Debe ser mayor a 0", variant: "destructive" });
      return;
    }
    if ((editingWeightProduct.purchasePrice ?? editingWeightProduct.purchasePricePerKg ?? 0) <= 0) {
      toast({ title: "Precio de compra inválido", description: "Debe ser mayor a 0", variant: "destructive" });
      return;
    }
    if ((editingWeightProduct.equivalentGrams ?? 0) <= 0) {
      toast({ title: "Gramos equivalentes inválidos", description: "Deben ser mayores a 0", variant: "destructive" });
      return;
    }
    if ((editingWeightProduct.minWeightGrams ?? 0) <= 0) {
      toast({ title: "Peso mínimo inválido", description: "Debe ser mayor a 0", variant: "destructive" });
      return;
    }
    if ((editingWeightProduct.purchasePrice ?? editingWeightProduct.purchasePricePerKg ?? 0) >= (editingWeightProduct.salePrice ?? editingWeightProduct.salePricePerKg ?? 0)) {
      toast({ title: "Precios inválidos", description: "El precio de compra debe ser menor al precio de venta", variant: "destructive" });
      return;
    }

    const oldProduct = products.find(p => p.id === editingWeightProduct.id);
    const hasSales = stockHistory.some(h => h.productId === editingWeightProduct.id && h.type === 'sale');
    if (hasSales && oldProduct && oldProduct.stock !== editingWeightProduct.stock) {
      toast({ title: "Stock bloqueado", description: "No puedes editar el stock después de haber ventas. Usa 'Restock' en el Historial de Stock para ajustar el inventario.", variant: "destructive" });
      return;
    }

    let imageUrl = editingWeightProduct.imageUrl;

    if (editProductImage) {
      try {
        imageUrl = await uploadProductImage(editProductImage, editingWeightProduct.id);
      } catch (error) {
        toast({
          title: "Error al procesar imagen",
          description: "Ocurrió un error al procesar la imagen",
          variant: "destructive"
        });
        return;
      }
    }

    const updatedProduct = { 
      ...editingWeightProduct, 
      imageUrl,
      purchasePrice: editingWeightProduct.purchasePrice ?? editingWeightProduct.purchasePricePerKg ?? 0,
      salePrice: editingWeightProduct.salePrice ?? editingWeightProduct.salePricePerKg ?? 0,
      purchasePricePerKg: editingWeightProduct.purchasePrice ?? editingWeightProduct.purchasePricePerKg ?? 0,
      salePricePerKg: editingWeightProduct.salePrice ?? editingWeightProduct.salePricePerKg ?? 0
    };

    if (oldProduct) {
      const oldSP = oldProduct.salePrice ?? oldProduct.salePricePerKg ?? 0;
      const newSP = updatedProduct.salePrice ?? updatedProduct.salePricePerKg ?? 0;
      const oldPP = oldProduct.purchasePrice ?? oldProduct.purchasePricePerKg ?? 0;
      const newPP = updatedProduct.purchasePrice ?? updatedProduct.purchasePricePerKg ?? 0;
      if (oldSP !== newSP || oldPP !== newPP) {
        const priceChangeEntry: StockHistoryItem = {
          id: generateId(),
          productId: editingWeightProduct.id,
          productName: editingWeightProduct.name,
          type: 'price_change',
          quantity: 0,
          resultingStock: 0,
          date: new Date().toISOString(),
          priceChanges: [{
            levelName: 'Peso',
            oldSalePrice: oldSP,
            newSalePrice: newSP,
            oldPurchasePrice: oldPP,
            newPurchasePrice: newPP
          }]
        };
        const updatedHistory = [...stockHistory, priceChangeEntry];
        setStockHistory(updatedHistory);
        safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
        addPendingId(PENDING.HISTORY, priceChangeEntry.id);
        syncHistoryToFirestore(updatedHistory);
      }
    }

    const updatedProducts = products.map(p => 
      p.id === editingWeightProduct.id ? updatedProduct : p
    );
    
    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    addPendingId(PENDING.PRODUCTS, editingWeightProduct.id);
    syncProductsToFirestore(updatedProducts);
    setIsEditWeightProductOpen(false);
    setEditingWeightProduct(null);
    setEditProductImage(null);
    setEditProductImagePreview('');
    
    toast({
      title: "Producto actualizado",
      description: "Los cambios se guardaron correctamente",
    });
  };

  const guardarEdicionProductoMetro = async () => {
    if (!editingMetroProduct) return;

    const purchasePrice = parseFloat(normalizeDecimalInput(editMetroPurchaseInput));
    const salePrice = parseFloat(normalizeDecimalInput(editMetroSaleInput));
    const stockCm = Math.round((parseFloat(normalizeDecimalInput(editMetroStockInput)) || 0) * 100);

    if (!editingMetroProduct.name.trim()) {
      toast({ title: "Nombre requerido", description: "El nombre del producto no puede estar vacío", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
      toast({ title: "Precio de compra inválido", description: "Debe ser mayor a 0", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      toast({ title: "Precio de venta inválido", description: "Debe ser mayor a 0", variant: "destructive" });
      return;
    }
    if (purchasePrice >= salePrice) {
      toast({ title: "Precios inválidos", description: "El precio de compra debe ser menor al precio de venta", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(stockCm) || stockCm < 0) {
      toast({ title: "Stock inválido", description: "El stock no puede ser negativo", variant: "destructive" });
      return;
    }

    const oldProduct = products.find(p => p.id === editingMetroProduct.id);
    const hasSales = stockHistory.some(h => h.productId === editingMetroProduct.id && h.type === 'sale');
    if (hasSales && oldProduct && oldProduct.stock !== stockCm) {
      toast({ title: "Stock bloqueado", description: "No puedes editar el stock después de haber ventas. Usa 'Restock' en el Historial de Stock para ajustar el inventario.", variant: "destructive" });
      return;
    }

    let imageUrl = editingMetroProduct.imageUrl;

    if (editProductImage) {
      try {
        imageUrl = await uploadProductImage(editProductImage, editingMetroProduct.id);
      } catch (error) {
        toast({
          title: "Error al procesar imagen",
          description: "Ocurrió un error al procesar la imagen",
          variant: "destructive"
        });
        return;
      }
    }

    const updatedProduct: Product = {
      ...editingMetroProduct,
      imageUrl,
      purchasePrice,
      salePrice,
      stock: stockCm,
      initialStock: hasSales ? editingMetroProduct.initialStock : stockCm,
    };

    if (oldProduct) {
      const oldSP = oldProduct.salePrice ?? 0;
      const newSP = updatedProduct.salePrice ?? 0;
      const oldPP = oldProduct.purchasePrice ?? 0;
      const newPP = updatedProduct.purchasePrice ?? 0;
      if (oldSP !== newSP || oldPP !== newPP) {
        const priceChangeEntry: StockHistoryItem = {
          id: generateId(),
          productId: editingMetroProduct.id,
          productName: editingMetroProduct.name,
          type: 'price_change',
          quantity: 0,
          resultingStock: 0,
          date: new Date().toISOString(),
          priceChanges: [{
            levelName: 'Metro',
            oldSalePrice: oldSP,
            newSalePrice: newSP,
            oldPurchasePrice: oldPP,
            newPurchasePrice: newPP
          }]
        };
        const updatedHistory = [...stockHistory, priceChangeEntry];
        setStockHistory(updatedHistory);
        safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
        addPendingId(PENDING.HISTORY, priceChangeEntry.id);
        syncHistoryToFirestore(updatedHistory);
      }
    }

    const updatedProducts = products.map(p =>
      p.id === editingMetroProduct.id ? updatedProduct : p
    );

    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    addPendingId(PENDING.PRODUCTS, editingMetroProduct.id);
    syncProductsToFirestore(updatedProducts);
    setIsEditMetroProductOpen(false);
    setEditingMetroProduct(null);
    setEditProductImage(null);
    setEditProductImagePreview('');

    toast({
      title: "Producto actualizado",
      description: "Los cambios se guardaron correctamente",
    });
  };

  const guardarEdicionProducto = async () => {
    if (!editingProduct) return;

    if (!editingProduct.name.trim()) {
      toast({ title: "Nombre requerido", description: "El nombre del producto no puede estar vacío", variant: "destructive" });
      return;
    }
    if (editingProduct.salePrice <= 0 || editingProduct.purchasePrice <= 0) {
      toast({ title: "Precios inválidos", description: "Los precios deben ser mayores a 0", variant: "destructive" });
      return;
    }
    if (editingProduct.purchasePrice >= editingProduct.salePrice) {
      toast({ title: "Precios inválidos", description: "El precio de compra debe ser menor al precio de venta", variant: "destructive" });
      return;
    }
    if (typeof editingProduct.stock !== 'number' || !Number.isFinite(editingProduct.stock) || editingProduct.stock < 0) {
      toast({ title: "Stock inválido", description: "El stock no puede ser negativo", variant: "destructive" });
      return;
    }

    const oldProduct = products.find(p => p.id === editingProduct.id);
    const hasSales = stockHistory.some(h => h.productId === editingProduct.id && h.type === 'sale');
    if (hasSales && oldProduct && oldProduct.stock !== editingProduct.stock) {
      toast({ title: "Stock bloqueado", description: "No puedes editar el stock después de haber ventas. Usa 'Restock' en el Historial de Stock para ajustar el inventario.", variant: "destructive" });
      return;
    }

    let imageUrl = editingProduct.imageUrl;

    if (editProductImage) {
      try {
        imageUrl = await uploadProductImage(editProductImage, editingProduct.id);
      } catch (error) {
        toast({
          title: "Error al procesar imagen",
          description: "Ocurrió un error al procesar la imagen",
          variant: "destructive"
        });
        return;
      }
    }

    const updatedProduct = { ...editingProduct, imageUrl };

    if (oldProduct) {
      const oldSP = oldProduct.salePrice ?? 0;
      const newSP = editingProduct.salePrice ?? 0;
      const oldPP = oldProduct.purchasePrice ?? 0;
      const newPP = editingProduct.purchasePrice ?? 0;
      if (oldSP !== newSP || oldPP !== newPP) {
        const priceChangeEntry: StockHistoryItem = {
          id: generateId(),
          productId: editingProduct.id,
          productName: editingProduct.name,
          type: 'price_change',
          quantity: 0,
          resultingStock: 0,
          date: new Date().toISOString(),
          priceChanges: [{
            levelName: 'Unidad',
            oldSalePrice: oldSP,
            newSalePrice: newSP,
            oldPurchasePrice: oldPP,
            newPurchasePrice: newPP
          }]
        };
        const updatedHistory = [...stockHistory, priceChangeEntry];
        setStockHistory(updatedHistory);
        safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
        addPendingId(PENDING.HISTORY, priceChangeEntry.id);
        syncHistoryToFirestore(updatedHistory);
      }
    }

    const updatedProducts = products.map(p => 
      p.id === editingProduct.id ? updatedProduct : p
    );
    
    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    addPendingId(PENDING.PRODUCTS, editingProduct.id);
    syncProductsToFirestore(updatedProducts);
    setIsEditProductOpen(false);
    setEditingProduct(null);
    setEditProductImage(null);
    setEditProductImagePreview('');
    
    toast({
      title: "Producto actualizado",
      description: "Los cambios se guardaron correctamente",
    });
  };

  const verProductoMayorista = (product: Product) => {
    setViewingMayoristaProduct(product);
    setInfoLevelTab(0);
    setIsViewMayoristaProductOpen(true);
  };

  const eliminarProducto = async (productId: string) => {
    const inCart = currentSale.some(item => item.product.id === productId);
    if (inCart) {
      setCurrentSale(currentSale.filter(item => item.product.id !== productId));
    }
    removePendingId(PENDING.PRODUCTS, productId);
    try { await deleteProduct(productId); } catch (e) { console.error('ERROR eliminarProducto:', e); }
    const updatedProducts = products.filter(p => p.id !== productId);
    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    syncProductsToFirestore(updatedProducts);
    const updatedHistory = stockHistory.filter(h => h.productId !== productId);
    setStockHistory(updatedHistory);
    safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
    syncHistoryToFirestore(updatedHistory);
    
    toast({
      title: "Producto eliminado",
      description: "El producto se eliminó del inventario",
    });
  };

  const deleteSelectedProducts = async () => {
    if (!(await esAdminActual())) {
      toast({
        title: "Sin permiso",
        description: "Solo un administrador puede eliminar productos",
        variant: "destructive"
      });
      return;
    }

    const inCartIds = selectedProductsToDelete.filter(id => currentSale.some(item => item.product.id === id));
    if (inCartIds.length > 0) {
      setCurrentSale(currentSale.filter(item => !selectedProductsToDelete.includes(item.product.id)));
    }
    selectedProductsToDelete.forEach(id => removePendingId(PENDING.PRODUCTS, id));
    await Promise.all(selectedProductsToDelete.map(id => deleteProduct(id).catch(e => console.error('ERROR deleteProduct:', e))));
    const updatedProducts = products.filter(p => !selectedProductsToDelete.includes(p.id));
    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    syncProductsToFirestore(updatedProducts);
    const updatedHistory = stockHistory.filter(h => !selectedProductsToDelete.includes(h.productId));
    setStockHistory(updatedHistory);
    safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
    syncHistoryToFirestore(updatedHistory);
    
    setSelectedProductsToDelete([]);
    setIsDeleteMode(false);
    setIsDeleteConfirmOpen(false);
    
    toast({
      title: "Productos eliminados",
      description: `${selectedProductsToDelete.length} productos han sido eliminados del inventario`,
    });
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;

    if (!(await esAdminActual())) {
      toast({
        title: "Sin permiso",
        description: "Solo un administrador puede eliminar productos",
        variant: "destructive"
      });
      return;
    }

    const inCart = currentSale.some(item => item.product.id === productToDelete.id);
    if (inCart) {
      setCurrentSale(currentSale.filter(item => item.product.id !== productToDelete.id));
    }
    removePendingId(PENDING.PRODUCTS, productToDelete.id);
    setCargando('Eliminando producto…');
    try { await deleteProduct(productToDelete.id); } catch (e) { console.error('ERROR confirmDeleteProduct:', e); }
    const updatedProducts = products.filter(p => p.id !== productToDelete.id);
    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    syncProductsToFirestore(updatedProducts);
    const updatedHistory = stockHistory.filter(h => h.productId !== productToDelete.id);
    setStockHistory(updatedHistory);
    safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
    syncHistoryToFirestore(updatedHistory);
    setCargando(null);
    
    setIsDeleteProductConfirmOpen(false);
    setProductToDelete(null);

    toast({
      title: "Producto eliminado",
      description: "El producto se eliminó del inventario",
    });
  };

  const saveQuickEdit = () => {
    if (!editingQuickProduct) return;

    if (!editingQuickProduct.name.trim()) {
      toast({ title: "Nombre requerido", description: "El nombre del producto no puede estar vacío", variant: "destructive" });
      return;
    }
    if (editingQuickProduct.salePrice <= 0 || editingQuickProduct.purchasePrice <= 0) {
      toast({ title: "Precios inválidos", description: "Los precios deben ser mayores a 0", variant: "destructive" });
      return;
    }
    if (editingQuickProduct.purchasePrice >= editingQuickProduct.salePrice) {
      toast({ title: "Precios inválidos", description: "El precio de compra debe ser menor al precio de venta", variant: "destructive" });
      return;
    }
    if (typeof editingQuickProduct.stock !== 'number' || !Number.isFinite(editingQuickProduct.stock) || editingQuickProduct.stock < 0) {
      toast({ title: "Stock inválido", description: "El stock no puede ser negativo", variant: "destructive" });
      return;
    }

    const updatedProducts = products.map(p => 
      p.id === editingQuickProduct.id ? editingQuickProduct : p
    );
    
    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    addPendingId(PENDING.PRODUCTS, editingQuickProduct.id);
    syncProductsToFirestore(updatedProducts);
    setIsEditQuickProductOpen(false);
    setEditingQuickProduct(null);
    
    toast({
      title: "Producto actualizado",
      description: "Los cambios se guardaron correctamente",
    });
  };

  const limpiarFormularioPeso = () => {
    setNewWeightProduct({ 
      name: "", 
      purchasePrice: 0,
      salePrice: 0,
      purchasePricePerKg: 0, 
      salePricePerKg: 0, 
      equivalentGrams: 0, 
      stock: 0, 
      initialStock: 0,
      minWeightGrams: 0, 
      category: "" 
    });
    setPurchasePerKgInput('');
    setSalePerKgInput('');
    setEquivalentGramsInput('');
    setEquivalentGramsError('');
    setMinWeightInput('');
    setMinWeightError('');
  };

  const limpiarFormularioMetro = () => {
    setNewMetroProduct({ name: "", purchasePrice: 0, salePrice: 0, initialStockCm: 0, category: "" });
    setMetroPurchaseInput('');
    setMetroSaleInput('');
    setMetroStockInput('');
  };

  const limpiarFormularioMayorista = () => {
    setNewMayoristaProduct({
      name: '',
      category: '',
      initialStock: 0
    });
    setNewMayoristaLevels([]);
    setNewLevelDropdown('Paquete');
    setNewLevelContains('');
    setNewLevelPurchasePrice('');
    setNewLevelSalePrice('');
    setNewLevelStockInput('');
  };

  const limpiarFormularioAgregarProducto = () => {
    setNewProduct({ name: '', purchasePrice: 0, salePrice: 0, stock: 0, category: '' });
    setUnitPurchaseInput('');
    setUnitSaleInput('');
    limpiarFormularioPeso();
    limpiarFormularioMetro();
    limpiarFormularioMayorista();
    setNewProductImage(null);
    setNewProductImagePreview('');
  };

  const agregarProductoMayorista = async () => {
    if (isMayoristaFormInvalid) {
      toast({
        title: "Datos incompletos",
        description: "Completa correctamente todos los campos y agrega al menos un nivel de venta.",
        variant: "destructive"
      });
      return;
    }
    const duplicadoMayorista = buscarProductoPorNombre(newMayoristaProduct.name);
    if (duplicadoMayorista) {
      toast({
        title: "Producto ya existe",
        description: `Ya existe "${duplicadoMayorista.name}" (${duplicadoMayorista.saleLevels?.length ? 'Mayorista' : 'General'}). Edítalo en vez de crear uno nuevo.`,
        variant: "destructive"
      });
      return;
    }

    let imageUrl: string | undefined = undefined;
    const tempId = Date.now().toString();

    setCargando('Guardando producto…');
    if (newProductImage) {
      try {
        imageUrl = await uploadProductImage(newProductImage, tempId);
      } catch (error) {
        setCargando(null);
        toast({
          title: "Error al procesar imagen",
          description: "Ocurrió un error al procesar la imagen.",
          variant: "destructive"
        });
        return;
      }
    }

    const sortedLevels = [...newMayoristaLevels].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; });
    const hasUnidad = sortedLevels.some(l => l.name === 'Unidad');
    let totalUnits: number;
    let initialTotalUnits: number;
    let productType: 'mayorista' | 'unidad' = 'mayorista';
    if (hasUnidad) {
      const unidadLevel = sortedLevels.find(l => l.name === 'Unidad')!;
      totalUnits = sortedLevels.reduce((sum, l) => sum + l.stock * l.baseUnitsContained, 0);
      initialTotalUnits = sortedLevels.reduce((sum, l) => sum + l.initialStock * l.baseUnitsContained, 0);
    } else {
      totalUnits = sortedLevels.reduce((sum, l) => sum + l.stock * l.baseUnitsContained, 0);
      initialTotalUnits = sortedLevels.reduce((sum, l) => sum + l.initialStock * l.baseUnitsContained, 0);
    }
    productType = 'mayorista';
    const minLevel = sortedLevels.find(l => l.name === 'Unidad') || sortedLevels[0];

    const productToAdd: Product = {
      id: tempId,
      name: newMayoristaProduct.name.trim(),
      purchasePrice: minLevel.purchasePrice,
      salePrice: minLevel.salePrice,
      stock: totalUnits,
      initialStock: initialTotalUnits,
      category: newMayoristaProduct.category.trim(),
      type: productType,
      imageUrl,
      baseUnit: minLevel.name,
      unitsPerBase: minLevel.baseUnitsContained,
      saleLevels: sortedLevels
    };

    const updatedProducts = [...products, productToAdd];
    const levelDescText = sortedLevels
      .filter(l => l.initialStock > 0)
      .map(l => `${l.initialStock} ${l.name}${l.initialStock > 1 ? 's' : ''} (${l.baseUnitsContained} unid. c/u)`)
      .join(', ');
    const updatedHistory = [...stockHistory, {
      id: generateId(),
      productId: productToAdd.id,
      productName: productToAdd.name,
      type: 'initial' as const,
      quantity: productToAdd.initialStock ?? productToAdd.stock,
      resultingStock: productToAdd.stock,
      date: new Date().toISOString(),
      isInitial: true,
      levelQuantities: sortedLevels.reduce((acc, l) => ({ ...acc, [l.name]: l.initialStock }), {}),
      levelDescription: `stock inicial: ${levelDescText}`,
      levelStockAfter: sortedLevels.reduce((acc, l) => ({ ...acc, [l.name]: l.initialStock }), {})
    }];
    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    addPendingId(PENDING.PRODUCTS, productToAdd.id);
    setStockHistory(updatedHistory);
    safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
    addPendingId(PENDING.HISTORY, updatedHistory[updatedHistory.length - 1].id);
    // El historial se sube cuando el producto ya tiene su id real en la base:
    // el movimiento apunta al producto por id y el temporal todavia no existe.
    void syncProductsToFirestore(updatedProducts).then(() => syncHistoryToFirestore(updatedHistory));
    setCargando(null);
    
    limpiarFormularioAgregarProducto();
    setIsAddProductOpen(false);
    
    toast({
      title: "Producto agregado",
      description: `${productToAdd.name} agregado al inventario`,
    });
  };

  const agregarProductoPeso = async () => {
    if (isWeightFormInvalid) {
      toast({
        title: "Datos incompletos",
        description: equivalentGramsError || minWeightError || "Completa correctamente todos los campos del producto por peso.",
        variant: "destructive"
      });
      return;
    }
    if (newWeightProduct.purchasePricePerKg >= newWeightProduct.salePricePerKg) {
      toast({ title: "Precios inválidos", description: "El precio de compra debe ser menor al precio de venta", variant: "destructive" });
      return;
    }
    const duplicadoPeso = buscarProductoPorNombre(newWeightProduct.name);
    if (duplicadoPeso) {
      toast({
        title: "Producto ya existe",
        description: `Ya existe "${duplicadoPeso.name}" (${duplicadoPeso.saleLevels?.length ? 'Mayorista' : 'General'}). Edítalo en vez de crear uno nuevo.`,
        variant: "destructive"
      });
      return;
    }

    const nuevoProductoPesoId = generateId();
    setCargando('Guardando producto…');
    let imageUrl: string | undefined = undefined;
    if (newProductImage) {
      try {
        imageUrl = await uploadProductImage(newProductImage, nuevoProductoPesoId);
      } catch (error) {
        setCargando(null);
        toast({
          title: "Error al procesar imagen",
          description: "Ocurrió un error al procesar la imagen.",
          variant: "destructive"
        });
        return;
      }
    }

    const productToAdd: Product = {
      id: nuevoProductoPesoId,
      name: newWeightProduct.name,
      purchasePrice: newWeightProduct.purchasePrice,
      salePrice: newWeightProduct.salePrice, 
      stock: newWeightProduct.initialStock, 
      initialStock: newWeightProduct.initialStock, 
      category: newWeightProduct.category,
      type: 'peso',
      imageUrl,
      purchasePricePerKg: newWeightProduct.purchasePrice,
      salePricePerKg: newWeightProduct.salePrice,
      equivalentGrams: newWeightProduct.equivalentGrams,
      minWeightGrams: newWeightProduct.minWeightGrams,
    };
    const updatedProducts = [...products, productToAdd];
    const updatedHistory = [...stockHistory, {
      id: generateId(),
      productId: productToAdd.id,
      productName: productToAdd.name,
      type: 'initial' as const,
      quantity: productToAdd.initialStock ?? productToAdd.stock,
      resultingStock: productToAdd.stock,
      date: new Date().toISOString()
    }];
    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    addPendingId(PENDING.PRODUCTS, productToAdd.id);
    setStockHistory(updatedHistory);
    safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
    addPendingId(PENDING.HISTORY, updatedHistory[updatedHistory.length - 1].id);
    // El historial se sube cuando el producto ya tiene su id real en la base:
    // el movimiento apunta al producto por id y el temporal todavia no existe.
    void syncProductsToFirestore(updatedProducts).then(() => syncHistoryToFirestore(updatedHistory));
    setCargando(null);
    limpiarFormularioAgregarProducto();
    setIsAddProductOpen(false);
    toast({
      title: "Producto por peso agregado",
      description: `${productToAdd.name} agregado al inventario`,
    });
  };

  const agregarProductoMetro = async () => {
    if (isMetroFormInvalid) {
      toast({
        title: "Datos incompletos",
        description: "Completa correctamente todos los campos del producto por metro.",
        variant: "destructive"
      });
      return;
    }
    if (newMetroProduct.purchasePrice >= newMetroProduct.salePrice) {
      toast({ title: "Precios inválidos", description: "El precio de compra debe ser menor al precio de venta", variant: "destructive" });
      return;
    }
    const duplicadoMetro = buscarProductoPorNombre(newMetroProduct.name);
    if (duplicadoMetro) {
      toast({
        title: "Producto ya existe",
        description: `Ya existe "${duplicadoMetro.name}" (${duplicadoMetro.saleLevels?.length ? 'Mayorista' : 'General'}). Edítalo en vez de crear uno nuevo.`,
        variant: "destructive"
      });
      return;
    }

    const nuevoProductoMetroId = generateId();
    setCargando('Guardando producto…');
    let imageUrl: string | undefined = undefined;
    if (newProductImage) {
      try {
        imageUrl = await uploadProductImage(newProductImage, nuevoProductoMetroId);
      } catch (error) {
        setCargando(null);
        toast({
          title: "Error al procesar imagen",
          description: "Ocurrió un error al procesar la imagen.",
          variant: "destructive"
        });
        return;
      }
    }

    const stockCm = Math.round(newMetroProduct.initialStockCm);
    const productToAdd: Product = {
      id: nuevoProductoMetroId,
      name: newMetroProduct.name.trim(),
      purchasePrice: newMetroProduct.purchasePrice,
      salePrice: newMetroProduct.salePrice,
      stock: stockCm,
      initialStock: stockCm,
      category: newMetroProduct.category.trim(),
      type: 'metro',
      imageUrl,
    };
    const updatedProducts = [...products, productToAdd];
    const updatedHistory = [...stockHistory, {
      id: generateId(),
      productId: productToAdd.id,
      productName: productToAdd.name,
      type: 'initial' as const,
      quantity: productToAdd.initialStock ?? productToAdd.stock,
      resultingStock: productToAdd.stock,
      date: new Date().toISOString()
    }];
    setProducts(updatedProducts);
    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    addPendingId(PENDING.PRODUCTS, productToAdd.id);
    setStockHistory(updatedHistory);
    safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
    addPendingId(PENDING.HISTORY, updatedHistory[updatedHistory.length - 1].id);
    // Se espera el guardado para no decir "agregado" cuando la base lo rechazo.
    const guardado = await syncProductsToFirestore(updatedProducts);
    if (guardado) await syncHistoryToFirestore(updatedHistory);
    setCargando(null);
    limpiarFormularioAgregarProducto();
    setIsAddProductOpen(false);
    if (guardado) {
      toast({
        title: "Producto por metro agregado",
        description: `${productToAdd.name} agregado al inventario`,
      });
    }
  };

  /**
   * 'crear-usuario' (la clave de servicio vive solo en el servidor). Si la
   * funcion no esta desplegada, cae en el aviso de siempre: copiar el correo
   * y darlo de alta desde el panel de Supabase.
   */
  const agregarUsuario = async () => {
    if (!newUser.name?.trim() || !newUser.email?.trim()) {
      toast({
        title: "Datos incompletos",
        description: "Completa nombre y correo del usuario",
        variant: "destructive"
      });
      return;
    }

    const errores: Record<string, string> = {};
    if (!newUser.name?.trim()) errores.name = 'Requerido';
    if (!newUser.email?.trim()) errores.email = 'Requerido';
    if (!newUser.password) {
      errores.password = 'Define una contraseña';
    } else if (newUser.password.length < 6) {
      errores.password = 'Mínimo 6 caracteres';
    }
    if (newUser.password !== confirmPassword) {
      errores.confirmPassword = 'No coincide';
    }
    setFieldErrors(errores);
    if (Object.keys(errores).length > 0) return;

    const correo = newUser.email.trim();
    setCargando('Creando usuario…');
    try {
      await crearUsuarioPorAdmin({
        email: correo,
        password: newUser.password,
        nombre: newUser.name.trim(),
        rol: newUser.role,
      });
      const actualizados = await getAllLocalUsers().catch(() => null as any);
      if (actualizados) setUsers(actualizados);
      setIsAddUserOpen(false);
      setNewUser({ password: '', name: '', role: 'empleado', email: '' });
      setConfirmPassword('');
      setFieldErrors({});
      toast({
        title: "Usuario creado",
        description: `La cuenta ${correo} ya puede iniciar sesión con la contraseña indicada.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      const inalcanzable = /failed to send|failed to fetch|not found|network|404/i.test(msg);
      try {
        if (inalcanzable) await navigator.clipboard.writeText(correo);
      } catch { /* el portapapeles puede estar bloqueado */ }
      setIsAddUserOpen(false);
      setNewUser({ password: '', name: '', role: 'empleado', email: '' });
      setConfirmPassword('');
      setFieldErrors({});
      toast({
        title: inalcanzable ? "No se pudo contactar la función" : "No se pudo crear el usuario",
        description: inalcanzable
          ? `${msg} Crea la cuenta "${correo}" en Supabase > Authentication > Users > Add user (correo copiado). El rol lo verás aquí al recargar.`
          : msg,
        variant: "destructive",
        duration: 12000,
      });
    } finally {
      setCargando(null);
    }
  };

  const editarUsuario = (user: AppUser) => {
    setEditingUser({ ...user, password: '' });
    setEditUserPassword('');
    setIsEditUserOpen(true);
  };

  const definirPasswordUsuario = async () => {
    if (!editingUser) return;
    if (editUserPassword.length < 6) {
      toast({ title: 'Contraseña muy corta', description: 'Usa al menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    setIsChangingUserPassword(true);
    setCargando('Cambiando contraseña…');
    try {
      await adminCambiarPassword(editingUser.id, editUserPassword);
      setEditUserPassword('');
      toast({
        title: 'Contraseña actualizada',
        description: `${editingUser.name} ya puede entrar con la nueva contraseña.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'No se pudo cambiar la contraseña', description: msg, variant: 'destructive' });
    } finally {
      setIsChangingUserPassword(false);
      setCargando(null);
    }
  };

  const guardarEdicionUsuario = async () => {
    if (!editingUser) return;

    const usuarioActual = getCurrentSupabaseUser();
    const miEmail = usuarioActual?.email ?? null;

    // No permitir que un admin se degrade a si mismo ni elimine el propio estado.
    if (editingUser.email === miEmail && editingUser.role !== 'admin') {
      toast({
        title: "No puedes quitar tu propio rol",
        description: "Un administrador no puede degradarse a sí mismo.",
        variant: "destructive",
      });
      return;
    }

    // Nombre y rol se guardan en la base. La contraseña la administra Supabase
    // (correo de recuperacion o panel), nunca la app.
    try {
      await updateUserProfile(editingUser.firebaseUid ?? editingUser.id, {
        displayName: editingUser.name,
        role: editingUser.role,
      });
    } catch (err: unknown) {
      console.error('Error al actualizar perfil:', err);
      toast({
        title: "No se pudo guardar",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
      return;
    }

    const actualizados = await getAllLocalUsers().catch(() => null as any);
    if (actualizados) setUsers(actualizados);
    setIsEditUserOpen(false);
    setEditingUser(null);

    toast({
      title: "Usuario actualizado",
      description: "El nombre y el rol se guardaron. La contraseña se cambia en Supabase o con el correo de recuperación.",
    });
  };

  const eliminarUsuario = async (userId: string) => {
    // Defensa doble: los administradores jamas se bloquean desde la app.
    const blanco = users.find(u => u.id === userId) ?? usuarioAEliminar;
    if (blanco?.role === 'admin') {
      toast({
        title: "Operación no permitida",
        description: "Los administradores no se pueden eliminar desde la app. Hazlo desde el panel de Supabase si es necesario.",
        variant: "destructive",
      });
      return;
    }
    try { await deleteLocalUser(userId); } catch (e) { console.error('ERROR deleteLocalUser:', e); }
    removePendingId(PENDING.USERS, userId);
    const user = users.find(u => u.id === userId) ?? usuarioAEliminar;
    if (user?.firebaseUid) {
      try {
        await deleteUserProfile(user.firebaseUid);
      } catch (err: unknown) {
        console.error('Error al eliminar perfil:', err);
      }
    }

    const actualizados = await getAllLocalUsers().catch(() => null as any);
    if (actualizados) setUsers(actualizados);
    setUsuarioAEliminar(null);

    toast({
      title: "Usuario bloqueado",
      description: `${user?.name ?? 'El empleado'} ya no puede entrar. Para quitarle el acceso por completo, bórralo también en Supabase > Authentication > Users.`,
      duration: 8000,
    });
  };

  // ===================== PESTAÑA CLIENTES =====================
  interface Serie { id: string; serie: string; tipo_documento: string; descripcion: string; activa: boolean; }
  const [clients, setClients] = useState<Cliente[]>([]);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Cliente | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Cliente | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [isConsultingRuc, setIsConsultingRuc] = useState(false);
  const [clientForm, setClientForm] = useState({
    tipoDocumento: '6',
    numeroDocumento: '',
    razonSocial: '',
    direccion: '',
    telefono: '',
    email: '',
  });

  // ===================== PESTAÑA EMITIR COMPROBANTE =====================
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [series, setSeries] = useState<Serie[]>([]);
  const [emisor, setEmisor] = useState<Emisor | null>(null);
  const [isSavingEmisor, setIsSavingEmisor] = useState(false);
  const [emisorForm, setEmisorForm] = useState({
    ruc: '', razonSocial: '', nombreComercial: '', direccion: '',
    telefono: '', email: '', igvRate: '18', redondeoEfectivo: true,
  });
  const [isEmitOpen, setIsEmitOpen] = useState(false);
  const [isEmitting, setIsEmitting] = useState(false);
  const [emitForm, setEmitForm] = useState({ ventaId: '', tipoDocumento: '03', serie: '', clienteId: '' });
  const [comprobanteAnular, setComprobanteAnular] = useState<Comprobante | null>(null);
  const [comprobantePreviewHTML, setComprobantePreviewHTML] = useState('');
  const [comprobantePreviewNumero, setComprobantePreviewNumero] = useState('');
  const [isComprobantePreviewOpen, setIsComprobantePreviewOpen] = useState(false);
  const [emitRucInput, setEmitRucInput] = useState('');
  const [isConsultandoRucEmit, setIsConsultandoRucEmit] = useState(false);
  const [emitClienteNoRegistrado, setEmitClienteNoRegistrado] = useState<{ razonSocial: string; direccion?: string } | null>(null);
  const [isConfirmarClienteOpen, setIsConfirmarClienteOpen] = useState(false);
  const [clienteVer, setClienteVer] = useState<Cliente | null>(null);
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [clientesBusca, setClientesBusca] = useState('');
  const [comprobanteBusca, setComprobanteBusca] = useState('');
  const [comprobanteFiltro, setComprobanteFiltro] = useState<'all' | '01' | '03'>('all');
  const [emitirSoloHoy, setEmitirSoloHoy] = useState(true);

  const tipoDocClienteLabel = (t: string) => t === '6' ? 'RUC' : t === '1' ? 'DNI' : 'Doc';
  const tipoComprobanteLabel = (t: string) => t === '01' ? 'Factura' : t === '03' ? 'Boleta' : t;

  const buscarCliente = (q: string) => {
    const term = q.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter(c => `${c.numeroDocumento} ${c.razonSocial}`.toLowerCase().includes(term));
  };
  const clientesFiltradosTab = buscarCliente(clientesBusca);
  const comprobanteVentaIds = new Set(comprobantes.map(c => c.venta_id).filter(Boolean));
  const hoyStr = getLocalDateStr(new Date());
  const ventasPendientesBase = sales.filter(v => !comprobanteVentaIds.has(v.id));
  const ventasPendientes = emitirSoloHoy
    ? ventasPendientesBase.filter(v => (v.localDate || getLocalDateStr(new Date(v.date))) === hoyStr)
    : ventasPendientesBase;
  const ventasPendientesCount = ventasPendientes.length;
  // Numero de ticket corto y amigable (orden cronologico de todas las ventas).
  const ticketNumberById = new Map<string, number>();
  [...sales]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((s, i) => ticketNumberById.set(s.id, i + 1));
  const ticketNumberOf = (id: string) => ticketNumberById.get(id) ?? 0;

  const ventaOptions: ComboOption[] = ventasPendientes.slice(0, 100).map(s => {
    const d = new Date(s.date);
    const nro = ticketNumberOf(s.id);
    return {
      value: s.id,
      label: `#${nro} · ${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · S/ ${s.total.toFixed(2)}`,
      search: `#${nro} ${s.id} ${s.total.toFixed(2)}`,
      node: (
        <span className="flex flex-1 items-center gap-2 text-xs">
          <span className="w-12 font-semibold text-slate-700">#{nro}</span>
          <span className="text-slate-500">{d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
          <span className="text-slate-500">{d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="ml-auto font-semibold text-slate-900">S/ {s.total.toFixed(2)}</span>
        </span>
      ),
    };
  });
  const clienteOptions: ComboOption[] = [
    { value: 'none', label: 'Sin cliente (Boleta a varios)', search: 'sin cliente varios' },
    ...clients.map(c => ({
      value: c.id,
      label: `${c.numeroDocumento} · ${c.razonSocial}`,
      search: `${c.numeroDocumento} ${c.razonSocial}`,
    })),
  ];
  const comprobantesFiltrados = comprobantes.filter(c => {
    if (comprobanteFiltro !== 'all' && c.tipo_documento !== comprobanteFiltro) return false;
    const q = comprobanteBusca.trim().toLowerCase();
    if (!q) return true;
    const cliente = clients.find(cl => cl.id === c.cliente_id);
    const fecha = new Date(c.fecha_emision).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).toLowerCase();
    return `${c.numero} ${tipoComprobanteLabel(c.tipo_documento)} ${cliente?.razonSocial ?? ''} ${c.estado} ${fecha} ${c.total_venta.toFixed(2)}`.toLowerCase().includes(q);
  });

  // Cargar clientes, comprobantes, series y emisor (solo admin, en tiempo real)
  useEffect(() => {
    if (!isAuthenticated || userRole !== 'admin') return;
    const unsubClients = subscribeClients(setClients);
    const unsubComprobantes = subscribeComprobantes(setComprobantes);
    const cargarBase = async () => {
      try {
        const { data } = await supabase
          .from('series')
          .select('id, serie, tipo_documento, descripcion, activa')
          .eq('activa', true)
          .order('serie');
        if (data) setSeries(data as unknown as Serie[]);
        const e = await getEmisor().catch(() => null);
        setEmisor(e ?? null);
        if (e?.logoUrl) {
          setCompanyLogo(e.logoUrl);
          safeSetItem('pos-company-logo', e.logoUrl);
        }
      } catch (err) {
        console.error('[emitir] carga inicial', err);
      }
    };
    void cargarBase();
    return () => { unsubClients(); unsubComprobantes(); };
  }, [isAuthenticated, userRole]);

  const abrirNuevoCliente = () => {
    setClientToEdit(null);
    setClientErrors({});
    setClientForm({ tipoDocumento: '6', numeroDocumento: '', razonSocial: '', direccion: '', telefono: '', email: '' });
    setIsAddClientOpen(true);
  };

  const abrirEditarCliente = (c: Cliente) => {
    setClientToEdit(c);
    setClientErrors({});
    setClientForm({
      tipoDocumento: c.tipoDocumento || '6',
      numeroDocumento: c.numeroDocumento,
      razonSocial: c.razonSocial,
      direccion: c.direccion ?? '',
      telefono: c.telefono ?? '',
      email: c.email ?? '',
    });
    setIsAddClientOpen(true);
  };

  const consultarRucCliente = async () => {
    const ruc = clientForm.numeroDocumento.replace(/\D/g, '');
    if (ruc.length !== 11) {
      toast({ title: 'RUC inválido', description: 'El RUC debe tener 11 dígitos.', variant: 'destructive' });
      return;
    }
    setIsConsultingRuc(true);
    try {
      const data = await consultarRuc(ruc);
      setClientForm(prev => ({
        ...prev,
        tipoDocumento: '6',
        razonSocial: data.razonSocial || prev.razonSocial,
        direccion: data.direccion || prev.direccion,
      }));
      const esActivo = (data.estado ?? '').trim().toUpperCase() === 'ACTIVO';
      const esHabil = (data.condicion ?? '').trim().toUpperCase() === 'HABIDO';
      if (data.estado && !esActivo) {
        toast({ title: `Atención: RUC ${data.estado}`, description: (data.condicion ? `Condición: ${data.condicion}. ` : '') + (data.razonSocial || ''), variant: 'destructive' });
      } else if (data.condicion && !esHabil) {
        toast({ title: `Atención: condición ${data.condicion}`, description: data.razonSocial || 'Revisa el estado del contribuyente.', variant: 'destructive' });
      } else {
        toast({ title: 'RUC consultado', description: data.razonSocial || 'Datos encontrados.' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo consultar';
      toast({ title: 'No se pudo consultar el RUC', description: msg, variant: 'destructive' });
    } finally {
      setIsConsultingRuc(false);
    }
  };

  const guardarCliente = async () => {
    const errores: Record<string, string> = {};
    if (!clientForm.numeroDocumento.trim()) errores.numeroDocumento = 'Requerido';
    if (!clientForm.razonSocial.trim()) errores.razonSocial = 'Requerido';
    setClientErrors(errores);
    if (Object.keys(errores).length > 0) return;
    try {
      const payload = {
        tipoDocumento: clientForm.tipoDocumento,
        numeroDocumento: clientForm.numeroDocumento.trim(),
        razonSocial: clientForm.razonSocial.trim(),
        direccion: clientForm.direccion.trim() || undefined,
        telefono: clientForm.telefono.trim() || undefined,
        email: clientForm.email.trim() || undefined,
      };
      if (clientToEdit) {
        await updateClient(clientToEdit.id, payload);
        toast({ title: 'Cliente actualizado', description: payload.razonSocial });
      } else {
        const docNorm = payload.numeroDocumento.replace(/\D/g, '');
        const yaExiste = clients.find(c => c.numeroDocumento.replace(/\D/g, '') === docNorm && (c.tipoDocumento || '0') === (payload.tipoDocumento || '0'));
        if (yaExiste) {
          toast({ title: 'Cliente ya registrado', description: `Ya existe "${yaExiste.razonSocial}" con ese documento.`, variant: 'destructive' });
          return;
        }
        await createClient(payload);
        toast({ title: 'Cliente creado', description: payload.razonSocial });
      }
      setIsAddClientOpen(false);
      setClientToEdit(null);
      const actualizados = await getAllClients().catch(() => null);
      if (actualizados) setClients(actualizados);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      const esDuplicado = /duplicate key|23505|unique constraint/i.test(msg);
      toast({
        title: esDuplicado ? 'Cliente ya registrado' : 'No se pudo guardar el cliente',
        description: esDuplicado ? 'Ya existe un cliente con ese tipo y número de documento.' : msg,
        variant: 'destructive',
      });
    }
  };

  const eliminarCliente = async () => {
    if (!clientToDelete) return;
    try {
      await deleteClient(clientToDelete.id);
      const actualizados = await getAllClients().catch(() => null);
      if (actualizados) setClients(actualizados);
      toast({ title: 'Cliente eliminado', description: clientToDelete.razonSocial });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'No se pudo eliminar', description: msg, variant: 'destructive' });
    } finally {
      setClientToDelete(null);
    }
  };

  const abrirConfigEmisor = () => {
    setEmisorForm({
      ruc: emisor?.ruc ?? '',
      razonSocial: emisor?.razonSocial ?? '',
      nombreComercial: emisor?.nombreComercial ?? '',
      direccion: emisor?.direccion ?? '',
      telefono: emisor?.telefono ?? '',
      email: emisor?.email ?? '',
      igvRate: String(emisor?.igvRate ?? 18),
      redondeoEfectivo: emisor?.redondeoEfectivo ?? true,
    });
    setIsConfigOpen(true);
  };

  const guardarEmisor = async () => {
    if (!emisorForm.ruc.trim() || !emisorForm.razonSocial.trim()) {
      toast({ title: 'Datos incompletos', description: 'El RUC y la razón social son obligatorios.', variant: 'destructive' });
      return;
    }
    setIsSavingEmisor(true);
    try {
      const guardado = await saveEmisor({
        ruc: emisorForm.ruc,
        razonSocial: emisorForm.razonSocial,
        nombreComercial: emisorForm.nombreComercial || undefined,
        direccion: emisorForm.direccion || undefined,
        telefono: emisorForm.telefono || undefined,
        email: emisorForm.email || undefined,
        igvRate: Number(emisorForm.igvRate) || 18,
        redondeoEfectivo: emisorForm.redondeoEfectivo,
        logoUrl: companyLogo || undefined,
      });
      setEmisor(guardado);
      toast({ title: 'Datos de la empresa guardados', description: guardado.razonSocial });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'No se pudo guardar la empresa', description: msg, variant: 'destructive' });
    } finally {
      setIsSavingEmisor(false);
    }
  };

  const abrirEmitir = () => {
    if (!emisor) {
      toast({ title: 'Configura la Empresa primero', description: 'Registra el RUC y la razón social antes de emitir.', variant: 'destructive' });
      abrirConfigEmisor();
      return;
    }
    const primeraSerie = series.find(s => s.tipo_documento === '03') ?? series[0];
    setEmitForm({
      ventaId: '', clienteId: '',
      tipoDocumento: primeraSerie?.tipo_documento ?? '03',
      serie: primeraSerie?.serie ?? '',
    });
    setEmitRucInput('');
    setEmitClienteNoRegistrado(null);
    setIsEmitOpen(true);
  };

  const abrirEmitirDesdeVenta = (sale: Sale, tipoDocumento: '01' | '03') => {
    if (!emisor) {
      toast({ title: 'Configura la Empresa primero', description: 'Registra el RUC y la razón social antes de emitir.', variant: 'destructive' });
      abrirConfigEmisor();
      return;
    }
    const serie = series.find(s => s.tipo_documento === tipoDocumento);
    if (!serie) {
      toast({
        title: 'Serie no disponible',
        description: `No hay una serie activa para ${tipoDocumento === '01' ? 'Factura' : 'Boleta'}.`,
        variant: 'destructive',
      });
      return;
    }
    const clienteVenta = sale.clientId ? clients.find(c => c.id === sale.clientId) : null;
    setEmitForm({ ventaId: sale.id, tipoDocumento, serie: serie.serie, clienteId: clienteVenta?.id ?? '' });
    setEmitRucInput(clienteVenta?.numeroDocumento ?? '');
    setEmitClienteNoRegistrado(null);
    setIsEmitOpen(true);
  };

  const consultarRucEnEmitir = async () => {
    const ruc = emitRucInput.replace(/\D/g, '');
    if (ruc.length !== 11) {
      toast({ title: 'RUC inválido', description: 'El RUC debe tener 11 dígitos.', variant: 'destructive' });
      return;
    }
    const existente = clients.find(c => c.numeroDocumento.replace(/\D/g, '') === ruc);
    if (existente) {
      setEmitForm(prev => ({ ...prev, clienteId: existente.id }));
      setEmitClienteNoRegistrado(null);
      toast({ title: 'Cliente encontrado', description: existente.razonSocial });
      return;
    }
    setIsConsultandoRucEmit(true);
    try {
      const data = await consultarRuc(ruc);
      setEmitClienteNoRegistrado({ razonSocial: data.razonSocial, direccion: data.direccion });
      setEmitForm(prev => ({ ...prev, clienteId: '' }));
      toast({ title: 'RUC no registrado', description: 'Pulsa "Registrar cliente" para usarlo.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo consultar';
      toast({ title: 'No se pudo consultar el RUC', description: msg, variant: 'destructive' });
    } finally {
      setIsConsultandoRucEmit(false);
    }
  };

  // Crea el cliente desde Emitir o, si ya existe ese documento, devuelve el id
  // del existente. Asi nunca choca con la restriccion unica (tipo, numero).
  const crearOSeleccionarCliente = async (datos: { numeroDocumento: string; razonSocial: string; direccion?: string }): Promise<string> => {
    const doc = datos.numeroDocumento.replace(/\D/g, '');
    const fresco = (await getAllClients().catch(() => null)) ?? clients;
    const existe = fresco.find(c => c.numeroDocumento.replace(/\D/g, '') === doc);
    if (existe) {
      setClients(fresco);
      return existe.id;
    }
    const creado = await createClient({
      tipoDocumento: '6',
      numeroDocumento: doc,
      razonSocial: datos.razonSocial,
      direccion: datos.direccion,
    });
    const actualizados = await getAllClients().catch(() => null);
    if (actualizados) setClients(actualizados);
    return creado.id;
  };

  const registrarClienteDesdeEmitir = async () => {
    if (!emitClienteNoRegistrado || creandoCliente) return;
    setCreandoCliente(true);
    try {
      const ruc = emitRucInput.replace(/\D/g, '');
      const id = await crearOSeleccionarCliente({
        numeroDocumento: ruc,
        razonSocial: emitClienteNoRegistrado.razonSocial,
        direccion: emitClienteNoRegistrado.direccion,
      });
      setEmitForm(prev => ({ ...prev, clienteId: id }));
      setEmitClienteNoRegistrado(null);
      toast({ title: 'Cliente listo', description: emitClienteNoRegistrado.razonSocial });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'No se pudo registrar el cliente', description: msg, variant: 'destructive' });
    } finally {
      setCreandoCliente(false);
    }
  };

  const emitirComprobanteActual = async () => {
    if (!emitForm.ventaId) {
      toast({ title: 'Selecciona una venta', variant: 'destructive' });
      return;
    }
    if (!emitForm.serie) {
      toast({ title: 'Selecciona una serie', variant: 'destructive' });
      return;
    }
    // Factura sin cliente seleccionado pero con RUC consultado: preguntar antes de guardarlo.
    if (emitForm.tipoDocumento === '01' && !emitForm.clienteId && emitClienteNoRegistrado) {
      setIsConfirmarClienteOpen(true);
      return;
    }
    await ejecutarEmision();
  };

  const ejecutarEmision = async (clienteIdOverride?: string) => {
    const clienteId = clienteIdOverride ?? emitForm.clienteId;
    if (emitForm.tipoDocumento === '01' && !clienteId) {
      toast({ title: 'Falta el cliente', description: 'La factura requiere RUC y razón social del cliente.', variant: 'destructive' });
      return;
    }
    const venta = sales.find(s => s.id === emitForm.ventaId);
    if (!venta) {
      toast({ title: 'Venta no encontrada', description: 'Recarga la página y vuelve a intentarlo.', variant: 'destructive' });
      return;
    }
    // Las ventas creadas sin conexión tienen un id temporal (Date.now()) y no
    // existen en la base: emitirlas revienta con "out of range for type integer".
    if (!/^\d{1,10}$/.test(venta.id) || isPendingId(PENDING.SALES, venta.id)) {
      toast({
        title: 'Venta sin guardar en Supabase',
        description: 'Esta venta aún no se sincronizó. Recarga la página para que se suba y luego emite el comprobante.',
        variant: 'destructive',
        duration: 10000,
      });
      return;
    }
    const totalVenta = venta.total ?? 0;
    setIsEmitting(true);
    setCargando('Emitiendo comprobante…');
    try {
      const comp = await emitirComprobante({
        ventaId: emitForm.ventaId,
        serie: emitForm.serie,
        clienteId: clienteId || null,
        tipoDocumento: emitForm.tipoDocumento === '01' ? '01' : '03',
        totalVenta,
        igvRate: emisor?.igvRate ?? 18,
      });
      const cliente = clients.find(c => c.id === clienteId) ?? null;
      const resultado = await emitirSunat(comp, emisor, cliente);
      try { await updateComprobanteSunat(comp.id, resultado); } catch { /* estado local */ }
      setComprobantes(prev => [comp, ...prev]);
      setIsEmitOpen(false);
      if (venta) {
        const html = await generarComprobanteElectronicoHTML({
          tipoDocumento: emitForm.tipoDocumento === '01' ? '01' : '03',
          numero: comp.numero,
          fecha: comp.fecha_emision,
          emisor,
          cliente,
          venta,
          igvRate: emisor?.igvRate ?? 18,
        });
        setComprobantePreviewHTML(html);
        setComprobantePreviewNumero(comp.numero);
        setIsComprobantePreviewOpen(true);
      }
      toast({ title: 'Comprobante emitido', description: comp.numero + (resultado.estado === 'emitido_local' ? ' (local)' : '') });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'No se pudo emitir', description: msg, variant: 'destructive' });
    } finally {
      setIsEmitting(false);
      setCargando(null);
    }
  };

  const confirmarRegistrarClienteYEmitir = async () => {
    if (!emitClienteNoRegistrado || creandoCliente) return;
    setIsEmitting(true);
    try {
      const ruc = emitRucInput.replace(/\D/g, '');
      const id = await crearOSeleccionarCliente({
        numeroDocumento: ruc,
        razonSocial: emitClienteNoRegistrado.razonSocial,
        direccion: emitClienteNoRegistrado.direccion,
      });
      setEmitForm(prev => ({ ...prev, clienteId: id }));
      setEmitClienteNoRegistrado(null);
      setIsConfirmarClienteOpen(false);
      await ejecutarEmision(id);
    } catch (err) {
      setIsEmitting(false);
      setIsConfirmarClienteOpen(false);
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'No se pudo registrar el cliente', description: msg, variant: 'destructive' });
    }
  };

  const verComprobanteOriginal = async (c: Comprobante) => {
    if (!emisor) {
      toast({ title: 'Configura la Empresa primero', description: 'Registra el RUC y la razón social antes de ver comprobantes.', variant: 'destructive' });
      return;
    }
    const venta = sales.find(s => s.id === c.venta_id);
    if (!venta) {
      toast({ title: 'No se encontró la venta', description: 'La venta original fue eliminada o ya no existe.', variant: 'destructive' });
      return;
    }
    const cliente = clients.find(cl => cl.id === c.cliente_id) ?? null;
    try {
      const xmlUrl = (c as any).url_xml || (c as any).xmlUrl || (c as any).sunat_xml_url || undefined;
      const pdfUrl = (c as any).url_pdf || (c as any).pdfUrl || undefined;
      const html = await generarComprobanteElectronicoHTML({
        tipoDocumento: c.tipo_documento === '01' ? '01' : '03',
        numero: c.numero,
        fecha: c.fecha_emision,
        emisor,
        cliente,
        venta,
        igvRate: emisor?.igvRate ?? 18,
        xmlUrl,
        pdfUrl,
      });
      setComprobantePreviewHTML(html);
      setComprobantePreviewNumero(c.numero);
      setIsComprobantePreviewOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'No se pudo generar el comprobante', description: msg, variant: 'destructive' });
    }
  };

  const anularComprobanteActual = async () => {
    if (!comprobanteAnular) return;
    try {
      await anularComprobante(comprobanteAnular.id);
      setComprobantes(prev => prev.map(c => c.id === comprobanteAnular.id ? { ...c, estado: 'anulado' } : c));
      toast({ title: 'Comprobante anulado', description: comprobanteAnular.numero });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'No se pudo anular', description: msg, variant: 'destructive' });
    } finally {
      setComprobanteAnular(null);
    }
  };

  const cerrarCaja = () => {
    const today = getLocalDateStr(new Date());
    const todaySales = sales.filter(sale => 
      (sale.localDate || getLocalDateStr(new Date(sale.date))) === today
    );

    if (todaySales.length === 0) {
      toast({
        title: "No hay ventas",
        description: "No hay ventas registradas para cerrar la caja",
        variant: "destructive"
      });
      return;
    }

    const totalSales = todaySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalProfit = todaySales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);
    const totalItems = todaySales.reduce((sum, sale) => 
      sum + (sale.items || []).reduce((itemSum, item) => {
        return (item?.product?.type === 'peso' || item?.product?.type === 'metro') ? itemSum + 1 : itemSum + (item?.quantity || 0);
      }, 0), 0
    );

    const paymentMethods = {
      efectivo: todaySales.filter(s => s.paymentMethod === 'efectivo').reduce((sum, s) => sum + (s.total || 0), 0),
      tarjeta: todaySales.filter(s => s.paymentMethod === 'tarjeta').reduce((sum, s) => sum + (s.total || 0), 0),
      yape: todaySales.filter(s => s.paymentMethod === 'yape').reduce((sum, s) => sum + (s.total || 0), 0),
      plin: todaySales.filter(s => s.paymentMethod === 'plin').reduce((sum, s) => sum + (s.total || 0), 0)
    };

    const currentUserName = firebaseUser?.displayName || users.find(u => u.email === getCurrentSupabaseUser()?.email)?.name || userRole;

    const existingCloseIndex = dailyCloses.findIndex(c => c.date === today);
    let updatedCloses: DailyClose[];
    let closeId: string;
    if (existingCloseIndex >= 0) {
      const existingClose = dailyCloses[existingCloseIndex];
      closeId = existingClose.id;
      const updatedClose: DailyClose = {
        ...existingClose,
        totalSales,
        totalProfit,
        totalItems,
        salesCount: todaySales.length,
        paymentMethods,
        closedBy: currentUserName,
        closeTime: new Date().toISOString(),
        transacciones: todaySales
      };
      updatedCloses = [...dailyCloses];
      updatedCloses[existingCloseIndex] = updatedClose;
      toast({
        title: "Cierre actualizado",
        description: `Se actualizó el cierre de hoy: S/ ${totalSales.toFixed(2)} en ventas`,
      });
    } else {
      closeId = Date.now().toString();
      const dailyClose: DailyClose = {
        id: closeId,
        date: today,
        totalSales,
        totalProfit,
        totalItems,
        salesCount: todaySales.length,
        paymentMethods,
        closedBy: currentUserName,
        closeTime: new Date().toISOString(),
        transacciones: todaySales
      };
      updatedCloses = [...dailyCloses, dailyClose];
      toast({
        title: "Caja cerrada",
        description: `Resumen del día guardado: S/ ${totalSales.toFixed(2)} en ventas`,
      });
    }

    setDailyCloses(updatedCloses);
    safeSetItem('pos-daily-closes', JSON.stringify(updatedCloses));
    addPendingId(PENDING.CLOSES, closeId);
    syncClosesToFirestore(updatedCloses);
    setIsCloseCashOpen(false);
  };

  const confirmClearTodaySales = async () => {
    if (!(await esAdminActual())) {
      toast({ title: "Sin permiso", description: "Solo un administrador puede limpiar las ventas del dia", variant: "destructive" });
      return;
    }
    const today = getLocalDateStr(new Date());
    const todaySales = sales.filter(s => getLocalDateStr(new Date(s.date)) === today);
    const todaySalesIds = todaySales.map(s => s.id);
    if (todaySalesIds.length === 0) {
      toast({ title: "Sin ventas", description: "No hay ventas del día para eliminar", variant: "destructive" });
      setIsClearSalesOpen(false);
      return;
    }

    for (const id of todaySalesIds) {
      try { await deleteSale(id); } catch (e) { console.error('ERROR deleteSale:', e); }
      removePendingId(PENDING.SALES, id);
    }
    const updatedSales = sales.filter(s => !todaySalesIds.includes(s.id));
    setSales(updatedSales);
    safeSetItem('pos-sales', JSON.stringify(updatedSales));
    syncSalesToFirestore(updatedSales);
    toast({ title: "Ventas eliminadas", description: `Se eliminaron ${todaySalesIds.length} ventas del día.` });
    setIsClearSalesOpen(false);
  };

  const viewCloseDetail = (dailyClose: DailyClose) => {
    try {
      setSelectedCloseDetail(dailyClose);
      setIsCloseDetailOpen(true);
    } catch (error) {
      console.error('Error al abrir detalle de cierre:', error);
      toast({
        title: "Error",
        description: "No se pudo abrir el detalle del cierre",
        variant: "destructive"
      });
    }
  };

  const formatCloseTime = (closeTime: string) => {
    if (!closeTime) return 'N/A';
    // ISO 8601 format (new format)
    const isoMatch = closeTime.match(/^\d{4}-\d{2}-\d{2}T/);
    if (isoMatch) {
      const d = new Date(closeTime);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    }
    // Legacy locale format
    const time = closeTime.trim();
    const hasMeridiem = /(AM|PM|a\.? m\.?|p\.? m\.?)/i.test(time);
    if (hasMeridiem) return time.replace(/\s+/g, ' ');
    const match = time.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const d = new Date();
      d.setHours(hours, minutes, 0, 0);
      return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return time;
  };

  const generateIndividualSalesPDF = (dailyClose: DailyClose) => {
    const daysSales = sales.filter(sale => 
      (sale.localDate || getLocalDateStr(new Date(sale.date))) === dailyClose.date
    );

    // Crear contenido de texto para descargar como archivo
    let textContent = `VENTAS INDIVIDUALES\n`;
    textContent += `Fecha: ${formatearFechaLocal(dailyClose.date)}\n`;
    textContent += `${'='.repeat(50)}\n\n`;
    
    if (daysSales.length === 0) {
      textContent += `No hay ventas registradas en esta fecha.\n`;
    } else {
      daysSales.forEach((sale, index) => {
        textContent += `VENTA #${index + 1}\n`;
        textContent += `Hora: ${new Date(sale.date).toLocaleTimeString('es-ES', { hour12: true, hour: '2-digit', minute: '2-digit' })}\n`;
        textContent += `Método de Pago: ${sale.paymentMethod.toUpperCase()}\n`;
        textContent += `${'-'.repeat(30)}\n`;
        
        sale.items.forEach(item => {
          const quantity = item.product?.type === 'peso' 
            ? formatWeight(item.quantity)
            : item.product?.type === 'metro'
              ? formatLength(item.quantity)
              : item.quantity;
          const price = item.product?.type === 'peso'
            ? `S/ ${((item.product.salePricePerKg || 0) * (item.quantity / 1000)).toFixed(2)}`
            : item.product?.type === 'metro'
              ? `S/ ${((item.product?.salePrice || 0) * (item.quantity / 100)).toFixed(2)}`
              : `S/ ${((item.product?.salePrice || 0) * item.quantity).toFixed(2)}`;
          
          textContent += `${item.product?.name || 'Producto sin nombre'}\n`;
          textContent += `  Cantidad: ${quantity} - ${price}\n`;
        });
        
        textContent += `${'-'.repeat(30)}\n`;
        textContent += `TOTAL: S/ ${sale.total.toFixed(2)}\n`;
        textContent += `\n`;
      });
      
      textContent += `${'='.repeat(50)}\n`;
      textContent += `RESUMEN DEL DÍA\n`;
      textContent += `Total de Ventas: ${daysSales.length}\n`;
      textContent += `Total Vendido: S/ ${dailyClose.totalSales.toFixed(2)}\n`;
    }

    // Crear y descargar archivo de texto
    try {
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ventas-individuales-${dailyClose.date}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al generar el archivo:', error);
      toast({
        title: "Error",
        description: "Error al generar el archivo de ventas",
        variant: "destructive"
      });
    }
  };

  // Función para eliminar cierre de caja
  const openDeleteCloseDialog = (dailyClose: DailyClose) => {
    setCloseToDelete(dailyClose);
    setIsDeleteCloseOpen(true);
    setAdminPassword('');
  };

    const confirmDeleteDailyClose = async () => {
    if (!closeToDelete) return;

    if (!(await esAdminActual())) {
      toast({
        title: "Sin permiso",
        description: "Solo un administrador puede eliminar cierres de caja",
        variant: "destructive"
      });
      return;
    }


    // Eliminar el cierre de caja
    setCargando('Eliminando cierre…');
    try { await deleteDailyClose(closeToDelete.id); } catch (e) { console.error('ERROR deleteDailyClose:', e); }
    removePendingId(PENDING.CLOSES, closeToDelete.id);
    const updatedCloses = dailyCloses.filter(c => c.id !== closeToDelete.id);
    setDailyCloses(updatedCloses);
    safeSetItem('pos-daily-closes', JSON.stringify(updatedCloses));
    syncClosesToFirestore(updatedCloses);
    setCargando(null);
    
    setIsDeleteCloseOpen(false);
    setCloseToDelete(null);
    setAdminPassword('');
    
    toast({
      title: "Cierre eliminado",
      description: `El cierre del ${formatearFechaLocal(closeToDelete.date)} ha sido eliminado permanentemente`,
    });
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = normalizeText(product.name).includes(normalizeSearch(searchTerm)) ||
      normalizeText(product.category).includes(normalizeSearch(searchTerm));
    if (ventaMode === 'mayor') return matchesSearch && product.saleLevels?.length;
    return matchesSearch && !product.saleLevels?.length;
  });

  const filteredInventory = products.filter(product => {
    if (product.saleLevels?.length) return false;
    const matchesSearch = normalizeText(product.name).includes(normalizeSearch(inventorySearch)) ||
                         normalizeText(product.category).includes(normalizeSearch(inventorySearch));
    
    if (inventoryView === 'todos') return matchesSearch;
    if (inventoryView === 'unidad') return matchesSearch && product.type === 'unidad';
    if (inventoryView === 'peso') return matchesSearch && product.type === 'peso';
    if (inventoryView === 'metro') return matchesSearch && product.type === 'metro';
    
    return matchesSearch;
  });

  const filteredMayoristaProducts = products.filter(product =>
    product.saleLevels?.length > 0 &&
    (normalizeText(product.name).includes(normalizeSearch(mayoristaSearch)) ||
     normalizeText(product.category).includes(normalizeSearch(mayoristaSearch)))
  );

  const [salesFilter, setSalesFilter] = useState<'all' | 'regular' | 'mayorista'>('all');
  const [transaccionesFilter, setTransaccionesFilter] = useState<'all' | 'regular' | 'mayorista'>('all');
  const [resumenTab, setResumenTab] = useState<'regular' | 'mayorista'>('regular');
  const isMayoristaSale = (sale: Sale) => sale.items.some(item => item.product.type === 'mayorista' || (item.selectedLevelName && item.selectedLevelName !== 'Unidad'));
  const isRegularSale = (sale: Sale) => sale.items.some(item => item.product.type !== 'mayorista' && (!item.selectedLevelName || item.selectedLevelName === 'Unidad'));

  const todaysSales = sales.filter(sale => 
    (sale.localDate || getLocalDateStr(new Date(sale.date))) === getLocalDateStr(new Date())
  );
  const filteredTodaysSales = todaysSales.filter(sale => {
    let matchesFilter = true;
    if (salesFilter === 'regular') matchesFilter = isRegularSale(sale);
    if (salesFilter === 'mayorista') matchesFilter = isMayoristaSale(sale);
    let matchesSearch = true;
    if (salesSearch.trim()) {
      matchesSearch = normalizeText(sale.id).includes(normalizeSearch(salesSearch));
    }
    return matchesFilter && matchesSearch;
  });

  const calculateProductPurchaseValue = (product: Product) => {
    if (product.type === 'peso') {
      const purchasePrice = product.purchasePrice ?? product.purchasePricePerKg ?? 0;
      return purchasePrice * (product.stock / 1000);
    } else if (product.type === 'metro') {
      return (product.purchasePrice || 0) * (product.stock / 100);
    } else if (product.saleLevels?.length) {
      return product.saleLevels.reduce((total, level) => total + (level.stock * level.purchasePrice), 0);
    } else {
      return product.purchasePrice * product.stock;
    }
  };

  const calculateProductSaleValue = (product: Product) => {
    if (product.type === 'peso') {
      const salePrice = product.salePrice ?? product.salePricePerKg ?? 0;
      return salePrice * (product.stock / 1000);
    } else if (product.type === 'metro') {
      return (product.salePrice || 0) * (product.stock / 100);
    } else if (product.saleLevels?.length) {
      return product.saleLevels.reduce((total, level) => total + (level.stock * level.salePrice), 0);
    } else {
      return product.salePrice * product.stock;
    }
  };

  const calculateProductPotentialProfit = (product: Product) => {
    if (product.type === 'peso') {
      const purchasePrice = product.purchasePrice ?? product.purchasePricePerKg ?? 0;
      const salePrice = product.salePrice ?? product.salePricePerKg ?? 0;
      const profitPerKg = salePrice - purchasePrice;
      return profitPerKg * (product.stock / 1000);
    } else if (product.type === 'metro') {
      const profitPerMeter = (product.salePrice || 0) - (product.purchasePrice || 0);
      return profitPerMeter * (product.stock / 100);
    } else if (product.saleLevels?.length) {
      if (!product.saleLevels?.length) return 0;
      return product.saleLevels.reduce((total, level) => total + (level.stock * (level.salePrice - level.purchasePrice)), 0);
    } else {
      return (product.salePrice - product.purchasePrice) * product.stock;
    }
  };

  const inventoryTotals = {
    totalPurchaseValue: products
      .filter(p => !p.saleLevels?.length)
      .reduce((total, product) => total + calculateProductPurchaseValue(product), 0),

    totalSaleValue: products
      .filter(p => !p.saleLevels?.length)
      .reduce((total, product) => total + calculateProductSaleValue(product), 0),

    potentialProfit: products
      .filter(p => !p.saleLevels?.length)
      .reduce((total, product) => total + calculateProductPotentialProfit(product), 0)
  };

  const inventoryStats = {
    totalProducts: products.filter(p => !p.saleLevels?.length).length,
    unitProducts: products.filter(p => p.type === 'unidad').length,
    weightProducts: products.filter(p => p.type === 'peso').length,
    metroProducts: products.filter(p => p.type === 'metro').length,
    outOfStock: products.filter(p => !p.saleLevels?.length && p.stock === 0).length,
    lowStock: products.filter(p => !p.saleLevels?.length && p.stock > 0 && p.stock <= getLowStockThreshold(p)).length,
    totalStockValue: products.filter(p => !p.saleLevels?.length).reduce((total, product) => {
      if (product.type === 'peso') {
        const salePrice = product.salePrice ?? product.salePricePerKg ?? 0;
        return total + (salePrice * (product.stock / 1000));
      } else if (product.type === 'metro') {
        return total + ((product.salePrice || 0) * (product.stock / 100));
      } else {
        return total + (product.salePrice * product.stock);
      }
    }, 0)
  };

  const mayoristaProductSales: Record<string, number> = {};
  const mayoristaLevelSales: Record<string, number> = {};

  sales.forEach(sale => {
    sale.items.forEach(item => {
      if (item.product.type === 'mayorista' || (item.product.type === 'unidad' && item.selectedLevelName)) {
        mayoristaProductSales[item.product.id] = (mayoristaProductSales[item.product.id] || 0) + item.quantity;
        if (item.selectedLevelName) {
          mayoristaLevelSales[item.selectedLevelName] = (mayoristaLevelSales[item.selectedLevelName] || 0) + item.quantity;
        }
      }
    });
  });

  let topSoldProduct: { name: string; quantity: number } | null = null;
  let maxProductSales = 0;
  for (const [pid, qty] of Object.entries(mayoristaProductSales)) {
    if (qty > maxProductSales) {
      maxProductSales = qty;
      const product = products.find(p => p.id === pid);
      if (product) {
        topSoldProduct = { name: product.name, quantity: qty };
      }
    }
  }

  let topSoldLevel: { name: string; quantity: number } | null = null;
  let maxLevelSales = 0;
  for (const [name, qty] of Object.entries(mayoristaLevelSales)) {
    if (qty > maxLevelSales) {
      maxLevelSales = qty;
      topSoldLevel = { name, quantity: qty };
    }
  }

  const STOCK_BAJO_THRESHOLD = 5;

  const mayProdFilter = (p: Product) => p.saleLevels?.length > 0;

  const stockCriticoList = products
    .flatMap(p => {
      if (p.type === 'mayorista') {
        return (p.saleLevels || [])
          .filter(l => l.stock <= STOCK_BAJO_THRESHOLD)
          .map(l => ({ productName: p.name, levelName: l.name, stock: l.stock }));
      }
      return [];
    });

  const stockCriticoCount = products
    .filter(p => {
      if (p.type === 'mayorista') return (p.saleLevels || []).some(l => l.stock <= STOCK_BAJO_THRESHOLD);
      return false;
    }).length;

  const inventarioValor = products
    .filter(mayProdFilter)
    .reduce((sum, p) => {
      if (p.type === 'unidad') return sum + p.stock * p.salePrice;
      return sum + (p.saleLevels || []).reduce((s, l) => s + l.stock * l.salePrice, 0);
    }, 0);

  const mayoristaStats = {
    totalProducts: products.filter(mayProdFilter).length,
    totalLevels: products.filter(mayProdFilter).reduce((sum, p) => sum + (p.saleLevels?.length || 0), 0),
    totalStock: products.filter(mayProdFilter).reduce((sum, p) => sum + p.stock, 0),
    potentialProfit: products.filter(mayProdFilter).reduce((sum, p) => sum + calculateProductPotentialProfit(p), 0),
    topSoldProduct,
    topSoldLevel,
    stockCriticoCount,
    inventarioValor
  };

  const getPaymentMethodColor = (method: string) => {
    switch(method) {
      case 'efectivo': return 'bg-green-100 text-green-800';
      case 'tarjeta': return 'bg-orange-100 text-orange-800';
      case 'yape': return 'bg-purple-100 text-purple-800';
      case 'plin': return 'bg-sky-100 text-sky-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const purchaseHeader = inventoryView === 'peso'
    ? 'Compra por kilo (S/)'
    : inventoryView === 'metro'
      ? 'Compra por metro (S/)'
      : 'Compra por unidad (S/)';
  const saleHeader = inventoryView === 'peso'
    ? 'Venta por kilo (S/)'
    : inventoryView === 'metro'
      ? 'Venta por metro (S/)'
      : 'Venta por unidad (S/)';

  const viewSaleDetail = (sale: Sale) => {
    setSelectedSaleDetail(sale);
    setIsDetailOpen(true);
  };

  const viewBoleta = (sale: Sale) => {
    setSelectedBoletaSale(sale);
    setBoletaPreviewHTML(generarBoletaHTML(sale, true));
    setIsBoletaPreviewOpen(true);
  };

  const reimprimirBoleta = (sale: Sale) => {
    imprimirTicket(sale);
  };

  if (!isAuthenticated) {
    if (showResetPasswordForm) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
          {cargando && <LoaderFerro mensaje={cargando} />}
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
          <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl overflow-hidden relative z-10">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
            <CardHeader className="text-center pb-2 pt-10">
              <div className="mx-auto w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/20">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-black text-white tracking-tighter">
                Nueva <span className="text-indigo-500">Contraseña</span>
              </CardTitle>
              <p className="text-sm text-slate-400 mt-2">Escribe tu nueva contraseña para volver a entrar.</p>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 px-8 pb-10">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Nueva Contraseña</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  className="h-11 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Confirmar Contraseña</Label>
                <Input
                  type="password"
                  placeholder="Repite la contraseña"
                  value={nuevaPassword2}
                  onChange={(e) => setNuevaPassword2(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleGuardarNuevaPassword()}
                  className="h-11 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600 rounded-xl"
                />
              </div>
              <Button
                onClick={handleGuardarNuevaPassword}
                disabled={isRecuperando}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-500/20 rounded-xl"
              >
                {isRecuperando ? "Guardando..." : "Guardar Contraseña"}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
        {cargando && <LoaderFerro mensaje={cargando} />}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl overflow-hidden relative z-10">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
          <CardHeader className="text-center pb-2 pt-10">
            <div className="mx-auto w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/20 transition-all hover:scale-105 hover:rotate-3 duration-500">
              <Store className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-3xl font-black text-white tracking-tighter">
              Ferreteria <span className="text-indigo-500">Ebenezer</span>
            </CardTitle>
            <p className="text-sm text-slate-400 mt-2 font-medium tracking-widest uppercase opacity-70">Sistema de Gestión Profesional</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-8 px-10 pb-12">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Correo Electrónico</Label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-indigo-400 transition-colors" />
                  <Input 
                    id="email" 
                    type="email"
                    autoComplete="email"
                    placeholder="correo@ejemplo.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="pl-10 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-xl transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Contraseña</Label>
                <div className="relative group">
                  <LogIn className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-indigo-400 transition-colors" />
                  <Input 
                    id="password" 
                    type="password" 
                    autoComplete="off"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    className="pl-10 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-xl transition-all"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isRecuperando}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {isRecuperando ? "Enviando correo..." : "¿Olvidaste tu contraseña?"}
                  </button>
                </div>
              </div>
            </div>
            <Button onClick={handleLogin} disabled={isAuthLoading} className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] rounded-xl">
              {isAuthLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
            <div className="text-center pt-4">
              <p className="text-[10px] text-slate-600 font-bold tracking-widest uppercase">
                {EMPRESA.nombreComercial || 'Sistema de Ventas'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {cargando && <LoaderFerro mensaje={cargando} />}
      <div className="min-h-screen bg-slate-50/50 selection:bg-indigo-100">
      <div className="bg-slate-900 sticky top-0 z-40 border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 transition-transform hover:scale-105 duration-300">
                <Store className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-sm sm:text-xl font-bold text-white tracking-tight">Ferreteria Ebenezer</h1>
                {!isMobile && <p className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-widest">SISTEMA PROFESIONAL</p>}
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {isOnline ? (
                <Badge variant="secondary" className="bg-green-900 text-green-400 border-green-700 hidden sm:flex font-bold px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse" />
                  ONLINE
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-red-900 text-red-400 border-red-700 hidden sm:flex font-bold px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5" />
                  OFFLINE
                </Badge>
              )}
              <Badge variant="secondary" className="bg-slate-800 text-slate-100 border-slate-700 hidden sm:flex font-medium px-3 py-1 rounded-full max-w-[180px]">
                <span className="truncate">{users.find(u => u.email === getCurrentSupabaseUser()?.email)?.name || firebaseUser?.displayName || 'Usuario'}</span>
              </Badge>
              <Badge variant="secondary" className="bg-slate-800 text-indigo-400 border-slate-700 hidden sm:flex font-bold px-3 py-1 rounded-full">
                <User className="w-3 h-3 mr-1.5" />
                {userRole === 'admin' ? 'ADMINISTRADOR' : 'EMPLEADO'}
              </Badge>
              <Button
                variant="ghost"
                size={isMobile ? "icon" : "sm"}
                className="text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors rounded-full"
                onClick={() => { abrirConfigEmisor(); }}
              >
                <Settings className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size={isMobile ? "icon" : "sm"} 
                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-full"
                onClick={async () => {
                  setCargando('Cerrando sesión…');
                  await firebaseLogout().catch(() => {});
                  setIsAuthenticated(false);
                  setCurrentSale([]);
                  setSearchTerm("");
                  setInventorySearch("");
                  setPaymentMethod('efectivo');
                  setAmountPaid("");
                  setPassword("");
                  setLoginEmail("");
                  setFirebaseUser(null);
                  setNewProduct({ name: '', purchasePrice: 0, salePrice: 0, stock: 0, category: '' });
                  setNewWeightProduct({ name: "", purchasePrice: 0, salePrice: 0, purchasePricePerKg: 0, salePricePerKg: 0, equivalentGrams: 0, stock: 0, initialStock: 0, minWeightGrams: 0, category: "" });
                  setNewMetroProduct({ name: "", purchasePrice: 0, salePrice: 0, initialStockCm: 0, category: "" });
                  setMetroPurchaseInput('');
                  setMetroSaleInput('');
                  setMetroStockInput('');
      setNewUser({ password: '', name: '', role: 'empleado', email: '' });
                  setConfirmPassword('');
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                  setEditingProduct(null);
                  setEditingWeightProduct(null);
                  setEditingMetroProduct(null);
                  setEditingUser(null);
                  setEditingQuickProduct(null);
                  setSelectedSaleDetail(null);
                  setSelectedCloseDetail(null);
                  setSelectedWeightProduct(null);
                  setWeightQuantities({});
                  setCustomWeight('');
                  setSelectedMetroProduct(null);
                  setMetroQuantities({});
                  setCustomMeters('');
                  setCustomMetroMoney('');
                  setRestockQuantities({});
                  setAdminPassword('');
                  setCloseToDelete(null);
                  setIsAddProductOpen(false);
                  setIsEditProductOpen(false);
                  setIsEditWeightProductOpen(false);
                  setIsEditMetroProductOpen(false);
                  setIsAddUserOpen(false);
                  setIsEditUserOpen(false);
                  setIsCloseCashOpen(false);
                  setIsDetailOpen(false);
                  setIsCloseDetailOpen(false);
                  setIsRestockModalOpen(false);
                  setIsWeightModalOpen(false);
                  setIsMetroModalOpen(false);
                  setIsDeleteMode(false);
                  setIsDeleteConfirmOpen(false);
                  setIsDeleteCloseOpen(false);
                  setIsEditQuickProductOpen(false);
                  setIsProductosVendidosOpen(false);
                  setIsVentasIndividualesOpen(false);
                  setIsStockHistoryModalOpen(false);
                  setIsDeleteStockHistoryOpen(false);
                  setIsDeleteSaleOpen(false);
                  setIsMayoristaModalOpen(false);
                  setIsBoletaPreviewOpen(false);
                  setBoletaPreviewHTML('');
                  setIsConfigOpen(false);
                  setIsViewMayoristaProductOpen(false);
                  setIsStockCriticoOpen(false);
                  setIsClearSalesOpen(false);
                  setIsDeleteProductConfirmOpen(false);
                  setIsEditMayoristaOpen(false);
                  setSalesFilter('all');
                  setTransaccionesFilter('all');
                  setResumenTab('regular');
                  setSalesSearch('');
                  setSelectedProductsToDelete([]);
                  setProductsToDelete([]);
                  setCargando(null);
                }}>
                {isMobile ? <LogIn className="w-5 h-5 rotate-180" /> : "Cerrar Sesión"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {storageAlert === 'critical' && (
          <div className="mb-4 px-4 py-3 bg-red-100 border border-red-400 text-red-800 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-semibold">Almacenamiento crítico. Conéctese a internet para liberar espacio.</p>
          </div>
        )}
        {storageAlert === 'warning' && (
          <div className="mb-4 px-4 py-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-semibold">Almacenamiento casi lleno. Conéctese a internet para sincronizar.</p>
          </div>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className={`flex w-full overflow-x-auto sm:grid ${userRole === 'admin' ? 'sm:grid-cols-7' : 'sm:grid-cols-3'} h-auto p-1.5 bg-slate-200/50 rounded-xl shadow-inner`}>
            <TabsTrigger value="ventas" className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md transition-all text-slate-600">
              <ShoppingCart className="w-4 h-4" />
              <span className={isMobile ? "text-xs" : ""}>Ventas</span>
            </TabsTrigger>
            <TabsTrigger value="inventario" className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md transition-all text-slate-600">
              <Package className="w-4 h-4" />
              <span className={isMobile ? "text-xs" : ""}>{isMobile ? "Inv." : "Inventario"}</span>
            </TabsTrigger>
            <TabsTrigger value="ventas-dia" className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md transition-all text-slate-600">
              <TrendingUp className="w-4 h-4" />
              <span className={isMobile ? "text-xs" : ""}>{isMobile ? "Hoy" : "Ventas del Día"}</span>
            </TabsTrigger>
            {userRole === 'admin' && (
              <TabsTrigger value="historial-diario" className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md transition-all text-slate-600">
                <History className="w-4 h-4" />
                <span className={isMobile ? "text-xs" : ""}>{isMobile ? "Hist." : "Historial"}</span>
              </TabsTrigger>
            )}
            {userRole === 'admin' && (
              <TabsTrigger value="usuarios" className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md transition-all text-slate-600">
                <UserPlus className="w-4 h-4" />
                <span className={isMobile ? "text-xs" : ""}>{isMobile ? "User" : "Usuarios"}</span>
              </TabsTrigger>
            )}
            {userRole === 'admin' && (
              <TabsTrigger value="clientes" className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md transition-all text-slate-600">
                <Users className="w-4 h-4" />
                <span className={isMobile ? "text-xs" : ""}>{isMobile ? "Cli." : "Clientes"}</span>
              </TabsTrigger>
            )}
            {userRole === 'admin' && (
              <TabsTrigger value="emitir" className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md transition-all text-slate-600">
                <ReceiptText className="w-4 h-4" />
                <span className={isMobile ? "text-xs" : ""}>{isMobile ? "Emit." : "Emitir"}</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="ventas" className="space-y-4 sm:space-y-6">
            <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
              <Button
                variant={ventaMode === 'regular' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => { setVentaMode('regular'); setIgvRateStr("18"); setSearchTerm(''); }}
                className={`flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-wider rounded-lg px-4 ${
                  ventaMode === 'regular'
                    ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                Venta Regular
              </Button>
              <Button
                variant={ventaMode === 'mayor' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => { setVentaMode('mayor'); setIgvRateStr(""); setSearchTerm(''); }}
                className={`flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-wider rounded-lg px-4 ${
                  ventaMode === 'mayor'
                    ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Package className="w-3.5 h-3.5 mr-1.5" />
                Venta por Mayor
              </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <span>{ventaMode === 'mayor' ? 'Productos Mayoristas' : 'Productos'}</span>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input
                            placeholder="Buscar productos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-9 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" />
                        </div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px] sm:h-[600px] pr-4">
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                        {filteredProducts.map((product) => (
                          <Card
                            key={product.id}
                            className="group overflow-hidden transition-all duration-300 border-slate-100 cursor-pointer hover:shadow-xl hover:border-indigo-200 hover:-translate-y-1 bg-white w-full"
                            onClick={() => agregarProductoVenta(product)}
                          >
                            <CardContent className="p-0">
                              <div className="p-3 sm:p-4 space-y-2">
                                {product.imageUrl && (
                                  <div className="flex justify-center w-full h-32 sm:h-40 mb-2 overflow-hidden">
                                    <img src={product.imageUrl} alt={product.name} className="h-full object-cover rounded-lg" />
                                  </div>
                                )}
                                <div className="flex justify-between items-start gap-2">
                                  <h3 className="font-bold text-xs sm:text-sm text-slate-800 line-clamp-2 leading-tight h-8 sm:h-10 group-hover:text-indigo-600 transition-colors">
                                    {product.name}
                                  </h3>
                                </div>
                                
                                <div className="flex items-center justify-between gap-1">
                                  <Badge variant="outline" className="text-[9px] sm:text-[10px] font-medium px-1.5 py-0 border-slate-200 text-slate-500 bg-slate-50 truncate max-w-[60px] sm:max-w-none">
                                    {product.category}
                                  </Badge>
                                  <Badge 
                                    variant={(() => { const rs = product.type === 'mayorista' ? (product.saleLevels || []).reduce((s, l) => s + (l.stock || 0), 0) : product.stock; return rs > 0 ? "secondary" : "destructive"; })()}
                                    className={`text-[9px] sm:text-[10px] px-1.5 py-0 font-bold ${(() => { const threshold = getLowStockThreshold(product); const rs = product.type === 'mayorista' ? (product.saleLevels || []).reduce((s, l) => s + (l.stock || 0), 0) : product.stock; return rs > 0 && rs <= threshold ? 'bg-amber-100 text-amber-700 border-amber-200' : rs > threshold ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : ''; })()}`}
                                  >
                                    {(() => { if (product.type === 'peso') return (product.stock / 1000).toFixed(1) + 'kg'; if (product.type === 'metro') return formatLength(product.stock); const total = product.type === 'mayorista' ? (product.saleLevels || []).reduce((s, l) => s + (l.stock || 0), 0) : product.stock; return 'Stock: ' + total; })()}
                                  </Badge>
                                </div>

                                <div className="pt-1 flex items-center justify-between border-t border-slate-50 mt-2">
                                  <span className="text-sm sm:text-lg font-black text-indigo-600">
                    S/ {(product.salePrice || 0).toFixed(2)}{product.type === 'peso' ? <span className="text-[10px] text-slate-400 font-normal ml-0.5">/{product.stock >= 1000 ? 'kg' : 'g'}</span> : product.type === 'metro' ? <span className="text-[10px] text-slate-400 font-normal ml-0.5">/m</span> : ''}
                  </span>
                                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-200 transition-all duration-300">
                                    <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <Card className="sticky top-4">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center space-x-2">
                      <ShoppingCart className="w-5 h-5 text-blue-600" />
                      <span>Venta Actual</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <ScrollArea className={`${currentSale.length === 0 ? 'h-24' : 'h-[300px] sm:h-[400px]'}`}>
                      {currentSale.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 py-4">
                          <ShoppingCart className="w-8 h-8 mb-2 opacity-20" />
                          <p className="text-sm">Carrito vacío</p>
                        </div>
                      ) : (
                        <div className="space-y-3 pr-4">
                          {currentSale.map((item) => (
                            <div key={`${item.product.id}-${item.selectedLevelName || 'default'}`} className="group relative flex flex-col p-3 bg-gray-50 rounded-lg border border-transparent hover:border-blue-200 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 flex items-start gap-2">
                                  {item.product.imageUrl ? (
                                    <img src={item.product.imageUrl} alt={item.product.name} className="w-10 h-10 object-cover rounded-md flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-md bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <Package className="w-4 h-4 text-slate-400" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-semibold text-sm text-gray-900 leading-tight">
                                      {item.product.name}
                                      {item.selectedLevelName && (
                                        <span className="font-normal text-gray-500"> — {item.selectedLevelName}</span>
                                      )}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {item.product.type === 'peso'
                                        ? `S/ ${((item.product.salePricePerKg || 0) / 1000).toFixed(3)}/g`
                                        : item.product.type === 'metro'
                                          ? `S/ ${(item.product.salePrice || 0).toFixed(2)}/m`
                                          : item.selectedLevelName
                                          ? (() => {
                                              const lvl = item.product.saleLevels?.find(l => l.name === item.selectedLevelName);
                                              return `S/ ${(item.product.salePrice || 0).toFixed(2)} c/${item.selectedLevelName}${lvl ? ` (${lvl.baseUnitsContained} u)` : ''}`;
                                            })()
                                          : `S/ ${(item.product.salePrice || 0).toFixed(2)} c/u`}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => eliminarProductoVenta(item.product.id, item.selectedLevelName)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center bg-white border rounded-md p-0.5">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => actualizarCantidad(item.product.id, item.quantity - (item.product.type === 'peso' ? 100 : item.product.type === 'metro' ? 10 : 1))}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="min-w-[40px] text-center text-xs font-bold">
                                    {item.product.type === 'peso' ? formatWeight(item.quantity) : item.product.type === 'metro' ? formatLength(item.quantity) : item.selectedLevelName ? `${item.quantity} ${item.selectedLevelName}(s)` : item.quantity}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => actualizarCantidad(item.product.id, item.quantity + (item.product.type === 'peso' ? 100 : item.product.type === 'metro' ? 10 : 1))}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-blue-600">
                                    S/ {item.product.type === 'peso'
                                      ? ((item.product.salePricePerKg || 0) * (item.quantity / 1000)).toFixed(2)
                                      : item.product.type === 'metro'
                                        ? ((item.product.salePrice || 0) * (item.quantity / 100)).toFixed(2)
                                        : ((item.product.salePrice || 0) * item.quantity).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>

                    <Separator />

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span>Subtotal:</span>
                          <span>S/ {calcularSubtotal().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span>IGV ({parseFloat(igvRateStr) || 18}%):</span>
                          <span>S/ {calcularIGV(calcularSubtotal()).toFixed(2)}</span>
                        </div>

                        {paymentMethod === 'efectivo' && (
                        <div className="flex items-center justify-between">
                          <label className="text-sm flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={aplicarRedondeo}
                              onChange={(e) => setAplicarRedondeo(e.target.checked)}
                              className="rounded border-gray-300 w-4 h-4 accent-indigo-600"
                            />
                            Aplicar redondeo
                          </label>
                        </div>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold">Total:</span>
                          <span className="text-2xl font-bold text-green-600">
                            S/ {(paymentMethod === 'efectivo' && aplicarRedondeo ? redondearTotalEfectivo(calcularTotal()) : calcularTotal()).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Método de Pago</Label>
                        <Select value={paymentMethod} onValueChange={(value: 'efectivo' | 'tarjeta' | 'yape' | 'plin') => setPaymentMethod(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="efectivo">
                              <div className="flex items-center space-x-2">
                                <Banknote className="w-4 h-4 text-green-600" />
                                <span>Efectivo</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="tarjeta">
                              <div className="flex items-center space-x-2">
                                <CreditCard className="w-4 h-4 text-orange-600" />
                                <span>Tarjeta</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="yape">
                              <div className="flex items-center space-x-2">
                                <Smartphone className="w-4 h-4 text-purple-600" />
                                <span>Yape</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="plin">
                              <div className="flex items-center space-x-2">
                                <CreditCard className="w-4 h-4 text-cyan-600" />
                                <span>Plin</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>



                      {paymentMethod === 'efectivo' && (
                        <div className="space-y-2">
                          <Label>Monto Recibido</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            placeholder="0.00" />
                          {parseFloat(amountPaid) > 0 && (
                            <div className="flex justify-between text-lg font-bold text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                              <span>Cambio:</span>
                              <span>S/ {calcularCambio().toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <Button
                        onClick={confirmarVenta}
                        className="w-full h-14 success-gradient text-white text-lg font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-[0.98] transition-all rounded-xl border-t border-emerald-400/20"
                        disabled={currentSale.length === 0 || (paymentMethod === 'efectivo' && (amountPaid.trim() === '' || parseFloat(amountPaid) < (aplicarRedondeo ? redondearTotalEfectivo(calcularTotal()) : calcularTotal())))}
                      >
                        <Calculator className="w-6 h-6 mr-3" />
                        Confirmar Venta
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inventario" className="space-y-4 sm:space-y-6">
            <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
              <Button
                variant={inventorySubTab === 'general' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setInventorySubTab('general')}
                className={`flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-wider rounded-lg px-4 ${
                  inventorySubTab === 'general'
                    ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Package className="w-3.5 h-3.5 mr-1.5" />
                Inventario General
              </Button>
              <Button
                variant={inventorySubTab === 'mayorista' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setInventorySubTab('mayorista')}
                className={`flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-wider rounded-lg px-4 ${
                  inventorySubTab === 'mayorista'
                    ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Store className="w-3.5 h-3.5 mr-1.5" />
                Inventario Mayorista
              </Button>
            </div>

            {inventorySubTab === 'general' && (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {userRole === 'admin' && (
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group">
                <div className="h-1 w-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <Package className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-indigo-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Valor Compra</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">S/ {inventoryTotals.totalPurchaseValue.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
              )}
              {userRole === 'admin' && (
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group">
                <div className="h-1 w-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-emerald-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Valor Venta</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">S/ {inventoryTotals.totalSaleValue.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
              )}
              {userRole === 'admin' && (
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group">
                <div className="h-1 w-full bg-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-violet-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Ganancia Est.</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">S/ {inventoryTotals.potentialProfit.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
              )}
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group">
                <div className="h-1 w-full bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <Dialog open={isRestockModalOpen} onOpenChange={setIsRestockModalOpen}>
                    <DialogTrigger asChild>
                      <div className="text-center cursor-pointer">
                        <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-amber-600" />
                        <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Stock Bajo</p>
                        <p className="text-lg sm:text-2xl font-black text-slate-900">{inventoryStats.lowStock}</p>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            Stock Bajo
                          </div>
                        </DialogTitle>
                        <DialogDescription>
                          Productos con stock por debajo del umbral (20 unidades, 500 g para peso y 10 m para metro).
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="max-h-[60vh]">
                        {lowStockProducts.length === 0 ? (
                          <div className="py-8 text-center text-slate-500">
                            No hay productos con stock bajo.
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                                <TableHead className="text-right">Estado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {lowStockProducts.map(product => (
                                <TableRow key={product.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="w-8 h-8 object-cover rounded" />
                                      ) : (
                                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                                          <Package className="w-4 h-4 text-slate-400" />
                                        </div>
                                      )}
                                      <span className="font-medium">{product.name}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-[10px] font-normal">{product.category}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {product.type === 'peso' ? formatWeight(product.stock) : product.type === 'metro' ? formatLength(product.stock) : `${product.stock}`}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {(() => { const rs = product.type === 'mayorista' ? (product.saleLevels || []).reduce((s, l) => s + (l.stock || 0), 0) : product.stock; return rs === 0 ? (
                                      <Badge variant="destructive">AGOTADO</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">BAJO</Badge>
                                    ); })()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group col-span-2 sm:col-span-1">
                <div className="h-1 w-full bg-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <Store className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-slate-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Total Prods</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">{inventoryStats.totalProducts}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="border-slate-100 shadow-xl overflow-hidden">
              <CardHeader className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100">
                <CardTitle className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <span className="text-slate-900 font-black tracking-tight">Gestión de Inventario</span>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                    <div className="flex bg-slate-200/50 p-1 rounded-xl">
                      <Button
                        variant={inventoryView === 'todos' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setInventoryView('todos')}
                        className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-wider rounded-lg"
                      >
                        Todos
                      </Button>
                      <Button
                        variant={inventoryView === 'unidad' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setInventoryView('unidad')}
                        className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-wider rounded-lg"
                      >
                        Unidad
                      </Button>
                      <Button
                        variant={inventoryView === 'peso' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setInventoryView('peso')}
                        className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-wider rounded-lg"
                      >
                        Peso
                      </Button>
                      <Button
                        variant={inventoryView === 'metro' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setInventoryView('metro')}
                        className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-wider rounded-lg"
                      >
                        Metro
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      {userRole === 'admin' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setNewProductType('general');
                            setAddProductMode('unidad');
                            setIsAddProductOpen(true);
                          }}
                          className="flex-1 sm:flex-none flex items-center justify-center space-x-2 h-10 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 rounded-xl"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="font-bold uppercase tracking-wider text-[10px]">Nuevo</span>
                        </Button>
                      )}
                      <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                          placeholder="Buscar en inventario..."
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          autoComplete="off"
                          disabled={isDeleteProductConfirmOpen}
                          className="pl-10 h-10 border-slate-200 focus:border-indigo-500 rounded-xl" />
                      </div>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="border-t sm:border rounded-lg">
                  <div className="overflow-auto h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow className="bg-gray-50/50">
                          <TableHead className="w-[200px] border-r">Producto</TableHead>
                          <TableHead className="border-r">Categoría</TableHead>
                          {userRole === 'admin' && <TableHead className="border-r bg-blue-50">{purchaseHeader}</TableHead>}
                          <TableHead className="border-r bg-green-50">{saleHeader}</TableHead>

                          <TableHead className="border-r">Estado</TableHead>
                          {userRole === 'admin' && (
                            <TableHead className="border-r">Ganancia</TableHead>
                          )}
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventory.map((product) => {
                          const isUnidadMay = product.type === 'unidad' && product.saleLevels && product.saleLevels.length > 0;
                          return (
                          <TableRow key={product.id} className="hover:bg-gray-50/50">
                            <TableCell className="font-semibold border-r">
                              <div className="flex items-center gap-2">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="w-12 h-12 object-cover rounded-lg border flex-shrink-0" />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <Package className="w-5 h-5 text-slate-400" />
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm truncate">{product.name}</span>
                                  <span className="text-[10px] text-gray-400 uppercase">{product.type}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="border-r">
                              <Badge variant="outline" className="text-[10px] font-normal">{product.category}</Badge>
                            </TableCell>
                            {userRole === 'admin' && (
                              <TableCell className="border-r text-xs font-medium text-blue-600 bg-blue-50">
                                S/ {product.type === 'peso' ? (product.purchasePrice ?? product.purchasePricePerKg ?? 0).toFixed(2) : (product.purchasePrice || 0).toFixed(2)}
                                {product.type === 'peso' && <span className="text-[10px] text-gray-400 ml-0.5">/kg</span>}
                                {product.type === 'metro' && <span className="text-[10px] text-gray-400 ml-0.5">/m</span>}
                              </TableCell>
                            )}
                            <TableCell className="border-r text-xs font-bold text-green-600 bg-green-50">
                              S/ {product.type === 'peso' ? (product.salePrice ?? product.salePricePerKg ?? 0).toFixed(2) : (product.salePrice || 0).toFixed(2)}
                              {product.type === 'peso' && <span className="text-[10px] text-gray-400 ml-0.5">/kg</span>}
                              {product.type === 'metro' && <span className="text-[10px] text-gray-400 ml-0.5">/m</span>}
                            </TableCell>

                            <TableCell className="border-r">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${(() => { const threshold = getLowStockThreshold(product); const rs = product.type === 'mayorista' ? (product.saleLevels || []).reduce((s, l) => s + (l.stock || 0), 0) : product.stock; return rs === 0 ? 'bg-red-100 text-red-700' : rs <= threshold ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'; })()}`}>
                                {(() => { const threshold = getLowStockThreshold(product); const rs = product.type === 'mayorista' ? (product.saleLevels || []).reduce((s, l) => s + (l.stock || 0), 0) : product.stock; return rs === 0 ? 'Agotado' : rs <= threshold ? 'Bajo' : 'OK'; })()}
                              </Badge>
                            </TableCell>
                            {userRole === 'admin' && (
                              <TableCell className="border-r text-xs font-bold text-purple-600">
                                S/ {calculateProductPotentialProfit(product).toFixed(2)}
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {!isUnidadMay && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-blue-600"
                                  onClick={() => verProductoMayorista(product)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                )}
                                {userRole === 'admin' && !isUnidadMay && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-purple-600"
                                  onClick={() => {
                                    setSelectedStockHistoryProduct(product);
                                    if (product.type === 'mayorista' && product.saleLevels && product.saleLevels.length > 0) {
                                      const sortedLevels = [...product.saleLevels].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; });
                                      setSelectedHistoryLevel(sortedLevels[0].name);
                                    } else {
                                      setSelectedHistoryLevel('');
                                    }
                                    setIsStockHistoryModalOpen(true);
                                  }}
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                                )}
                                {userRole === 'admin' && !isUnidadMay && (
                                  <>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => editarProducto(product)}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => {
                                      setProductToDelete(product);
                                      setIsDeleteProductConfirmOpen(true);
                                    }}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
            </>
            )}

          {inventorySubTab === 'mayorista' && (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group">
                <div className="h-1 w-full bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-purple-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Más Vendido</p>
                    <p className="text-base sm:text-xl font-black text-slate-900 break-words leading-tight">
                      {mayoristaStats.topSoldProduct?.name || 'Sin ventas'}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card
                className="bg-white border-slate-100 shadow-sm overflow-hidden group cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setStockCriticoLevels(stockCriticoList);
                  setIsStockCriticoOpen(true);
                }}
              >
                <div className="h-1 w-full bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-amber-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Stock Bajo Mayorista</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">{mayoristaStats.stockCriticoCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group">
                <div className="h-1 w-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-blue-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Valor del Inventario</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">
                      S/ {mayoristaStats.inventarioValor.toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              {userRole === 'admin' && (
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group">
                <div className="h-1 w-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-emerald-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Ganancia Est.</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">S/ {mayoristaStats.potentialProfit.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
              )}
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group col-span-2 sm:col-span-1">
                <div className="h-1 w-full bg-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <Store className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-slate-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Total Prods</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">{mayoristaStats.totalProducts}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-100 shadow-xl overflow-hidden">
              <CardHeader className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100">
                <CardTitle className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <span className="text-slate-900 font-black tracking-tight">Productos Mayoristas</span>
                  <div className="flex gap-2">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder="Buscar mayorista..."
                        value={mayoristaSearch}
                        onChange={(e) => setMayoristaSearch(e.target.value)}
                        disabled={isDeleteProductConfirmOpen}
                        className="pl-10 h-10 border-slate-200 focus:border-indigo-500 rounded-xl" />
                    </div>
                    {userRole === 'admin' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setNewProductType('mayorista');
                          setAddProductMode('mayorista');
                          limpiarFormularioMayorista();
                          setIsAddProductOpen(true);
                        }}
                        className="flex items-center justify-center space-x-2 h-10 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 rounded-xl"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider text-[10px]">Nuevo</span>
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="border-t sm:border rounded-lg">
                  <div className="overflow-auto h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow className="bg-gray-50/50">
                          <TableHead className="w-[200px] border-r">Producto</TableHead>
                          <TableHead className="border-r">Categoría</TableHead>
                          <TableHead className="border-r">Niveles Venta</TableHead>
                          <TableHead className="border-r text-center">Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMayoristaProducts.map((product) => {
                          const sortedLevels = [...(product.saleLevels || [])].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; });
                          const minLevel = sortedLevels[0];
                          
                          return (
                          <TableRow key={product.id} className="hover:bg-gray-50/50">
                            <TableCell className="font-semibold border-r">
                              <div className="flex items-center gap-2">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="w-12 h-12 object-cover rounded-lg border flex-shrink-0" />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <Package className="w-5 h-5 text-slate-400" />
                                  </div>
                                )}
                                <span className="text-sm">{product.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="border-r">
                              <Badge variant="outline" className="text-[10px] font-normal">{product.category}</Badge>
                            </TableCell>
                            <TableCell className="border-r">
                              <div className="flex flex-wrap gap-1">
                                {product.saleLevels?.map((level, i) => {
                                  const isUnidadBased = product.saleLevels?.some(l => l.name === 'Unidad');
                                  const levelStock = isUnidadBased && level.name !== 'Unidad'
                                    ? Math.floor(product.stock / level.baseUnitsContained)
                                    : level.stock;
                                  return (
                                  <TooltipProvider key={i}>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="secondary" className={`text-[10px] ${level.name === 'Unidad' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'}`}>
                                          {level.name}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">{level.name === 'Unidad' ? '1 unid.' : `Contiene: ${level.baseUnitsContained} unid.`}</p>
                                        <p className="text-xs">Compra: S/ {(level.purchasePrice ?? 0).toFixed(2)}</p>
                                        <p className="text-xs">Venta: S/ {(level.salePrice ?? 0).toFixed(2)}</p>
                                        {level.name === 'Unidad' ? (
                                          <p className="text-xs font-semibold">Stock: {product.stock} unid.</p>
                                        ) : (
                                          <p className="text-xs">Stock: {levelStock} {level.name}(s)</p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  );
                                })}
                              </div>
                            </TableCell>
                            <TableCell className="border-r text-center">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${(() => { const rs = product.type === 'mayorista' ? (product.saleLevels || []).reduce((s, l) => s + (l.stock || 0), 0) : product.stock; return rs === 0 ? 'bg-red-100 text-red-700' : rs <= 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'; })()}`}>
                                {(() => { const rs = product.type === 'mayorista' ? (product.saleLevels || []).reduce((s, l) => s + (l.stock || 0), 0) : product.stock; return rs === 0 ? 'Agotado' : rs <= 20 ? 'Bajo' : 'OK'; })()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => verProductoMayorista(product)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {userRole === 'admin' && (
                                  <>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-purple-600" onClick={() => {
                                      setSelectedStockHistoryProduct(product);
                                      if (product.type === 'mayorista' && product.saleLevels && product.saleLevels.length > 0) {
                                        const sortedLevels = [...product.saleLevels].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; });
                                        setSelectedHistoryLevel(sortedLevels[0].name);
                                      } else {
                                        setSelectedHistoryLevel('');
                                      }
                                      setIsStockHistoryModalOpen(true);
                                    }}>
                                      <History className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => editarProductoMayorista(product)}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => {
                                      setProductToDelete(product);
                                      setIsDeleteProductConfirmOpen(true);
                                    }}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
            </>
            )}
          </TabsContent>

          <TabsContent value="ventas-dia" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group">
                <div className="h-1 w-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-indigo-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Ventas Hoy</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">{todaysSales.length}</p>
                  </div>
                </CardContent>
              </Card>
              {userRole === 'admin' && (
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group">
                <div className="h-1 w-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-emerald-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Total Hoy</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">
                      S/ {todaysSales.reduce((sum, sale) => sum + sale.total, 0).toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              )}
              {userRole === 'admin' && (
                <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group">
                  <div className="h-1 w-full bg-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-3 sm:p-4">
                    <div className="text-center">
                      <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-violet-600" />
                      <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Ganancia Hoy</p>
                      <p className="text-lg sm:text-2xl font-black text-slate-900">
                        S/ {todaysSales.reduce((sum, sale) => sum + sale.totalProfit, 0).toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group col-span-2 lg:col-span-1">
                <div className="h-1 w-full bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <Package className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-orange-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Prods Vendidos</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">
                      {todaysSales.reduce((total, sale) => total + sale.items.reduce((itemSum, item) => {
                        return (item.product.type === 'peso' || item.product.type === 'metro') ? itemSum + 1 : itemSum + item.quantity;
                      }, 0), 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-100 shadow-sm overflow-hidden group">
                <div className="h-1 w-full bg-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 text-sky-600" />
                    <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Total de Ventas</p>
                    <p className="text-lg sm:text-2xl font-black text-slate-900">{todaysSales.length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <span className="text-xl font-black text-slate-900 tracking-tight">Ventas de Hoy</span>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <div className="flex bg-slate-200/50 p-1 rounded-xl">
                      <Button
                        variant={salesFilter === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setSalesFilter('all')}
                        className={`h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest ${salesFilter === 'all' ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        Todas
                      </Button>
                      <Button
                        variant={salesFilter === 'regular' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setSalesFilter('regular')}
                        className={`h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest ${salesFilter === 'regular' ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        Regulares
                      </Button>
                      <Button
                        variant={salesFilter === 'mayorista' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setSalesFilter('mayorista')}
                        className={`h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest ${salesFilter === 'mayorista' ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        Mayoristas
                      </Button>
                    </div>
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder="Buscar por ID Venta..."
                        value={salesSearch}
                        onChange={(e) => setSalesSearch(e.target.value)}
                        className="pl-10 h-10 border-slate-200 focus:border-indigo-500 rounded-xl" />
                    </div>
                      <Button
                        onClick={() => setIsCloseCashOpen(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white h-10 rounded-xl shadow-lg shadow-slate-200"
                        disabled={todaysSales.length === 0}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        <span className="font-bold uppercase tracking-widest text-[10px]">Cerrar Caja</span>
                      </Button>
                      <Button
                        onClick={() => setIsClearSalesOpen(true)}
                        className="bg-red-600 hover:bg-red-700 text-white h-10 rounded-xl shadow-lg shadow-slate-200"
                        disabled={todaysSales.length === 0}
                      >
                          <Trash2 className="w-4 h-4 mr-2" />
                          <span className="font-bold uppercase tracking-widest text-[10px]">Limpiar</span>
                        </Button>
                      {products.some(p => p.imageUrl?.startsWith('data:')) && (
                        <Button
                          onClick={handleMigrateImages}
                          disabled={isMigrating}
                          className="bg-sky-600 hover:bg-sky-700 text-white h-10 rounded-xl shadow-lg shadow-sky-200"
                        >
                          <CloudUpload className="w-4 h-4 mr-2" />
                          <span className="font-bold uppercase tracking-widest text-[10px]">{isMigrating ? 'Migrando...' : 'Migrar imágenes'}</span>
                        </Button>
                      )}
                    </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="border-t sm:border rounded-lg overflow-hidden">
                  <div className="overflow-auto h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow className="bg-gray-50/50">
                          <TableHead className="border-r">Hora</TableHead>
                          <TableHead className="border-r">ID Venta</TableHead>
                          <TableHead className="border-r">Pago</TableHead>
                          <TableHead className="border-r">Tipo</TableHead>
                          <TableHead className="border-r text-right">Total</TableHead>
                          {userRole === 'admin' && <TableHead className="border-r text-right">Ganancia</TableHead>}
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTodaysSales.slice().reverse().map((sale) => (
                          <TableRow key={sale.id} className="hover:bg-gray-50/50">
                            <TableCell className="border-r text-xs font-medium">
                              {new Date(sale.date).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </TableCell>
                            <TableCell className="border-r font-mono text-xs">
                              #{ticketNumberOf(sale.id)}
                            </TableCell>
                            <TableCell className="border-r">
                              <Badge variant="outline" className={`text-[10px] font-normal capitalize ${getPaymentMethodColor(sale.paymentMethod)}`}>
                                {sale.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell className="border-r">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {sale.items.some(item => item.selectedLevelName === 'Unidad') && (
                                  <Badge className="text-[9px] bg-blue-100 text-blue-700 border-blue-200">
                                    Unidad
                                  </Badge>
                                )}
                                {sale.items.some(item => item.product.type === 'mayorista' || (item.selectedLevelName && item.selectedLevelName !== 'Unidad')) && (
                                  <Badge className="text-[9px] bg-pink-100 text-pink-700 border-pink-200">
                                    Mayorista
                                  </Badge>
                                )}
                                {sale.items.some(item => item.product.type === 'unidad' && !item.selectedLevelName) && (
                                  <Badge className="text-[9px] bg-teal-100 text-teal-700 border-teal-200">
                                    Unidad Simple
                                  </Badge>
                                )}
                                {sale.items.some(item => item.product.type === 'peso') && (
                                  <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">
                                    Peso
                                  </Badge>
                                )}
                                {sale.items.some(item => item.product.type === 'metro') && (
                                  <Badge className="text-[9px] bg-cyan-100 text-cyan-700 border-cyan-200">
                                    Metro
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="border-r text-right text-xs font-bold text-green-600">
                              S/ {sale.total.toFixed(2)}
                            </TableCell>
                            {userRole === 'admin' && (
                              <TableCell className="border-r text-right text-xs font-bold text-purple-600">
                                S/ {sale.totalProfit.toFixed(2)}
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-8 text-slate-600" onClick={() => viewBoleta(sale)}>
                                  <FileText className="w-3 h-3 mr-1" />
                                  <span className="hidden sm:inline">Ticket</span>
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-blue-600" onClick={() => viewSaleDetail(sale)}>
                                  <Eye className="w-3 h-3 mr-1" />
                                  <span className="hidden sm:inline">Ver</span>
                                </Button>
                                {userRole === 'admin' && (
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => {
                                    setSaleToDelete(sale);
                                    setIsDeleteSaleOpen(true);
                                  }}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        {userRole === 'admin' && (
          <TabsContent value="historial-diario" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center justify-between">
                  <span>Historial Diario</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="border-t sm:border rounded-lg overflow-hidden">
                  <div className="overflow-auto h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow className="bg-gray-50/50">
                          <TableHead className="border-r">Fecha</TableHead>
                          <TableHead className="border-r text-right">Total</TableHead>
                          <TableHead className="border-r text-right">Ganancia</TableHead>
                          <TableHead className="border-r text-center">Ventas</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyCloses.slice().sort((a,b) => b.date.localeCompare(a.date)).map((dailyClose) => (
                          <TableRow key={dailyClose.id} className="hover:bg-gray-50/50 text-xs sm:text-sm">
                            <TableCell className="border-r font-medium">
                              {formatearFechaLocal(dailyClose.date)}
                              <span className="block text-[10px] text-gray-400">{formatCloseTime(dailyClose.closeTime)}</span>
                            </TableCell>
                            <TableCell className="border-r text-right font-bold text-green-600">S/ {dailyClose.totalSales.toFixed(2)}</TableCell>
                            <TableCell className="border-r text-right font-bold text-purple-600">S/ {dailyClose.totalProfit.toFixed(2)}</TableCell>
                            <TableCell className="border-r text-center">{dailyClose.salesCount}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-purple-600" onClick={() => { setSelectedCloseDetail(dailyClose); setIsProductosVendidosOpen(true); }}>
                                  <Package className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => { setSelectedCloseDetail(dailyClose); setIsVentasIndividualesOpen(true); }}>
                                  <ShoppingCart className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => viewCloseDetail(dailyClose)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => openDeleteCloseDialog(dailyClose)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {userRole === 'admin' && (
          <TabsContent value="usuarios" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center justify-between">
                  <span>Gestión de Usuarios</span>
                  <Dialog open={isAddUserOpen} onOpenChange={(open) => { setIsAddUserOpen(open); if (!open) setFieldErrors({}); }}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white h-9">
                        <UserPlus className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Nuevo Usuario</span>
                        <span className="sm:hidden">Nuevo</span>
                      </Button>
                    </DialogTrigger>
                      <DialogContent className="sm:max-w-[400px]">
                      <DialogHeader>
                        <DialogTitle>Agregar Nuevo Usuario</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Nombre Completo</Label>
                          <Input
                            className={fieldErrors.name ? "border-red-500" : ""}
                            placeholder="Ej: Juan Pérez"
                            value={newUser.name}
                            onChange={(e) => { setNewUser({ ...newUser, name: e.target.value }); setFieldErrors(prev => ({ ...prev, name: '' })); }} />
                        </div>
                        <div className="space-y-2">
                          <Label>Correo Electrónico</Label>
                          <Input
                            type="email"
                            className={fieldErrors.email ? "border-red-500" : ""}
                            placeholder="Ej: juan@correo.com"
                            value={newUser.email}
                            onChange={(e) => { setNewUser({ ...newUser, email: e.target.value }); setFieldErrors(prev => ({ ...prev, email: '' })); }} />
                        </div>
                        <div className="space-y-2">
                          <Label>Contraseña</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              className={fieldErrors.password ? "border-red-500" : ""}
                              placeholder="Contraseña segura"
                              value={newUser.password}
                              autoComplete="new-password"
                              onChange={(e) => { setNewUser({ ...newUser, password: e.target.value }); setFieldErrors(prev => ({ ...prev, password: '' })); }} />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                            </Button>
                          </div>
                          {fieldErrors.password && <p className="text-[11px] text-red-500">{fieldErrors.password}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Confirmar Contraseña</Label>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? 'text' : 'password'}
                              className={fieldErrors.confirmPassword ? "border-red-500" : ""}
                              placeholder="Repite la contraseña"
                              value={confirmPassword}
                              autoComplete="new-password"
                              onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(prev => ({ ...prev, confirmPassword: '' })); }} />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                            </Button>
                          </div>
                          {fieldErrors.confirmPassword && <p className="text-[11px] text-red-500">{fieldErrors.confirmPassword}</p>}
                        </div>
                        {newUser.role === 'admin' && (
                          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3">
                            <div className="flex gap-2">
                              <User className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-indigo-800">Se crea la cuenta desde aquí</p>
                                <p className="text-[11px] text-indigo-600 mt-0.5">Al guardar se crea el acceso con el rol y el nombre indicados.</p>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Rol</Label>
                          <Select value={newUser.role} onValueChange={(value: 'admin' | 'empleado') => {
                            setNewUser(prev => ({ ...prev, role: value }));
                          }}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="empleado">Empleado</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={agregarUsuario} className="w-full bg-blue-600 hover:bg-blue-700">Agregar Usuario</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="border-t sm:border rounded-lg">
                  <div className="overflow-auto h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow className="bg-gray-50/50">
                          <TableHead className="border-r">Nombre</TableHead>
                          <TableHead className="border-r">Correo</TableHead>
                          <TableHead className="border-r">Rol</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id} className="hover:bg-gray-50/50 text-xs sm:text-sm">
                            <TableCell className="font-medium border-r">{user.name}</TableCell>
                            <TableCell className="border-r text-gray-500">{user.email || '-'}</TableCell>
                            <TableCell className="border-r">
                              <Badge variant={user.role === 'admin' ? "default" : "secondary"} className="text-[10px] capitalize">
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-slate-600"
                                  onClick={() => setViewUser(user)}
                                  title="Ver usuario"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-blue-600"
                                  onClick={() => editarUsuario(user)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600"
                                  onClick={() => user.role === 'empleado' ? setUsuarioAEliminar(user) : null}
                                  disabled={user.role === 'admin' || getCurrentSupabaseUser()?.email === user.email}
                                  title={user.role === 'admin' ? 'Los administradores no se eliminan desde la app' : 'Eliminar empleado'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {userRole === 'admin' && (
          <TabsContent value="clientes" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <span>Clientes</span>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input className="pl-10 h-10 border-slate-200 focus:border-indigo-500 rounded-xl" placeholder="Buscar por documento o nombre…" value={clientesBusca} onChange={(e) => setClientesBusca(e.target.value)} />
                    </div>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white h-9" onClick={abrirNuevoCliente}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Nuevo Cliente</span>
                      <span className="sm:hidden">Nuevo</span>
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="border-t sm:border rounded-lg">
                  <div className="overflow-auto h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow className="bg-gray-50/50">
                          <TableHead className="border-r hidden sm:table-cell w-24">Tipo</TableHead>
                          <TableHead className="border-r">Nº Documento</TableHead>
                          <TableHead className="border-r">Razón Social</TableHead>
                          <TableHead className="border-r hidden sm:table-cell">Teléfono</TableHead>
                          <TableHead className="border-r hidden sm:table-cell">Correo</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clients.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                              No hay clientes registrados todavía.
                            </TableCell>
                          </TableRow>
                        )}
                        {clients.length > 0 && clientesFiltradosTab.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                              Sin resultados para "{clientesBusca}".
                            </TableCell>
                          </TableRow>
                        )}
                        {clientesFiltradosTab.map((c) => (
                          <TableRow key={c.id} className="hover:bg-gray-50/50 text-xs sm:text-sm">
                            <TableCell className="border-r hidden sm:table-cell whitespace-nowrap">
                              <Badge variant="outline" className="text-[10px]">{tipoDocClienteLabel(c.tipoDocumento)}</Badge>
                            </TableCell>
                            <TableCell className="border-r font-medium whitespace-nowrap">
                              {c.numeroDocumento}
                            </TableCell>
                            <TableCell className="border-r">{c.razonSocial}</TableCell>
                            <TableCell className="border-r hidden sm:table-cell text-gray-500">{c.telefono || '-'}</TableCell>
                            <TableCell className="border-r hidden sm:table-cell text-gray-500">{c.email || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-600" onClick={() => setClienteVer(c)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => abrirEditarCliente(c)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setClientToDelete(c)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Dialog open={isAddClientOpen} onOpenChange={(open) => { setIsAddClientOpen(open); if (!open) { setClientToEdit(null); setClientErrors({}); } }}>
              <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                  <DialogTitle>{clientToEdit ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Tipo de Documento</Label>
                    <Select value={clientForm.tipoDocumento} onValueChange={(v) => setClientForm(prev => ({ ...prev, tipoDocumento: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">RUC</SelectItem>
                        <SelectItem value="1">DNI</SelectItem>
                        <SelectItem value="4">Carné de Extranjería</SelectItem>
                        <SelectItem value="7">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                    <div className="space-y-2">
                      <Label>Número de Documento</Label>
                      <div className="flex gap-2">
                        <Input
                          className={clientErrors.numeroDocumento ? 'border-red-500' : ''}
                          placeholder="Ej: 20614583968"
                          value={clientForm.numeroDocumento}
                          onChange={(e) => { setClientForm(prev => ({ ...prev, numeroDocumento: e.target.value })); setClientErrors(prev => ({ ...prev, numeroDocumento: '' })); }} />
                        {clientForm.tipoDocumento === '6' && (
                          <Button type="button" variant="outline" className="shrink-0" disabled={isConsultingRuc} onClick={consultarRucCliente}>
                            <Search className="w-4 h-4 mr-1" />
                            {isConsultingRuc ? 'Consultando…' : 'Consultar'}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Razón Social / Nombre</Label>
                      <Input
                        className={clientErrors.razonSocial ? 'border-red-500' : ''}
                        value={clientForm.razonSocial}
                        onChange={(e) => { setClientForm(prev => ({ ...prev, razonSocial: e.target.value })); setClientErrors(prev => ({ ...prev, razonSocial: '' })); }} />
                    </div>
                    <div className="space-y-2">
                      <Label>Dirección Fiscal</Label>
                      <Input value={clientForm.direccion} onChange={(e) => setClientForm(prev => ({ ...prev, direccion: e.target.value }))} />
                    </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Teléfono</Label>
                      <Input value={clientForm.telefono} onChange={(e) => setClientForm(prev => ({ ...prev, telefono: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Correo</Label>
                      <Input type="email" value={clientForm.email} onChange={(e) => setClientForm(prev => ({ ...prev, email: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddClientOpen(false)}>Cancelar</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={guardarCliente}>
                    {clientToEdit ? 'Guardar Cambios' : 'Guardar Cliente'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={clienteVer !== null} onOpenChange={(open) => { if (!open) setClienteVer(null); }}>
              <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
                <DialogHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-5 text-left">
                  <DialogTitle className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Información del Cliente</DialogTitle>
                  <DialogDescription className="pt-0.5 text-xs font-medium text-slate-500">Consulta RUC • SUNAT Perú</DialogDescription>
                </DialogHeader>
                {clienteVer && (
                  <div className="space-y-5 px-6 py-5">
                    {/* Tarjeta del documento */}
                    <section className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
                          {tipoDocClienteLabel(clienteVer.tipoDocumento)}
                        </span>
                        <span className="font-mono text-xl font-bold tracking-wider text-slate-900 sm:text-2xl">
                          {clienteVer.numeroDocumento}
                        </span>
                        <button
                          type="button"
                          title="Copiar número de documento"
                          onClick={() => {
                            void navigator.clipboard?.writeText(clienteVer.numeroDocumento);
                            toast({ title: 'Copiado', description: `${clienteVer.numeroDocumento} copiado al portapapeles.` });
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-blue-600 hover:shadow-sm active:scale-95"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </section>

                    {/* Datos del cliente */}
                    <section className="divide-y divide-slate-100 rounded-xl border border-slate-200/90 bg-white">
                      <div className="flex flex-col gap-1 p-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 sm:w-1/3">Razón Social</dt>
                        <dd className="flex flex-wrap items-center justify-end gap-2 text-right sm:w-2/3">
                          <span className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">{clienteVer.razonSocial}</span>
                          <span className="inline-flex shrink-0 items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                            {clienteVer.tipoDocumento === '6' && clienteVer.numeroDocumento.startsWith('20') ? 'Persona Jurídica' : 'Persona Natural'}
                          </span>
                        </dd>
                      </div>
                      <div className="flex flex-col gap-1 p-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:w-1/3">
                          <MapPin className="h-4 w-4 shrink-0 text-slate-400" /> Dirección
                        </dt>
                        <dd className="text-right text-sm font-medium leading-relaxed text-slate-800 sm:w-2/3">
                          {clienteVer.direccion || <span className="text-xs italic text-slate-400 sm:text-sm">— Sin registrar —</span>}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 p-3.5">
                        <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:w-1/3">
                          <Phone className="h-4 w-4 shrink-0 text-slate-400" /> Teléfono
                        </dt>
                        <dd className="text-right sm:w-2/3">
                          {clienteVer.telefono
                            ? <span className="text-sm font-medium text-slate-800">{clienteVer.telefono}</span>
                            : <span className="text-xs italic text-slate-400 sm:text-sm">— Sin registrar —</span>}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 p-3.5">
                        <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:w-1/3">
                          <Mail className="h-4 w-4 shrink-0 text-slate-400" /> Correo
                        </dt>
                        <dd className="break-all text-right sm:w-2/3">
                          {clienteVer.email
                            ? <span className="text-sm font-medium text-slate-800">{clienteVer.email}</span>
                            : <span className="text-xs italic text-slate-400 sm:text-sm">— Sin registrar —</span>}
                        </dd>
                      </div>
                    </section>
                  </div>
                )}
                <DialogFooter className="border-t border-slate-100 bg-slate-50/80 px-6 py-4">
                  <Button variant="outline" className="rounded-xl" onClick={() => setClienteVer(null)}>Cerrar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={clientToDelete !== null} onOpenChange={(open) => { if (!open) setClientToDelete(null); }}>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle className="text-red-600">Eliminar Cliente</DialogTitle>
                </DialogHeader>
                {clientToDelete && (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-red-800">{clientToDelete.razonSocial}</p>
                      <p className="text-sm text-red-700">{clientToDelete.numeroDocumento}</p>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      El cliente dejará de aparecer en la lista. Las ventas históricas no se borran.
                    </p>
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" onClick={() => setClientToDelete(null)}>Cancelar</Button>
                      <Button variant="destructive" onClick={eliminarCliente}>Eliminar</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        {userRole === 'admin' && (
          <TabsContent value="emitir" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <span>Comprobantes</span>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <div className="flex bg-slate-200/50 p-1 rounded-xl">
                      <Button
                        variant={comprobanteFiltro === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setComprobanteFiltro('all')}
                        className={`h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest ${comprobanteFiltro === 'all' ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        Todas
                      </Button>
                      <Button
                        variant={comprobanteFiltro === '03' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setComprobanteFiltro('03')}
                        className={`h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest ${comprobanteFiltro === '03' ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        Boletas
                      </Button>
                      <Button
                        variant={comprobanteFiltro === '01' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setComprobanteFiltro('01')}
                        className={`h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest ${comprobanteFiltro === '01' ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        Facturas
                      </Button>
                    </div>
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder="Buscar comprobante..."
                        value={comprobanteBusca}
                        onChange={(e) => setComprobanteBusca(e.target.value)}
                        className="pl-10 h-10 border-slate-200 focus:border-indigo-500 rounded-xl" />
                    </div>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white h-9" onClick={abrirEmitir}>
                      <ReceiptText className="w-4 h-4 mr-2" />
                      Emitir
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {!emisor && (
                  <div className="mx-4 sm:mx-0 mb-4 px-4 py-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-semibold">Configura la Empresa (RUC y razón social) en "Configuración de Impresión y Empresa" antes de emitir comprobantes.</p>
                  </div>
                )}
                <div className="border-t sm:border rounded-lg">
                  <div className="overflow-auto h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow className="bg-gray-50/50">
                          <TableHead className="border-r">Número</TableHead>
                          <TableHead className="border-r">Tipo</TableHead>
                          <TableHead className="border-r hidden sm:table-cell">Cliente</TableHead>
                          <TableHead className="border-r">Total</TableHead>
                          <TableHead className="border-r">Estado</TableHead>
                          <TableHead className="border-r hidden sm:table-cell">Fecha</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comprobantes.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                              Todavía no se ha emitido ningún comprobante.
                            </TableCell>
                          </TableRow>
                        )}
                        {comprobantes.length > 0 && comprobantesFiltrados.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                              Sin resultados para "{comprobanteBusca}".
                            </TableCell>
                          </TableRow>
                        )}
                        {comprobantesFiltrados.map((c) => {
                          const cliente = clients.find(cl => cl.id === c.cliente_id);
                          return (
                            <TableRow key={c.id} className="hover:bg-gray-50/50 text-xs sm:text-sm">
                              <TableCell className="border-r font-medium whitespace-nowrap">{c.numero}</TableCell>
                              <TableCell className="border-r">{tipoComprobanteLabel(c.tipo_documento)}</TableCell>
                              <TableCell className="border-r hidden sm:table-cell">{cliente?.razonSocial || '-'}</TableCell>
                              <TableCell className="border-r">S/ {c.total_venta.toFixed(2)}</TableCell>
                              <TableCell className="border-r">
                                <Badge
                                  className={`text-[10px] capitalize border-transparent ${
                                    c.estado === 'anulado'
                                      ? 'bg-red-100 text-red-700'
                                      : c.estado === 'emitido' || c.estado === 'emitido_local'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-amber-100 text-amber-700'
                                  }`}>
                                  {c.estado}
                                </Badge>
                              </TableCell>
                              <TableCell className="border-r hidden sm:table-cell text-gray-500">
                                {new Date(c.fecha_emision).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-600" onClick={() => void verComprobanteOriginal(c)}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" disabled={c.estado === 'anulado'} onClick={() => setComprobanteAnular(c)}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Dialog open={isEmitOpen} onOpenChange={setIsEmitOpen}>
              <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>Emitir Comprobante</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Venta</Label>
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!emitirSoloHoy}
                          onChange={(e) => setEmitirSoloHoy(!e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        Mostrar todas las ventas sin comprobante
                      </label>
                    </div>
                    <Combobox
                      options={ventaOptions}
                      value={emitForm.ventaId}
                      onChange={(v) => setEmitForm(prev => ({ ...prev, ventaId: v }))}
                      placeholder="Selecciona una venta"
                      searchPlaceholder="Buscar por #Ticket, fecha o monto…"
                      emptyText={ventasPendientes.length === 0 ? (emitirSoloHoy ? 'No hay ventas del día pendientes de comprobante' : 'No hay ventas pendientes de comprobante') : 'Sin resultados'}
                      columns={
                        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <span className="w-12">Ticket #</span>
                          <span className="flex-1">Fecha y Hora</span>
                          <span>Importe Total</span>
                        </div>
                      }
                      badge={
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 whitespace-nowrap">
                          {ventasPendientesCount} pendientes{emitirSoloHoy ? ' (hoy)' : ''}
                        </span>
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Comprobante</Label>
                    <Select
                      value={emitForm.tipoDocumento}
                      onValueChange={(v) => {
                        const serie = series.find(s => s.tipo_documento === v);
                        setEmitForm(prev => ({ ...prev, tipoDocumento: v, serie: serie?.serie ?? '' }));
                        if (v !== '01') {
                          setEmitClienteNoRegistrado(null);
                          setEmitRucInput('');
                        }
                      }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="03">Boleta de Venta</SelectItem>
                        <SelectItem value="01">Factura</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Serie</Label>
                    {(() => {
                      const serieActual = series.find(s => s.serie === emitForm.serie);
                      if (serieActual) {
                        return (
                          <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700 flex items-center justify-between">
                            <span className="font-semibold">{serieActual.serie}</span>
                            {serieActual.descripcion && <span className="text-slate-500 text-xs">{serieActual.descripcion}</span>}
                          </div>
                        );
                      }
                      return (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                          No hay una serie activa para {emitForm.tipoDocumento === '01' ? 'Factura' : 'Boleta'}.
                        </div>
                      );
                    })()}
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente {emitForm.tipoDocumento === '01' ? '(RUC obligatorio)' : '(opcional)'}</Label>
                    {emitForm.tipoDocumento === '01' && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Escribe el RUC y consulta"
                          value={emitRucInput}
                          onChange={(e) => setEmitRucInput(e.target.value)} />
                        <Button type="button" variant="outline" className="shrink-0" disabled={isConsultandoRucEmit} onClick={consultarRucEnEmitir}>
                          <Search className="w-4 h-4 mr-1" />
                          {isConsultandoRucEmit ? 'Consultando…' : 'RUC'}
                        </Button>
                      </div>
                    )}
                    <Combobox
                      options={clienteOptions}
                      value={emitForm.clienteId || 'none'}
                      onChange={(v) => setEmitForm(prev => ({ ...prev, clienteId: v === 'none' ? '' : v }))}
                      placeholder="Selecciona cliente"
                      searchPlaceholder="Buscar cliente por documento o nombre…"
                      emptyText="Sin resultados"
                    />
                    {(() => {
                      const clienteSel = emitForm.clienteId ? clients.find(cl => cl.id === emitForm.clienteId) : null;
                      if (!clienteSel && !emitClienteNoRegistrado) return null;
                      const esNuevo = !clienteSel && !!emitClienteNoRegistrado;
                      const info = clienteSel
                        ? { razonSocial: clienteSel.razonSocial, direccion: clienteSel.direccion }
                        : { razonSocial: emitClienteNoRegistrado!.razonSocial, direccion: emitClienteNoRegistrado!.direccion };
                      return (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Datos del Cliente</p>
                          <div className="flex justify-between gap-3 text-xs">
                            <span className="text-slate-500">Razón Social</span>
                            <span className="font-medium text-slate-900 text-right">{info.razonSocial}</span>
                          </div>
                          <div className="flex justify-between gap-3 text-xs">
                            <span className="text-slate-500">Dirección fiscal</span>
                            <span className="font-medium text-slate-900 text-right">{info.direccion || '-'}</span>
                          </div>
                          {esNuevo && (
                            <>
                              <p className="text-amber-700 text-xs">Cliente no registrado: se guardará al emitir.</p>
                              <Button type="button" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white w-full" onClick={registrarClienteDesdeEmitir}>
                                <UserPlus className="w-4 h-4 mr-1" /> Registrar cliente ahora
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                    Total: <span className="font-semibold text-green-800">
                      S/ {(sales.find(s => s.id === emitForm.ventaId)?.total ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEmitOpen(false)}>Cancelar</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" disabled={isEmitting} onClick={emitirComprobanteActual}>
                    {isEmitting ? 'Emitiendo…' : 'Emitir Comprobante'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isConfirmarClienteOpen} onOpenChange={setIsConfirmarClienteOpen}>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle className="text-amber-600">Cliente no registrado</DialogTitle>
                  <DialogDescription>
                    El cliente <span className="font-semibold text-amber-700">{emitClienteNoRegistrado?.razonSocial}</span> no está en tu lista de clientes. Se guardará automáticamente y la factura se emitirá con sus datos.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setIsConfirmarClienteOpen(false)} disabled={isEmitting}>Cancelar</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" disabled={isEmitting} onClick={confirmarRegistrarClienteYEmitir}>
                    {isEmitting ? 'Guardando…' : 'Guardar y emitir'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={comprobanteAnular !== null} onOpenChange={(open) => { if (!open) setComprobanteAnular(null); }}>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle className="text-red-600">Anular Comprobante</DialogTitle>
                </DialogHeader>
                {comprobanteAnular && (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-red-800">{comprobanteAnular.numero}</p>
                      <p className="text-sm text-red-700">S/ {comprobanteAnular.total_venta.toFixed(2)}</p>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      El comprobante quedará marcado como <span className="font-semibold text-slate-700">anulado</span>. El número no se reutiliza.
                    </p>
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" onClick={() => setComprobanteAnular(null)}>Cancelar</Button>
                      <Button variant="destructive" onClick={anularComprobanteActual}>Anular</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}
      </Tabs>
      <Dialog open={isCloseCashOpen} onOpenChange={setIsCloseCashOpen}>
        <DialogContent className="sm:max-w-[600px] md:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>¿Cerrar caja del día {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-xl font-bold text-green-600">
                    S/ {todaysSales.reduce((sum, sale) => sum + sale.total, 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Productos</p>
                  <p className="text-xl font-bold text-blue-600">
                    {todaysSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => {
                      return (item.product.type === 'peso' || item.product.type === 'metro') ? itemSum + 1 : itemSum + item.quantity;
                    }, 0), 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Ganancias</p>
                  <p className="text-xl font-bold text-purple-600">
                    S/ {todaysSales.reduce((sum, sale) => sum + sale.totalProfit, 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600"># Ventas</p>
                  <p className="text-xl font-bold text-orange-600">{todaysSales.length}</p>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-green-100 rounded-lg p-3 text-center">
                  <p className="text-xs font-bold uppercase text-green-700">Efectivo</p>
                  <p className="text-lg font-bold text-green-800">
                    S/ {todaysSales.filter(s => s.paymentMethod === 'efectivo').reduce((sum, s) => sum + s.total, 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-orange-100 rounded-lg p-3 text-center">
                  <p className="text-xs font-bold uppercase text-orange-700">Tarjeta</p>
                  <p className="text-lg font-bold text-orange-800">
                    S/ {todaysSales.filter(s => s.paymentMethod === 'tarjeta').reduce((sum, s) => sum + s.total, 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-purple-100 rounded-lg p-3 text-center">
                  <p className="text-xs font-bold uppercase text-purple-700">Yape</p>
                  <p className="text-lg font-bold text-purple-800">
                    S/ {todaysSales.filter(s => s.paymentMethod === 'yape').reduce((sum, s) => sum + s.total, 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-100 rounded-lg p-3 text-center">
                  <p className="text-xs font-bold uppercase text-gray-700">Plin</p>
                  <p className="text-lg font-bold text-gray-800">
                    S/ {todaysSales.filter(s => s.paymentMethod === 'plin').reduce((sum, s) => sum + s.total, 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setIsCloseCashOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={cerrarCaja} className="flex-1 success-gradient text-white">
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog><Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden" hideClose>
          {selectedSaleDetail && (
            <div className="flex flex-col max-h-[92vh]">
              <header className="px-6 sm:px-8 pt-6 pb-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200/80">
                      Ticket #{ticketNumberOf(selectedSaleDetail.id)}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Detalle de Venta</h1>
                  <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(selectedSaleDetail.date).toLocaleDateString('es-PE')}</span>
                    <span className="text-slate-300">•</span>
                    <span>{new Date(selectedSaleDetail.date).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                  </p>
                </div>
                <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition">
                  <X className="w-5 h-5" />
                </button>
              </header>
              <div className="px-6 sm:px-8 py-5 overflow-y-auto space-y-5">
                <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-100">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Método Pago</span>
                    <Badge className={getPaymentMethodColor(selectedSaleDetail.paymentMethod)}>{selectedSaleDetail.paymentMethod}</Badge>
                  </div>
                  <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-100">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Atendido por</span>
                    <p className="text-xs font-semibold text-slate-700">
                      {users.find(u => u.id === selectedSaleDetail.userId)?.name || 'Caja'}
                    </p>
                  </div>
                  <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-100">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Importe Cobrado</span>
                    <p className="text-sm font-bold text-slate-900">S/ {selectedSaleDetail.total.toFixed(2)}</p>
                  </div>
                  {userRole === 'admin' && (
                    <div className="bg-emerald-50/80 rounded-2xl p-3 border border-emerald-100">
                      <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block mb-1">Ganancia Neta</span>
                      <p className="text-sm font-bold text-emerald-600">+ S/ {selectedSaleDetail.totalProfit.toFixed(2)}</p>
                    </div>
                  )}
                </section>

                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">Productos Vendidos ({selectedSaleDetail.items.length})</h2>
                  </div>
                  <div className="space-y-3">
                    {selectedSaleDetail.items.map((item, index) => {
                      const isMayoristaItem = item.product.type === 'mayorista' || (!!item.selectedLevelName && item.selectedLevelName !== 'Unidad');
                      const itemTotal = item.totalLinea ?? (
                        isMayoristaItem || item.product.type === 'unidad' ? (item.product.salePrice || 0) * item.quantity : item.product.type === 'peso' ? (item.product.salePricePerKg || 0) * (item.quantity / 1000) : item.product.type === 'metro' ? (item.product.salePrice || 0) * (item.quantity / 100) : (item.product.salePrice || 0) * item.quantity
                      );
                      const getItemProfit = () => {
                        if (item.product.type === 'peso') {
                          const totalKg = item.quantity / 1000;
                          const profitPerKg = (item.product.salePricePerKg || 0) - (item.product.purchasePricePerKg || 0);
                          return profitPerKg * totalKg;
                        }
                        if (item.product.type === 'metro') {
                          return ((item.product.salePrice || 0) - (item.product.purchasePrice || 0)) * (item.quantity / 100);
                        }
                        return ((item.product.salePrice || 0) - (item.product.purchasePrice || 0)) * item.quantity;
                      };
                      const itemProfit = getItemProfit();
                      const typeKey = isMayoristaItem ? 'mayorista' : item.product.type === 'peso' ? 'peso' : item.product.type === 'metro' ? 'metro' : !item.selectedLevelName ? 'unidad-simple' : 'unidad';
                      const palette = {
                        mayorista: { header: 'bg-pink-50 border-pink-100', badge: 'bg-pink-100 text-pink-700', total: 'bg-pink-600' },
                        peso: { header: 'bg-amber-50 border-amber-100', badge: 'bg-amber-100 text-amber-700', total: 'bg-amber-600' },
                        metro: { header: 'bg-cyan-50 border-cyan-100', badge: 'bg-cyan-100 text-cyan-700', total: 'bg-cyan-600' },
                        'unidad-simple': { header: 'bg-teal-50 border-teal-100', badge: 'bg-teal-100 text-teal-700', total: 'bg-teal-600' },
                        unidad: { header: 'bg-blue-50 border-blue-100', badge: 'bg-blue-100 text-blue-700', total: 'bg-blue-600' }
                      }[typeKey];

                      return (
                        <article key={index} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                          <div className={`p-3.5 border-b flex items-center justify-between gap-3 ${palette.header}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center">
                                <Package className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-slate-800 truncate">{item.product.name}</h3>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${palette.badge}`}>
                                  {isMayoristaItem ? 'Mayorista' : item.product.type === 'peso' ? 'Peso' : item.product.type === 'metro' ? 'Metro' : !item.selectedLevelName ? 'Unidad Simple' : 'Unidad'}
                                </span>
                              </div>
                            </div>
                            <div className={`${palette.total} text-white px-3 py-1 rounded-xl text-xs font-bold`}>
                              Total: S/ {itemTotal.toFixed(2)}
                            </div>
                          </div>
                          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {isMayoristaItem && (
                              <div>
                                <span className="text-xs font-medium text-slate-400 block mb-0.5">Nivel vendido</span>
                                <p className="text-sm font-semibold text-slate-900">{item.selectedLevelName || '-'}</p>
                              </div>
                            )}
                            <div>
                              <span className="text-xs font-medium text-slate-400 block mb-0.5">Cantidad</span>
                              <p className="text-sm font-semibold text-slate-900">
                                {item.product.type === 'peso' ? formatWeight(item.quantity) : item.product.type === 'metro' ? formatLength(item.quantity) : `${item.quantity} ${item.selectedLevelName === 'Unidad' ? 'und' : item.selectedLevelName?.toLowerCase() || item.product.baseUnit || 'unid.'}`}
                              </p>
                            </div>
                            {userRole === 'admin' && (
                              <div>
                                <span className="text-xs font-medium text-slate-400 block mb-0.5">P. Compra</span>
                                <p className="text-sm font-semibold text-slate-700">S/ {(item.product.purchasePrice || 0).toFixed(2)}{item.product.type === 'metro' ? '/m' : ''}</p>
                              </div>
                            )}
                            <div>
                              <span className="text-xs font-medium text-slate-400 block mb-0.5">P. Venta</span>
                              <p className="text-sm font-semibold text-emerald-600">
                                {item.product.type === 'peso' ? `S/ ${((item.product.salePricePerKg || 0)).toFixed(2)}/kg` : item.product.type === 'metro' ? `S/ ${(item.product.salePrice || 0).toFixed(2)}/m` : `S/ ${(item.product.salePrice || 0).toFixed(2)}`}
                              </p>
                            </div>
                          </div>
                          {userRole === 'admin' && (
                            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                              <span className="text-slate-500">Rentabilidad estimada</span>
                              <span className="inline-flex items-center gap-1.5 bg-emerald-100/80 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-lg">Ganancia: S/ {itemProfit.toFixed(2)}</span>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-800">S/ {selectedSaleDetail.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm text-slate-600">
                    <span>IGV (18%)</span>
                    <span className="font-medium text-slate-800">S/ {selectedSaleDetail.igv?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="h-px bg-slate-200"></div>
                  <div className="bg-amber-50/90 border border-amber-200/70 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Total Cancelado</span>
                      <span className="text-[11px] text-amber-700/80 block">Pagado con {selectedSaleDetail.paymentMethod}</span>
                    </div>
                    <span className="text-2xl font-extrabold text-amber-600">S/ {selectedSaleDetail.total.toFixed(2)}</span>
                  </div>
                  {userRole === 'admin' && (
                    <div className="flex justify-between items-center text-sm pt-1">
                      <span className="text-slate-600">Ganancia Total</span>
                      <span className="font-semibold text-emerald-600">S/ {selectedSaleDetail.totalProfit.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedSaleDetail.paymentMethod === 'efectivo' && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Monto Recibido</span>
                        <span>S/ {selectedSaleDetail.amountPaid?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Cambio</span>
                        <span>S/ {selectedSaleDetail.change?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog><Dialog open={isCloseDetailOpen} onOpenChange={setIsCloseDetailOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalle del Cierre Diario</DialogTitle>
          </DialogHeader>
          {selectedCloseDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-medium">{formatearFechaLocal(selectedCloseDetail.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Hora de Cierre</p>
                  <p className="font-medium">
                    {formatCloseTime(selectedCloseDetail.closeTime)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cerrado por</p>
                  <p className="font-medium capitalize">{selectedCloseDetail.closedBy}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Resumen de Ventas</h4>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Total Vendido:</span>
                      <span className="font-semibold">S/ {selectedCloseDetail.totalSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ganancias:</span>
                      <span className="font-semibold text-green-600">S/ {selectedCloseDetail.totalProfit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Productos Vendidos:</span>
                      <span className="font-semibold">{selectedCloseDetail.totalItems}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Número de Ventas:</span>
                      <span className="font-semibold">{selectedCloseDetail.salesCount}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Métodos de Pago</h4>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Banknote className="w-4 h-4 text-green-600" />
                        <span>Efectivo:</span>
                      </div>
                      <span className="font-semibold">S/ {selectedCloseDetail.paymentMethods.efectivo.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <CreditCard className="w-4 h-4 text-orange-600" />
                        <span>Tarjeta:</span>
                      </div>
                      <span className="font-semibold">S/ {selectedCloseDetail.paymentMethods.tarjeta.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Smartphone className="w-4 h-4 text-purple-600" />
                        <span>Yape:</span>
                      </div>
                      <span className="font-semibold">S/ {selectedCloseDetail.paymentMethods.yape.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Package className="w-4 h-4 text-cyan-600" />
                        <span>Plin:</span>
                      </div>
                      <span className="font-semibold">S/ {selectedCloseDetail.paymentMethods.plin.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isProductosVendidosOpen} onOpenChange={setIsProductosVendidosOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Resumen por Producto</DialogTitle>
          </DialogHeader>
          {selectedCloseDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-medium">{formatearFechaLocal(selectedCloseDetail.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Hora de Cierre</p>
                  <p className="font-medium">{formatCloseTime(selectedCloseDetail.closeTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cerrado por</p>
                  <p className="font-medium capitalize">{selectedCloseDetail.closedBy}</p>
                </div>
              </div>

              <Separator />

              <div className="max-h-96 overflow-y-auto p-2">
                {(() => {
                  try {
                    if (!selectedCloseDetail || !selectedCloseDetail.date) {
                      return <div className="text-center p-4">No hay datos disponibles</div>;
                    }
                    
                    const savedTransactions = selectedCloseDetail.transacciones;
                    const daysSales = savedTransactions && savedTransactions.length > 0
                      ? savedTransactions
                      : sales.filter(sale => {
                          try {
                            const saleDate = (sale.localDate || getLocalDateStr(new Date(sale.date)));
                            return saleDate === selectedCloseDetail.date;
                          } catch (error) {
                            console.error('Error al comparar fechas:', error);
                            return false;
                          }
                        });
                    
                    const productSummary: {
                      [key: string]: {
                        quantity: number;
                        currentStock: number;
                        salePrice: number;
                        purchasePrice: number;
                        total: number;
                        profit: number;
                        type: string;
                      };
                    } = {};
                    
                    const levelSummary: {
                      [key: string]: {
                        productName: string;
                        levelName: string;
                        quantity: number;
                        salePrice: number;
                        purchasePrice: number;
                        total: number;
                        profit: number;
                      };
                    } = {};

                    const inventoryProducts = products || [];

                    daysSales.forEach(sale => {
                      if (!sale.items || !Array.isArray(sale.items)) return;
                      
                      sale.items.forEach(item => {
                        if (!item.product || !item.product.name) return;
                        
                        if (item.product.type === 'mayorista' || (item.product.type === 'unidad' && item.selectedLevelName)) {
                          // Si la venta vieja no guardo el nivel (nivel_id nulo), se
                          // agrupa igual como "Mayorista" para que el resumen no quede vacio.
                          const nivelTexto = item.selectedLevelName
                            || (item.levelId ? `Nivel ${item.levelId}` : 'Mayorista');
                          const lKey = `${item.product.name}|${nivelTexto}`;
                          if (!levelSummary[lKey]) {
                            levelSummary[lKey] = {
                              productName: item.product.name,
                              levelName: nivelTexto,
                              quantity: 0,
                              salePrice: item.product.salePrice || 0,
                              purchasePrice: item.product.purchasePrice || 0,
                              total: 0,
                              profit: 0
                            };
                          }
                          levelSummary[lKey].quantity += item.quantity || 0;
                          levelSummary[lKey].total += (item.product.salePrice || 0) * (item.quantity || 0);
                          levelSummary[lKey].profit += ((item.product.salePrice || 0) - (item.product.purchasePrice || 0)) * (item.quantity || 0);
                          if (item.product.type === 'mayorista' || item.selectedLevelName !== 'Unidad') return;
                        }
                        
                        const inventoryProduct = inventoryProducts.find(p => p.name === item.product.name);
                        
                        if (!productSummary[item.product.name]) {
                          productSummary[item.product.name] = {
                            quantity: 0,
                            currentStock: inventoryProduct?.stock || 0,
                            salePrice: item.product.salePrice || 0,
                            purchasePrice: item.product.purchasePrice || 0,
                            total: 0,
                            profit: 0,
                            type: item.product.type
                          };
                        }
                        
                        if (item.product.type === 'peso') {
                          const totalKg = item.quantity / 1000;
                          const profitPerKg = (item.product.salePricePerKg || 0) - (item.product.purchasePricePerKg || 0);
                          productSummary[item.product.name].quantity += item.quantity || 0;
                          productSummary[item.product.name].total += (item.product.salePricePerKg || 0) * totalKg;
                          productSummary[item.product.name].profit += profitPerKg * totalKg;
                        } else if (item.product.type === 'metro') {
                          const totalMeters = (item.quantity || 0) / 100;
                          productSummary[item.product.name].quantity += item.quantity || 0;
                          productSummary[item.product.name].total += (item.product.salePrice || 0) * totalMeters;
                          productSummary[item.product.name].profit += ((item.product.salePrice || 0) - (item.product.purchasePrice || 0)) * totalMeters;
                        } else {
                          productSummary[item.product.name].quantity += item.quantity || 0;
                          productSummary[item.product.name].total += (item.product.salePrice || 0) * (item.quantity || 0);
                          productSummary[item.product.name].profit += ((item.product.salePrice || 0) - (item.product.purchasePrice || 0)) * (item.quantity || 0);
                        }
                      });
                    });

                    const regularEntries = Object.entries(productSummary);
                    const levelEntries = Object.values(levelSummary);
                    
                    const filteredRegularEntries = regularEntries.filter(([name]) =>
                      !resumenSearch.trim() || normalizeText(name).includes(normalizeSearch(resumenSearch))
                    );
                    const filteredLevelEntries = levelEntries.filter(item =>
                      !resumenSearch.trim() || normalizeText(item.productName).includes(normalizeSearch(resumenSearch))
                    );
                    
                    const hasRegular = filteredRegularEntries.length > 0;
                    const hasMayorista = filteredLevelEntries.length > 0;

                    const activeTab: 'regular' | 'mayorista' = resumenTab;
                    const showSelector = true;

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          {showSelector && (
                            <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
                              <Button
                                variant={activeTab === 'regular' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setResumenTab('regular')}
                                className={`h-8 rounded-lg text-xs font-bold uppercase tracking-widest ${activeTab === 'regular' ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                              >
                                Unidad / Peso / Metro
                              </Button>
                              <Button
                                variant={activeTab === 'mayorista' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setResumenTab('mayorista')}
                                className={`h-8 rounded-lg text-xs font-bold uppercase tracking-widest ${activeTab === 'mayorista' ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                              >
                                Ventas por Mayor
                              </Button>
                            </div>
                          )}
                          <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                              placeholder="Buscar producto..."
                              value={resumenSearch}
                              onChange={(e) => setResumenSearch(e.target.value)}
                              className="pl-10 h-8 text-sm border-slate-200 focus:border-indigo-500 rounded-lg" />
                          </div>
                        </div>

                        {!hasRegular && !hasMayorista ? (
                          <div className="text-center py-6 text-gray-500">No hay productos vendidos en esta fecha</div>
                        ) : (
                          <>

                        {activeTab === 'regular' && hasRegular && (
                          <div>
                            <Table>
                              <TableHeader className="sticky top-0 bg-white z-10">
                                <TableRow className="bg-gray-50/50">
                                  <TableHead className="border-r">Producto</TableHead>
                                  <TableHead className="border-r text-center">Stock Actual</TableHead>
                                  <TableHead className="border-r text-center">Vendido</TableHead>
                                  <TableHead className="border-r text-center">P. Venta</TableHead>
                                  <TableHead className="border-r text-right">Total Venta</TableHead>
                                  {userRole === 'admin' && (
                                    <>
                                      <TableHead className="border-r text-center">P. Compra</TableHead>
                                      <TableHead className="text-right">Ganancia</TableHead>
                                    </>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredRegularEntries.map(([name, data]) => {
                                  const product = inventoryProducts.find(p => p.name === name);
                                  return (
                                  <TableRow key={name} className="hover:bg-gray-50/50">
                                    <TableCell className="font-medium border-r">
                                      <div className="flex items-center gap-3">
                                        {product?.imageUrl ? (
                                          <img src={product.imageUrl} alt={name} className="w-10 h-10 object-cover rounded-md flex-shrink-0 border" />
                                        ) : (
                                          <div className="w-10 h-10 rounded-md bg-slate-100 border flex items-center justify-center flex-shrink-0">
                                            <Package className="w-5 h-5 text-slate-400" />
                                          </div>
                                        )}
                                        <span className="text-sm font-semibold">{name}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center font-semibold border-r">
                                      {product?.type === 'peso' ? formatWeight(data.currentStock) : product?.type === 'metro' ? formatLength(data.currentStock) : data.currentStock}
                                    </TableCell>
                                    <TableCell className="text-center font-semibold text-amber-600 border-r">
                                      {product?.type === 'peso' ? formatWeight(data.quantity) : product?.type === 'metro' ? formatLength(data.quantity) : data.type === 'unidad' ? `${data.quantity} unid` : data.quantity}
                                    </TableCell>
                                    <TableCell className="text-center border-r">
                                      {product?.type === 'peso'
                                        ? `S/ ${(product.salePricePerKg || 0).toFixed(2)}/kg`
                                        : product?.type === 'metro'
                                          ? `S/ ${(data.salePrice || 0).toFixed(2)}/m`
                                          : `S/ ${(data.salePrice || 0).toFixed(2)}`}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-green-600 border-r">
                                      S/ {(data.total || 0).toFixed(2)}
                                    </TableCell>
                                    {userRole === 'admin' && (
                                      <>
                                        <TableCell className="text-center border-r">
                                          S/ {(data.purchasePrice || 0).toFixed(2)}{product?.type === 'metro' ? '/m' : ''}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-purple-600">
                                          S/ {Math.max(0, data.profit).toFixed(2)}
                                        </TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {activeTab === 'mayorista' && hasMayorista && (
                          <div>
                            <Table>
                              <TableHeader className="sticky top-0 bg-white z-10">
                                <TableRow className="bg-purple-50/30">
                                  <TableHead className="border-r">Producto</TableHead>
                                  <TableHead className="border-r text-center">Nivel</TableHead>
                                  <TableHead className="border-r text-center">Vendido</TableHead>
                                  <TableHead className="border-r text-center">Stock Actual</TableHead>
                                  <TableHead className="border-r text-center">P. Venta</TableHead>
                                  <TableHead className="border-r text-right">Total</TableHead>
                                  {userRole === 'admin' && (
                                    <>
                                      <TableHead className="border-r text-center">P. Compra</TableHead>
                                      <TableHead className="text-right">Ganancia</TableHead>
                                    </>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredLevelEntries.map((item, idx) => {
                                  const product = inventoryProducts.find(p => p.name === item.productName);
                                  const level = product?.saleLevels?.find(l => l.name === item.levelName);
                                  return (
                                  <TableRow key={`${item.productName}-${item.levelName}-${idx}`} className="hover:bg-purple-50/30">
                                    <TableCell className="font-medium border-r">
                                      <div className="flex items-center gap-3">
                                        {product?.imageUrl ? (
                                          <img src={product.imageUrl} alt={item.productName} className="w-10 h-10 object-cover rounded-md flex-shrink-0 border" />
                                        ) : (
                                          <div className="w-10 h-10 rounded-md bg-slate-100 border flex items-center justify-center flex-shrink-0">
                                            <Package className="w-5 h-5 text-slate-400" />
                                          </div>
                                        )}
                                        <span className="text-sm font-semibold">{item.productName}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center font-semibold text-purple-700 border-r">
                                      {item.levelName}
                                    </TableCell>
                                    <TableCell className="text-center font-semibold text-amber-600 border-r">
                                      {item.levelName === 'Unidad' ? `${item.quantity} unid` : `${item.quantity} ${item.levelName.toLowerCase()} (${item.quantity * (level?.baseUnitsContained || 1)} unid)`}
                                    </TableCell>
                                    <TableCell className="text-center border-r">
                                      {product?.stock != null ? `${product.stock} unid` : '-'}
                                    </TableCell>
                                    <TableCell className="text-center border-r">
                                      S/ {(item.salePrice || 0).toFixed(2)} /{item.levelName}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-green-600 border-r">
                                      S/ {(item.total || 0).toFixed(2)}
                                    </TableCell>
                                    {userRole === 'admin' && (
                                      <>
                                        <TableCell className="text-center border-r">
                                          S/ {(item.purchasePrice || 0).toFixed(2)} /{item.levelName}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-purple-600">
                                          S/ {(Math.max(0, item.profit) || 0).toFixed(2)}
                                        </TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        {activeTab === 'regular' && filteredRegularEntries.length === 0 && (
                          <div className="text-center py-6 text-gray-500">No hay ventas de unidad / peso / metro con ese filtro</div>
                        )}
                        {activeTab === 'mayorista' && filteredLevelEntries.length === 0 && (
                          <div className="text-center py-6 text-gray-500">No hay ventas por mayor con ese filtro</div>
                        )}
                          </>
                        )}
                      </div>
                    );
                  } catch (error) {
                    console.error('Error al renderizar productos vendidos:', error);
                    return <div className="text-center py-6 text-red-500">Error al cargar los datos</div>;
                  }
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isVentasIndividualesOpen} onOpenChange={setIsVentasIndividualesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Transacciones</DialogTitle>
          </DialogHeader>
          {selectedCloseDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-medium">{formatearFechaLocal(selectedCloseDetail.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Hora de Cierre</p>
                  <p className="font-medium">{formatCloseTime(selectedCloseDetail.closeTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cerrado por</p>
                  <p className="font-medium capitalize">{selectedCloseDetail.closedBy}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
                  <Button
                    variant={transaccionesFilter === 'all' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setTransaccionesFilter('all')}
                    className={`h-7 rounded-lg text-[10px] font-bold uppercase tracking-widest ${transaccionesFilter === 'all' ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    Todas
                  </Button>
                  <Button
                    variant={transaccionesFilter === 'regular' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setTransaccionesFilter('regular')}
                    className={`h-7 rounded-lg text-[10px] font-bold uppercase tracking-widest ${transaccionesFilter === 'regular' ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    Regulares
                  </Button>
                  <Button
                    variant={transaccionesFilter === 'mayorista' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setTransaccionesFilter('mayorista')}
                    className={`h-7 rounded-lg text-[10px] font-bold uppercase tracking-widest ${transaccionesFilter === 'mayorista' ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    Mayoristas
                  </Button>
                </div>
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por producto o ID..."
                    value={transaccionesSearch}
                    onChange={(e) => setTransaccionesSearch(e.target.value)}
                    className="pl-10 h-8 text-sm border-slate-200 focus:border-indigo-500 rounded-lg" />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto p-2">
                {(() => {
                  try {
                    if (!selectedCloseDetail || !selectedCloseDetail.date) {
                      return <div className="text-center p-4">No hay datos disponibles</div>;
                    }
                    
                    const savedTransactions = selectedCloseDetail.transacciones;
                    const daysSales = savedTransactions && savedTransactions.length > 0
                      ? savedTransactions
                      : sales.filter(sale => {
                          try {
                            const saleDate = (sale.localDate || getLocalDateStr(new Date(sale.date)));
                            return saleDate === selectedCloseDetail.date;
                          } catch (error) {
                            console.error('Error al comparar fechas:', error);
                            return false;
                          }
                        });
                    
                    const filteredDaysSales = daysSales.filter(sale => {
                      if (transaccionesFilter === 'regular') return sale.items.some(item => item.product.type !== 'mayorista' && (!item.selectedLevelName || item.selectedLevelName === 'Unidad'));
                      if (transaccionesFilter === 'mayorista') return sale.items.some(item => item.product.type === 'mayorista' || (item.selectedLevelName && item.selectedLevelName !== 'Unidad'));
                      return true;
                    }).filter(sale => {
                      if (!transaccionesSearch.trim()) return true;
                      return (
                        sale.id.toLowerCase().includes(transaccionesSearch.toLowerCase()) ||
                        sale.items.some(item => normalizeText(item.product?.name || '').includes(normalizeSearch(transaccionesSearch)))
                      );
                    });
                    
                    if (filteredDaysSales.length === 0) {
                      return <div className="text-center p-4">No hay ventas en esta fecha</div>;
                    }
                    
                    return filteredDaysSales.map((sale) => {
                      const hasUnidad = sale.items.some(item => item.selectedLevelName === 'Unidad');
                      const hasUnidadSimple = sale.items.some(item => item.product.type === 'unidad' && !item.selectedLevelName);
                      const hasMayorista = sale.items.some(item => item.product.type === 'mayorista' || (item.selectedLevelName && item.selectedLevelName !== 'Unidad'));
                      const hasPeso = sale.items.some(item => item.product.type === 'peso');
                      const hasMetro = sale.items.some(item => item.product.type === 'metro');
                      return (
                      <Card key={sale.id} className={`mb-3 cursor-pointer hover:shadow-md transition-shadow ${sale.paymentMethod === 'efectivo' ? 'border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/50 to-white' : sale.paymentMethod === 'yape' ? 'border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/50 to-white' : sale.paymentMethod === 'plin' ? 'border-l-4 border-l-sky-500 bg-gradient-to-r from-sky-50/50 to-white' : sale.paymentMethod === 'tarjeta' ? 'border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50/50 to-white' : ''}`} onClick={() => {
                        setSelectedSaleDetail(sale);
                        setIsDetailOpen(true);
                      }}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">{new Date(sale.date).toLocaleTimeString('es-ES', { hour12: true, hour: '2-digit', minute: '2-digit' })}</span>
                              <Badge variant="outline" className="bg-gray-50 text-gray-700">
                                #{ticketNumberOf(sale.id)}
                              </Badge>
                              {hasUnidad && (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                                  Unidad
                                </Badge>
                              )}
                              {hasUnidadSimple && (
                                <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[10px]">
                                  Unidad Simple
                                </Badge>
                              )}
                              {hasMayorista && (
                                <Badge className="bg-pink-100 text-pink-700 border-pink-200 text-[10px]">
                                  Mayorista
                                </Badge>
                              )}
                              {hasPeso && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                                  Peso
                                </Badge>
                              )}
                              {hasMetro && (
                                <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 text-[10px]">
                                  Metro
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className={getPaymentMethodColor(sale.paymentMethod)}>
                                {sale.paymentMethod.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex justify-end items-center">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-lg">S/ {sale.total.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" className="h-7 text-slate-600 text-[10px]" onClick={() => viewBoleta(sale)}>
                              📋 Ticket
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )});
                  } catch (error) {
                    console.error('Error al renderizar ventas individuales:', error);
                    return <div className="text-center p-4 text-red-500">Error al cargar ventas</div>;
                  }
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditProductOpen} onOpenChange={setIsEditProductOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4">
              <div>
                <Label>Nombre del Producto</Label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Precio Compra (S/)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={editingProduct.purchasePrice ? editingProduct.purchasePrice.toFixed(2) : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const normalized = raw.replace(',', '.');
                      if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                        const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                        setEditingProduct({ ...editingProduct, purchasePrice: num });
                      }
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.replace(',', '.');
                      if (v !== '' && !isNaN(Number(v))) {
                        const n = Math.round((parseFloat(v) || 0) * 100) / 100;
                        setEditingProduct({ ...editingProduct, purchasePrice: n });
                      }
                    }} />
                </div>
                <div>
                  <Label>Precio Venta (S/)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={editingProduct.salePrice ? editingProduct.salePrice.toFixed(2) : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const normalized = raw.replace(',', '.');
                      if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                        const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                        setEditingProduct({ ...editingProduct, salePrice: num });
                      }
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.replace(',', '.');
                      if (v !== '' && !isNaN(Number(v))) {
                        const n = Math.round((parseFloat(v) || 0) * 100) / 100;
                        setEditingProduct({ ...editingProduct, salePrice: n });
                      }
                    }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const hasSales = stockHistory.some(h => h.productId === editingProduct.id && h.type === 'sale');
                  return (
                    <>
                      <div>
                        <Label>Stock Actual</Label>
                        <Input
                          type="text"
                          placeholder="0"
                          value={editingProduct.stock || ''}
                          onChange={(e) => {
                            if (hasSales) return;
                            const value = e.target.value;
                            if (value === '' || /^\d+$/.test(value)) {
                              setEditingProduct({ ...editingProduct, stock: value === '' ? 0 : parseInt(value) || 0 });
                            }
                          }}
                          className={hasSales ? 'opacity-60 cursor-not-allowed' : ''}
                          disabled={hasSales}
                        />
                      </div>
                      {hasSales && (
                        <div className="col-span-2">
                          <p className="text-[10px] text-amber-600 font-medium">⚠️ Stock bloqueado porque ya se realizaron ventas. Usa <strong>"Restock"</strong> en Historial de Stock.</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div>
                <Label>Categoría</Label>
                <Input
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })} />
              </div>
              <Separator />
              <div>
                <Label>Imagen del producto</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditProductImage(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setEditProductImagePreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div className="mt-3">
                  {editProductImagePreview ? (
                    <img src={editProductImagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border" />
                  ) : editingProduct.imageUrl ? (
                    <div className="relative">
                      <img src={editingProduct.imageUrl} alt={editingProduct.name} className="w-full h-40 object-cover rounded-lg border" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 rounded-full"
                        onClick={() => {
                          setEditingProduct({ ...editingProduct, imageUrl: undefined });
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-slate-100 rounded-lg border flex items-center justify-center">
                      <Package className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                </div>
              </div>
              <Button onClick={guardarEdicionProducto} className="w-full">
                Guardar Cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog><Dialog open={isEditUserOpen} onOpenChange={(open) => {
        setIsEditUserOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <Label>Nombre Completo</Label>
                <Input
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} />
              </div>
              <div>
                <Label>Correo Electrónico <span className="text-slate-400 text-xs">(no editable)</span></Label>
                <Input
                  type="email"
                  disabled
                  value={editingUser.email} />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-slate-700">Cambiar contraseña</p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Nueva contraseña (mín. 6)"
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    className="h-9 text-xs"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    className="h-9 text-xs shrink-0"
                    disabled={isChangingUserPassword}
                    onClick={definirPasswordUsuario}
                  >
                    {isChangingUserPassword ? 'Guardando…' : 'Definir'}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Rol</Label>
                <Select value={editingUser.role} onValueChange={(value: 'admin' | 'empleado') => setEditingUser({ ...editingUser, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empleado">Empleado</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={guardarEdicionUsuario} className="w-full">Guardar Cambios</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={usuarioAEliminar !== null} onOpenChange={(open) => { if (!open) setUsuarioAEliminar(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Eliminar al Empleado</DialogTitle>
          </DialogHeader>
          {usuarioAEliminar && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-800">{usuarioAEliminar.name}</p>
                <p className="text-sm text-red-700">{usuarioAEliminar.email}</p>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                El empleado quedará <span className="font-semibold text-slate-700">bloqueado y dejará de ver el sistema</span>.
                Para quitarle el acceso por completo, bórralo también en
                <span className="font-semibold text-slate-700"> Supabase → Authentication → Users</span>.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setUsuarioAEliminar(null)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={() => eliminarUsuario(usuarioAEliminar.id)}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viewUser !== null} onOpenChange={(open) => { if (!open) setViewUser(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Información del Usuario</DialogTitle>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border">
                <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-md">
                  {viewUser.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{viewUser.name}</p>
                  <Badge variant={viewUser.role === 'admin' ? "default" : "secondary"} className="mt-1 text-[10px] capitalize">
                    {viewUser.role === 'admin' ? 'Administrador' : 'Empleado'}
                  </Badge>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600">Correo Electrónico</p>
                    <p className="font-medium text-gray-900 break-all">{viewUser.email || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Fecha de creación</p>
                    <p className="font-medium text-gray-900">
                      {viewUser.createdAt ? new Date(viewUser.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </p>
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={() => setViewUser(null)}>Cerrar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para agregar peso */}
      <Dialog open={isWeightModalOpen} onOpenChange={setIsWeightModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar Peso</DialogTitle>
          </DialogHeader>
          {selectedWeightProduct && (
            <div className="space-y-4">
              {selectedWeightProduct.imageUrl ? (
                <div className="rounded-lg overflow-hidden border bg-slate-50 flex items-center justify-center">
                  <img src={selectedWeightProduct.imageUrl} alt={selectedWeightProduct.name} className="w-full h-40 object-contain" />
                </div>
              ) : (
                <div className="rounded-lg h-24 bg-slate-100 border flex items-center justify-center">
                  <Package className="w-10 h-10 text-slate-300" />
                </div>
              )}
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border">
                <div>
                  <h3 className="font-bold text-base">{selectedWeightProduct.name}</h3>
                  <p className="text-xs text-gray-500">Stock: {formatWeight(selectedWeightProduct.stock)}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-600 font-bold text-sm">S/ {((selectedWeightProduct.salePricePerKg || 0) / 1000).toFixed(3)} / g</p>
                  <p className="text-blue-600 font-bold text-xs">S/ {(selectedWeightProduct.salePricePerKg || 0).toFixed(2)} / kg</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { grams: 250, label: "250 g", kgLabel: "1/4 kg" },
                    { grams: 500, label: "500 g", kgLabel: "1/2 kg" },
                    { grams: 1000, label: "1000 g", kgLabel: "1 kg" }
                  ].map((item) => (
                    <div key={item.grams} className="text-center">
                      <p className="text-xs font-bold text-gray-700 mb-1">{item.kgLabel}</p>
                      <Button
                        variant="outline"
                        className="w-full mb-2 text-xs"
                        onClick={() => handleWeightQuantityChange(item.grams.toString(), (weightQuantities[item.grams.toString()] || 0) + 1)}
                      >
                        {item.label}
                      </Button>
                      <div className="flex items-center justify-center space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleWeightQuantityChange(item.grams.toString(), Math.max(0, (weightQuantities[item.grams.toString()] || 0) - 1))}
                        >
                          -
                        </Button>
                        <span className="text-sm font-medium">{weightQuantities[item.grams.toString()] || 0}</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleWeightQuantityChange(item.grams.toString(), 0)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label htmlFor={weightInputMode === 'grams' ? 'customWeight' : 'customMoney'}>
                      {weightInputMode === 'grams' ? 'O ingresa peso manualmente' : 'O ingresa valor de la venta'}
                    </Label>
                    <div className="flex space-x-1 bg-slate-100 p-0.5 rounded-md border text-xs">
                      <Button
                        type="button"
                        variant={weightInputMode === 'grams' ? 'default' : 'ghost'}
                        className={`h-6 px-2 text-[10px] rounded-sm font-semibold ${weightInputMode === 'grams' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
                        onClick={() => {
                          setWeightInputMode('grams');
                          setCustomMoney('');
                        }}
                      >
                        En Gramos
                      </Button>
                      <Button
                        type="button"
                        variant={weightInputMode === 'money' ? 'default' : 'ghost'}
                        className={`h-6 px-2 text-[10px] rounded-sm font-semibold ${weightInputMode === 'money' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
                        onClick={() => {
                          setWeightInputMode('money');
                          setCustomWeight('');
                        }}
                      >
                        En Soles
                      </Button>
                    </div>
                  </div>

                  {weightInputMode === 'grams' ? (
                    <Input
                      type="text"
                      placeholder="ej. 350 gramos"
                      id="customWeight"
                      value={customWeight === '0' && !document.activeElement?.id?.includes('customWeight') ? '' : customWeight}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^[0-9]*[.]?[0-9]*$/.test(value)) {
                          setCustomWeight(value === '' ? '' : value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!/[0-9.]/.test(e.key) && 
                            !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                    />
                  ) : (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">S/</span>
                        <Input
                          type="text"
                          placeholder="ej. 5.00"
                          id="customMoney"
                          className="pl-8"
                          value={customMoney}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^[0-9]*[.]?[0-9]*$/.test(value)) {
                              setCustomMoney(value === '' ? '' : value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (!/[0-9.]/.test(e.key) && 
                                !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                        />
                      </div>
                      {customMoney && parseFloat(customMoney) > 0 && (
                        <p className="text-xs text-blue-600 font-semibold mt-1">
                          Equivale a: {(() => {
                            const pricePerKg = selectedWeightProduct.salePricePerKg || 0;
                            const equiv = pricePerKg > 0 ? Math.round((parseFloat(customMoney) * 1000) / pricePerKg) : 0;
                            return formatWeight(equiv);
                          })()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex justify-between">
                    <span>Peso Total:</span>
                    <span className="font-bold">
                      {(() => {
                        let total = 0;
                        Object.entries(weightQuantities).forEach(([weight, quantity]) => {
                          total += parseInt(weight) * quantity;
                        });
                        if (weightInputMode === 'grams') {
                          if (customWeight && parseFloat(customWeight) > 0) {
                            total += parseFloat(customWeight);
                          }
                        } else {
                          if (customMoney && parseFloat(customMoney) > 0) {
                            const pricePerKg = selectedWeightProduct.salePricePerKg || 0;
                            total += pricePerKg > 0 ? Math.round((parseFloat(customMoney) * 1000) / pricePerKg) : 0;
                          }
                        }
                        return formatWeight(total);
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Precio Total:</span>
                    <span className="font-bold text-green-600">
                      S/ {(() => {
                        let totalWeight = 0;
                        Object.entries(weightQuantities).forEach(([weight, quantity]) => {
                          totalWeight += parseInt(weight) * quantity;
                        });
                        if (weightInputMode === 'grams') {
                          if (customWeight && parseFloat(customWeight) > 0) {
                            totalWeight += parseFloat(customWeight);
                          }
                        } else {
                          if (customMoney && parseFloat(customMoney) > 0) {
                            const pricePerKg = selectedWeightProduct.salePricePerKg || 0;
                            totalWeight += pricePerKg > 0 ? Math.round((parseFloat(customMoney) * 1000) / pricePerKg) : 0;
                          }
                        }
                        return ((selectedWeightProduct.salePricePerKg || 0) * (totalWeight / 1000)).toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              </div>
              
              <Button onClick={handleAddWeightToCart} className="w-full bg-green-600 hover:bg-green-700">
                Agregar al Carrito
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para agregar metro */}
      <Dialog open={isMetroModalOpen} onOpenChange={setIsMetroModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar Metro</DialogTitle>
          </DialogHeader>
          {selectedMetroProduct && (
            <div className="space-y-4">
              {selectedMetroProduct.imageUrl ? (
                <div className="rounded-lg overflow-hidden border bg-slate-50 flex items-center justify-center">
                  <img src={selectedMetroProduct.imageUrl} alt={selectedMetroProduct.name} className="w-full h-40 object-contain" />
                </div>
              ) : (
                <div className="rounded-lg h-24 bg-slate-100 border flex items-center justify-center">
                  <Package className="w-10 h-10 text-slate-300" />
                </div>
              )}
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border">
                <div>
                  <h3 className="font-bold text-base">{selectedMetroProduct.name}</h3>
                  <p className="text-xs text-gray-500">Stock: {formatLength(selectedMetroProduct.stock)}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-600 font-bold text-sm">S/ {((selectedMetroProduct.salePrice || 0) / 100).toFixed(3)} / cm</p>
                  <p className="text-blue-600 font-bold text-xs">S/ {(selectedMetroProduct.salePrice || 0).toFixed(2)} / m</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { centimeters: 25, label: "25 cm", meterLabel: "1/4 m" },
                    { centimeters: 50, label: "50 cm", meterLabel: "1/2 m" },
                    { centimeters: 100, label: "100 cm", meterLabel: "1 m" }
                  ].map((item) => (
                    <div key={item.centimeters} className="text-center">
                      <p className="text-xs font-bold text-gray-700 mb-1">{item.meterLabel}</p>
                      <Button
                        variant="outline"
                        className="w-full mb-2 text-xs"
                        onClick={() => handleMetroQuantityChange(item.centimeters, (metroQuantities[item.centimeters.toString()] || 0) + 1)}
                      >
                        {item.label}
                      </Button>
                      <div className="flex items-center justify-center space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMetroQuantityChange(item.centimeters, Math.max(0, (metroQuantities[item.centimeters.toString()] || 0) - 1))}
                        >
                          -
                        </Button>
                        <span className="text-sm font-medium">{metroQuantities[item.centimeters.toString()] || 0}</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleMetroQuantityChange(item.centimeters, 0)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label htmlFor={metroInputMode === 'meters' ? 'customMeters' : 'customMetroMoney'}>
                      {metroInputMode === 'meters' ? 'O ingresa metros manualmente' : 'O ingresa valor de la venta'}
                    </Label>
                    <div className="flex space-x-1 bg-slate-100 p-0.5 rounded-md border text-xs">
                      <Button
                        type="button"
                        variant={metroInputMode === 'meters' ? 'default' : 'ghost'}
                        className={`h-6 px-2 text-[10px] rounded-sm font-semibold ${metroInputMode === 'meters' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
                        onClick={() => {
                          setMetroInputMode('meters');
                          setCustomMetroMoney('');
                        }}
                      >
                        En Metros
                      </Button>
                      <Button
                        type="button"
                        variant={metroInputMode === 'money' ? 'default' : 'ghost'}
                        className={`h-6 px-2 text-[10px] rounded-sm font-semibold ${metroInputMode === 'money' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
                        onClick={() => {
                          setMetroInputMode('money');
                          setCustomMeters('');
                        }}
                      >
                        En Soles
                      </Button>
                    </div>
                  </div>

                  {metroInputMode === 'meters' ? (
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="ej. 2.50 metros"
                      id="customMeters"
                      value={customMeters}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*(?:[.,]\d{0,2})?$/.test(value)) {
                          setCustomMeters(value);
                        }
                      }}
                    />
                  ) : (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">S/</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="ej. 5.00"
                          id="customMetroMoney"
                          className="pl-8"
                          value={customMetroMoney}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*(?:[.,]\d{0,2})?$/.test(value)) {
                              setCustomMetroMoney(value);
                            }
                          }}
                        />
                      </div>
                      {customMetroMoney && parseFloat(normalizeDecimalInput(customMetroMoney)) > 0 && (
                        <p className="text-xs text-blue-600 font-semibold mt-1">
                          Equivale a: {(() => {
                            const pricePerMeter = selectedMetroProduct.salePrice || 0;
                            const money = parseFloat(normalizeDecimalInput(customMetroMoney)) || 0;
                            const cm = pricePerMeter > 0 ? Math.round((money / pricePerMeter) * 100) : 0;
                            return formatLength(cm);
                          })()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex justify-between">
                    <span>Longitud Total:</span>
                    <span className="font-bold">
                      {(() => {
                        let total = 0;
                        Object.entries(metroQuantities).forEach(([centimeters, quantity]) => {
                          total += Number(centimeters) * quantity;
                        });
                        if (metroInputMode === 'meters') {
                          const meters = parseFloat(normalizeDecimalInput(customMeters)) || 0;
                          if (meters > 0) total += Math.round(meters * 100);
                        } else {
                          const pricePerMeter = selectedMetroProduct.salePrice || 0;
                          const money = parseFloat(normalizeDecimalInput(customMetroMoney)) || 0;
                          if (money > 0 && pricePerMeter > 0) total += Math.round((money / pricePerMeter) * 100);
                        }
                        return formatLength(total);
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Precio Total:</span>
                    <span className="font-bold text-green-600">
                      S/ {(() => {
                        let totalCm = 0;
                        Object.entries(metroQuantities).forEach(([centimeters, quantity]) => {
                          totalCm += Number(centimeters) * quantity;
                        });
                        if (metroInputMode === 'meters') {
                          const meters = parseFloat(normalizeDecimalInput(customMeters)) || 0;
                          if (meters > 0) totalCm += Math.round(meters * 100);
                        } else {
                          const pricePerMeter = selectedMetroProduct.salePrice || 0;
                          const money = parseFloat(normalizeDecimalInput(customMetroMoney)) || 0;
                          if (money > 0 && pricePerMeter > 0) totalCm += Math.round((money / pricePerMeter) * 100);
                        }
                        return ((selectedMetroProduct.salePrice || 0) * (totalCm / 100)).toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <Button onClick={handleAddMetroToCart} className="w-full bg-green-600 hover:bg-green-700">
                Agregar al Carrito
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para venta mayorista */}
      <Dialog open={isMayoristaModalOpen} onOpenChange={setIsMayoristaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedMayoristaProduct?.saleLevels?.some(l => l.name === 'Unidad') ? 'Seleccionar Venta' : 'Venta Mayorista'}</DialogTitle>
          </DialogHeader>
          {selectedMayoristaProduct && (
            <div className="space-y-4">
              {selectedMayoristaProduct.imageUrl ? (
                <div className="rounded-lg overflow-hidden border bg-slate-50 flex items-center justify-center">
                  <img src={selectedMayoristaProduct.imageUrl} alt={selectedMayoristaProduct.name} className="w-full h-40 object-contain" />
                </div>
              ) : (
                <div className="rounded-lg h-24 bg-slate-100 border flex items-center justify-center">
                  <Package className="w-10 h-10 text-slate-300" />
                </div>
              )}
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border">
                <div>
                  <h3 className="font-bold text-base">{selectedMayoristaProduct.name}</h3>
                </div>
                <p className="text-xs text-gray-500">
                  {selectedMayoristaProduct.type === 'mayorista'
                    ? 'Stock disponible por niveles'
                    : `Stock: ${selectedMayoristaProduct.stock} unid.`}
                </p>
              </div>

              <div className="space-y-3">
                <Label>Nivel de Venta</Label>
                <div className="grid gap-2">
                  {selectedMayoristaProduct.saleLevels?.map((level) => {
                    const isUnidadBased = selectedMayoristaProduct.saleLevels?.some(l => l.name === 'Unidad');
                    const stockBase = isUnidadBased
                      ? (selectedMayoristaProduct.saleLevels?.find(l => l.name === 'Unidad')?.stock ?? 0)
                      : selectedMayoristaProduct.stock;
                    const availableStock = isUnidadBased
                      ? Math.floor(stockBase / level.baseUnitsContained)
                      : level.stock;
                    const hasStock = isUnidadBased
                      ? stockBase >= level.baseUnitsContained
                      : level.stock > 0;
                    return (
                    <div
                      key={level.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        !hasStock ? 'opacity-50 cursor-not-allowed' :
                        selectedLevelId === level.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      onClick={() => {
                        if (!hasStock) return;
                        setSelectedLevelId(level.id);
                        setMayoristaQuantity(1);
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{level.name}</p>
                            {!hasStock && (
                              <Badge variant="secondary" className="text-[9px] bg-red-100 text-red-700 border-red-200">
                                Sin stock
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {level.name === 'Unidad' ? '1 unid.' : `Contiene: ${level.baseUnitsContained} unid.`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">S/ {(level.salePrice ?? 0).toFixed(2)}</p>
                          {level.name === 'Unidad' ? (
                            <p className="text-sm text-indigo-600 font-semibold">Stock: {stockBase} unid.</p>
                          ) : (
                            <p className="text-sm text-indigo-600 font-semibold">Stock: {availableStock} {level.name}(s)</p>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              {selectedLevelId && (() => {
                const selectedLevel = selectedMayoristaProduct.saleLevels?.find(l => l.id === selectedLevelId);
                if (!selectedLevel) return null;
                const isUnidadBased = selectedMayoristaProduct.saleLevels?.some(l => l.name === 'Unidad');
                const stockBase = isUnidadBased
                  ? (selectedMayoristaProduct.saleLevels?.find(l => l.name === 'Unidad')?.stock ?? 0)
                  : selectedMayoristaProduct.stock;
                const maxLevels = isUnidadBased
                  ? Math.floor(stockBase / selectedLevel.baseUnitsContained)
                  : selectedLevel.stock;
                return (
                  <div className="space-y-3">
                    <div>
                      <Label>Cantidad ({selectedLevel.name}(s))</Label>
                      <div className="flex items-center space-x-3 mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 w-9"
                          onClick={() => {
                            const currentVal = typeof mayoristaQuantity === 'number' ? mayoristaQuantity : (parseInt(mayoristaQuantity) || 1);
                            setMayoristaQuantity(Math.max(1, currentVal - 1));
                          }}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          max={maxLevels}
                          value={mayoristaQuantity}
                          onChange={(e) => {
                            if (e.target.value === '') {
                              setMayoristaQuantity('');
                              return;
                            }
                            let val = parseInt(e.target.value);
                            if (isNaN(val)) return;
                            if (val < 1) val = 1;
                            if (val > maxLevels) val = maxLevels;
                            setMayoristaQuantity(val);
                          }}
                          onBlur={(e) => {
                            let val = parseInt(e.target.value);
                            if (isNaN(val) || val < 1) val = 1;
                            if (val > maxLevels) val = maxLevels;
                            setMayoristaQuantity(val);
                          }}
                          className="text-center h-9 w-20"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 w-9"
                          onClick={() => {
                            const currentVal = typeof mayoristaQuantity === 'number' ? mayoristaQuantity : (parseInt(mayoristaQuantity) || 1);
                            setMayoristaQuantity(Math.min(maxLevels, currentVal + 1));
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Máx: {maxLevels} {selectedLevel.name}(s)</p>
                    </div>

                    <Separator />

                    <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Precio por {selectedLevel.name}:</span>
                        <span className="font-semibold">S/ {(selectedLevel.salePrice ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Cantidad:</span>
                        <span className="font-semibold">
                          {typeof mayoristaQuantity === 'number' ? mayoristaQuantity : (parseInt(mayoristaQuantity) || 0)} {selectedLevel.name}(s)
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-green-600">
                          S/ {(selectedLevel.salePrice * (typeof mayoristaQuantity === 'number' ? mayoristaQuantity : (parseInt(mayoristaQuantity) || 0))).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={handleAddMayoristaToCart}
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                    >
                      Agregar al Carrito
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para editar producto de peso */}
      <Dialog open={isEditWeightProductOpen} onOpenChange={setIsEditWeightProductOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Producto por Peso</DialogTitle>
          </DialogHeader>
          {editingWeightProduct && (
            <div className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input 
                  placeholder="Ej: Queso Fresco" 
                  value={editingWeightProduct.name} 
                  onChange={(e) => setEditingWeightProduct({...editingWeightProduct, name: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="block min-h-[20px]">Precio de Compra por Kilo</Label>
                  <Input 
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={editPurchasePerKgInput} 
                    onChange={(e) => {
                      const raw = e.target.value;
                      const normalized = raw.replace(',', '.');
                      if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                        setEditPurchasePerKgInput(raw);
                        const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                        setEditingWeightProduct({...editingWeightProduct, purchasePrice: num, purchasePricePerKg: num});
                      }
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.replace(',', '.');
                      if (v !== '' && !isNaN(Number(v))) {
                        const n = Math.round(parseFloat(v) * 100) / 100;
                        setEditingWeightProduct({ ...editingWeightProduct, purchasePrice: n, purchasePricePerKg: n });
                        setEditPurchasePerKgInput(n.toFixed(2));
                      } else {
                        setEditPurchasePerKgInput('');
                      }
                    }}
                  />
                </div>
                <div>
                  <Label className="block min-h-[20px]">Precio de Venta por Kilo</Label>
                  <Input 
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={editSalePerKgInput} 
                    onChange={(e) => {
                      const raw = e.target.value;
                      const normalized = raw.replace(',', '.');
                      if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                        setEditSalePerKgInput(raw);
                        const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                        setEditingWeightProduct({...editingWeightProduct, salePrice: num, salePricePerKg: num});
                      }
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.replace(',', '.');
                      if (v !== '' && !isNaN(Number(v))) {
                        const n = Math.round(parseFloat(v) * 100) / 100;
                        setEditingWeightProduct({ ...editingWeightProduct, salePrice: n, salePricePerKg: n });
                        setEditSalePerKgInput(n.toFixed(2));
                      } else {
                        setEditSalePerKgInput('');
                      }
                    }}
                  />
                </div>
              </div>
              <div className={`text-sm text-green-600 font-medium ${pricePulse ? 'animate-pulse' : ''}`}>
                Precio de Venta por Gramo: S/ {((editingWeightProduct.salePrice || 0) / 1000).toFixed(3)}
              </div>
                <div>
                <Label>Equivale por gramo</Label>
                <Input 
                  type="number"
                  step="0.001"
                  inputMode="decimal"
                  placeholder="0.020"
                  value={editingWeightProduct.equivalentGrams ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(',', '.');
                    if (v === '' || /^\d*(?:[.,]\d{0,3})?$/.test(v)) {
                      setEditingWeightProduct({
                        ...editingWeightProduct,
                        equivalentGrams: v === '' ? 0 : parseFloat(v) || 0
                      });
                    }
                  }}
                  onBlur={(e) => {
                    const v = e.target.value.replace(',', '.');
                    if (v !== '') {
                      const n = Math.round((parseFloat(v) || 0) * 1000) / 1000;
                      setEditingWeightProduct({ ...editingWeightProduct, equivalentGrams: n });
                    }
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(() => {
                  const hasSales = stockHistory.some(h => h.productId === editingWeightProduct.id && h.type === 'sale');
                  return (
                    <>
                      <div>
                        <Label>Stock actual (g)</Label>
                        <Input 
                          type="text" 
                          placeholder="9000" 
                          value={editingWeightProduct.stock || ''} 
                          onChange={(e) => {
                            if (hasSales) return;
                            const value = e.target.value;
                            if (value === '' || /^\d+$/.test(value)) {
                              setEditingWeightProduct({...editingWeightProduct, stock: value === '' ? 0 : parseInt(value) || 0});
                            }
                          }}
                          className={hasSales ? 'opacity-60 cursor-not-allowed' : ''}
                          disabled={hasSales}
                        />
                      </div>
                      <div className="flex items-end">
                        {hasSales ? (
                          <p className="text-[10px] text-amber-600 font-medium w-full">⚠️ Stock bloqueado. Usa <strong>"Restock"</strong> en Historial.</p>
                        ) : (
                          <div className="p-2 bg-green-100 text-green-800 rounded-md text-center w-full">
                            <p className="text-xs">Conversión</p>
                            <p className="font-bold">{formatWeight(editingWeightProduct.stock)}</p>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div>
                <Label>Peso mínimo (g)</Label>
                <Input 
                  type="text" 
                  placeholder="10" 
                  id="editMinWeightGrams"
                  value={editingWeightProduct.minWeightGrams === 0 && !document.activeElement?.id?.includes('editMinWeightGrams') ? '' : (editingWeightProduct.minWeightGrams || '').toString()} 
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^[0-9]*$/.test(value)) {
                      setEditingWeightProduct({...editingWeightProduct, minWeightGrams: value === '' ? 0 : parseInt(value)});
                    }
                  }}
                  onKeyDown={(e) => {
                    if (!/\d/.test(e.key) && 
                        !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }} 
                />
              </div>
              <div>
                <Label>Categoría</Label>
                <Input 
                  placeholder="Ej: Especias" 
                  value={editingWeightProduct.category} 
                  onChange={(e) => setEditingWeightProduct({...editingWeightProduct, category: e.target.value})} 
                />
              </div>
              <Separator />
              <div>
                <Label>Imagen del producto</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditProductImage(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setEditProductImagePreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div className="mt-3">
                  {editProductImagePreview ? (
                    <img src={editProductImagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border" />
                  ) : editingWeightProduct.imageUrl ? (
                    <div className="relative">
                      <img src={editingWeightProduct.imageUrl} alt={editingWeightProduct.name} className="w-full h-40 object-cover rounded-lg border" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 rounded-full"
                        onClick={() => {
                          setEditingWeightProduct({ ...editingWeightProduct, imageUrl: undefined });
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-slate-100 rounded-lg border flex items-center justify-center">
                      <Package className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                </div>
              </div>
              <Button onClick={guardarEdicionProductoPeso} className="w-full bg-green-600 hover:bg-green-700">
                Guardar Cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para editar producto por metro */}
      <Dialog open={isEditMetroProductOpen} onOpenChange={setIsEditMetroProductOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Producto por Metro</DialogTitle>
          </DialogHeader>
          {editingMetroProduct && (
            <div className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input
                  placeholder="Ej: Cable THW 12 AWG"
                  value={editingMetroProduct.name}
                  onChange={(e) => setEditingMetroProduct({ ...editingMetroProduct, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="block min-h-[20px]">Precio de Compra por Metro</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={editMetroPurchaseInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const normalized = raw.replace(',', '.');
                      if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                        setEditMetroPurchaseInput(raw);
                        const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                        setEditingMetroProduct({ ...editingMetroProduct, purchasePrice: num });
                      }
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.replace(',', '.');
                      if (v !== '' && !isNaN(Number(v))) {
                        const n = Math.round(parseFloat(v) * 100) / 100;
                        setEditingMetroProduct({ ...editingMetroProduct, purchasePrice: n });
                        setEditMetroPurchaseInput(n.toFixed(2));
                      } else {
                        setEditMetroPurchaseInput('');
                      }
                    }}
                  />
                </div>
                <div>
                  <Label className="block min-h-[20px]">Precio de Venta por Metro</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={editMetroSaleInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const normalized = raw.replace(',', '.');
                      if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                        setEditMetroSaleInput(raw);
                        const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                        setEditingMetroProduct({ ...editingMetroProduct, salePrice: num });
                      }
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.replace(',', '.');
                      if (v !== '' && !isNaN(Number(v))) {
                        const n = Math.round(parseFloat(v) * 100) / 100;
                        setEditingMetroProduct({ ...editingMetroProduct, salePrice: n });
                        setEditMetroSaleInput(n.toFixed(2));
                      } else {
                        setEditMetroSaleInput('');
                      }
                    }}
                  />
                </div>
              </div>
              <div className="text-sm text-green-600 font-medium">
                Precio de Venta por Centímetro: S/ {((editingMetroProduct.salePrice || 0) / 100).toFixed(3)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(() => {
                  const hasSales = stockHistory.some(h => h.productId === editingMetroProduct.id && h.type === 'sale');
                  const stockCmPreview = Math.round((parseFloat(normalizeDecimalInput(editMetroStockInput)) || 0) * 100);
                  return (
                    <>
                      <div>
                        <Label>Stock actual (m)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={editMetroStockInput}
                          onChange={(e) => {
                            if (hasSales) return;
                            const raw = e.target.value;
                            if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                              setEditMetroStockInput(raw);
                            }
                          }}
                          onBlur={(e) => {
                            if (hasSales) return;
                            const v = e.target.value.replace(',', '.');
                            if (v !== '' && !isNaN(Number(v))) {
                              setEditMetroStockInput((Math.round(parseFloat(v) * 100) / 100).toFixed(2));
                            } else {
                              setEditMetroStockInput('');
                            }
                          }}
                          className={hasSales ? 'opacity-60 cursor-not-allowed' : ''}
                          disabled={hasSales}
                        />
                      </div>
                      <div className="flex items-end">
                        {hasSales ? (
                          <p className="text-[10px] text-amber-600 font-medium w-full">⚠️ Stock bloqueado. Usa <strong>"Restock"</strong> en Historial.</p>
                        ) : (
                          <div className="p-2 bg-green-100 text-green-800 rounded-md text-center w-full">
                            <p className="text-xs">Conversión</p>
                            <p className="font-bold">{formatLength(stockCmPreview)}</p>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div>
                <Label>Categoría</Label>
                <Input
                  placeholder="Ej: cables"
                  value={editingMetroProduct.category}
                  onChange={(e) => setEditingMetroProduct({ ...editingMetroProduct, category: e.target.value })}
                />
              </div>
              <Separator />
              <div>
                <Label>Imagen del producto</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditProductImage(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setEditProductImagePreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div className="mt-3">
                  {editProductImagePreview ? (
                    <img src={editProductImagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border" />
                  ) : editingMetroProduct.imageUrl ? (
                    <div className="relative">
                      <img src={editingMetroProduct.imageUrl} alt={editingMetroProduct.name} className="w-full h-40 object-cover rounded-lg border" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 rounded-full"
                        onClick={() => {
                          setEditingMetroProduct({ ...editingMetroProduct, imageUrl: undefined });
                          setEditProductImagePreview('');
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-slate-100 rounded-lg border flex items-center justify-center">
                      <Package className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                </div>
              </div>
              <Button onClick={guardarEdicionProductoMetro} className="w-full bg-green-600 hover:bg-green-700">
                Guardar Cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para editar producto mayorista */}
      <Dialog open={isEditMayoristaOpen} onOpenChange={setIsEditMayoristaOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar Producto Mayorista</DialogTitle>
          </DialogHeader>
          {editingMayoristaProduct && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Basic Info */}
                <div className="space-y-4">
                  <div>
                    <Label>Nombre del Producto</Label>
                    <Input
                      value={editMayoristaName}
                      onChange={(e) => setEditMayoristaName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Categoría</Label>
                    <Input
                      value={editMayoristaCategory}
                      onChange={(e) => setEditMayoristaCategory(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Imagen del producto</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setEditProductImage(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setEditProductImagePreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <div className="mt-3">
                      {editProductImagePreview ? (
                        <img src={editProductImagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border" />
                      ) : editingMayoristaProduct.imageUrl ? (
                        <div className="relative">
                          <img src={editingMayoristaProduct.imageUrl} alt={editingMayoristaProduct.name} className="w-full h-40 object-cover rounded-lg border" />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6 rounded-full"
                            onClick={() => {
                              setEditingMayoristaProduct({ ...editingMayoristaProduct, imageUrl: undefined });
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="w-full h-40 bg-slate-100 rounded-lg border flex items-center justify-center">
                          <Package className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column 2: Levels */}
                <div className="space-y-4">
                  <div className="border p-4 rounded-xl space-y-4 bg-white shadow-sm">
                    <h4 className="font-semibold text-sm text-slate-700">Niveles de Venta</h4>
                    {editMayoristaLevels.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {editMayoristaLevels.map((lvl) => {
                          const hasUnidad = editMayoristaLevels.some(l => l.name === 'Unidad');
                          const isStockEditable = lvl.name === 'Unidad' || !hasUnidad;
                          const hasSales = stockHistory.some(h => h.productId === editingMayoristaProduct?.id && h.type === 'sale');
                          return (
                          <div key={lvl.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                            {editingLevelId === lvl.id ? (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <p className="font-semibold text-slate-800">{lvl.name}</p>
                                  <div className="flex gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-green-600 hover:text-green-800 hover:bg-green-50"
                                      onClick={() => {
                                        const newStock = isStockEditable ? parseInt(editLevelTempStock) : lvl.stock;
                                        const newSP = parseFloat(editLevelTempSalePrice);
                                        const newPP = parseFloat(editLevelTempPurchasePrice);
                                        if ((isStockEditable && (isNaN(newStock) || newStock < 0)) || isNaN(newSP) || newSP < 0 || isNaN(newPP) || newPP < 0) {
                                          toast({ title: "Valores no válidos", variant: "destructive" });
                                          return;
                                        }
                                        if (newPP >= newSP) {
                                          toast({ title: "Precios inválidos", description: "El precio de compra debe ser menor al precio de venta", variant: "destructive" });
                                          return;
                                        }
                                        const oldSP = lvl.salePrice;
                                        const oldPP = lvl.purchasePrice;
                                        const priceChanged = oldSP !== newSP || oldPP !== newPP;
                                        if (priceChanged) {
                                          const priceChangeEntry: StockHistoryItem = {
                                            id: generateId(),
                                            productId: editingMayoristaProduct!.id,
                                            productName: editingMayoristaProduct!.name,
                                            type: 'price_change',
                                            quantity: 0,
                                            resultingStock: 0,
                                            date: new Date().toISOString(),
                                            priceChanges: [{
                                              levelName: lvl.name,
                                              oldSalePrice: oldSP,
                                              newSalePrice: newSP,
                                              oldPurchasePrice: oldPP,
                                              newPurchasePrice: newPP
                                            }]
                                          };
                                          const updatedHistory = [...stockHistory, priceChangeEntry];
                                          setStockHistory(updatedHistory);
                                          safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
                                          addPendingId(PENDING.HISTORY, priceChangeEntry.id);
                                          syncHistoryToFirestore(updatedHistory);
                                        }
                                        setEditMayoristaLevels(editMayoristaLevels.map(l =>
                                          l.id === lvl.id ? { ...l, stock: newStock, salePrice: newSP, purchasePrice: newPP } : l
                                        ));
                                        setEditingLevelId(null);
                                      }}
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    </Button>
                                    {!(lvl.name === 'Unidad') && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => setEditMayoristaLevels(editMayoristaLevels.filter(l => l.id !== lvl.id))}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                    )}
                                  </div>
                                </div>
                                <div className={`grid gap-2 ${isStockEditable ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                  {isStockEditable && (
                                  <div>
                                    <Label className="text-[9px] text-slate-500">Stock</Label>
                                    <Input
                                      type="text"
                                      value={editLevelTempStock}
                                      onChange={(e) => {
                                        if (hasSales) return;
                                        const val = e.target.value;
                                        if (val === '' || /^\d*$/.test(val)) setEditLevelTempStock(val);
                                      }}
                                      className={`h-7 text-xs ${hasSales ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      disabled={hasSales}
                                    />
                                  </div>
                                  )}
                                  <div>
                                    <Label className="text-[9px] text-slate-500">P. Venta (S/)</Label>
                                    <Input
                                      type="text"
                                      value={editLevelTempSalePrice}
                                      onChange={(e) => setEditLevelTempSalePrice(e.target.value)}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-[9px] text-slate-500">P. Compra (S/)</Label>
                                    <Input
                                      type="text"
                                      value={editLevelTempPurchasePrice}
                                      onChange={(e) => setEditLevelTempPurchasePrice(e.target.value)}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                </div>
                                {hasSales && isStockEditable && (
                                  <p className="text-[9px] text-amber-600 col-span-3">⚠️ Stock bloqueado porque ya se realizaron ventas. Usa <strong>"Restock"</strong> en Historial de Stock.</p>
                                )}
                                <p className="text-[9px] text-slate-400">Contiene: {lvl.baseUnitsContained} unid. por {lvl.name}</p>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-semibold text-slate-800">{lvl.name}</p>
                                  {lvl.name === 'Unidad' ? (
                                    <p className="text-[10px] text-slate-500">
                                      Contiene: {lvl.baseUnitsContained} unid. &middot; Stock: {lvl.stock} unid. &middot; S/ {(lvl.salePrice ?? 0).toFixed(2)} (Compra: S/ {(lvl.purchasePrice ?? 0).toFixed(2)})
                                    </p>
                                  ) : hasUnidad ? (
                                    <p className="text-[10px] text-slate-500">
                                      Contiene: {lvl.baseUnitsContained} unid. &middot; S/ {(lvl.salePrice ?? 0).toFixed(2)} (Compra: S/ {(lvl.purchasePrice ?? 0).toFixed(2)})
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-slate-500">
                                      Contiene: {lvl.baseUnitsContained} unid. &middot; Stock: {lvl.stock} {lvl.name}(s) &middot; S/ {(lvl.salePrice ?? 0).toFixed(2)} (Compra: S/ {(lvl.purchasePrice ?? 0).toFixed(2)})
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => {
                                      setEditingLevelId(lvl.id);
                                      setEditLevelTempStock(String(lvl.stock));
                                      setEditLevelTempSalePrice(String((lvl.salePrice ?? 0).toFixed(2)));
                                      setEditLevelTempPurchasePrice(String((lvl.purchasePrice ?? 0).toFixed(2)));
                                    }}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  </Button>
                                    {!(lvl.name === 'Unidad') && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => setEditMayoristaLevels(editMayoristaLevels.filter(l => l.id !== lvl.id))}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                    )}
                                 </div>
                               </div>
                             )}
                           </div>
                           );
                         })}
                       </div>
                     ) : (
                       <p className="text-xs text-slate-400 italic">No hay niveles. Agrega al menos uno.</p>
                    )}

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
                      <p className="text-xs font-semibold text-slate-700">Agregar Nivel</p>
                      <div>
                        <Label className="text-[10px]">Seleccionar Nivel</Label>
                        <Select value={editLevelDropdown} onValueChange={setEditLevelDropdown}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Elige un nivel..." />
                          </SelectTrigger>
                          <SelectContent>
                            {['Unidad', 'Paquete', 'Ciento', 'Millar', 'Plancha', 'Fardo', 'Personalizado'].filter(n => !editMayoristaLevels.find(l => l.name === n) && (n !== 'Unidad' || editingMayoristaProduct?.type !== 'mayorista')).map(n => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {editLevelDropdown === 'Personalizado' && (
                          <Input
                            type="text"
                            placeholder="Nombre del nivel..."
                            value={editLevelCustomName}
                            onChange={(e) => setEditLevelCustomName(e.target.value)}
                            className="h-8 text-xs mt-2"
                          />
                        )}
                      </div>
                      {editLevelDropdown && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Contenido (unid.)</Label>
                            <Input
                              type="text"
                              placeholder="Ej: 25"
                              value={editLevelDropdown === 'Unidad' ? '1' : editLevelContains}
                              onChange={(e) => setEditLevelContains(e.target.value)}
                              className="h-8 text-xs"
                              disabled={editLevelDropdown === 'Unidad'}
                            />
                          </div>
                          {!editMayoristaLevels.some(l => l.name === 'Unidad') && (
                          <div>
                            <Label className="text-[10px]">Stock {editLevelDropdown !== 'Personalizado' ? `(${editLevelDropdown}s)` : ''}</Label>
                            <Input
                              type="text"
                              placeholder="0"
                              value={editLevelStockInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d*$/.test(val)) {
                                  setEditLevelStockInput(val);
                                }
                              }}
                              className="h-8 text-xs"
                            />
                          </div>
                          )}
                          <div>
                            <Label className="text-[10px]">P. Compra (S/)</Label>
                            <Input
                              type="text"
                              placeholder="0.00"
                              value={editLevelPurchasePrice}
                              onChange={(e) => setEditLevelPurchasePrice(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">P. Venta (S/)</Label>
                            <Input
                              type="text"
                              placeholder="0.00"
                              value={editLevelSalePrice}
                              onChange={(e) => setEditLevelSalePrice(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="col-span-2 flex items-end pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full h-8 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                              disabled={
                                editLevelDropdown === 'Unidad'
                                  ? (!editLevelPurchasePrice || !editLevelSalePrice || !editLevelStockInput)
                                  : editMayoristaLevels.some(l => l.name === 'Unidad')
                                    ? (!editLevelContains || !editLevelPurchasePrice || !editLevelSalePrice)
                                    : (!editLevelContains || !editLevelPurchasePrice || !editLevelSalePrice || !editLevelStockInput)
                              }
                              onClick={() => {
                                const isUnidad = editLevelDropdown === 'Unidad';
                                const contains = isUnidad ? 1 : parseInt(editLevelContains);
                                if (!isUnidad && (isNaN(contains) || contains <= 0)) {
                                  toast({ title: "Contenido no válido", description: "Debe ser mayor a 0", variant: "destructive" });
                                  return;
                                }

                                const pPrice = parseFloat(editLevelPurchasePrice);
                                const sPrice = parseFloat(editLevelSalePrice);
                                const hasUnidad = editMayoristaLevels.some(l => l.name === 'Unidad');
                                const stockQty = (isUnidad || !hasUnidad) ? parseInt(editLevelStockInput || '0') : 0;
                                if (isNaN(pPrice) || pPrice < 0 || isNaN(sPrice) || sPrice < 0) {
                                  toast({ title: "Precios no válidos", description: "Ingresa precios mayores o iguales a 0", variant: "destructive" });
                                  return;
                                }
                                if (pPrice >= sPrice) {
                                  toast({ title: "Precios inválidos", description: "El precio de compra debe ser menor al precio de venta", variant: "destructive" });
                                  return;
                                }
                                if ((isUnidad || !hasUnidad) && (isNaN(stockQty) || stockQty < 0)) {
                                  toast({ title: "Stock no válido", description: "Ingresa un stock válido", variant: "destructive" });
                                  return;
                                }
                                const newLvl: SaleLevel = {
      id: generateId(),
                                  name: editLevelDropdown === 'Personalizado' ? editLevelCustomName.trim() : editLevelDropdown,
                                  baseUnitsContained: contains,
                                  purchasePrice: pPrice,
                                  salePrice: sPrice,
                                  stock: isUnidad ? stockQty : (editMayoristaLevels.some(l => l.name === 'Unidad') ? 0 : stockQty),
                                  initialStock: isUnidad ? stockQty : (editMayoristaLevels.some(l => l.name === 'Unidad') ? 0 : stockQty)
                                };
                                setEditMayoristaLevels([...editMayoristaLevels, newLvl]);
                                setEditLevelDropdown('');
                                setEditLevelCustomName('');
                                setEditLevelContains('');
                                setEditLevelPurchasePrice('');
                                setEditLevelSalePrice('');
                                setEditLevelStockInput('');
                              }}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Agregar Nivel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>


                </div>
              </div>

              <Button
                onClick={guardarEdicionMayorista}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 text-base shadow-md"
                disabled={!editMayoristaName.trim() || !editMayoristaCategory.trim() || editMayoristaLevels.length === 0}
              >
                Guardar Cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar productos */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar los siguientes productos? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {productsToDelete.map((product) => (
              <div key={product.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-red-900">{product.name}</p>
                    <p className="text-sm text-red-700">Stock: {product.type === 'metro' ? formatLength(product.stock) : product.stock}</p>
                    <p className="text-sm text-red-700">Categoría: {product.category}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deleteSelectedProducts}>
              Eliminar Productos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de edición rápida de productos */}
      <Dialog open={isEditQuickProductOpen} onOpenChange={setIsEditQuickProductOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          {editingQuickProduct && (
            <div className="space-y-4">
              <div>
                <Label>Nombre del Producto</Label>
                <Input 
                  placeholder="Ej: Coca Cola 600ml"
                  value={editingQuickProduct.name}
                  onChange={(e) => setEditingQuickProduct({...editingQuickProduct, name: e.target.value})}
                />
              </div>
              <div>
                <Label>Categoría</Label>
                <Input 
                  placeholder="Ej: Bebidas"
                  value={editingQuickProduct.category}
                  onChange={(e) => setEditingQuickProduct({...editingQuickProduct, category: e.target.value})}
                />
                {getFrequentCategories.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-2">Categorías frecuentes:</p>
                    <div className="flex flex-wrap gap-2">
                      {getFrequentCategories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setEditingQuickProduct({...editingQuickProduct, category})}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label>Stock</Label>
                <Input 
                  type="text"
                  placeholder="0"
                  value={editingQuickProduct.stock || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d+$/.test(value)) {
                      setEditingQuickProduct({...editingQuickProduct, stock: value === '' ? 0 : parseInt(value) || 0});
                    }
                  }}
                />
              </div>
              <Button onClick={saveQuickEdit} className="w-full">
                Guardar Cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar cierre de caja */}
      <Dialog open={isDeleteCloseOpen} onOpenChange={setIsDeleteCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ Confirmar Eliminación Permanente</DialogTitle>
            <DialogDescription>
              Estás a punto de eliminar permanentemente el cierre de caja del{' '}
              <strong>{closeToDelete ? formatearFechaLocal(closeToDelete.date) : ''}</strong>.
              <br /><br />
              <span className="text-red-600 font-medium">
                ⚠️ Esta acción NO se puede deshacer y eliminará completamente todos los datos de este cierre.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {closeToDelete && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-900 mb-2">Resumen del cierre a eliminar:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><span className="font-medium">Total Vendido:</span> S/ {closeToDelete.totalSales.toFixed(2)}</p>
                    <p><span className="font-medium">Ganancias:</span> S/ {closeToDelete.totalProfit.toFixed(2)}</p>
                  </div>
                  <div>
                    <p><span className="font-medium">Productos:</span> {closeToDelete.totalItems}</p>
                    <p><span className="font-medium">Ventas:</span> {closeToDelete.salesCount}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteCloseOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteDailyClose}
              disabled={!adminPassword.trim()}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ver Producto Mayorista */}
      <Dialog open={isViewMayoristaProductOpen} onOpenChange={setIsViewMayoristaProductOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Información de producto
            </DialogTitle>
            {viewingMayoristaProduct && (
              <p className="text-base font-bold text-slate-900 mt-3 pt-3 border-t border-slate-100">
                {viewingMayoristaProduct.name}
              </p>
            )}
          </DialogHeader>
          {viewingMayoristaProduct && (() => {
            const sortedLevels = [...(viewingMayoristaProduct.saleLevels || [])].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; });
            const colors = [
              { border: 'border-blue-300', bgAccent: 'bg-blue-50', headerBg: 'bg-blue-100', profitBg: 'bg-blue-600' },
              { border: 'border-green-300', bgAccent: 'bg-green-50', headerBg: 'bg-green-100', profitBg: 'bg-green-700' },
              { border: 'border-purple-300', bgAccent: 'bg-purple-50', headerBg: 'bg-purple-100', profitBg: 'bg-purple-700' },
              { border: 'border-orange-300', bgAccent: 'bg-orange-50', headerBg: 'bg-orange-100', profitBg: 'bg-orange-600' },
              { border: 'border-pink-300', bgAccent: 'bg-pink-50', headerBg: 'bg-pink-100', profitBg: 'bg-pink-600' },
            ];
            const hasUnidad = viewingMayoristaProduct.saleLevels?.some(l => l.name === 'Unidad');
            const unidadLevel = hasUnidad ? sortedLevels.find(l => l.name === 'Unidad') : null;
            // Productos sin Unidad (paquete/millar/etc) usan el nuevo diseño con pestañas
            const usarDisenoNuevo = !hasUnidad && sortedLevels.length > 0;
            return (
              <div className="space-y-8">
                {/* Row 1: Image + Estado de Inventario card (hasUnidad) or full levels grid (!hasUnidad) */}
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  {!usarDisenoNuevo && (
                  <div className="flex-shrink-0 flex flex-col items-center">
                    {viewingMayoristaProduct.imageUrl ? (
                      <img 
                        src={viewingMayoristaProduct.imageUrl} 
                        alt={viewingMayoristaProduct.name} 
                        className="w-48 h-48 object-cover rounded-xl border border-slate-200" 
                      />
                    ) : (
                      <div className="w-48 h-48 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center">
                        <Package className="w-12 h-12 text-slate-400" />
                      </div>
                    )}
                  </div>
                  )}
                  <div className="flex-1 w-full">
                    {hasUnidad ? (
                      unidadLevel && (
                        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-lg">
                          <div className="bg-slate-100 px-4 py-3 border-b border-slate-300">
                            <div className="flex justify-between items-center">
                              <h4 className="text-lg font-bold text-slate-800">Estado de Inventario</h4>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase">STOCK INICIAL</p>
                                <p className="text-xl font-bold text-slate-900">{unidadLevel.initialStock} und</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase">STOCK ACTUAL</p>
                                <p className="text-xl font-bold text-blue-600">{unidadLevel.stock} und</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    ) : sortedLevels.length === 0 ? (
                      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-lg">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-300">
                          <div className="flex justify-between items-center">
                            <h4 className="text-lg font-bold text-slate-800">Estado de Inventario</h4>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-slate-500 uppercase">STOCK INICIAL</p>
                              <p className="text-xl font-bold text-slate-900">{viewingMayoristaProduct.type === 'peso' ? formatWeight(viewingMayoristaProduct.initialStock ?? viewingMayoristaProduct.stock) : viewingMayoristaProduct.type === 'metro' ? formatLength(viewingMayoristaProduct.initialStock ?? viewingMayoristaProduct.stock) : `${viewingMayoristaProduct.initialStock ?? viewingMayoristaProduct.stock} und`}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-slate-500 uppercase">STOCK ACTUAL</p>
                              <p className="text-xl font-bold text-blue-600">{viewingMayoristaProduct.type === 'peso' ? formatWeight(viewingMayoristaProduct.stock) : viewingMayoristaProduct.type === 'metro' ? formatLength(viewingMayoristaProduct.stock) : `${viewingMayoristaProduct.stock} und`}</p>
                            </div>
                          </div>
                          <div className="border-t border-slate-200 my-4"></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                              <p className="text-xs font-semibold text-blue-700 uppercase mb-1">VALOR COMPRA</p>
                              <p className="text-2xl font-bold text-blue-800">{formatCurrency(viewingMayoristaProduct.type === 'peso' ? (viewingMayoristaProduct.purchasePrice ?? viewingMayoristaProduct.purchasePricePerKg ?? 0) * (viewingMayoristaProduct.initialStock ?? viewingMayoristaProduct.stock) / 1000 : viewingMayoristaProduct.type === 'metro' ? (viewingMayoristaProduct.purchasePrice ?? 0) * (viewingMayoristaProduct.initialStock ?? viewingMayoristaProduct.stock) / 100 : (viewingMayoristaProduct.purchasePrice ?? 0) * (viewingMayoristaProduct.initialStock ?? viewingMayoristaProduct.stock))}</p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                              <p className="text-xs font-semibold text-green-700 uppercase mb-1">VALOR VENTA</p>
                              <p className="text-2xl font-bold text-green-800">{formatCurrency(viewingMayoristaProduct.type === 'peso' ? (viewingMayoristaProduct.salePrice ?? viewingMayoristaProduct.salePricePerKg ?? 0) * (viewingMayoristaProduct.initialStock ?? viewingMayoristaProduct.stock) / 1000 : viewingMayoristaProduct.type === 'metro' ? (viewingMayoristaProduct.salePrice ?? 0) * (viewingMayoristaProduct.initialStock ?? viewingMayoristaProduct.stock) / 100 : (viewingMayoristaProduct.salePrice ?? 0) * (viewingMayoristaProduct.initialStock ?? viewingMayoristaProduct.stock))}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <InfoProductoNiveles
                        producto={viewingMayoristaProduct}
                        userRole={userRole}
                        tab={infoLevelTab}
                        onTab={setInfoLevelTab}
                        onCerrar={() => setIsViewMayoristaProductOpen(false)}
                      />
                    )}
                  </div>
                </div>

                {/* Row 2: All levels in CSS grid with fixed columns (only for hasUnidad) */}
                {hasUnidad && (() => {
                  const overflow = sortedLevels.length > 4;
                  return (
                  <div
                    className={overflow ? "flex flex-wrap justify-center gap-6" : "grid gap-6"}
                    style={overflow ? undefined : { gridTemplateColumns: `repeat(${sortedLevels.length}, 1fr)` }}
                  >
                    {sortedLevels.map((level, idx) => {
                      const color = colors[idx % colors.length];
                      const gananciaPorUnidad = (level.salePrice ?? 0) - (level.purchasePrice ?? 0);
                      return (
                        <div key={level.id} className={`bg-white border ${color.border} rounded-xl overflow-hidden shadow-sm ${overflow ? 'w-[calc(25%_-_1.125rem)]' : ''}`}>
                          <div className={`${color.headerBg} px-4 py-3 border-b ${color.border}`}>
                            <div className="flex justify-between items-center">
                              <h4 className="text-sm font-bold text-slate-800">{level.name}</h4>
                              <span className="text-[10px] text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {level.baseUnitsContained} unid. / {level.name}
                              </span>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="space-y-3">
                              {userRole === 'admin' && (
                              <div className="flex justify-between items-center text-xs">
                                <p className="text-slate-500">P. Compra</p>
                                <p className="font-semibold text-slate-800">S/ {(level.purchasePrice ?? 0).toFixed(2)}</p>
                              </div>
                              )}
                              <div className="flex justify-between items-center text-xs">
                                <p className="text-slate-500">P. Venta</p>
                                <p className="font-semibold text-blue-600">S/ {(level.salePrice ?? 0).toFixed(2)}</p>
                              </div>
                            </div>
                            {userRole === 'admin' && (
                              <>
                                <div className="border-t border-slate-200 my-3"></div>
                                <div className="flex justify-between items-center text-xs pt-1">
                                  <p className="text-slate-500 font-medium">Ganancia</p>
                                  <p className="font-semibold text-emerald-600">+ S/ {gananciaPorUnidad.toFixed(2)}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}

                {/* Row 3: REGISTRO DE VENTAS POR NIVEL (también para productos sin Unidad) */}
                {userRole === 'admin' && sortedLevels.length > 0 && (() => {
                  const productId = viewingMayoristaProduct.id;
                  const productHistory = modalProductHistory;
                  const boundaryEvents = productHistory.filter(h => h.type === 'restock' || h.type === 'initial')
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                  const productSales = productHistory.filter(h => h.type === 'sale' && h.affectedLevelName)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                  
                  const buildPeriods = () => {
                    const periods = [];
                    // Sin contorno "initial"/"restock" en la base (por ejemplo la
                    // primera venta ocurre antes de que el alta termine de subir)
                    // se crea un contorno sintético con la fecha de la primera
                    // venta para que nunca quede oculta.
                    let contornos = boundaryEvents;
                    if (contornos.length === 0 && productSales.length > 0) {
                      const totalVendido = productSales.reduce((t, s) => {
                        const lvl = viewingMayoristaProduct.saleLevels?.find(l => l.name === s.affectedLevelName);
                        return t + (s.levelQuantity || 0) * (lvl?.baseUnitsContained || 1);
                      }, 0);
                      contornos = [{ ...productSales[0], type: 'initial', quantity: totalVendido } as any];
                    }
                    if (contornos.length === 0) return periods;
                    for (let i = 0; i < contornos.length; i++) {
                      const startDate = contornos[i].date;
                      const endDate = i + 1 < contornos.length ? contornos[i + 1].date : null;
                      const periodSales = productSales.filter(s => {
                        const sDate = new Date(s.date);
                        const start = new Date(startDate);
                        if (!endDate) return sDate >= start;
                        return sDate >= start && sDate < new Date(endDate);
                      });
                      const unitsSold = periodSales.reduce((total, s) => {
                        const lvl = viewingMayoristaProduct.saleLevels?.find(l => l.name === s.affectedLevelName);
                        if (!lvl) return total;
                        return total + (s.levelQuantity || 0) * (lvl.baseUnitsContained || 1);
                      }, 0);
                      const isPriceChange = contornos[i].type === 'price_change';
                      periods.push({
                        type: contornos[i].type,
                        date: contornos[i].date,
                        quantity: isPriceChange ? 0 : contornos[i].quantity,
                        unitsSold,
                        remaining: isPriceChange
                          ? (i > 0 ? periods[i - 1].remaining : (contornos[i].quantity || 0))
                          : Math.max(0, (contornos[i].quantity || 0) - unitsSold),
                        sales: periodSales,
                        priceChanges: contornos[i].priceChanges || []
                      });
                    }
                    return periods;
                  };
                  
                  const periods = buildPeriods();
                  const productPriceChanges = productHistory.filter(h => h.type === 'price_change')
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                  for (let pi = 0; pi < periods.length; pi++) {
                    const startDate = new Date(periods[pi].date);
                    const endDate = pi + 1 < periods.length ? new Date(periods[pi + 1].date) : null;
                    periods[pi].priceChanges = productPriceChanges.filter(pc => {
                      const pcDate = new Date(pc.date);
                      if (!endDate) return pcDate >= startDate;
                      return pcDate >= startDate && pcDate < endDate;
                    });
                  }
                  const allLevelNames: string[] = [...(viewingMayoristaProduct.saleLevels || [])]
                    .sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; })
                    .map(l => l.name);
                  
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <FileText className="w-5 h-5" />
                        <h4 className="font-bold text-sm uppercase tracking-wider">Registro de Ventas por Nivel</h4>
                      </div>
                      {(() => {
                        let restockCounter = 0;
                        return periods.map((period, pi) => {
                          const byLevel: Record<string, number> = {};
                          for (const s of period.sales) {
                            const levelName = s.affectedLevelName;
                            if (levelName) {
                              byLevel[levelName] = (byLevel[levelName] || 0) + (s.levelQuantity || s.quantity || 0);
                            }
                          }
                          const isCurrentPeriod = pi === periods.length - 1;
                          const periodLabel = period.type === 'initial' ? 'Stock Inicial' :
                            `Restock #${++restockCounter}`;
                          
                          return (
                            <div key={pi} className="border border-slate-200 rounded-lg overflow-hidden">
                              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm text-slate-700">
                                    {periodLabel}
                                    {isCurrentPeriod && (
                                      <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">⭐ Período Actual</span>
                                    )}
                                  </span>
                                  <span className="text-[10px] text-slate-400 mt-0.5">
                                    {period.type === 'initial'
                                      ? `${period.quantity} und iniciales`
                                      : (() => {
                                          const prev = pi > 0 ? periods[pi - 1] : null;
                                          const prevRemaining = prev ? prev.remaining : 0;
                                          return `sobraron ${prevRemaining} + ${period.quantity} agregados = ${prevRemaining + period.quantity} und`;
                                        })()
                                    }
                                    <span className="text-slate-500 font-medium ml-1">
                                      · {period.date ? new Date(period.date).toLocaleDateString('es-PE') : ''}
                                    </span>
                                  </span>
                                </div>
                              </div>
                              <div className="p-3">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-500 border-b border-slate-200">
                                      <th className="text-left py-1.5 font-medium">Nivel</th>
                                      <th className="text-right py-1.5 font-medium">Vendido</th>
                                      <th className="text-right py-1.5 font-medium">Precio Venta</th>
                                      <th className="text-right py-1.5 font-medium">Total</th>
                                      <th className="text-right py-1.5 font-medium">Ganancia</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {allLevelNames.map(ln => {
                                      const lvl = viewingMayoristaProduct.saleLevels?.find(l => l.name === ln);
                                      const qty = byLevel[ln] || 0;
                                      const price = lvl?.salePrice || 0;
                                      const costPerUnit = lvl?.purchasePrice || 0;
                                      const revenue = qty * price;
                                      const cost = qty * costPerUnit;
                                      const profit = revenue - cost;
                                      return (
                                        <tr key={ln} className="border-b border-slate-50">
                                          <td className="py-1.5 font-medium text-slate-700">{ln}</td>
                                          <td className="py-1.5 text-right text-slate-600">{qty}</td>
                                          <td className="py-1.5 text-right text-slate-600">S/ {price.toFixed(2)}</td>
                                          <td className="py-1.5 text-right text-green-600">S/ {revenue.toFixed(2)}</td>
                                          <td className="py-1.5 text-right font-semibold text-blue-600">S/ {profit.toFixed(2)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              {period.priceChanges && period.priceChanges.length > 0 && (() => {
                                return (
                                  <div className="mx-3 mb-3 space-y-3">
                                    {period.priceChanges.map((pcEntry: any, pci: number) => {
                                      return (pcEntry.priceChanges || []).map((pc: any, pci2: number) => {
                                        const salesAfterPC = period.sales.filter((s: any) =>
                                          s.affectedLevelName === pc.levelName && new Date(s.date) >= new Date(pcEntry.date)
                                        );
                                        const qty = salesAfterPC.reduce((sum: number, s: any) => sum + (s.levelQuantity || s.quantity || 0), 0);
                                        const revenue = qty * (pc.newSalePrice || 0);
                                        const cost = qty * (pc.newPurchasePrice || 0);
                                        const profit = revenue - cost;
                                        return (
                                          <div key={`${pci}-${pci2}`} className="border border-indigo-200 rounded-lg overflow-hidden bg-indigo-50/40 shadow-sm">
                                            <div className="px-3 py-1.5 border-b border-indigo-200 bg-indigo-100">
                                              <span className="text-xs font-semibold text-indigo-800">Ajuste de Precio #{pci + 1}</span>
                                              <span className="ml-3 px-2 py-0.5 bg-indigo-200/60 text-indigo-700 rounded-md text-[11px] font-semibold">
                                                {new Date(pcEntry.date).toLocaleDateString('es-PE')}
                                              </span>
                                            </div>
                                            <div className="px-3 py-2 space-y-2">
                                              <div className="text-xs font-medium text-indigo-700 mb-2">{pc.levelName}</div>
                                              <div className="grid grid-cols-4 gap-2">
                                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5">
                                                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">P.Compra anterior</p>
                                                  <p className="text-sm font-bold text-slate-800">S/ {pc.oldPurchasePrice?.toFixed(2)}</p>
                                                </div>
                                                <div className={`rounded-lg border p-2.5 ${pc.oldPurchasePrice !== pc.newPurchasePrice ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">P.Compra nuevo</p>
                                                  <p className={`text-sm font-bold flex items-center gap-1 ${pc.oldPurchasePrice !== pc.newPurchasePrice ? 'text-emerald-700' : 'text-slate-800'}`}>
                                                    S/ {pc.newPurchasePrice?.toFixed(2)}
                                                    {pc.oldPurchasePrice !== pc.newPurchasePrice && (
                                                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                    )}
                                                  </p>
                                                </div>
                                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5">
                                                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">P.Venta anterior</p>
                                                  <p className="text-sm font-bold text-slate-800">S/ {pc.oldSalePrice?.toFixed(2)}</p>
                                                </div>
                                                <div className={`rounded-lg border p-2.5 ${pc.oldSalePrice !== pc.newSalePrice ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">P.Venta nuevo</p>
                                                  <p className={`text-sm font-bold flex items-center gap-1 ${pc.oldSalePrice !== pc.newSalePrice ? 'text-emerald-700' : 'text-slate-800'}`}>
                                                    S/ {pc.newSalePrice?.toFixed(2)}
                                                    {pc.oldSalePrice !== pc.newSalePrice && (
                                                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                    )}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="border-t border-slate-100 pt-2 mt-2">
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="text-slate-500 border-b border-slate-200">
                                                      <th className="text-left py-1 font-medium">Nivel</th>
                                                      <th className="text-right py-1 font-medium">Vendido</th>
                                                      <th className="text-right py-1 font-medium">P.Venta</th>
                                                      <th className="text-right py-1 font-medium">Total</th>
                                                      <th className="text-right py-1 font-medium">Ganancia</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    <tr className="border-b border-slate-100">
                                                      <td className="py-1 font-medium text-slate-700">{pc.levelName}</td>
                                                      <td className="py-1 text-right text-slate-600">{qty}</td>
                                                      <td className="py-1 text-right text-slate-600">S/ {(pc.newSalePrice || 0).toFixed(2)}</td>
                                                      <td className="py-1 text-right text-green-700">S/ {revenue.toFixed(2)}</td>
                                                      <td className="py-1 text-right font-semibold text-blue-700">S/ {profit.toFixed(2)}</td>
                                                    </tr>
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      });
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  );
                })()}

                {/* Price Changes for Mayorista (no Unidad level) */}
                {userRole === 'admin' && !hasUnidad && viewingMayoristaProduct && (() => {
                  const productPriceChanges = stockHistory
                    .filter(h => h.productId === viewingMayoristaProduct.id && h.type === 'price_change')
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  if (productPriceChanges.length === 0) return null;
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <FileText className="w-5 h-5" />
                        <h4 className="font-bold text-sm uppercase tracking-wider">Ajustes de Precio</h4>
                      </div>
                      <div className="space-y-3">
                        {productPriceChanges.map((entry: any, ei: number) => {
                          return (entry.priceChanges || []).map((pc: any, pci: number) => {
                            return (
                              <div key={`${ei}-${pci}`} className="border border-indigo-200 rounded-lg overflow-hidden bg-indigo-50/40 shadow-sm">
                                <div className="px-3 py-1.5 border-b border-indigo-200 bg-indigo-100">
                                  <span className="text-xs font-semibold text-indigo-800">Ajuste de Precio #{ei + 1}</span>
                                  <span className="ml-3 px-2 py-0.5 bg-indigo-200/60 text-indigo-700 rounded-md text-[11px] font-semibold">
                                    {new Date(entry.date).toLocaleDateString('es-PE')}
                                  </span>
                                </div>
                                <div className="px-3 py-2 space-y-2">
                                  <div className="text-xs font-medium text-indigo-700 mb-2">{pc.levelName}</div>
                                  <div className="grid grid-cols-4 gap-2">
                                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5">
                                      <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">P.Compra anterior</p>
                                      <p className="text-sm font-bold text-slate-800">S/ {pc.oldPurchasePrice?.toFixed(2)}</p>
                                    </div>
                                    <div className={`rounded-lg border p-2.5 ${pc.oldPurchasePrice !== pc.newPurchasePrice ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                      <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">P.Compra nuevo</p>
                                      <p className={`text-sm font-bold flex items-center gap-1 ${pc.oldPurchasePrice !== pc.newPurchasePrice ? 'text-emerald-700' : 'text-slate-800'}`}>
                                        S/ {pc.newPurchasePrice?.toFixed(2)}
                                        {pc.oldPurchasePrice !== pc.newPurchasePrice && (
                                          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                        )}
                                      </p>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5">
                                      <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">P.Venta anterior</p>
                                      <p className="text-sm font-bold text-slate-800">S/ {pc.oldSalePrice?.toFixed(2)}</p>
                                    </div>
                                    <div className={`rounded-lg border p-2.5 ${pc.oldSalePrice !== pc.newSalePrice ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                      <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">P.Venta nuevo</p>
                                      <p className={`text-sm font-bold flex items-center gap-1 ${pc.oldSalePrice !== pc.newSalePrice ? 'text-emerald-700' : 'text-slate-800'}`}>
                                        S/ {pc.newSalePrice?.toFixed(2)}
                                        {pc.oldSalePrice !== pc.newSalePrice && (
                                          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal Agregar Producto */}
      <Dialog open={isAddProductOpen} onOpenChange={(open) => {
        if (open) {
          if (newProductType === 'mayorista') {
            setAddProductMode('mayorista');
            limpiarFormularioMayorista();
          } else {
            setAddProductMode('unidad');
          }
        } else {
          setNewProductType('general');
          limpiarFormularioAgregarProducto();
        }
        setIsAddProductOpen(open);
      }}>
        <DialogContent className={newProductType === 'mayorista' ? "max-w-2xl sm:max-w-3xl md:max-w-4xl" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle>Agregar producto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {newProductType === 'general' && (
              <div>
                <div className="flex space-x-2 mb-4">
                  <Button
                    type="button"
                    variant={addProductMode === 'unidad' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => {
                      setAddProductMode('unidad');
                      setNewProduct({ name: '', purchasePrice: 0, salePrice: 0, stock: 0, category: '' });
                      setUnitPurchaseInput('');
                      setUnitSaleInput('');
                    }}
                  >
                    Unidad
                  </Button>
                  <Button
                    type="button"
                    variant={addProductMode === 'peso' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => {
                      setAddProductMode('peso');
                      limpiarFormularioPeso();
                    }}
                  >
                    Peso
                  </Button>
                  <Button
                    type="button"
                    variant={addProductMode === 'metro' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => {
                      setAddProductMode('metro');
                      limpiarFormularioMetro();
                    }}
                  >
                    Metro
                  </Button>
                </div>
              </div>
            )}

            {addProductMode === 'unidad' && (
              /* Formulario para productos por unidad */
              <>
                <div>
                  <Label htmlFor="productName">Nombre</Label>
                  <Input
                    id="productName"
                    placeholder="oregano"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="purchasePrice">Precio de compra</Label>
                  <Input
                    id="purchasePrice"
                    type="text"
                    inputMode="decimal"
                    placeholder="10.00"
                    value={unitPurchaseInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const normalized = raw.replace(',', '.');
                      if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                        setUnitPurchaseInput(raw);
                        const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                        setNewProduct({ ...newProduct, purchasePrice: num });
                      }
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.replace(',', '.');
                      if (v !== '' && !isNaN(Number(v))) {
                        const n = Math.round(parseFloat(v) * 100) / 100;
                        setNewProduct({ ...newProduct, purchasePrice: n });
                        setUnitPurchaseInput(n.toFixed(2));
                      } else {
                        setUnitPurchaseInput('');
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="salePrice">Precio de venta</Label>
                  <Input
                    id="salePrice"
                    type="text"
                    inputMode="decimal"
                    placeholder="20.00"
                    value={unitSaleInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const normalized = raw.replace(',', '.');
                      if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                        setUnitSaleInput(raw);
                        const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                        setNewProduct({ ...newProduct, salePrice: num });
                      }
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.replace(',', '.');
                      if (v !== '' && !isNaN(Number(v))) {
                        const n = Math.round(parseFloat(v) * 100) / 100;
                        setNewProduct({ ...newProduct, salePrice: n });
                        setUnitSaleInput(n.toFixed(2));
                      } else {
                        setUnitSaleInput('');
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="stock">Cantidad en stock</Label>
                  <Input
                    id="stock"
                    type="text"
                    placeholder=""
                    value={newProduct.stock || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d+$/.test(value)) {
                        setNewProduct({...newProduct, stock: value === '' ? 0 : parseInt(value)});
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Categoría</Label>
                  <Input
                    id="category"
                    placeholder=""
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Imagen del producto</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewProductImage(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setNewProductImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {newProductImagePreview && (
                    <div className="mt-2">
                      <img src={newProductImagePreview} alt="Preview" className="w-full h-32 object-cover rounded-lg border" />
                    </div>
                  )}
                </div>
              </>
            )}

            {addProductMode === 'peso' && (
              /* Formulario para productos por peso */
              <>
                <div>
                  <Label htmlFor="weightProductName">Nombre</Label>
                  <Input
                    id="weightProductName"
                    placeholder="oregano"
                    value={newWeightProduct.name}
                    onChange={(e) => setNewWeightProduct({...newWeightProduct, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchasePricePerKg" className="block min-h-[20px]">Precio de Compra por Kilo</Label>
                    <Input
                      id="purchasePricePerKg"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={purchasePerKgInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const normalized = raw.replace(',', '.');
                        if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                          setPurchasePerKgInput(raw);
                          const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                          setNewWeightProduct({ ...newWeightProduct, purchasePrice: num, purchasePricePerKg: num });
                        }
                      }}
                      onBlur={(e) => {
                        const v = e.target.value.replace(',', '.');
                        if (v !== '' && !isNaN(Number(v))) {
                          const n = Math.round(parseFloat(v) * 100) / 100;
                          setNewWeightProduct({ ...newWeightProduct, purchasePrice: n, purchasePricePerKg: n });
                          setPurchasePerKgInput(n.toFixed(2));
                        } else {
                          setPurchasePerKgInput('');
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="salePricePerKg" className="block min-h-[20px]">Precio de Venta por Kilo</Label>
                    <Input
                      id="salePricePerKg"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={salePerKgInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const normalized = raw.replace(',', '.');
                        if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                          setSalePerKgInput(raw);
                          const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                          setNewWeightProduct({ ...newWeightProduct, salePrice: num, salePricePerKg: num });
                          setEquivalentGramsInput(num > 0 ? (num / 1000).toFixed(3) : '');
                        }
                      }}
                      onBlur={(e) => {
                        const v = e.target.value.replace(',', '.');
                        if (v !== '' && !isNaN(Number(v))) {
                          const n = Math.round(parseFloat(v) * 100) / 100;
                          setNewWeightProduct({ ...newWeightProduct, salePrice: n, salePricePerKg: n });
                          setSalePerKgInput(n.toFixed(2));
                          setEquivalentGramsInput(n > 0 ? (n / 1000).toFixed(3) : '');
                        } else {
                          setSalePerKgInput('');
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="bg-green-100 p-3 rounded-lg text-center">
                    <div className="text-sm text-green-700 font-medium">Precio de Venta por Gramo: S/ {newWeightProduct.salePrice ? (newWeightProduct.salePrice / 1000).toFixed(3) : '0.000'}</div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="equivalentGrams">Equivale por gramo</Label>
                  <Input
                    id="equivalentGrams"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={equivalentGramsInput}
                    onChange={(e) => setEquivalentGramsInput(e.target.value)}
                    className={equivalentGramsError ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  <p className={`mt-1 text-xs ${equivalentGramsError ? 'text-red-600' : 'text-slate-500'}`}>
                    {equivalentGramsError || 'Ingresa un valor numerico con hasta 3 decimales. La conversion se actualiza al escribir.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="weightInitialStock">Stock inicial (g)</Label>
                    <Input
                      id="weightInitialStock"
                      type="text"
                      placeholder="0"
                      value={newWeightProduct.initialStock || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === '0' || /^\d+$/.test(value)) {
                          setNewWeightProduct({...newWeightProduct, initialStock: value === '' ? 0 : parseInt(value) || 0});
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="bg-green-100 px-3 py-2 rounded text-sm font-medium text-green-700 w-full text-center">
                      Conversión<br/>{newWeightProduct.initialStock ? `${(newWeightProduct.initialStock / 1000).toFixed(1)}kg` : '0kg'}
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="minWeight">Peso mínimo (g)</Label>
                  <Input
                    id="minWeight"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={minWeightInput}
                    onChange={(e) => setMinWeightInput(e.target.value)}
                    className={minWeightError ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  <p className={`mt-1 text-xs ${minWeightError ? 'text-red-600' : 'text-slate-500'}`}>
                    {minWeightError || 'El peso minimo debe ser valido y no superar el stock inicial.'}
                  </p>
                </div>
                <div>
                  <Label htmlFor="weightCategory">Categoría</Label>
                  <Input
                    id="weightCategory"
                    placeholder="especias"
                    value={newWeightProduct.category}
                    onChange={(e) => setNewWeightProduct({...newWeightProduct, category: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Imagen del producto</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewProductImage(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setNewProductImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {newProductImagePreview && (
                    <div className="mt-2">
                      <img src={newProductImagePreview} alt="Preview" className="w-full h-32 object-cover rounded-lg border" />
                    </div>
                  )}
                </div>
              </>
            )}

            {addProductMode === 'metro' && (
              /* Formulario para productos por metro */
              <>
                <div>
                  <Label htmlFor="metroProductName">Nombre</Label>
                  <Input
                    id="metroProductName"
                    placeholder="Ej: Cable THW 12 AWG"
                    value={newMetroProduct.name}
                    onChange={(e) => setNewMetroProduct({...newMetroProduct, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="metroPurchasePrice" className="block min-h-[20px]">Precio de Compra por Metro</Label>
                    <Input
                      id="metroPurchasePrice"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={metroPurchaseInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const normalized = raw.replace(',', '.');
                        if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                          setMetroPurchaseInput(raw);
                          const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                          setNewMetroProduct({ ...newMetroProduct, purchasePrice: num });
                        }
                      }}
                      onBlur={(e) => {
                        const v = e.target.value.replace(',', '.');
                        if (v !== '' && !isNaN(Number(v))) {
                          const n = Math.round(parseFloat(v) * 100) / 100;
                          setNewMetroProduct({ ...newMetroProduct, purchasePrice: n });
                          setMetroPurchaseInput(n.toFixed(2));
                        } else {
                          setMetroPurchaseInput('');
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="metroSalePrice" className="block min-h-[20px]">Precio de Venta por Metro</Label>
                    <Input
                      id="metroSalePrice"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={metroSaleInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const normalized = raw.replace(',', '.');
                        if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                          setMetroSaleInput(raw);
                          const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                          setNewMetroProduct({ ...newMetroProduct, salePrice: num });
                        }
                      }}
                      onBlur={(e) => {
                        const v = e.target.value.replace(',', '.');
                        if (v !== '' && !isNaN(Number(v))) {
                          const n = Math.round(parseFloat(v) * 100) / 100;
                          setNewMetroProduct({ ...newMetroProduct, salePrice: n });
                          setMetroSaleInput(n.toFixed(2));
                        } else {
                          setMetroSaleInput('');
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="bg-green-100 p-3 rounded-lg text-center">
                  <div className="text-sm text-green-700 font-medium">Precio de Venta por Centímetro: S/ {newMetroProduct.salePrice ? (newMetroProduct.salePrice / 100).toFixed(3) : '0.000'}</div>
                </div>
                <div>
                  <Label htmlFor="metroInitialStock">Stock inicial (m)</Label>
                  <Input
                    id="metroInitialStock"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={metroStockInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const normalized = raw.replace(',', '.');
                      if (raw === '' || /^\d*(?:[.,]\d{0,2})?$/.test(raw)) {
                        setMetroStockInput(raw);
                        const num = normalized === '' ? 0 : parseFloat(normalized) || 0;
                        setNewMetroProduct({ ...newMetroProduct, initialStockCm: Math.round(num * 100) });
                      }
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.replace(',', '.');
                      if (v !== '' && !isNaN(Number(v))) {
                        const n = Math.round(parseFloat(v) * 100) / 100;
                        setNewMetroProduct({ ...newMetroProduct, initialStockCm: Math.round(n * 100) });
                        setMetroStockInput(n.toFixed(2));
                      } else {
                        setMetroStockInput('');
                      }
                    }}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Se guarda internamente en centímetros: {formatLength(newMetroProduct.initialStockCm)}.
                  </p>
                </div>
                <div>
                  <Label htmlFor="metroCategory">Categoría</Label>
                  <Input
                    id="metroCategory"
                    placeholder="Ej: cables"
                    value={newMetroProduct.category}
                    onChange={(e) => setNewMetroProduct({...newMetroProduct, category: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Imagen del producto</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewProductImage(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setNewProductImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {newProductImagePreview && (
                    <div className="mt-2">
                      <img src={newProductImagePreview} alt="Preview" className="w-full h-32 object-cover rounded-lg border" />
                    </div>
                  )}
                </div>
              </>
            )}

            {addProductMode === 'mayorista' && (
              <>
                {/* Información General */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-l-4 border-indigo-600 pl-3">
                    <h3 className="font-bold text-slate-900 text-sm">Información General</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="mayoristaProductName">Nombre del Producto</Label>
                      <Input
                        id="mayoristaProductName"
                        placeholder="taper 1/2"
                        value={newMayoristaProduct.name}
                        onChange={(e) => setNewMayoristaProduct({...newMayoristaProduct, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="mayoristaCategory">Categoría</Label>
                      <Input
                        id="mayoristaCategory"
                        placeholder="tapers"
                        value={newMayoristaProduct.category}
                        onChange={(e) => setNewMayoristaProduct({...newMayoristaProduct, category: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Niveles de Venta */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-2 border-l-4 border-indigo-600 pl-3">
                    <h3 className="font-bold text-slate-900 text-sm">Niveles de Venta</h3>
                  </div>

                  {newMayoristaLevels.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-[11px] font-bold text-slate-700">Nivel</TableHead>
                            <TableHead className="text-[11px] font-bold text-slate-700">Contenido</TableHead>
                            <TableHead className="text-[11px] font-bold text-slate-700">P. Compra</TableHead>
                            <TableHead className="text-[11px] font-bold text-slate-700">P. Venta</TableHead>
                            <TableHead className="text-[11px] font-bold text-slate-700">Stock</TableHead>
                            <TableHead className="text-[11px] font-bold text-slate-700 text-center">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...newMayoristaLevels].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; }).map((lvl, i) => (
                            <TableRow key={lvl.id}>
                              {editingNewLevelId === lvl.id ? (
                                <>
                                  <TableCell className="py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900 text-xs">{lvl.name}</span>
                                      {i === 0 && (
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px]">
                                          nivel mínimo
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    {lvl.name === 'Unidad' ? (
                                      <span className="text-xs text-slate-600">1 unid.</span>
                                    ) : (
                                      <Input
                                        type="text"
                                        value={editNewTempContains}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === '' || /^\d*$/.test(val)) setEditNewTempContains(val);
                                        }}
                                        className="h-7 text-xs w-16"
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Input
                                      type="text"
                                      value={editNewTempPurchasePrice}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) setEditNewTempPurchasePrice(val);
                                      }}
                                      className="h-7 text-xs w-20"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Input
                                      type="text"
                                      value={editNewTempSalePrice}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) setEditNewTempSalePrice(val);
                                      }}
                                      className="h-7 text-xs w-20"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2">
                                    {(() => {
                                      const hasUnidad = newMayoristaLevels.some(l => l.name === 'Unidad');
                                      const isStockEditable = lvl.name === 'Unidad' || !hasUnidad;
                                      return isStockEditable ? (
                                        <Input
                                          type="text"
                                          value={editNewTempStock}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d*$/.test(val)) setEditNewTempStock(val);
                                          }}
                                          className="h-7 text-xs w-16"
                                        />
                                      ) : (
                                        <span className="text-xs text-slate-400">—</span>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="py-2 text-center">
                                    <div className="flex gap-1 justify-center">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-green-600 hover:text-green-800 hover:bg-green-50"
                                        onClick={() => {
                                          const hasUnidad = newMayoristaLevels.some(l => l.name === 'Unidad');
                                          const isStockEditable = lvl.name === 'Unidad' || !hasUnidad;
                                          const newStock = isStockEditable ? parseInt(editNewTempStock) : lvl.stock;
                                          const newSP = parseFloat(editNewTempSalePrice);
                                          const newPP = parseFloat(editNewTempPurchasePrice);
                                          const newContains = lvl.name !== 'Unidad' ? parseInt(editNewTempContains) : lvl.baseUnitsContained;
                                          if ((isStockEditable && (isNaN(newStock) || newStock < 0)) || isNaN(newSP) || newSP < 0 || isNaN(newPP) || newPP < 0 || isNaN(newContains) || newContains <= 0) {
                                            toast({ title: "Valores no válidos", variant: "destructive" });
                                            return;
                                          }
                                          setNewMayoristaLevels(newMayoristaLevels.map(l =>
                                            l.id === lvl.id ? { ...l, stock: newStock, salePrice: newSP, purchasePrice: newPP, baseUnitsContained: newContains } : l
                                          ));
                                          setEditingNewLevelId(null);
                                        }}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => setEditingNewLevelId(null)}
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900 text-xs">{lvl.name}</span>
                                      {i === 0 && (
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px]">
                                          nivel mínimo
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 text-xs text-slate-600">
                                    {lvl.baseUnitsContained} unid.
                                  </TableCell>
                                  <TableCell className="py-2 text-xs text-blue-700 font-medium">
                                    S/ {(lvl.purchasePrice ?? 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="py-2 text-xs text-green-700 font-medium">
                                    S/ {(lvl.salePrice ?? 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="py-2 text-xs font-bold">
                                    {(() => {
                                      const hasUn = newMayoristaLevels.some(l => l.name === 'Unidad');
                                      if (hasUn && lvl.name !== 'Unidad') return <span className="text-slate-400">—</span>;
                                      return <>{lvl.stock} {lvl.name}(s)</>;
                                    })()}
                                  </TableCell>
                                  <TableCell className="py-2 text-center">
                                    <div className="flex gap-1 justify-center">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                        onClick={() => {
                                          const hasUnidad = newMayoristaLevels.some(l => l.name === 'Unidad');
                                          const isStockEditable = lvl.name === 'Unidad' || !hasUnidad;
                                          setEditNewTempStock(lvl.stock.toString());
                                          setEditNewTempPurchasePrice(lvl.purchasePrice.toString());
                                          setEditNewTempSalePrice(lvl.salePrice.toString());
                                          setEditNewTempContains(lvl.baseUnitsContained.toString());
                                          setEditingNewLevelId(lvl.id);
                                        }}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50"
                                        onClick={() => setNewMayoristaLevels(newMayoristaLevels.filter(l => l.id !== lvl.id))}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  {/* Agregar Nuevo Nivel */}
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-4">
                    <p className="text-xs font-semibold text-slate-700 mb-3">Agregar Nuevo Nivel</p>
                    {newMayoristaLevels.some(l => l.name === 'Unidad') && newMayoristaLevels.length <= 1 && (
                      <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3 mx-1 w-fit">
                        Debes agregar al menos un nivel adicional (Paquete, Ciento, etc.) además de Unidad
                      </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div>
                        <Label className="text-[10px]">Seleccionar Nivel</Label>
                        <Select value={newLevelDropdown} onValueChange={setNewLevelDropdown}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Elige un nivel..." />
                          </SelectTrigger>
                          <SelectContent>
                            {['Unidad', 'Paquete', 'Ciento', 'Millar', 'Plancha', 'Fardo', 'Personalizado'].filter(n => !newMayoristaLevels.find(l => l.name === n)).map(n => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {newLevelDropdown === 'Personalizado' && (
                          <Input
                            type="text"
                            placeholder="Nombre del nivel..."
                            value={newLevelCustomName}
                            onChange={(e) => setNewLevelCustomName(e.target.value)}
                            className="h-8 text-xs mt-2"
                          />
                        )}
                      </div>
                      <div>
                        <Label className="text-[10px]">Contenido (unid.)</Label>
                        <Input
                          type="text"
                          placeholder="Ej: 25"
                          value={newLevelDropdown === 'Unidad' ? '1' : newLevelContains}
                          onChange={(e) => setNewLevelContains(e.target.value)}
                          className="h-8 text-xs"
                          disabled={newLevelDropdown === 'Unidad'}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">P. Compra (S/)</Label>
                        <Input
                          type="text"
                          placeholder="0.00"
                          value={newLevelPurchasePrice}
                          onChange={(e) => setNewLevelPurchasePrice(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">P. Venta (S/)</Label>
                        <Input
                          type="text"
                          placeholder="0.00"
                          value={newLevelSalePrice}
                          onChange={(e) => setNewLevelSalePrice(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      {!newMayoristaLevels.some(l => l.name === 'Unidad') && (
                      <div>
                        <Label className="text-[10px]">Stock {newLevelDropdown !== 'Personalizado' && newLevelDropdown ? `(${newLevelDropdown}s)` : ''}</Label>
                        <Input
                          type="text"
                          placeholder="0"
                          value={newLevelStockInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*$/.test(val)) {
                              setNewLevelStockInput(val);
                            }
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      )}
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
                        disabled={
                          !newLevelDropdown ||
                          newLevelDropdown === 'Unidad'
                            ? (!newLevelPurchasePrice || !newLevelSalePrice || !newLevelStockInput)
                            : newMayoristaLevels.some(l => l.name === 'Unidad')
                              ? (!newLevelContains || !newLevelPurchasePrice || !newLevelSalePrice)
                              : (!newLevelContains || !newLevelPurchasePrice || !newLevelSalePrice || !newLevelStockInput)
                        }
                          onClick={() => {
                            const isUnidad = newLevelDropdown === 'Unidad';
                            const contains = isUnidad ? 1 : parseInt(newLevelContains);
                            if (!isUnidad && (isNaN(contains) || contains <= 0)) {
                              toast({ title: "Contenido no válido", description: "Debe ser mayor a 0", variant: "destructive" });
                              return;
                            }

                            const pPrice = parseFloat(newLevelPurchasePrice);
                            const sPrice = parseFloat(newLevelSalePrice);
                            const hasUnidad = newMayoristaLevels.some(l => l.name === 'Unidad');
                            const stockQty = (isUnidad || !hasUnidad) ? parseInt(newLevelStockInput || '0') : 0;
                            if (isNaN(pPrice) || pPrice < 0 || isNaN(sPrice) || sPrice < 0) {
                              toast({ title: "Precios no válidos", description: "Ingresa precios mayores o iguales a 0", variant: "destructive" });
                              return;
                            }
                            if (pPrice >= sPrice) {
                              toast({ title: "Precios inválidos", description: "El precio de compra debe ser menor al precio de venta", variant: "destructive" });
                              return;
                            }
                            if ((isUnidad || !hasUnidad) && (isNaN(stockQty) || stockQty < 0)) {
                              toast({ title: "Stock no válido", description: "Ingresa un stock válido", variant: "destructive" });
                              return;
                            }
                            const newLvl: SaleLevel = {
                              id: generateId(),
                              name: newLevelDropdown === 'Personalizado' ? newLevelCustomName.trim() : newLevelDropdown,
                              baseUnitsContained: contains,
                              purchasePrice: pPrice,
                              salePrice: sPrice,
                              stock: isUnidad ? stockQty : (newMayoristaLevels.some(l => l.name === 'Unidad') ? 0 : stockQty),
                              initialStock: isUnidad ? stockQty : (newMayoristaLevels.some(l => l.name === 'Unidad') ? 0 : stockQty)
                            };
                            setNewMayoristaLevels([...newMayoristaLevels, newLvl]);
                            setNewLevelDropdown('');
                            setNewLevelCustomName('');
                            setNewLevelContains('');
                            setNewLevelPurchasePrice('');
                            setNewLevelSalePrice('');
                            setNewLevelStockInput('');
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Agregar Nivel
                        </Button>
                      </div>
                  </div>
                </div>

                {/* Resumen de Stock */}
                {newMayoristaLevels.length > 0 && (
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2 border-l-4 border-indigo-600 pl-3">
                      <h3 className="font-bold text-slate-900 text-sm">Resumen de Stock</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(() => {
                        const hasUnidad = newMayoristaLevels.some(l => l.name === 'Unidad');
                        return [...newMayoristaLevels].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; }).map((lvl, i) => {
                          return (
                            <div key={lvl.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{lvl.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {lvl.baseUnitsContained} unid.{lvl.name !== 'Unidad' ? ` equivale a 1 ${lvl.name.toLowerCase()}` : ''}
                                  </p>
                                </div>
                                <div className="text-right">
                                  {hasUnidad && lvl.name !== 'Unidad' ? (
                                    <p className="text-xs text-slate-400 italic">Stock variable</p>
                                  ) : (
                                    <>
                                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Stock disponible</p>
                                      <p className="text-2xl font-bold text-slate-900">{lvl.stock}</p>
                                      <p className="text-[10px] text-slate-500">{lvl.name}(s)</p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
                <div>
                  <Label>Imagen del producto</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewProductImage(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setNewProductImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {newProductImagePreview && (
                    <div className="mt-2">
                      <img src={newProductImagePreview} alt="Preview" className="w-full h-32 object-cover rounded-lg border" />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                if (addProductMode === 'unidad') agregarProducto();
                else if (addProductMode === 'peso') agregarProductoPeso();
                else if (addProductMode === 'metro') agregarProductoMetro();
                else if (addProductMode === 'mayorista') agregarProductoMayorista();
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              disabled={
                addProductMode === 'unidad' ? (!newProduct.name || newProduct.salePrice <= 0 || newProduct.purchasePrice <= 0 || newProduct.stock <= 0) :
                addProductMode === 'peso' ? isWeightFormInvalid :
                addProductMode === 'metro' ? isMetroFormInvalid :
                addProductMode === 'mayorista' ? isMayoristaFormInvalid : false
              }
            >
              Agregar producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock History Modal */}
      <Dialog
        open={isStockHistoryModalOpen}
        onOpenChange={(open) => {
          setIsStockHistoryModalOpen(open);
          if (!open) {
            setSelectedStockHistoryProduct(null);
            setIsDeleteStockHistoryOpen(false);
            setShowStockRestockForm(false);
            setStockHistoryRestockQuantity('');
            setSelectedMayoristaRestockLevel('');
            setMayoristaRestockQuantity('');
            setSelectedHistoryLevel('');
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl md:max-w-6xl lg:max-w-7xl">
          <DialogHeader>
            <DialogTitle>Historial de stock</DialogTitle>
            <DialogDescription>
              {currentStockHistoryProduct
                ? `${currentStockHistoryProduct.name} · ${currentStockHistoryProduct.category}`
                : 'Selecciona un producto para ver su historial.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {currentStockHistoryProduct && (
              <div className="space-y-4">
                  {currentStockHistoryProduct.type === 'mayorista' && (currentStockHistoryProduct.saleLevels?.some(l => l.name === 'Unidad')) === false ? (
                  // Modal para productos mayoristas (Modelo B: cada nivel tiene su propio stock)
                  <div className="space-y-4">


                    {/* Botones de filtro por nivel */}
                    <div className="flex flex-wrap justify-between items-end gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Mostrar historial de:</Label>
                        <div className="flex flex-wrap gap-2">
                        {[...(currentStockHistoryProduct.saleLevels || [])].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; }).map((level) => (
                          <Button
                            key={level.id}
                            variant={selectedHistoryLevel === level.name ? "default" : "outline"}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setSelectedHistoryLevel(level.name)}
                          >
                            {level.name}
                          </Button>
                        ))}
                        </div>
                      </div>
                      {userRole === 'admin' && (
                        <Button
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setIsDeleteStockHistoryOpen(true)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar historial
                        </Button>
                      )}
                    </div>

                    {/* Formulario de reposición */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <Button
                        variant="outline"
                        className="border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                        onClick={() => setShowStockRestockForm(!showStockRestockForm)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar reposición
                      </Button>

                      {showStockRestockForm && (
                        <div className="mt-4 space-y-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Nivel</Label>
                            <div className="flex flex-wrap gap-2">
                              {[...(currentStockHistoryProduct.saleLevels || [])].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; }).map((level) => (
                                <Button
                                  key={level.id}
                                  variant={selectedMayoristaRestockLevel === level.name ? "default" : "outline"}
                                  className={`${selectedMayoristaRestockLevel === level.name ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-white hover:bg-slate-100'}`}
                                  onClick={() => setSelectedMayoristaRestockLevel(level.name)}
                                >
                                  {level.name}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {selectedMayoristaRestockLevel && (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Stock actual ({selectedMayoristaRestockLevel}s)</Label>
                                  <div className="p-3 bg-slate-100 rounded-lg text-lg font-bold text-slate-700">
                                    {currentStockHistoryProduct.saleLevels?.find(l => l.name === selectedMayoristaRestockLevel)?.stock || 0}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Cantidad a agregar ({selectedMayoristaRestockLevel}s)</Label>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={mayoristaRestockQuantity}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^\d*$/.test(val)) {
                                        setMayoristaRestockQuantity(val);
                                      }
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Fecha</Label>
                                  <div className="relative">
                                    <Input value={stockHistoryCurrentDate} readOnly className="pr-10 bg-white" />
                                    <Calendar className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end gap-3">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setShowStockRestockForm(false);
                                    setSelectedMayoristaRestockLevel('');
                                    setMayoristaRestockQuantity('');
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  className="bg-slate-900 hover:bg-slate-800 text-white"
                                  onClick={() => {
                                    if (!selectedMayoristaRestockLevel || !mayoristaRestockQuantity) {
                                      toast({ title: "Datos incompletos", description: "Selecciona un nivel y una cantidad", variant: "destructive" });
                                      return;
                                    }

                                    const level = currentStockHistoryProduct.saleLevels?.find(l => l.name === selectedMayoristaRestockLevel);
                                    if (!level) return;

                                    const qty = parseInt(mayoristaRestockQuantity);
                                    if (isNaN(qty) || qty <= 0) {
                                      toast({ title: "Cantidad no válida", variant: "destructive" });
                                      return;
                                    }

                                    const productHistory = stockHistory.filter(item => 
                                      item.productId === currentStockHistoryProduct.id && 
                                      (item.affectedLevelName === selectedMayoristaRestockLevel || 
                                        (item.type === 'initial' && item.levelStockAfter?.[selectedMayoristaRestockLevel]))
                                    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                                    let newHistoryItems: StockHistoryItem[] = [];

                                    // Find last stock state for this level
                                    let lastLevelStock = 0;
                                    if (productHistory.length > 0) {
                                      const lastEntry = productHistory[productHistory.length - 1];
                                      lastLevelStock = lastEntry.levelStockAfter?.[selectedMayoristaRestockLevel] ?? 0;
                                    }
                                    
                                    // Calculate sales since last entry
                                    const soldSinceLast = Math.max(lastLevelStock - level.stock, 0);

                                    const totalUnits = qty * level.baseUnitsContained;

                                    const updatedProducts = products.map(p => {
                                      if (p.id === currentStockHistoryProduct.id) {
                                        const updatedLevels = p.saleLevels?.map(l => {
                                          if (l.name === level.name) {
                                            const newStock = l.stock + qty;
                                            return { ...l, stock: newStock };
                                          }
                                          return l;
                                        });
                                        const newTotalUnits = (updatedLevels || []).reduce((sum, l) => sum + l.stock * l.baseUnitsContained, 0);
                                        return { ...p, saleLevels: updatedLevels, stock: newTotalUnits };
                                      }
                                      return p;
                                    });
                                    setProducts(updatedProducts);
                                    safeSetItem('pos-products', JSON.stringify(updatedProducts));
    syncProductsToFirestore(updatedProducts);

                                    const levelHasHistory = productHistory.length > 0;
                                    
                                    const updatedProduct = updatedProducts.find(p => p.id === currentStockHistoryProduct.id);
                                    const levelStockAfter = updatedProduct?.saleLevels?.reduce((acc, l) => ({ ...acc, [l.name]: l.stock }), {});
                                    
                                    const descParts: string[] = [];
                                    if (soldSinceLast > 0) descParts.push(`${soldSinceLast} vendidos`);
                                    descParts.push(`+${qty} agregados`);

                                    // Single combined entry: restock + sold info
                                    const restockHistoryItem: StockHistoryItem = {
                                      id: generateId(),
                                      productId: currentStockHistoryProduct.id,
                                      productName: currentStockHistoryProduct.name,
                                      type: levelHasHistory ? 'restock' : 'initial',
                                      quantity: totalUnits,
                                      resultingStock: updatedProduct?.stock ?? currentStockHistoryProduct.stock,
                                      date: new Date().toISOString(),
                                      levelQuantities: { [level.name]: qty + soldSinceLast },
                                      levelDescription: levelHasHistory ? descParts.join(' — ') : 'stock inicial',
                                      affectedLevelName: level.name,
                                      levelQuantity: qty,
                                      levelSoldQuantity: soldSinceLast > 0 ? soldSinceLast : undefined,
                                      levelStockAfter,
                                      isInitial: !levelHasHistory
                                    };
                                    newHistoryItems.push(restockHistoryItem);

                                    const updatedHistory = [...stockHistory, ...newHistoryItems];
                                    setStockHistory(updatedHistory);
                                    safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
                                    newHistoryItems.forEach(h => addPendingId(PENDING.HISTORY, h.id));
      syncHistoryToFirestore(updatedHistory);

                                    toast({ title: "Reposición guardada", description: `+${qty} ${selectedMayoristaRestockLevel}${qty > 1 ? 's' : ''} agregados` });
                                    setShowStockRestockForm(false);
                                    setSelectedMayoristaRestockLevel('');
                                    setMayoristaRestockQuantity('');
                                  }}
                                >
                                  Guardar
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tabla de historial */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-200">
                        <h3 className="font-bold text-slate-900">
                          {selectedHistoryLevel ? `Historial de ${selectedHistoryLevel}` : 'Historial completo'}
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="text-[11px] font-bold text-slate-700">Fecha</TableHead>
                              <TableHead className="text-[11px] font-bold text-slate-700">Stock actual</TableHead>
                              <TableHead className="text-[11px] font-bold text-slate-700">Venta</TableHead>
                              <TableHead className="text-[11px] font-bold text-slate-700">Cantidad agregada</TableHead>
                              <TableHead className="text-[11px] font-bold text-slate-700 text-right">Stock resultante</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const productHistory = [...modalProductHistory]
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                              if (!selectedHistoryLevel) {
                                // Vista "Todos": libro cronologico con inicial, reposiciones y ventas.
                                const visibleHistory = productHistory.filter(item => item.type !== 'price_change');

                                if (visibleHistory.length === 0) {
                                  return (
                                    <TableRow>
                                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        No hay registros para este producto.
                                      </TableCell>
                                    </TableRow>
                                  );
                                }

                                // Movimiento en unidades generales (mayorista usa unidades_contenidas del nivel).
                                const movementOf = (item: StockHistoryItem) => {
                                  if (item.type !== 'sale') return item.quantity;
                                  const level = currentStockHistoryProduct.saleLevels?.find(l => l.name === item.affectedLevelName);
                                  return item.quantity * (level?.baseUnitsContained ?? 1);
                                };

                                const displayRows: Array<{
                                  date: string;
                                  stockActual: number;
                                  soldQuantity: number | null;
                                  addedQuantity: number | null;
                                  resultingStock: number;
                                  isInitial: boolean;
                                  key: string;
                                }> = [];

                                visibleHistory.forEach((item) => {
                                  if (item.type === 'initial') {
                                    displayRows.push({
                                      key: item.id,
                                      date: item.date,
                                      stockActual: item.quantity,
                                      soldQuantity: null,
                                      addedQuantity: item.quantity,
                                      resultingStock: item.resultingStock,
                                      isInitial: true
                                    });
                                    return;
                                  }

                                  if (item.type === 'sale') {
                                    return;
                                  }

                                  const prevSale = visibleHistory
                                    .filter(h => h.type === 'sale' && h.isSummary)
                                    .find(h => Math.abs(new Date(h.date).getTime() - new Date(item.date).getTime()) < 5000);

                                  const saleMatch = visibleHistory
                                    .slice()
                                    .reverse()
                                    .find(h => h.type === 'sale' && h.isSummary && new Date(h.date).getTime() < new Date(item.date).getTime());

                                  const saleQty = prevSale?.quantity ?? saleMatch?.quantity;

                                  displayRows.push({
                                    key: item.id,
                                    date: item.date,
                                    stockActual: item.resultingStock - item.quantity,
                                    soldQuantity: saleQty ? movementOf({ ...saleQty as any, type: 'sale', affectedLevelName: item.affectedLevelName } as any) : null,
                                    addedQuantity: item.quantity,
                                    resultingStock: item.resultingStock,
                                    isInitial: false
                                  });
                                });

                                return displayRows.slice().reverse().map((row) => (
                                  <TableRow key={row.key}>
                                    <TableCell className="text-sm text-slate-700">
                                      {new Date(row.date).toLocaleDateString('es-PE', {
                                        year: 'numeric', month: 'short', day: 'numeric'
                                      })}
                                    </TableCell>
                                    <TableCell className="text-sm font-bold text-slate-700">
                                      {row.stockActual}
                                    </TableCell>
                                    <TableCell className="text-sm font-bold text-red-600">
                                      {row.soldQuantity === null ? '-' : `-${row.soldQuantity}`}
                                    </TableCell>
                                    <TableCell className="text-sm font-bold text-green-600">
                                      {row.addedQuantity === null
                                        ? '-'
                                        : `+${row.addedQuantity}`}
                                      {row.isInitial && <span className="text-slate-500 font-medium"> (inicial)</span>}
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-bold text-slate-700">
                                      {row.resultingStock}
                                    </TableCell>
                                  </TableRow>
                                ));
                              }

                              // Vista por nivel seleccionado (inicial, reposiciones y ventas de ese nivel)
                              const levelEvents = productHistory.filter(item =>
                                item.type === 'initial' ||
                                ((item.type === 'restock' || item.type === 'sale') && item.affectedLevelName === selectedHistoryLevel)
                              );

                              if (levelEvents.length === 0) {
                                return (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                      No hay registros para {selectedHistoryLevel}.
                                    </TableCell>
                                  </TableRow>
                                );
                              }

                              const displayRows: Array<{
                                id: string;
                                date: string;
                                stockActual: number;
                                soldQuantity: number | null;
                                addedQuantity: number | null;
                                resultingStock: number;
                                isInitial: boolean;
                              }> = [];

                              // Calculate final running stock from current product's level stock!
                              const currentLevel = currentStockHistoryProduct.saleLevels?.find(l => l.name === selectedHistoryLevel);
                              let finalRunningStock = currentLevel?.stock ?? 0;

                              let currentStock = finalRunningStock;

                              // Now process in reverse (newest to oldest)
                              levelEvents.slice().reverse().forEach((item) => {
                                const isInitial = item.type === 'initial';
                                
                                let soldQty: number | null = null;
                                let addedQty: number | null = null;
                                let stockBefore: number;
                                let stockAfter: number;

                                // Calculate stockAfter as currentStock, then work backwards
                                stockAfter = currentStock;
                                
                                if (item.type === 'sale') {
                                  soldQty = item.levelQuantity ?? 0;
                                  stockBefore = stockAfter + soldQty;
                                } else if (item.type === 'restock' || item.type === 'initial') {
                                  addedQty = item.type === 'initial' 
                                    ? (item.levelStockAfter?.[selectedHistoryLevel] ?? (item.levelQuantities?.[selectedHistoryLevel] ?? 0))
                                    : (item.levelQuantity ?? 0);
                                  if (isInitial) {
                                    // Initial: after is addedQty (the initial stock)
                                    stockAfter = addedQty;
                                    stockBefore = 0;
                                  } else {
                                    // Restock: before was stockAfter - addedQty, after is stockAfter
                                    stockBefore = stockAfter - addedQty;
                                    // Combined entry: extract sold quantity from levelSoldQuantity
                                    if (item.levelSoldQuantity !== undefined) {
                                      soldQty = item.levelSoldQuantity;
                                    }
                                  }
                                }
                                
                                // Push this row (newest first, like the general view)
                                displayRows.push({
                                  id: item.id,
                                  date: item.date,
                                  stockActual: isInitial ? addedQty : stockBefore,
                                  soldQuantity: soldQty,
                                  addedQuantity: addedQty,
                                  resultingStock: stockAfter,
                                  isInitial
                                });
                                
                                currentStock = stockBefore;
                              });

                              return displayRows.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className="text-sm text-slate-700">
                                    {new Date(row.date).toLocaleDateString('es-PE', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </TableCell>
                                  <TableCell className="text-sm font-bold text-slate-700">
                                    {row.stockActual}
                                  </TableCell>
                                  <TableCell className="text-sm font-bold text-red-600">
                                    {row.soldQuantity === null
                                      ? '-'
                                      : `-${row.soldQuantity}`}
                                  </TableCell>
                                  <TableCell className="text-sm font-bold text-green-600">
                                    {row.addedQuantity === null
                                      ? '-'
                                      : `+${row.addedQuantity}`}
                                    {row.isInitial && <span className="text-slate-500 font-medium"> (inicial)</span>}
                                  </TableCell>
                                  <TableCell className="text-right text-sm font-bold text-slate-700">
                                    {row.resultingStock}
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Modal para productos normales (mantenemos el original)
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      {currentStockHistoryProduct.imageUrl && (
                        <div className="flex-shrink-0">
                          <img 
                            src={currentStockHistoryProduct.imageUrl} 
                            alt={currentStockHistoryProduct.name} 
                            className="w-48 h-48 object-cover rounded-xl border border-slate-200" 
                          />
                        </div>
                      )}
                      <div className="flex-1 w-full space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Stock disponible</p>
                            <p className="text-2xl font-black text-slate-900">
                              {currentStockHistoryProduct.type === 'peso'
                                ? formatWeight(currentStockHistoryProduct.stock)
                                : currentStockHistoryProduct.type === 'metro'
                                  ? formatLength(currentStockHistoryProduct.stock)
                                  : currentStockHistoryProduct.stock}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {(currentStockHistoryProduct.type !== 'mayorista' || (currentStockHistoryProduct.saleLevels?.some(l => l.name === 'Unidad'))) && (
                              <Button
                                variant="outline"
                                className="border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                                onClick={() => setShowStockRestockForm(true)}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Agregar reposición
                              </Button>
                            )}
                            {userRole === 'admin' && (
                              <Button
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setIsDeleteStockHistoryOpen(true)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                              </Button>
                            )}
                          </div>
                        </div>
                        {currentStockHistoryProduct.type === 'peso' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Precio de Venta por Gramo</p>
                              <p className="text-xl font-bold text-green-600">
                                 S/ {((currentStockHistoryProduct.salePricePerKg || 0) / 1000).toFixed(3)}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Precio de Compra por Kg</p>
                              <p className="text-xl font-bold text-indigo-600">
                                S/ {(currentStockHistoryProduct.purchasePrice ?? 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        )}
                        {currentStockHistoryProduct.type === 'metro' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Precio de Venta por Metro</p>
                              <p className="text-xl font-bold text-green-600">
                                S/ {(currentStockHistoryProduct.salePrice ?? 0).toFixed(2)}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Precio de Compra por Metro</p>
                              <p className="text-xl font-bold text-indigo-600">
                                S/ {(currentStockHistoryProduct.purchasePrice ?? 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {showStockRestockForm && (currentStockHistoryProduct.type !== 'mayorista' || (currentStockHistoryProduct.saleLevels?.some(l => l.name === 'Unidad'))) && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="stockHistoryRestockQuantity">
                              {currentStockHistoryProduct.type === 'peso'
                                ? 'Cantidad (gramos)'
                                : currentStockHistoryProduct.type === 'metro'
                                  ? 'Cantidad (metros)'
                                  : currentStockHistoryProduct.type === 'mayorista' ? 'Cantidad (unidades)' : 'Cantidad'}
                            </Label>
                            <Input
                              id="stockHistoryRestockQuantity"
                              type={currentStockHistoryProduct.type === 'metro' ? 'text' : 'number'}
                              inputMode={currentStockHistoryProduct.type === 'metro' ? 'decimal' : undefined}
                              min={currentStockHistoryProduct.type === 'metro' ? undefined : '1'}
                              placeholder={currentStockHistoryProduct.type === 'metro' ? '0.00' : '0'}
                              value={stockHistoryRestockQuantity}
                              onChange={(e) => setStockHistoryRestockQuantity(e.target.value)}
                            />
                            {currentStockHistoryProduct.type === 'peso' && (
                              <div className="bg-green-100 px-3 py-2 rounded text-sm font-medium text-green-700 w-full text-center">
                                Conversión<br/>{stockHistoryRestockQuantity ? `${(parseFloat(stockHistoryRestockQuantity) / 1000).toFixed(1)}kg` : '0kg'}
                              </div>
                            )}
                            {currentStockHistoryProduct.type === 'metro' && (
                              <div className="bg-green-100 px-3 py-2 rounded text-sm font-medium text-green-700 w-full text-center">
                                Conversión<br/>{stockHistoryRestockQuantity ? formatLength((parseFloat(normalizeDecimalInput(stockHistoryRestockQuantity)) || 0) * 100) : '0.00 m'}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Fecha</Label>
                            <div className="relative">
                              <Input value={stockHistoryCurrentDate} readOnly className="pr-10 bg-white" />
                              <Calendar className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowStockRestockForm(false);
                              setStockHistoryRestockQuantity('');
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={handleAddStockHistoryRestock}>
                            Guardar
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-[11px] font-bold text-slate-700">Fecha</TableHead>
                            <TableHead className="text-[11px] font-bold text-slate-700">Stock actual</TableHead>
                            <TableHead className="text-[11px] font-bold text-slate-700">Venta</TableHead>
                            <TableHead className="text-[11px] font-bold text-slate-700">Cantidad agregada</TableHead>
                            <TableHead className="text-[11px] font-bold text-slate-700 text-right">Stock resultante</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!currentStockHistoryProduct || stockHistoryDisplayRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                No hay registros para este producto.
                              </TableCell>
                            </TableRow>
                          ) : (
                            stockHistoryDisplayRows.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-sm text-slate-700">
                                  {new Date(item.date).toLocaleDateString('es-PE', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </TableCell>
                                <TableCell className="text-sm font-bold text-slate-700">
                                  {currentStockHistoryProduct.type === 'peso'
                                    ? formatWeight(item.stockActual)
                                    : currentStockHistoryProduct.type === 'metro'
                                      ? formatLength(item.stockActual)
                                      : item.stockActual}
                                </TableCell>
                                <TableCell className="text-sm font-bold text-red-600">
                                  {item.soldQuantity === null
                                    ? '-'
                                    : `-${currentStockHistoryProduct.type === 'peso'
                                      ? formatWeight(item.soldQuantity)
                                      : currentStockHistoryProduct.type === 'metro'
                                        ? formatLength(item.soldQuantity)
                                        : item.soldQuantity}`}
                                </TableCell>
                                <TableCell className="text-sm font-bold text-green-600">
                                  {item.addedQuantity === null
                                    ? '-'
                                    : `+${currentStockHistoryProduct.type === 'peso'
                                      ? formatWeight(item.addedQuantity)
                                      : currentStockHistoryProduct.type === 'metro'
                                        ? formatLength(item.addedQuantity)
                                        : item.addedQuantity}`}
                                </TableCell>
                                <TableCell className="text-right text-sm font-bold text-slate-700">
                                  {currentStockHistoryProduct.type === 'peso'
                                    ? formatWeight(item.resultingStock)
                                    : currentStockHistoryProduct.type === 'metro'
                                      ? formatLength(item.resultingStock)
                                      : item.resultingStock}
                                  {item.isInitial && <span className="text-slate-500 font-medium"> (inicial)</span>}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteStockHistoryOpen}
        onOpenChange={(open) => {
          setIsDeleteStockHistoryOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar historial</DialogTitle>
            <DialogDescription>
              {currentStockHistoryProduct
                ? `Se eliminará el historial de ${currentStockHistoryProduct.name}.`
                : 'Confirma la eliminación del historial.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {currentStockHistoryProduct?.type === 'mayorista' && (currentStockHistoryProduct.saleLevels?.some(l => l.name === 'Unidad')) === false && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Eliminar historial de:</Label>
                <div className="flex flex-wrap gap-2">
                  {[...(currentStockHistoryProduct.saleLevels || [])].sort((a, b) => { if (a.name === 'Unidad') return -1; if (b.name === 'Unidad') return 1; return a.baseUnitsContained - b.baseUnitsContained; }).map((level) => (
                    <Button
                      key={level.id}
                      variant={selectedHistoryLevel === level.name ? "destructive" : "outline"}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setSelectedHistoryLevel(level.name)}
                    >
                      {level.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteStockHistoryOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
              if (!currentStockHistoryProduct) return;

              if (await esAdminActual()) {
                  let updatedProducts;
                  let updatedHistory;
                  let deletedIds: string[] = [];
                  
                  if (currentStockHistoryProduct.type === 'mayorista' && selectedHistoryLevel) {
                    // Delete only the selected level's history and recalculate that level's stock
                    deletedIds = stockHistory.filter(item => {
                      if (item.productId !== currentStockHistoryProduct.id) return false;
                      if (item.affectedLevelName === selectedHistoryLevel) return true;
                      if (item.type === 'initial' && item.levelStockAfter && item.levelStockAfter[selectedHistoryLevel]) return true;
                      return false;
                    }).map(item => item.id);
                    updatedHistory = stockHistory.filter(item => !deletedIds.includes(item.id));
                    const lastRemainingLevel = updatedHistory
                      .filter(item => item.productId === currentStockHistoryProduct.id && item.levelStockAfter?.[selectedHistoryLevel] !== undefined)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    const newLevelStock = lastRemainingLevel?.levelStockAfter?.[selectedHistoryLevel] ?? 0;
                    updatedProducts = products.map(p =>
                      p.id !== currentStockHistoryProduct.id ? p : {
                        ...p,
                        saleLevels: p.saleLevels?.map(l =>
                          l.name !== selectedHistoryLevel ? l : { ...l, stock: newLevelStock, initialStock: newLevelStock }
                        )
                      }
                    );
                    toast({
                      title: "Historial eliminado",
                      description: `Se eliminó el historial de ${selectedHistoryLevel} de ${currentStockHistoryProduct.name}.`,
                    });
                  } else {
                    // For non-mayorista or no level selected, delete all history and reset stock to 0
                    deletedIds = stockHistory.filter(item => item.productId === currentStockHistoryProduct.id).map(item => item.id);
                    updatedProducts = products.map(p =>
                      p.id !== currentStockHistoryProduct.id ? p : { ...p, stock: 0, initialStock: 0 }
                    );
                    updatedHistory = stockHistory.filter(item => item.productId !== currentStockHistoryProduct.id);
                    toast({
                      title: "Historial eliminado",
                      description: `Se eliminó el historial de ${currentStockHistoryProduct.name}.`,
                    });
                  }

                  await Promise.all(deletedIds.map(id => deleteStockHistoryItem(id).catch(e => console.error('ERROR deleteStockHistoryItem:', e))));
                  deletedIds.forEach(id => removePendingId(PENDING.HISTORY, id));
                  
                  const resetProduct = updatedProducts.find(product => product.id === currentStockHistoryProduct.id) ?? null;
                  
                  setStockHistory(updatedHistory);
                  safeSetItem('pos-stock-history', JSON.stringify(updatedHistory));
      syncHistoryToFirestore(updatedHistory);
                  setSelectedStockHistoryProduct(resetProduct);
                  setInventorySearch('');
                  setShowStockRestockForm(false);
                  setStockHistoryRestockQuantity('');
                  setSelectedMayoristaRestockLevel('');
                  setMayoristaRestockQuantity('');
                  setIsDeleteStockHistoryOpen(false);
                } else {
                  toast({
                    title: "Contraseña incorrecta",
                    description: "La contraseña de administrador no es válida.",
                    variant: "destructive",
                  });
                }
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteSaleOpen}
        onOpenChange={(open) => {
          setIsDeleteSaleOpen(open);
          if (!open) {
            setSaleToDelete(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar venta</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el Ticket #{saleToDelete ? ticketNumberOf(saleToDelete.id) : ''}? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteSaleOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
              if (!saleToDelete) return;

              if (await esAdminActual()) {
                  try { await deleteSale(saleToDelete.id); } catch (e) { console.error('ERROR deleteSale:', e); }
                  removePendingId(PENDING.SALES, saleToDelete.id);
                  const updatedSales = sales.filter(s => s.id !== saleToDelete.id);
                  setSales(updatedSales);
                  safeSetItem('pos-sales', JSON.stringify(updatedSales));
                  try {
                    const lista = JSON.parse(localStorage.getItem('pos-sales') || '[]');
                    if (Array.isArray(lista)) {
                      const limpia = lista.filter((x: any) => x?.id !== saleToDelete.id);
                      safeSetItem('pos-sales', JSON.stringify(limpia));
                    }
                  } catch {}
                  syncSalesToFirestore(updatedSales);
                  toast({
                    title: "Venta eliminada",
                    description: `Venta #${ticketNumberOf(saleToDelete.id)} eliminada.`,
                  });
                  setIsDeleteSaleOpen(false);
                  setSaleToDelete(null);
                } else {
                  toast({
                    title: "Contraseña incorrecta",
                    description: "La contraseña de administrador no es válida.",
                    variant: "destructive",
                  });
                }
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteProductConfirmOpen}
        onOpenChange={(open) => {
          setIsDeleteProductConfirmOpen(open);
          if (!open) {
            setProductToDelete(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar producto</DialogTitle>
            <DialogDescription>
              Se eliminará el producto: {productToDelete?.name}. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setIsDeleteProductConfirmOpen(false);
              setProductToDelete(null);
            }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteProduct}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBoletaPreviewOpen} onOpenChange={setIsBoletaPreviewOpen}>
        <DialogContent className="max-w-2xl" style={{ maxHeight: 'none' }}>
          <DialogHeader>
            <DialogTitle className="text-center">Vista previa de Ticket de Compra</DialogTitle>
          </DialogHeader>
          {selectedBoletaSale && (
            <div className="space-y-4">
              <div className="bg-white border rounded-lg" style={{ maxWidth: '520px', margin: '0 auto' }}>
                <div
                  dangerouslySetInnerHTML={{ __html: boletaPreviewHTML }}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsBoletaPreviewOpen(false)}
                >
                  Cerrar
                </Button>
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    imprimirTicket(selectedBoletaSale);
                    setIsBoletaPreviewOpen(false);
                  }}
                >
                  <Printer className="w-4 h-4 mr-2" /> Imprimir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isComprobantePreviewOpen} onOpenChange={setIsComprobantePreviewOpen}>
        <DialogContent className="w-[min(230mm,96vw)] max-w-none" style={{ maxHeight: '90vh' }}>
          <DialogHeader>
            <DialogTitle className="text-center">Comprobante {comprobantePreviewNumero}</DialogTitle>
          </DialogHeader>
          <div className="bg-white border rounded-lg overflow-auto" style={{ maxHeight: '72vh' }}>
            <div className="p-2 sm:p-3" dangerouslySetInnerHTML={{ __html: comprobantePreviewHTML }} style={{ width: '100%', minWidth: 0 }} />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsComprobantePreviewOpen(false)}
            >
              Cerrar
            </Button>
            <Button
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              disabled={!comprobantePreviewHTML}
              onClick={() => imprimirHTML(comprobantePreviewHTML)}
            >
              <Printer className="w-4 h-4 mr-2" /> Imprimir / Descargar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] p-0 overflow-hidden [&>button]:hidden">
          <div className="flex flex-col h-full">
            <header className="flex items-center justify-between px-6 py-5 sm:px-8 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">Configuración del Sistema</h2>
                </div>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                aria-label="Cerrar modal"
                className="group p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </header>
            <main className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 space-y-4 bg-slate-50/60">
              <article className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                <details className="group">
                  <summary className="w-full flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-50/50 hover:bg-slate-50/90 cursor-pointer">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 tracking-wide uppercase">DATOS FISCALES (EMISOR)</h3>
                    </div>
                    <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-5 sm:px-6 py-5 border-t border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Número de RUC</Label>
                        <Input value={emisorForm.ruc} onChange={(e) => setEmisorForm(prev => ({ ...prev, ruc: e.target.value }))} className="rounded-xl" placeholder="20XXXXXXXXX" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Razón Social</Label>
                        <Input value={emisorForm.razonSocial} onChange={(e) => setEmisorForm(prev => ({ ...prev, razonSocial: e.target.value }))} className="rounded-xl" />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Descripción</Label>
                        <Input value={emisorForm.nombreComercial} onChange={(e) => setEmisorForm(prev => ({ ...prev, nombreComercial: e.target.value }))} className="rounded-xl w-full" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Dirección Fiscal</Label>
                        <Input value={emisorForm.direccion} onChange={(e) => setEmisorForm(prev => ({ ...prev, direccion: e.target.value }))} className="rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Teléfono</Label>
                        <Input value={emisorForm.telefono} onChange={(e) => setEmisorForm(prev => ({ ...prev, telefono: e.target.value }))} className="rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Correo Electrónico</Label>
                        <Input type="email" value={emisorForm.email} onChange={(e) => setEmisorForm(prev => ({ ...prev, email: e.target.value }))} className="rounded-xl" />
                      </div>
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isSavingEmisor} onClick={guardarEmisor}>
                        <Building2 className="w-4 h-4 mr-2" />
                        {isSavingEmisor ? 'Guardando…' : 'Guardar Datos Fiscales'}
                      </Button>
                    </div>
                  </div>
                </details>
              </article>

              <article className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                <details className="group">
                  <summary className="w-full flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-50/50 hover:bg-slate-50/90 cursor-pointer">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 tracking-wide uppercase">LOGO DE LA EMPRESA</h3>
                    </div>
                    <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-5 sm:px-6 py-4 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-4">
                        <div className="w-36 h-14 bg-white border border-slate-200 rounded-lg flex items-center justify-center">
                          {companyLogo ? <img src={companyLogo} alt="Logo" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-slate-400">Sin logo</span>}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{companyLogo ? 'Logo configurado' : 'Sin logo'}</p>
                          <p className="text-[11px] text-slate-500">Dimensiones óptimas: 240x80px • PNG/JPG</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/png,image/jpeg,image/jpg';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              const img = new Image();
                              img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const MAX = 300;
                                let w = img.width, h = img.height;
                                if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
                                canvas.width = w; canvas.height = h;
                                canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
                                const resized = canvas.toDataURL('image/jpeg', 0.8);
                                setCompanyLogo(resized);
                                safeSetItem('pos-company-logo', resized);
                                toast({ title: "Logo actualizado" });
                              };
                              img.src = URL.createObjectURL(file);
                            }
                          };
                          input.click();
                        }}>Cambiar Logo</Button>
                        {companyLogo && <Button variant="outline" size="sm" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => { setCompanyLogo(''); try { localStorage.removeItem('pos-company-logo'); } catch {} toast({ title: "Logo eliminado" }); }}>Quitar</Button>}
                      </div>
                    </div>
                  </div>
                </details>
              </article>

              <article className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                <details className="group">
                  <summary className="w-full flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-50/50 hover:bg-slate-50/90 cursor-pointer">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                        <Printer className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-semibold text-slate-900 tracking-wide uppercase">CONFIGURACIÓN DE IMPRESIÓN</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${qzConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${qzConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          {qzConnected ? 'QZ Tray Conectado' : 'QZ Tray Sin Conexión'}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-5 sm:px-6 py-4 border-t border-slate-100 space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="text-sm font-medium">Impresión directa</p>
                        <p className="text-xs text-slate-500">Usa el diálogo de impresión del navegador</p>
                      </div>
                      <Button variant={useQzPrint ? "default" : "outline"} size="sm" className={useQzPrint ? "bg-indigo-600 hover:bg-indigo-700" : ""} onClick={() => setUseQzPrint(!useQzPrint)} disabled={!qzConnected}>
                        {useQzPrint ? 'Activado' : 'Desactivado'}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium">QZ Tray (Impresión directa a impresora térmica)</p>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${qzConnected ? 'bg-green-500' : 'bg-slate-300'}`} />
                          <p className="text-sm">Estado: {qzConnected ? 'Conectado' : 'Sin conexión'}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={probarQZTray} disabled={isQzTesting}>
                          {isQzTesting ? 'Probando...' : 'Probar Conexión'}
                        </Button>
                      </div>
                      {qzConnected && qzPrinters.length > 0 && (
                        <div className="space-y-2">
                          <Label>Impresora</Label>
                          <Select value={selectedQzPrinter} onValueChange={setSelectedQzPrinter}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar impresora" /></SelectTrigger>
                            <SelectContent>
                              {qzPrinters.map((printer) => (<SelectItem key={printer} value={printer}>{printer}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-amber-800 mb-1">¿No ves tu impresora?</p>
                        <ul className="text-[11px] text-amber-700 space-y-0.5 list-disc list-inside">
                          <li>Descarga e instala QZ Tray desde qz.io</li>
                          <li>Verifica que QZ Tray esté ejecutándose</li>
                          <li>Haz clic en "Probar Conexión"</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </details>
              </article>

              <article className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                <details className="group">
                  <summary className="w-full flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-50/50 hover:bg-slate-50/90 cursor-pointer">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
                        <CloudUpload className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 tracking-wide uppercase">SINCRONIZACIÓN EN LA NUBE</h3>
                    </div>
                    <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-5 sm:px-6 py-4 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-xs text-slate-600">Sincronizar datos con la base de datos</p>
                      <Button variant="outline" size="sm" onClick={handleForceSync}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Descargar desde la base de datos
                      </Button>
                    </div>
                  </div>
                </details>
              </article>
            </main>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isClearSalesOpen} onOpenChange={(open) => {
        setIsClearSalesOpen(open);
              }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                Limpiar Ventas del Día
              </div>
            </DialogTitle>
            <DialogDescription>
              Se eliminarán TODAS las ventas de hoy ({todaysSales.length} ventas).
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsClearSalesOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmClearTodaySales}>
              Limpiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStockCriticoOpen} onOpenChange={setIsStockCriticoOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Stock Bajo Mayorista
              </div>
            </DialogTitle>
            <DialogDescription>
              Niveles de productos mayoristas con stock agotado o por debajo del umbral ({STOCK_BAJO_THRESHOLD} unidades).
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {stockCriticoLevels.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                No hay productos mayoristas con stock bajo.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockCriticoLevels.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.levelName}</TableCell>
                      <TableCell className="text-right">{item.stock}</TableCell>
                      <TableCell className="text-right">
                        {item.stock === 0 ? (
                          <Badge variant="destructive">AGOTADO</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">BAJO</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      </div>
      </div>
    </>
  );
};

export default Index;