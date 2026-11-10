import { supabase } from './client';
import { aTexto, aNumero, aNumeroEstricto, num } from './ids';
import type { StockHistoryItem } from './types';

type FilaMov = {
  id: number;
  producto_id: number;
  nivel_id: number | null;
  tipo: string;
  cantidad: string | number;
  stock_resultante: string | number;
  venta_id: number | null;
  descripcion: string | null;
  fecha: string;
  extra: Record<string, unknown> | null;
};

type FilaCambio = {
  id: number;
  movimiento_id: number;
  nivel_id: number | null;
  precio_venta_anterior: string | number | null;
  precio_venta_nuevo: string | number | null;
  precio_compra_anterior: string | number | null;
  precio_compra_nuevo: string | number | null;
};

type InfoNivel = { nombre: string; unidades: number };

// El enum de la base es ('initial','sale','restock','price_change','adjustment').
// Antes estos mapas estaban al reves: se escribia 'venta'/'inicial' (el insert
// fallaba) y al leer 'sale'/'initial' se interpretaban como 'restock'.
const TIPOS_DB_A_APP: Record<string, StockHistoryItem['type']> = {
  initial: 'initial',
  sale: 'sale',
  restock: 'restock',
  price_change: 'price_change',
  adjustment: 'restock', // anulacion de venta: el stock volvio
};

const TIPOS_APP_A_DB: Record<StockHistoryItem['type'], string> = {
  initial: 'initial',
  sale: 'sale',
  restock: 'restock',
  price_change: 'price_change',
};

// Marcador de la venta-resumen que crea el repuesto (total vendido desde la
// ultima reposicion). Se guarda en descripcion para no tocar el esquema.
const DESCRIPCION_RESUMEN = 'resumen';

// Campos que la app usa para el detalle mayorista y que Firestore guardaba
// solito. En Supabase viven en la columna extra (jsonb) para que no se pierdan
// al recargar la pagina.
const CLAVES_EXTRA = ['levelStockAfter', 'levelQuantities', 'isInitial', 'levelSoldQuantity'] as const;

const construirExtra = (data: Partial<StockHistoryItem> & { isInitial?: boolean }): Record<string, unknown> | null => {
  const fuente = data as Record<string, unknown>;
  const extra: Record<string, unknown> = {};
  for (const k of CLAVES_EXTRA) {
    if (fuente[k] !== undefined) extra[k] = fuente[k];
  }
  return Object.keys(extra).length > 0 ? extra : null;
};

const aplicarExtra = (item: StockHistoryItem, extra: Record<string, unknown> | null): StockHistoryItem => {
  if (extra && typeof extra === 'object') {
    for (const k of CLAVES_EXTRA) {
      if (extra[k] !== undefined) (item as unknown as Record<string, unknown>)[k] = extra[k];
    }
  }
  return item;
};

const exigir = <T>(r: { data: T | null; error: { message: string } | null }, ctx: string): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

/**
 * Reconstruye el historial. El nombre del producto no se guarda duplicado en
 * cada movimiento: se lee del producto actual, que es como la app lo muestra.
 * El nivel (Paquete, Millar...) se persiste como nivel_id y se devuelve como
 * affectedLevelName, que es lo que "Ventas por Restock" necesita para agrupar.
 */
const aHistorial = (
  movs: FilaMov[],
  cambios: FilaCambio[],
  nombres: Map<number, string>,
  niveles: Map<number, InfoNivel>
): StockHistoryItem[] => {
  const cambiosPorMov = new Map<number, FilaCambio[]>();
  for (const c of cambios) {
    const l = cambiosPorMov.get(c.movimiento_id) ?? [];
    l.push(c);
    cambiosPorMov.set(c.movimiento_id, l);
  }

  return movs.map((m) => {
    const cs = cambiosPorMov.get(m.id) ?? [];
    const esResumen = m.descripcion === DESCRIPCION_RESUMEN;
    const tipo = TIPOS_DB_A_APP[m.tipo] ?? 'restock';
    const nivel = m.nivel_id !== null ? niveles.get(m.nivel_id) : undefined;
    const cantidad = num(m.cantidad);

    const item: StockHistoryItem = {
      id: aTexto(m.id),
      productId: aTexto(m.producto_id),
      productName: nombres.get(m.producto_id) ?? 'Producto',
      type: tipo,
      quantity: cantidad,
      resultingStock: num(m.stock_resultante),
      date: m.fecha,
    };
    if (m.venta_id !== null) item.saleId = aTexto(m.venta_id);
    if (esResumen) item.isSummary = true;
    else if (m.descripcion) item.levelDescription = m.descripcion;

    if (nivel) {
      item.affectedLevelName = nivel.nombre;
      // En una venta la cantidad ya viene en niveles (2 paquetes). En un
      // reposite es la cantidad base, y el nivel equivale a floor(base/unidades).
      item.levelQuantity = tipo === 'sale'
        ? cantidad
        : nivel.unidades > 0 ? Math.floor(cantidad / nivel.unidades) : cantidad;
    }

    if (cs.length > 0) {
      item.priceChanges = cs.map((c) => ({
        levelName: c.nivel_id !== null ? (niveles.get(c.nivel_id)?.nombre ?? `Nivel ${c.nivel_id}`) : 'General',
        oldSalePrice: c.precio_venta_anterior === null ? undefined : num(c.precio_venta_anterior),
        newSalePrice: c.precio_venta_nuevo === null ? undefined : num(c.precio_venta_nuevo),
        oldPurchasePrice: c.precio_compra_anterior === null ? undefined : num(c.precio_compra_anterior),
        newPurchasePrice: c.precio_compra_nuevo === null ? undefined : num(c.precio_compra_nuevo),
      }));
    }

    return aplicarExtra(item, m.extra ?? null);
  });
};

