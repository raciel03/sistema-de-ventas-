-- ============================================================================
-- Venta por metro.
-- ============================================================================
-- El stock de un producto tipo 'metro' se guarda en centimetros (1 m = 100 cm)
-- y su precio_compra / precio_venta se interpretan como precio por metro.
-- No se agregan columnas nuevas: el resto de campos sigue funcionando igual.
--
-- Nota: ALTER TYPE ... ADD VALUE no puede usarse dentro del mismo bloque que
-- ya utilize el valor nuevo. Esta migracion solo habilita el valor.

alter type tipo_producto add value if not exists 'metro';
