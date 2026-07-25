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