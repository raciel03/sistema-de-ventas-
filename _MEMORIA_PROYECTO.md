# MEMORIA DEL PROYECTO — Sistema de Ventas

## Estado actual
- **Live URL:** https://sistema-de-ventas-milam.web.app
- **Backup disponible en:** `_backup_antes_stock_unificado/` (Index.tsx, firebase_config.ts)
- **Archivo principal:** `caja-magica-ventas-main-app/src/pages/Index.tsx` (~9487 líneas)

## Última sesión — Correcciones aplicadas (12 Julio 2026)

### 1. Bug: disminuir cantidad en carrito muestra "stock insuficiente"
**Archivo:** Index.tsx ~línea 1706
**Cambio:** En `actualizarCantidad`, cuando `product.type === 'mayorista'` o hay `levelName`, ahora calcula el stock máximo como `level.stock > 0 ? level.stock : Math.floor(product.stock / level.baseUnitsContained)` en vez de usar `level?.stock ?? 0` que siempre daba 0 para productos unificados.

### 2. Ticket/Boleta — Reducir timeout de impresión
**Archivo:** Index.tsx ~línea 2250
**Cambio:** `setTimeout` de 500ms → **200ms** para impresión por navegador.

### 3. NaN en `salePrice * quantity` — 7 lugares corregidos
**Archivo:** Index.tsx — líneas 1778, 1844, 2087, 2088, 2095, 2265, 4103, 5296
**Cambio:** Agregar `|| 0` a `salePrice` y `purchasePrice` antes de multiplicar:
- `calcularSubtotal` (1778): `(salePrice || 0) * item.quantity`
- `calcularTotalProfit` (1844): `((salePrice || 0) - (purchasePrice || 0)) * item.quantity`
- `formatearProductoTicket` mayorista (2087): `salePrice || 0`
- `formatearProductoTicket` unidad (2095): `(salePrice || 0) * item.quantity`
- `formatearProductoTicketHTML` (2265): `(salePrice || 0) * item.quantity`
- Cart display (4103): `(salePrice || 0) * item.quantity`
- Detail item total (5296): `(salePrice || 0) * item.quantity`

### 4. `.toFixed()` sin fallback — 10 lugares corregidos
**Archivo:** Index.tsx — líneas 4441, 4446, 5775, 5778, 5783, 5845, 5848, 5853
**Cambio:** Agregar `|| 0` antes de `.toFixed()`:
- Inventory table purchasePrice (4441): `(product.purchasePrice || 0).toFixed(2)`
- Inventory table salePrice (4446): `(product.salePrice || 0).toFixed(2)`
- Summary regular salePrice (5775): `(data.salePrice || 0).toFixed(2)`
- Summary regular total (5778): `(data.total || 0).toFixed(2)`
- Summary regular purchasePrice (5783): `(data.purchasePrice || 0).toFixed(2)`
- Summary mayorista salePrice (5845): `(item.salePrice || 0).toFixed(2)`
- Summary mayorista total (5848): `(item.total || 0).toFixed(2)`
- Summary mayorista purchasePrice (5853): `(item.purchasePrice || 0).toFixed(2)`
- Summary mayorista profit (5856): `(Math.max(0, item.profit) || 0).toFixed(2)`

### 5. `name.substring()` sin null check
**Archivo:** Index.tsx ~línea 2267
**Cambio:** `(item.product.name || '').substring(0, 18)` en vez de `item.product.name.substring(0, 18)`.

### 6. `localStorage.removeItem` sin try-catch
**Archivo:** Index.tsx ~línea 9258
**Cambio:** Envuelto en `try { ... } catch {}`.

## Bugs conocidos (no corregidos)
- `salePricePerKg || 1` en línea ~6422 — si price es 0, usa divisor incorrecto
- Empty `catch {}` blocks en varias líneas (dificultan debugging)
- `item.product.type` sin optional chaining en helper functions (líneas ~3485-3486)
- `venta.total - venta.subtotal` sin NaN guard (línea ~2114)

## Corrección aplicada — 15 Julio 2026

### Cambio: Ordenamiento del Historial
**Archivo:** `Index.tsx` línea 4972
**Antes:** `dailyCloses.slice().reverse()`
**Después:** `dailyCloses.slice().sort((a,b) => b.date.localeCompare(a.date))`
**Efecto:** La tabla del Historial ahora ordena por fecha descendente (más reciente primero) en vez de solo invertir el array. Soluciona el desorden de fechas definitivamente.

## Sesión 15 Julio 2026 — Corrección cierre 13/07

### Problema
El cierre del 13/07/2026 registró solo 9 ventas (S/109.00) pero hubo 12 ventas (S/180.40) en total. Faltan 3 ventas que ocurrieron después del cierre pero dentro de la misma fecha local 13/07.

