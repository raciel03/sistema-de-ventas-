# MEMORIA DEL PROYECTO — Sistema de Ventas

## Estado actual
- **Live URL:** https://sistema-de-ventas-milam.web.app
- **Firebase project:** `sistema-de-ventas-milam`
- **GitHub:** https://github.com/raciel03/sistema-de-ventas- (privado)
- **Archivo principal:** `caja-magica-ventas-main-app/src/pages/Index.tsx` (~10497 líneas)
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
- `StockHistoryItem.type` en `stockHistoryService.ts` no incluye `'price_change'` (solo en interfaz local de Index.tsx)
- ✅ `salePricePerKg || 1` → CORREGIDO el 31 Julio (modal de peso, ya no inventa precio)
- ✅ `venta.total - venta.subtotal` sin NaN guard → CORREGIDO el 31 Julio (guardia `isFinite`)

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

## Última sesión — 31 Julio 2026 (Ventas que desaparecían + fixes de stock)

### 🔴 Problema principal diagnosticado
- **0 ventas en Firebase el 30/07** (última registrada el 27/07). Las ventas hechas desde **otra PC** no aparecían en esta PC.
- **Causa raíz:** los filtros `local.filter(item => isPendingId(...) || fb.find(...))` ocultaban ventas locales que todavía no estaban en Firebase NI marcadas como pendientes.
- El pending solo se marcaba cuando la subida **fallaba** (`createSale(...).catch(e => addPendingId(...))`), así que durante la ventana normal de subida la venta quedaba "sin marcar" → el filtro la ocultaba/borraba.
- **Recuperación:** no es posible recuperar las ventas de hoy desde esta PC (no estaban en Firebase ni en este localStorage). Los fixes previenen pérdidas futuras.

### 📌 Modelos de stock (referencia clave, NO confundir)
- **Modelo A — "Unidad + Niveles"** (producto tiene un nivel llamado `'Unidad'` en `saleLevels`): el stock general en **unidades** es compartido; vender 1 nivel descuenta `baseUnitsContained × cantidad` del stock general (y del nivel "Unidad"). Los demás niveles (Paquete/Ciento/Fardo) **NO tienen stock real** — solo sirven para elegir precio. Al crear con nivel "Unidad", el formulario FUERZA stock 0 en los otros niveles.
- **Modelo B — Mayorista puro** (mayorista SIN nivel `'Unidad'`): **cada nivel tiene su propio stock**; vender descuenta del nivel vendido y el stock general se recalcula como `Σ (nivel.stock × baseUnitsContained)`.
- **Unidad simple:** unidades. **Peso:** gramos.
- El interruptor entre Modelo A y B es **la existencia del nivel "Unidad"** (línea ~1988), NO el `type` del producto. "Mayorista con Unidad" y "Unidad + Niveles" son el MISMO modelo (la etiqueta `type` solo refleja datos viejos vs nuevos).

### ✅ Fixes aplicados y desplegados (build + `firebase deploy --only hosting` OK)
1. **Pending optimista en ventas y productos:** en `confirmarVenta` se hace `addPendingId(...)` **ANTES** de guardar en localStorage, y `removePendingId` al confirmar en Firebase (`.then()`). Elimina la carrera que ocultaba ventas.
2. **Validación de stock al confirmar reescrita:** ya NO salta `mayorista`/`peso`. Valida: Modelo A multiplicando por `baseUnitsContained`, Modelo B por stock de nivel, peso por gramos. Bloquea sobreventa con 2 pestañas/cajas.
3. **Modal de peso:** `salePricePerKg || 1` → `|| 0` con guardia (si no hay precio, bloquea modo "por dinero" con aviso). Se respeta `minWeightGrams` (mínimo de venta). Sigue bloqueando venta en 0.
4. **Guardia NaN** en redondeo de boleta (`isFinite`).
5. **Filtros en líneas ~779 y ~861 quedan COMENTADOS deliberadamente** → no se borra nada local. Costo: lo borrado desde otra PC no desaparece aquí automáticamente (se puede borrar a mano). Solo reactivar si se quiere propagar borrados, y solo con el pending optimista funcionando.

### 🧰 Herramientas de diagnóstico
- Script `_consultar_ventas_hoy` (temporal): consulta ventas de hoy desde Firebase. `firebase-admin` v14 usa **`admin.cert()`** (NO `admin.credential.cert()`); debe ejecutarse desde `caja-magica-ventas-main-app` (ahí vive `node_modules`) y como `.cjs` (la app tiene `"type": "module"`).
- Key de servicio admin: `C:\Users\Raciel\Downloads\sistema-de-ventas-milam-firebase-adminsdk-fbsvc-1aa8f02017.json`.

### ⚠️ Recomendaciones pendientes
- Antes de desplegar la app en la otra PC, verificar que reciba los fixes (mismo build).
- Opcional futuro: exportar/importar ventas a JSON e ID único por PC en `generateSaleId()` para evitar colisiones.

