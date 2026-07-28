# MEMORIA DEL PROYECTO — Sistema de Ventas

## Estado actual
- **Live URL:** https://sistema-de-ventas-milam.web.app
- **Firebase project:** `sistema-de-ventas-milam`
- **GitHub:** https://github.com/raciel03/sistema-de-ventas- (privado)
- **Archivo principal:** `caja-magica-ventas-main-app/src/pages/Index.tsx` (~10327 líneas)
- **Backup:** `_backup_antes_stock_unificado/`

## Última sesión — 24 Julio 2026

### 1. Bug fix: `const` → `let` en `mergeInitialData`
**Archivo:** `Index.tsx` líneas 753, 767, 776, 782, 788
**Cambio:** `const local` → `let local` para permitir `.filter()` reassignment.
**Problema:** El filter `local = local.filter(item => isPendingId(...) || fb.find(...))` fallaba porque `const` no permite reasignación, causando que productos desaparecieran al recargar.

### 2. Firebase service optimizations
**Archivo:** `src/firebase/saleService.ts`
- `getSaleById()`: ahora usa `getDoc(docRef)` (1 sola lectura) en vez de traer todas las ventas
- `getRecentSales(pageSize, cursor?)`: agregado con paginación cursor-based

**Archivo:** `src/firebase/productService.ts`
- `getProductById()`: ahora usa `getDoc(docRef)` (1 sola lectura)

**Archivo:** `src/firebase/stockHistoryService.ts`
- `getStockHistoryByProduct(productId)`: agregado con `where('productId') + orderBy('date')` — requiere índice compuesto en Firestore (creado por usuario vía link)
- `getRecentStockHistory(pageSize, cursor?)`: agregado con paginación cursor-based
- ⚠️ **Nota importante:** El tipo `StockHistoryItem` en este servicio NO incluye `'price_change'` en el union type `type`. Solo tiene: `'restock' | 'sale' | 'initial'`. La interfaz local en `Index.tsx` línea 135 SÍ incluye `'price_change'`.

### 3. Modal history optimization
**Archivo:** `Index.tsx`
- Línea 343: Nuevo estado `modalProductHistory`
- Líneas 1126-1138: Nuevo `useEffect` que carga historial por producto vía `getStockHistoryByProduct(productId)`
- Línea 7967: Reemplazado `stockHistory.filter(...)` por `modalProductHistory`
- Línea 9295: Reemplazado `stockHistory.filter(...)` por `modalProductHistory`

### 4. Label fix
**Archivo:** `Index.tsx` línea 5954
**Cambio:** "Productos / Peso" → "Unidad / Peso" en Resumen por Producto

### 5. Bug fix: `price_change` filter
**Archivo:** `Index.tsx` línea 9301
**Cambio:** `(item.type !== 'sale' || item.isSummary) && item.type !== 'price_change'`
**Efecto:** Oculta entradas de tipo `price_change` de la tabla de Historial de Stock (vista "Todos")

### 6. GitHub setup
- `.gitignore` creado/actualizado
- `git init`, `git add .`, `git commit`
- Repo remoto: `https://github.com/raciel03/sistema-de-ventas-` (privado)
- Push: `git push -u origin main`
- 64 archivos, 33k+ líneas

### 7. Firebase deploys
Múltiples despliegues con `cd caja-magica-ventas-main-app && npm run build && firebase deploy --only hosting`
Incluye deploy luego de crear el índice compuesto para `getStockHistoryByProduct`.

## Hallazgos clave sobre `price_change`

### Creación de entradas `price_change` (3 caminos):
| # | Línea | Función | Producto | quantity | resultingStock |
|---|-------|---------|----------|----------|----------------|
| 1 | 2694 | `guardarEdicionProductoPeso` | Peso | 0 | 0 |
| 2 | 2787 | `guardarEdicionProducto` | Unidad | 0 | 0 |
| 3 | 7220 | Edición inline de niveles mayoristas | Mayorista | 0 | 0 |

