import { Package, TrendingUp, CheckCircle2 } from "lucide-react";

// Nuevo diseño del modal "Información de Producto" para productos mayoristas
// registrados SIN nivel Unidad (paquete, millar, ciento, caja...).
// Los productos CON Unidad y los de peso conservan la vista anterior.

interface NivelInfo {
  id: string;
  name: string;
  initialStock: number;
  stock: number;
  purchasePrice: number;
  salePrice: number;
  baseUnitsContained: number;
}

interface ProductoInfo {
  name: string;
  category: string;
  imageUrl?: string;
  stock: number;
  saleLevels?: NivelInfo[];
}

interface Props {
  producto: ProductoInfo;
  userRole: string;
  tab: number;
  onTab: (i: number) => void;
  onCerrar: () => void;
}

const paletas = [
  { dot: "bg-blue-600", tabActivo: "text-blue-700 border-blue-200", chipActivo: "bg-blue-50 text-blue-700 border-blue-200", banner: "bg-blue-50", borde: "border-blue-200", stockNum: "text-blue-600", grad: "from-blue-600 to-indigo-700", ring: "bg-blue-100" },
  { dot: "bg-emerald-500", tabActivo: "text-emerald-700 border-emerald-200", chipActivo: "bg-emerald-50 text-emerald-700 border-emerald-200", banner: "bg-emerald-50", borde: "border-emerald-200", stockNum: "text-emerald-600", grad: "from-emerald-600 to-teal-700", ring: "bg-emerald-100" },
  { dot: "bg-purple-500", tabActivo: "text-purple-700 border-purple-200", chipActivo: "bg-purple-50 text-purple-700 border-purple-200", banner: "bg-purple-50", borde: "border-purple-200", stockNum: "text-purple-600", grad: "from-purple-600 to-indigo-700", ring: "bg-purple-100" },
  { dot: "bg-orange-500", tabActivo: "text-orange-700 border-orange-200", chipActivo: "bg-orange-50 text-orange-700 border-orange-200", banner: "bg-orange-50", borde: "border-orange-200", stockNum: "text-orange-600", grad: "from-orange-500 to-amber-600", ring: "bg-orange-100" },
  { dot: "bg-pink-500", tabActivo: "text-pink-700 border-pink-200", chipActivo: "bg-pink-50 text-pink-700 border-pink-200", banner: "bg-pink-50", borde: "border-pink-200", stockNum: "text-pink-600", grad: "from-pink-500 to-rose-600", ring: "bg-pink-100" },
];