### 🐞 Fix posterior (mismo día): `usuario is not defined` al crear usuarios
- **Síntoma:** al agregar un usuario administrador (o cualquier usuario) salía "Error: usuario is not defined".
- **Causa raíz:** en `agregarUsuario`, `const usuario` se declaraba DENTRO de cada rama `if/else` (bloques `{}`). En JS, `const` es de ámbito de bloque, así que en el toast (fuera de ambos bloques) la referencia `usuario.username` lanzaba `ReferenceError`. La creación SÍ ocurría (Firebase Auth + perfil + lista local), solo fallaba el aviso.
- **Por qué compilaba:** el build es `vite build` (esbuild), que NO revisa tipos; TypeScript sí lo habría detectado.
- **Fix:** `let usuario: AppUser | undefined;` declarado en el ámbito del `try`, asignación `usuario = {...}` en ambas ramas, y `usuario?.username` en el toast.
- **Verificación:** `npx tsc --noEmit` pasó sin errores → no quedan más variables fuera de ámbito en Index.tsx. Build + deploy OK.
- ⚠️ **Lección:** correr `npx tsc --noEmit` antes de desplegar (el build de Vite no detecta estos errores).

### 🔒 Fix posterior (mismo día): loops de borrado en sincronizadores (protección 2 PCs)
- **Motivo:** con 2 PCs, los sincronizadores tenían un loop de borrado idéntico al que causó la desaparición de ventas: *"borra de Firebase lo que no está en la lista local"*. Si una PC con datos desactualizados hacía cualquier acción que sincronizara, podía borrar silenciosamente cierres/productos/usuarios que la OTRA PC acababa de guardar (sin pedir contraseña).
- **Fix:** se comentaron los 3 loops (mismo patrón que el de ventas, línea 648):
  - `syncProductsToFirestore` (~línea 634) → loop de `deleteProduct`
  - `syncClosesToFirestore` (~línea 661) → loop de `deleteDailyClose`
  - `syncUsersToFirestore` (~línea 685) → loop de `deleteLocalUser`
- **No se rompe el borrado intencional:** `eliminarProducto`/`deleteSelectedProducts` usan `deleteProduct(id)` directo; los cierres usan `deleteDailyClose(id)` directo. Solo se desactiva el borrado automático ciego.
- **Sincronización en vivo confirmada:** `subscribe*` (líneas 937-941) usan `onSnapshot` → los cambios de una PC aparecen en la otra en ~1s SIN recargar. Los `subMerge*` NO llaman a los sync* (no disparan los loops).
- **Verificación:** `npx tsc --noEmit` sin errores + build + `firebase deploy --only hosting` OK.
- **Límite conocido (futuro):** si las 2 PCs vendieran el MISMO producto en el MISMO instante, el stock podría quedar con un valor incorrecto ("último que escribe gana"). El usuario NO trabaja en simultáneo (la 2ª PC es solo de consulta), así que no afecta hoy. Se podría reforzar con transacciones atómicas si algún día se necesita venta simultánea real.

### ⚡ Optimización de sincronización (mismo día): memoria de IDs sincronizados (8 cambios)
- **Objetivo:** dejar de descargar/comparar TODA la colección en cada sincronización de ventas e historial. Ahora solo se sube lo NUEVO.
- **Cómo:** 2 Sets en RAM (`syncedSaleIds`, `syncedHistoryIds` con `useRef`) recuerdan qué IDs YA están confirmados en Firebase. `syncSalesToFirestore` y `syncHistoryToFirestore` filtran `data.filter(s => !syncedSet.has(s.id))` y solo crean los pendientes (`createSale`/`createStockHistoryItem`), marcándolos tras éxito.
- **Los Sets se rellenan desde Firebase** en: carga inicial (`mergeInitialData`, cambios 4-5), suscripción en vivo (`subMergeSales`/`subMergeHistory`, cambios 6-7) y sincronización manual (cambio 8).
- **No afecta el fix de borrado** (los loops siguen comentados) ni el flujo offline (un item fallido no se marca → se reintenta solo).
- **Nota:** quedan imports sin uso (`updateSale`, `updateStockHistoryItem`) — inofensivos, tsc no los marca. Comentario existente en ~línea 346 ("Ya no se necesita seguimiento de IDs...") quedó contradictorio con el nuevo código (opcional limpiarlo después).
- **Verificación:** `npx tsc --noEmit` sin errores + build + `firebase deploy --only hosting` OK. Commit GitHub `b115f20` → nuevo commit de optimización.

### 🖨️ Fix impresión vertical (mismo día): QZ Tray no forzaba orientación
- **Problema:** la boleta salía horizontal. El CSS del navegador ya era vertical (`@page { size: 80mm auto; orientation: portrait }`, sin cambios desde el primer commit), pero la **impresión directa QZ Tray** usaba `qz.configs.create(printerName)` SIN orientación → tomaba la config de la impresora (horizontal).
- **Fix (línea ~2490):** config de QZ Tray ahora fuerza vertical y ancho de ticket:
  ```js
  const config = qz.configs.create(printerName, { orientation: 0, paperSize: { width: '80mm', height: 'auto' } });
  ```