### Ventas faltantes del 13/07
| # | ID | Total | Items | UTC |
|---|-----|:-----:|:-----:|-----|
| 10 | 1783989242120 | $30.00 | 1 | 14/07 00:34 |
| 11 | 1783989529352 | $31.40 | 3 | 14/07 00:38 |
| 12 | 1783990338037 | $10.00 | 1 | 14/07 00:52 |
| | **Total** | **$71.40** | **5** | |

### Bug de fecha en cierres (YA CORREGIDO)
Había un bug donde `cerrarCaja()` usaba `getLocalDateStr(new Date())` que si se ejecutaba después de medianoche tomaba la fecha del día siguiente, perdiendo ventas. Ya está solucionado (no se tocó el código, el bug se resolvió con el uso correcto de `localDate`).

### Verificación de fechas
Todas las demás fechas de cierre (07/07 al 14/07) coinciden correctamente con sus ventas. Solo el 13/07 estaba incompleto.

### Archivo de referencia
`correcion.txt` en Descargas — contiene dump de la consola con ventas y cierres actuales.

## Comandos útiles
```powershell
# Build
cd caja-magica-ventas-main-app && npm run build

# Deploy
cd caja-magica-ventas-main-app && firebase deploy --only hosting

# Dev server
cd caja-magica-ventas-main-app && npm run dev
```

## Sesión 15 Julio 2026 — UI: Badges, Layout, Fix editar stock + historial

### 1. Badge **[Peso 🟧]** en Transacciones (Historial)
**Archivo:** `Index.tsx` ~línea 6006, ~6030
**Cambio:** Agregado `hasPeso` y su badge en las cards de Transacciones.
**Visual:** `[Unidad🟦] [Mayorista🟪] [Peso🟧]`

### 2. Colores a badges de items en Detalle de Venta
**Archivo:** `Index.tsx` ~línea 5352
**Antes:** Todos los badges eran `bg-white/20 text-white` (invisibles)
**Después:** Cada tipo con su color: `Mayorista🟪`, `Peso🟧`, `Unidad🟦`

### 3. Layout imagen + info en Detalle de Venta (unidad/peso)
**Archivo:** `Index.tsx` ~líneas 5396-5431
**Antes:** Imagen `w-28 h-28` en esquina derecha, info stacked
**Después:** Imagen `w-32 h-32` centrada verticalmente + grid 2 columnas

### 4. FIX: `hasUnidad` no detectaba productos regulares
**Archivo:** `Index.tsx` ~línea 6004
**Cambio:** Agregado `(item.product.type === 'unidad' && !item.selectedLevelName)` a la condición

### 5. FIX: Badges redundantes eliminados del header Detalle de Venta
**Archivo:** `Index.tsx` ~líneas 5287-5294
**Cambio:** Eliminados badges de tipo en el header (cada item ya muestra su badge)

### 6. FIX: `initialStock` actualizado al editar producto mayorista
**Archivo:** `Index.tsx` ~línea 2531
**Antes:** `initialStock: editingMayoristaProduct.initialStock ?? totalUnits`
**Después:** `initialStock: totalUnits`

### 7. FIX: Auto-apply nivel pendiente al guardar edición
**Archivo:** `Index.tsx` ~línea 2464
**Problema:** Si el usuario editaba el nivel pero olvidaba el checkmark ✅, los cambios se perdían.
**Solución:** Al guardar, si `editingLevelId` no es null, aplica `editLevelTempStock` a `editMayoristaLevels` automáticamente.

### 8. FIX: Ocultar lápiz ✏️ en niveles no editables
**Archivo:** `Index.tsx` ~línea 7019
**Cambio:** El botón de lápiz solo aparece en niveles editables (Unidad). Paquete/Ciento/Millar muestran solo texto informativo sin icono de edición.

### 9. FIX: `level.initialStock` se actualiza al editar producto
**Archivo:** `Index.tsx` ~línea 2525
**Problema:** Modal Información de Producto mostraba `STOCK INICIAL` desactualizado.
**Solución:** `saleLevels: sortedLevels.map(l => ({ ...l, initialStock: l.stock }))`

### 10. FIX: StockHistory entry `initial` se actualiza al editar
**Archivo:** `Index.tsx` ~línea 2540-2550
**Problema:** Historial de Stock mostraba los valores originales del entry `initial` (5000) en vez del nuevo valor editado (5100).
**Solución:** Al editar, actualiza `resultingStock`, `quantity`, `levelStockAfter` y `levelQuantities` del entry `initial` en el historial.

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
- El límite real del navegador es ~5MB
- App requiere internet (no hay offline)
