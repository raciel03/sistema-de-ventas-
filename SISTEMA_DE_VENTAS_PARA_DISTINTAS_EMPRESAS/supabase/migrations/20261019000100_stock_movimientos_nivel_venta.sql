-- ============================================================================
-- registrar_venta: guardar nivel_id en stock_movimientos.
-- ============================================================================
-- La venta ya guardaba el nivel en venta_items, pero el movimiento de historial
-- salia sin nivel_id. Sin esa columna "Ventas por Restock" no puede agrupar lo
-- vendido por nivel (Unidad, Paquete, Millar...) porque el servicio de la app
-- reconstruye affectedLevelName desde nivel_id.
--
-- Cambio minimo: se agrega nivel_id al insert de stock_movimientos, tomandolo
-- del mismo item jsonb que ya usa venta_items. Nada mas cambia.
--
-- extra (jsonb): guarda los campos de detalle mayorista que antes solo vivian
-- en el navegador (stock por nivel tras cada evento, stock inicial, etc). Sin
-- esto se perdia al recargar la pagina.

alter table stock_movimientos add column if not exists extra jsonb;

create or replace function registrar_venta(
  p_cliente_id       int,
  p_subtotal         numeric,
  p_igv              numeric,
  p_igv_rate         numeric,
  p_total            numeric,
  p_ganancia         numeric,
  p_metodo_pago      metodo_pago,
  p_monto_recibido   numeric,
  p_vuelto           numeric,
  p_items            jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id  int;
  v_item      jsonb;
  v_producto  int;
  v_cantidad  numeric;
  v_stock     numeric;
  v_total     numeric;
  v_nombre    text;
  v_tipo      tipo_producto;
begin
  if not esta_activo() then
    raise exception 'Sesion no permitida: usuario inactivo o no autenticado';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene items';
  end if;

  -- Validar TODO el stock antes de escribir nada. Asi el error aparece antes
  -- de crear la cabecera y no hay que deshacer nada.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_producto := nullif(v_item->>'producto_id', '')::int;
    v_cantidad := nullif(v_item->>'cantidad', '')::numeric;

    if v_producto is null then
      raise exception 'Un item no tiene producto';
    end if;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad invalida en el producto %', v_producto;
    end if;

    -- for update RESERVA la fila: si otra caja esta vendiendo el mismo producto
    -- a la vez, esta venta espera en vez de leer un stock viejo.
    select stock into v_stock from productos where id = v_producto for update;
    if v_stock is null then
      raise exception 'El producto % no existe', v_producto;
    end if;
    if v_stock < v_cantidad then
      raise exception 'Stock insuficiente: quedan % y se venden % (producto %)',
        v_stock, v_cantidad, v_producto;
    end if;
  end loop;

  -- Cabecera
  insert into ventas (
    cliente_id, subtotal, igv, igv_rate, total, ganancia,
    metodo_pago, monto_recibido, vuelto, usuario_id
  )
  values (
    p_cliente_id, p_subtotal, p_igv, p_igv_rate, p_total, p_ganancia,
    p_metodo_pago, p_monto_recibido, p_vuelto, auth.uid()
  )
  returning id into v_venta_id;

  -- Items + descuento de stock
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_producto := nullif(v_item->>'producto_id', '')::int;
    v_cantidad := nullif(v_item->>'cantidad', '')::numeric;
    v_total    := coalesce(nullif(v_item->>'total_linea', '')::numeric, 0);

    select coalesce(nullif(p.nombre, ''), 'Producto ' || p.id), p.tipo
      into v_nombre, v_tipo
      from productos p
     where p.id = v_producto;

    insert into venta_items (
      venta_id, producto_id, nivel_id, nombre_producto, tipo_producto,
      cantidad, precio_compra_unit, precio_venta_unit, total_linea
    )
    values (
      v_venta_id,
      v_producto,
      nullif(v_item->>'nivel_id', '')::int,
      v_nombre,
      v_tipo,
      v_cantidad,
      coalesce(nullif(v_item->>'precio_compra_unit', '')::numeric, 0),
      coalesce(nullif(v_item->>'precio_venta_unit', '')::numeric, 0),
      v_total
    );

    -- El stock SIEMPRE se descuenta del stock general del producto, en unidades.
    -- Los niveles (Paquete, Millar...) son solo referencia informativa.
    perform descontar_stock_producto(v_producto, v_cantidad);

    -- Movimiento de historial, para poder auditar el descuento.
    -- nivel_id es lo nuevo: es el nivel con el que se vendio (Unidad, Paquete...).
    insert into stock_movimientos (
      producto_id, nivel_id, tipo, cantidad, stock_resultante, venta_id,
      descripcion, usuario_id
    )
    select
      v_producto, nullif(v_item->>'nivel_id', '')::int, 'sale', v_cantidad, stock,
      v_venta_id, 'Venta ' || v_venta_id, auth.uid()
    from productos where id = v_producto;
  end loop;

  return v_venta_id;
end;
$$;

revoke execute on function registrar_venta(
  int, numeric, numeric, numeric, numeric, numeric, metodo_pago, numeric, numeric, jsonb
) from public;
grant execute on function registrar_venta(
  int, numeric, numeric, numeric, numeric, numeric, metodo_pago, numeric, numeric, jsonb
) to authenticated;