const nombresDeProductos = async (ids: number[]): Promise<Map<number, string>> => {
  if (ids.length === 0) return new Map();
  const r = (await supabase.from('productos').select('id, nombre').in('id', ids)) as unknown as {
    data: { id: number; nombre: string }[] | null;
    error: { message: string } | null;
  };
  if (r.error) return new Map();
  return new Map((r.data ?? []).map((p) => [p.id, p.nombre]));
};

/** Trae nombre y unidades de los niveles usados por los movimientos/cambios. */
const nivelesUsados = async (movs: FilaMov[], cambios: FilaCambio[]): Promise<Map<number, InfoNivel>> => {
  const ids = new Set<number>();
  for (const m of movs) if (m.nivel_id !== null) ids.add(m.nivel_id);
  for (const c of cambios) if (c.nivel_id !== null) ids.add(c.nivel_id);
  if (ids.size === 0) return new Map();
  const r = (await supabase.from('niveles').select('id, nombre, unidades_contenidas').in('id', [...ids])) as unknown as {
    data: { id: number; nombre: string; unidades_contenidas: string | number }[] | null;
    error: { message: string } | null;
  };
  if (r.error) return new Map();
  return new Map((r.data ?? []).map((n) => [n.id, { nombre: n.nombre, unidades: num(n.unidades_contenidas, 1) }]));
};

/** Resuelve el id real de un nivel a partir del producto y el nombre. */
const resolverNivelId = async (productoId: number, nombreNivel?: string): Promise<number | null> => {
  if (!nombreNivel) return null;
  const r = (await supabase
    .from('niveles')
    .select('id')
    .eq('producto_id', productoId)
    .eq('nombre', nombreNivel)
    .limit(1)) as unknown as { data: { id: number }[] | null; error: { message: string } | null };
  if (r.error) return null;
  return r.data?.[0]?.id ?? null;
};

const cargarHistorial = async (filtro?: { productoId?: string; limite?: number }): Promise<StockHistoryItem[]> => {
  let q = supabase.from('stock_movimientos').select('*').order('fecha', { ascending: false });
  if (filtro?.productoId !== undefined) {
    const pid = aNumero(filtro.productoId);
    if (pid === null) return [];
    q = q.eq('producto_id', pid);
  }
  if (filtro?.limite !== undefined) q = q.limit(filtro.limite);

  const movs = exigir(await q, 'getAllStockHistory') as unknown as FilaMov[];
  if (movs.length === 0) return [];

  const cambios = exigir(
    await supabase.from('stock_cambios_precio').select('*').in('movimiento_id', movs.map((m) => m.id)),
    'getAllStockHistory:cambios'
  ) as unknown as FilaCambio[];

  const [nombres, niveles] = await Promise.all([
    nombresDeProductos([...new Set(movs.map((m) => m.producto_id))]),
    nivelesUsados(movs, cambios),
  ]);
  return aHistorial(movs, cambios, nombres, niveles);
};

export const getAllStockHistory = async (): Promise<StockHistoryItem[]> => cargarHistorial();

export const getStockHistoryByProduct = async (productId: string): Promise<StockHistoryItem[]> =>
  cargarHistorial({ productoId: productId });

export const getRecentStockHistory = async (limite = 200): Promise<StockHistoryItem[]> =>
  cargarHistorial({ limite });

