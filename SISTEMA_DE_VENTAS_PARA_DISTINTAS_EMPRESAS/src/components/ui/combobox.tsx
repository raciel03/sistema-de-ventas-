import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ComboOption {
  value: string
  label: string
  search?: string
  node?: React.ReactNode
}

interface ComboboxProps {
  options: ComboOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  /** Contenido personalizado para el boton (resumen de la seleccion). */
  summary?: React.ReactNode
  /** Franja opcional de cabeceras de columna dentro del panel. */
  columns?: React.ReactNode
  /** Elemento opcional (p. ej. un badge) junto al buscador. */
  badge?: React.ReactNode
}

/**
 * Desplegable con busqueda, renderizado EN LINEA (sin portal) para que
 * funcione correctamente dentro de un Dialog de Radix.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Selecciona…",
  searchPlaceholder = "Buscar…",
  emptyText = "Sin resultados",
  className,
  disabled,
  summary,
  columns,
  badge,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  const term = query.trim().toLowerCase()
  const filtered = term
    ? options.filter((o) => `${o.label} ${o.search ?? ""}`.toLowerCase().includes(term))
    : options

  const close = () => {
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selected && !summary && "text-muted-foreground"
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {summary ?? (selected ? selected.label : placeholder)}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50/70 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-blue-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation()
                  close()
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-blue-400/80"
            />
            {badge}
          </div>

          {columns}

          <div className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-slate-400">{emptyText}</div>
            ) : (
              filtered.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value)
                    close()
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 border-l-4 border-transparent px-3 py-2 text-left text-sm hover:bg-slate-50",
                    value === opt.value && "border-blue-600 bg-blue-50/80"
                  )}
                >
                  {opt.node ?? <span className="flex-1 truncate">{opt.label}</span>}
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4 shrink-0 text-blue-600",
                      value === opt.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
