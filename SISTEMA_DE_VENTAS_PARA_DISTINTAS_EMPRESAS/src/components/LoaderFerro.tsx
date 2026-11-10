/**
 * Pantalla de carga a pantalla completa (Ferreteria Ebenezer).
 * Las animaciones viven en src/index.css bajo `.ferro-loader` para que el CSS
 * no se escape al resto de la pagina.
 */
interface LoaderFerroProps {
  mensaje?: string;
}

const LoaderFerro = ({ mensaje }: LoaderFerroProps) => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm">
    <div className="ferro-loader w-36 h-36 sm:w-40 sm:h-40">
      <svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cargando">
        <defs>
          <linearGradient id="ferroOrbitGrad" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <filter id="ferroSoftGlow" height="140%" width="140%" x="-20%" y="-20%">
            <feGaussianBlur result="blur" stdDeviation="2.5" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <circle cx="80" cy="80" fill="#F8FAFC" r="64" stroke="#E2E8F0" strokeWidth="1.2" />
        <circle cx="80" cy="80" fill="none" r="52" stroke="#EEF2F6" strokeWidth="2.5" />
        <circle className="ferro-burst" cx="80" cy="80" fill="none" r="52" stroke="#10B981" strokeWidth="2" />

        <g className="ferro-orbit">
          <circle className="ferro-arc" cx="80" cy="80" fill="none" r="52" stroke="url(#ferroOrbitGrad)" strokeLinecap="round" strokeWidth="3.5" />
          <circle cx="132" cy="80" fill="#38BDF8" filter="url(#ferroSoftGlow)" opacity="0.9" r="2.8" />
        </g>

        <g className="ferro-store">
          <rect fill="#4F46E5" filter="url(#ferroSoftGlow)" height="56" rx="16" width="56" x="52" y="52" />
          <g transform="translate(64, 64) scale(1.333)">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d="M2 7h20" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </g>
        </g>

        <g className="ferro-check">
          <circle cx="80" cy="80" fill="#FFFFFF" filter="url(#ferroSoftGlow)" r="28" stroke="#E2E8F0" strokeWidth="1" />
          <circle cx="80" cy="80" fill="#10B981" r="24" />
          <path className="ferro-check-path" d="M71 80.5 L77.5 86.5 L89.5 73.5" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
        </g>
      </svg>
    </div>
    {mensaje && (
      <p className="mt-5 text-sm font-semibold tracking-wide text-slate-200">{mensaje}</p>
    )}
  </div>
);

export default LoaderFerro;