export const createStockHistoryItem = async (id: string, data: StockHistoryItem): Promise<StockHistoryItem> => {
  const pid = aNumeroEstricto(data.productId, 'createStockHistoryItem');
  const tipo = TIPOS_APP_A_DB[data.type] ?? 'restock';
  const nivelId = await resolverNivelId(pid, data.affectedLevelName);

  const mov = exigir(
    await supabase
      .from('stock_movimientos')
      .insert({
        producto_id: pid,
        nivel_id: nivelId,
        tipo: tipo,
        cantidad: data.quantity,
        stock_resultante: data.resultingStock,
        venta_id: data.saleId === undefined ? null : (aNumero(data.saleId) ?? null),
        descripcion: data.isSummary ? DESCRIPCION_RESUMEN : (data.levelDescription ?? null),
        fecha: data.date,
        extra: construirExtra(data),
      })
      .select()
      .single(),
    'createStockHistoryItem'
  ) as unknown as FilaMov;

  if (data.priceChanges && data.priceChanges.length > 0) {
    const nivelesProducto = (await supabase
      .from('niveles')
      .select('id, nombre')
      .eq('producto_id', pid)) as unknown as { data: { id: number; nombre: string }[] | null };
    const porNombre = new Map((nivelesProducto.data ?? []).map((n) => [n.nombre, n.id]));
    await supabase.from('stock_cambios_precio').insert(
      data.priceChanges.map((c) => ({
        movimiento_id: mov.id,
        nivel_id: c.levelName && c.levelName !== 'General' ? (porNombre.get(c.levelName) ?? null) : null,
        precio_venta_anterior: c.oldSalePrice ?? null,
        precio_venta_nuevo: c.newSalePrice ?? null,
        precio_compra_anterior: c.oldPurchasePrice ?? null,
        precio_compra_nuevo: c.newPurchasePrice ?? null,
      }))
    );
  }

  const nombres = await nombresDeProductos([pid]);
  const niveles = await nivelesUsados([mov], []);
  return aHistorial([mov], [], nombres, niveles)[0];
};

export const updateStockHistoryItem = async (
  id: string,
  data: Partial<StockHistoryItem> & { isInitial?: boolean }
): Promise<StockHistoryItem> => {
  const mid = aNumeroEstricto(id, 'updateStockHistoryItem');
  const cambios: Record<string, unknown> = {};
  if (data.quantity !== undefined) cambios.cantidad = data.quantity;
  if (data.resultingStock !== undefined) cambios.stock_resultante = data.resultingStock;
  if (data.date !== undefined) cambios.fecha = data.date;
  if (data.levelDescription !== undefined) cambios.descripcion = data.levelDescription;
  const extra = construirExtra(data);
  if (extra !== null) cambios.extra = extra;

  if (Object.keys(cambios).length > 0) {
    exigir(await supabase.from('stock_movimientos').update(cambios).eq('id', mid), 'updateStockHistoryItem');
  }
  const mov = exigir(
    await supabase.from('stock_movimientos').select('*').eq('id', mid).single(),
    'updateStockHistoryItem'
  ) as unknown as FilaMov;
  const nombres = await nombresDeProductos([mov.producto_id]);
  const niveles = await nivelesUsados([mov], []);
  return aHistorial([mov], [], nombres, niveles)[0];
};

export const deleteStockHistoryItem = async (id: string): Promise<void> => {
  const mid = aNumeroEstricto(id, 'deleteStockHistoryItem');
  exigir(await supabase.from('stock_movimientos').delete().eq('id', mid), 'deleteStockHistoryItem');
};

export const subscribeStockHistory = (callback: (items: StockHistoryItem[]) => void): (() => void) => {
  let vivo = true;
  const cargar = async () => {
    try {
      const h = await cargarHistorial({ limite: 500 });
      if (vivo) callback(h);
    } catch (e) {
      console.error('[subscribeStockHistory]', e);
    }
  };
  void cargar();
  const canal = supabase
    .channel('stock-vivo')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movimientos' }, () => void cargar())
    .subscribe();
  return () => {
    vivo = false;
    void supabase.removeChannel(canal);
  };
};

/**
 * Registra una entrada de stock (restock) y actualiza el stock del producto
 * con la funcion bloqueante, para que dos cajas no descuenten de mas.
 */
export const registrarRestock = async (productId: string, cantidad: number, descripcion?: string): Promise<number> => {
  const pid = aNumeroEstricto(productId, 'registrarRestock');
  const r = exigir(
    await supabase.rpc('aumentar_stock_producto', { p_producto_id: pid, p_cantidad: cantidad }),
    'registrarRestock'
  );
  const stock = num(Array.isArray(r) ? r[0] : r, 0);

  await supabase.from('stock_movimientos').insert({
    producto_id: pid,
    tipo: 'restock',
    cantidad: cantidad,
    stock_resultante: stock,
    descripcion: descripcion ?? null,
  });
  return stock;
};