export function InfoProductoNiveles({ producto, userRole, tab, onTab, onCerrar }: Props) {
  const niveles = producto.saleLevels || [];
  if (niveles.length === 0) return null;

  const idx = Math.min(Math.max(tab, 0), niveles.length - 1);
  const nivel = niveles[idx];
  const pal = paletas[idx % paletas.length];

  const soles = (v: number) =>
    `S/ ${v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const gananciaNivel = (nivel.salePrice ?? 0) - (nivel.purchasePrice ?? 0);
  const margenNivel = (nivel.salePrice ?? 0) > 0 ? (gananciaNivel / (nivel.salePrice ?? 1)) * 100 : 0;

  const totalUnidades = niveles.reduce((t, l) => t + (l.stock || 0) * (l.baseUnitsContained || 1), 0);
  const valorCompraTotal = niveles.reduce((t, l) => t + (l.stock || 0) * (l.purchasePrice ?? 0), 0);
  const valorVentaTotal = niveles.reduce((t, l) => t + (l.stock || 0) * (l.salePrice ?? 0), 0);
  const gananciaTotal = valorVentaTotal - valorCompraTotal;
  const margenTotal = valorVentaTotal > 0 ? (gananciaTotal / valorVentaTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Encabezado del producto */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-slate-100 border border-blue-200 flex items-center justify-center shrink-0 overflow-hidden">
            {producto.imageUrl ? (
              <img src={producto.imageUrl} alt={producto.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-7 h-7 text-blue-600" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> En Stock
              </span>
              <span className="text-xs text-slate-400 font-medium">{niveles.length} niveles definidos</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{producto.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{producto.category}</p>
          </div>
        </div>
        <div className="md:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Unidades Físicas</p>
          <p className="text-xl font-black text-slate-900">
            {totalUnidades.toLocaleString("es-PE")} <span className="text-xs font-semibold text-slate-500">und</span>
          </p>
        </div>
      </div>

      {/* Pestañas por nivel de empaque */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Nivel de Empaque / Presentación</p>
            <p className="text-xs text-slate-400">Selecciona el nivel para ver costos y márgenes</p>
          </div>
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold" role="tablist">
            {niveles.map((l, i) => {
              const activo = i === idx;
              const p = paletas[i % paletas.length];
              return (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => onTab(i)}
                  className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 border ${
                    activo
                      ? `bg-white shadow-sm font-bold ${p.tabActivo}`
                      : "border-transparent text-slate-600 hover:text-slate-900 font-medium"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.dot}`}></span>
                  <span>{l.name}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded border font-mono ${
                      activo ? p.chipActivo : "bg-slate-200 text-slate-600 border-slate-200"
                    }`}
                  >
                    x{l.baseUnitsContained} und
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenido del nivel activo */}
        <div className="mt-4 space-y-4">
          <div className={`${pal.banner} border ${pal.borde} rounded-xl p-4 flex flex-wrap items-center justify-between gap-3`}>
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ring-4 ${pal.ring} ${pal.dot}`}></span>
              <div>
                <p className="text-sm font-bold text-slate-900">Presentación: {nivel.name}</p>
                <p className="text-xs text-slate-500">{nivel.baseUnitsContained} unidades por nivel</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg bg-white border ${pal.borde} font-mono`}>
              x{nivel.baseUnitsContained} und
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Stock Inicial</p>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {nivel.initialStock} <span className="text-xs font-semibold text-slate-500">{nivel.name.toLowerCase()}</span>
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Stock Actual</p>
              <p className={`text-2xl font-black mt-1 ${pal.stockNum}`}>
                {nivel.stock} <span className="text-xs font-semibold text-slate-500">{nivel.name.toLowerCase()}</span>
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Capacidad Total</p>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {(nivel.stock * nivel.baseUnitsContained).toLocaleString("es-PE")} <span className="text-xs font-semibold text-slate-500">und</span>
              </p>
            </div>
          </div>

          {/* Tabla financiera */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4 font-bold">Concepto</th>
                  <th className="py-2.5 px-4 font-bold text-right">Por Unidad (u)</th>
                  <th className="py-2.5 px-4 font-bold text-right">
                    Total Nivel ({nivel.stock} {nivel.name.toLowerCase()})
                  </th>
                  <th className="py-2.5 px-4 font-bold text-center">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userRole === "admin" && (
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-700">Precio de Compra</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800">{soles(nivel.purchasePrice ?? 0)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800">{soles((nivel.purchasePrice ?? 0) * nivel.stock)}</td>
                    <td className="py-3 px-4 text-center text-xs text-slate-400">—</td>
                  </tr>
                )}
                <tr>
                  <td className="py-3 px-4 font-medium text-slate-700">Precio de Venta</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-900 font-semibold">{soles(nivel.salePrice ?? 0)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-900 font-semibold">{soles((nivel.salePrice ?? 0) * nivel.stock)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${pal.chipActivo}`}>{nivel.name}</span>
                  </td>
                </tr>
                {userRole === "admin" && (
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-700">Ganancia</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">+ {soles(gananciaNivel)}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">+ {soles(gananciaNivel * nivel.stock)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        +{margenNivel.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Banner de ganancia del nivel (solo admin) */}
          {userRole === "admin" && (
            <div className={`rounded-xl p-4 text-white flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r ${pal.grad}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-white/90">Ganancia del Nivel</p>
                  <p className="text-[11px] text-white/70">
                    Sobre {nivel.stock} {nivel.name.toLowerCase()} en stock actual
                  </p>
                </div>
              </div>
              <p className="text-2xl font-black">{soles(gananciaNivel * nivel.stock)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Resumen financiero total (solo admin) */}
      {userRole === "admin" && (
        <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-indigo-400">
              <TrendingUp className="w-5 h-5" />
              <h4 className="font-bold text-sm uppercase tracking-wider text-slate-200">Resumen Financiero Total del Stock</h4>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
              +{margenTotal.toFixed(1)}% margen neto
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
            <div className="pt-4 sm:pt-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Valor Compra Total</p>
              <p className="text-2xl font-black text-sky-400 mt-1">{soles(valorCompraTotal)}</p>
              <p className="text-[11px] text-slate-500 mt-1">Inversión total inmovilizada</p>
            </div>
            <div className="pt-4 sm:pt-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Valor Venta Total</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">{soles(valorVentaTotal)}</p>
              <p className="text-[11px] text-slate-500 mt-1">Suma de todos los niveles</p>
            </div>
            <div className="pt-4 sm:pt-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ganancia Total Proyectada</p>
              <p className="text-2xl font-black text-purple-300 mt-1">{soles(gananciaTotal)}</p>
              <p className="text-[11px] text-slate-500 mt-1">Retorno bruto del inventario</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer: solo Cerrar */}
      <div className="flex justify-end pt-2 border-t border-slate-200">
        <button
          type="button"
          onClick={onCerrar}
          className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