- El diálogo del navegador se deja igual (`80mm auto` + portrait) → sigue vertical y se adapta al largo según lo vendido (NO se fija altura para no dejar espacio vacío).
- **Verificación:** tsc sin errores + build + deploy OK.

### 🐛 Fix crash mayorista "removeChild" (mismo día): dropdown de niveles quedaba con valor inexistente
- **Problema (solo se veía en la otra PC, build de producción):** al agregar un producto mayorista, si se agregaba el nivel **Unidad** y luego **Paquete**, la página crasheaba con `Error al iniciar: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.`
- **Causa:** en el modal "Agregar producto" → "Agregar Nuevo Nivel", tras agregar un nivel el código hacía `setNewLevelDropdown('Paquete')` (línea 9115). Si ya se habían agregado Unidad + Paquete, el `Select` quedaba apuntando a `'Paquete'`, pero la opción ya estaba **filtrada** de la lista (línea 9003). Ese valor sin item coincidente dispara un race interno de Radix Select al abrir/cerrar el menú → error `removeChild` → pantalla blanca en producción (intermitente, por eso "solo en la otra PC": build de producción + orden de clics Unidad→Paquete→tocar menú; en dev con overlay y distinto timing no se notaba).
- **Fix (línea 9115):** `setNewLevelDropdown('')` en vez de `'Paquete'` (mismo patrón seguro que ya usaba el modal de **editar**, línea 7649). El menú muestra placeholder "Elige un nivel..." y el valor SIEMPRE existe entre las opciones → el crash desaparece en ambas PCs.
- **Detalle cosmético (línea 9051):** la etiqueta "Stock (...)" solo muestra el nombre del nivel si hay dropdown seleccionado (evita "Stock ()").
- **Confirma NO regresión:** la línea 9115 no se tocaba desde el commit inicial (35c8a93) — verificado con `git log`. No es una regresión de los fixes anteriores (impresión/sync/usuarios tocan otras líneas).
- **Verificación:** `npx tsc --noEmit` + build + `firebase deploy --only hosting` OK. En la otra PC: recargar con **Ctrl+Shift+R** para descartar bundle cacheado.

### 🐛🔧 Fixes de estabilidad + Modelo A en Historial de stock (31/07/2026): 4 cambios
- **Objetivo:** blindar crashes del mismo tipo que el removeChild y corregir el restock del "Historial de stock" para productos **Modelo A** ("Unidad + niveles"). Ninguno cambia lógica de negocio ni datos.
- **Bug 1 (crítico, mismo removeChild):** el modal **editar** producto mayorista hacía `setEditLevelDropdown('Paquete')` (línea 2639). Si el producto ya tenía nivel "Paquete", el `Select` quedaba con valor inexistente (opción filtrada en ~7538) → mismo crash intermitente que Agregar. Fix: `setEditLevelDropdown('')`.
- **Bug 2 (.sort() que mutaban estado):** 4 sitios ordenaban arrays del estado EN SU LUGAR: los botones de nivel del Historial (líneas 9252, 9293, 9868 sobre `currentStockHistoryProduct.saleLevels`) y el historial del modal (línea 9473 sobre `modalProductHistory`). Fix: copiar antes de ordenar con `[...(... || [])].sort(...)`. Sin cambio visual.
- **Bug 3 (.toFixed() sobre precios indefinidos):** blindaje `(x ?? 0).toFixed(2)` en ~14 sitios que mostraban precios de nivel/producto (`purchasePrice`/`salePrice`): 5082-5083, 6955, 7039, 7480-7502, 8016/8021/8118/8123, 8938-8941, 9727, y `gananciaPorUnidad` (7980, 8102). Si un producto legado/migrado tenía un nivel sin precio → `undefined.toFixed(2)` → TypeError → pantalla blanca (solo en la PC con esos datos).
- **Fix 4 (Historial de stock respeta Modelo A vs B):** el interruptor es la existencia del nivel **"Unidad"** (documentado en líneas 144-147). Antes el modal mostraba la sección por niveles para TODOS los mayoristas. Ahora:
  - **Modelo A** (`type === 'mayorista'` CON nivel "Unidad"): usa la sección general (stock en unidades, restock "Cantidad (unidades)" vía `handleAddStockHistoryRestock`, historial general, sin botones por nivel). El botón "Agregar reposición" y el formulario se habilitaron para Modelo A (líneas ~9694 y ~9735).
  - **Modelo B** (mayorista SIN "Unidad"): sección por niveles intacta (filtrar por nivel, restock por nivel con stock/vendidos).
  - El diálogo "Eliminar historial" también oculta los botones por nivel para Modelo A (línea ~9864).
- **NO era regresión:** el formulario por niveles en Historial existía desde el commit inicial (verificado con `git log -S`) y los fixes anteriores no lo tocaban.
- **Verificación:** `npx tsc --noEmit` + `npm run build` + `firebase deploy --only hosting` OK. En la otra PC: **Ctrl+Shift+R** y probar: editar mayorista con nivel "Paquete" → tocar "Agregar Nivel"; historial de un mayorista Modelo A (restock en unidades) y Modelo B (por nivel).