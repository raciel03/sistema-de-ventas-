-- ============================================================================
-- Cambio de contrasena de otro usuario desde el modal "Editar Usuario".
-- ============================================================================
-- Supabase Auth guarda el hash bcrypt en auth.users.encrypted_password. La app
-- no puede tocarlo con la clave publica, asi que se expone esta funcion
-- SECURITY DEFINER que exige ser administrador activo (es_admin()).
--
-- Evita depender de la Edge Function 'crear-usuario' (que necesita la clave de
-- servicio) y del correo de recuperacion (limitado por el SMTP de Supabase).
-- ============================================================================

create or replace function admin_cambiar_password(p_usuario uuid, p_password text)
returns void
language plpgsql
security definer
-- pgcrypto (crypt/gen_salt) vive en el esquema `extensions` en Supabase.
set search_path = public, auth, extensions
as $$
begin
  if not es_admin() then
    raise exception 'Solo un administrador activo puede cambiar contraseñas';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_usuario;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;
end;
$$;

grant execute on function admin_cambiar_password(uuid, text) to authenticated;