- `guardarEdicionMayorista` (línea 2580) **NO** crea `price_change` — solo actualiza producto y opcionalmente el entry `initial`
- Usuario reporta que los `price_change` con ceros aún aparecen incluso después del filtro — posiblemente caché del navegador o un segundo path de rendering no cubierto

## Pendiente
- [ ] Verificar si el filtro `price_change` funciona en incógnito (descartar caché)
- [ ] Conectar paginación en UI: reemplazar `getDocs(stockHistoryRef)` por `getRecentStockHistory(50)`, reemplazar `getDocs(salesRef)` por `getRecentSales(50)`, agregar botón "Cargar más"
- [ ] Nota: `getStockHistoryByProduct(pageSize, cursor?)` necesita actualizarse para aceptar `limit` (actualmente trae todos)

## Última sesión — 27 Julio 2026 (Restauración + Fixes finales)

### 🔴 Opción A REVERTIDA Y DATOS RESTAURADOS
Se eliminó la corrección automática de tipo que causó que 42 productos se movieran incorrectamente de `unidad` → `mayorista`.

**Restauración ejecutada vía script con firebase-admin:**
- 42 productos restaurados de `mayorista` → `unidad`
- Stock tomado del nivel "Unidad" en `saleLevels`
- `initialStock` tomado del nivel "Unidad"
- `saleLevels` eliminados completamente de esos productos
- Backup guardado en: `caja-magica-ventas-main-app/_backup_productos_antes_restaurar.json`

**Estado actual en Firebase:**
- unidad: 54
- peso: 1  
- mayorista: 51
- Total: 106

### ✅ Fixes que se mantienen
1. **Guardia en `syncProductsToFirestore`** (línea 621): No ejecuta si data vacío o sospechoso (<5 vs >50 en Firebase)
2. **Filtro en suscripción** (línea 828): Conserva productos locales aunque no estén en pending ni en Firebase
3. **Loop de borrado en `syncSalesToFirestore`** (línea 638): Ventas eliminadas localmente también se borran de Firebase
4. **`inventoryTotals` filtra `mayorista`** (línea 3770): Cards de Inventario General no incluyen valores mayorista
5. **Tipos en `stockHistoryService.ts`**: Incluye `'price_change'`, `saleId?`, `priceChanges?`

### 🆕 Punto 5: Auto-clasificación al guardar
**Archivo:** `Index.tsx` línea 622-626
**Qué hace:** Dentro de `syncProductsToFirestore`, antes de sincronizar se corrige:
```typescript
const corregirTipo = (p: Product) => {
  if (p.saleLevels?.length && p.type !== 'mayorista') {
    return { ...p, type: 'mayorista' as const, stock: 0 };
  }
  return p;
};
```
**Efecto:** Si un producto tiene `saleLevels`, se fuerza `type: "mayorista"` con `stock: 0` al sincronizar. Si no tiene niveles, el tipo se queda como está. Esto previene que vuelva a ocurrir el error de clasificación.

## Bugs conocidos (no corregidos)
- `salePricePerKg || 1` en línea ~6422 — si price es 0, usa divisor incorrecto
- `venta.total - venta.subtotal` sin NaN guard (línea ~2114)
- `StockHistoryItem.type` en `stockHistoryService.ts` no incluye `'price_change'` (solo en interfaz local de Index.tsx)

## Comandos útiles
```powershell
# Build
cd caja-magica-ventas-main-app && npm run build

# Deploy
cd caja-magica-ventas-main-app && firebase deploy --only hosting

# Dev server
cd caja-magica-ventas-main-app && npm run dev
```

## Notas
- localStorage se monitorea cada 30s; warning a 4MB, critical a 4.75MB
- Límite real del navegador ~5MB
- App requiere internet (no hay offline)
- `getStockHistoryByProduct()` requiere índice compuesto `productId ASC + date ASC` en Firestore