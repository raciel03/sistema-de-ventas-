-- ════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTICO DE VENTAS DUPLICADAS (Ventas del Dia)
-- Paso 1 (SOLO LEER): pega este SELECT en el SQL Editor de Supabase y pegame
-- el resultado. Con tu OK corro el Paso 2 (borrado con devolucion de stock).
--
-- Considera duplicado: misma fecha_local, total, ganancia, metodo de pago,
-- mismo cliente (o ambos "a varios") y MISMO detalle de items. El de id mas
-- alto se conserva; los anteriores son candidatos a borrar.
-- ════════════════════════════════════════════════════════════════════════════

with articulos as (
  select vi.venta_id,
         string_agg(
           coalesce(vi.producto_id::text, 's/' || vi.nombre_producto) || '|' ||
           vi.cantidad::text || '|' || vi.precio_venta_unit::text || '|' ||
           coalesce(vi.nivel_id::text, '') || '|' || vi.total_linea::text,
           '~' order by vi.id
         ) as items_key
  from venta_items vi
  group by 1
),
v as (
  select v.id, v.fecha_local, v.total, v.ganancia, v.metodo_pago,
         coalesce(v.cliente_id::text, '-') as cliente,
         a.items_key,
         (select count(*) from comprobantes c where c.venta_id = v.id) as comprobantes
  from ventas v
  left join articulos a on a.venta_id = v.id
)
select v1.id as venta_mantener,
       v1.fecha_local,
       v1.total,
       v1.metodo_pago,
       v1.comprobantes as comprobantes_mantener,
       v2.id as venta_duplicada,
       v2.comprobantes as comprobantes_duplicada
from v v1
join v v2
  on v2.id < v1.id
 and v2.fecha_local = v1.fecha_local
 and v2.total = v1.total
 and v2.ganancia = v1.ganancia
 and v2.metodo_pago = v1.metodo_pago
 and v2.cliente is not distinct from v1.cliente
 and v2.items_key is not distinct from v1.items_key
order by v1.id, v2.id;

-- ════════════════════════════════════════════════════════════════════════════
-- Paso 2 (BORRAR): solo despues de ver el diagnostico y avisarme.
-- Borra los candidatos SIN comprobante llamando a eliminar_venta (devuelve el
-- stock). Los que tengan comprobante NO se tocan y se listan a continuacion.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  r record;
  con_comprobante int := 0;
  borradas int := 0;
begin
  for r in
    with articulos as (
      select vi.venta_id,
             string_agg(
               coalesce(vi.producto_id::text, 's/' || vi.nombre_producto) || '|' ||
               vi.cantidad::text || '|' || vi.precio_venta_unit::text || '|' ||
               coalesce(vi.nivel_id::text, '') || '|' || vi.total_linea::text,
               '~' order by vi.id
             ) as items_key
      from venta_items vi
      group by 1
    ),
    v as (
      select v.id, v.fecha_local, v.total, v.ganancia, v.metodo_pago,
             coalesce(v.cliente_id::text, '-') as cliente,
             a.items_key,
             (select count(*) from comprobantes c where c.venta_id = v.id) as comprobantes
      from ventas v
      left join articulos a on a.venta_id = v.id
    )
    select v1.id as mantener, v2.id as dup, v2.comprobantes
    from v v1
    join v v2
      on v2.id < v1.id
     and v2.fecha_local = v1.fecha_local
     and v2.total = v1.total
     and v2.ganancia = v1.ganancia
     and v2.metodo_pago = v1.metodo_pago
     and v2.cliente is not distinct from v1.cliente
     and v2.items_key is not distinct from v1.items_key
    order by v1.id, v2.id
  loop
    if r.comprobantes > 0 then
      con_comprobante := con_comprobante + 1;
      raise notice 'SIN BORRAR venta % (tiene comprobante emitido)', r.dup;
    else
      perform eliminar_venta(r.dup);
      borradas := borradas + 1;
      raise notice 'BORRADA venta % (duplicada de %)', r.dup, r.mantener;
    end if;
  end loop;
  raise notice 'Resumen: % borradas, % con comprobante preservadas', borradas, con_comprobante;
end $$;