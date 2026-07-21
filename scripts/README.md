# amati — Gestor de Administradores (TI CLI)

Este script de Node.js permite al área de TI de la institución gestionar el ciclo de vida completo de las cuentas de administrador (Admin, `role_id = 1`) de la Plataforma Emocional, incluyendo la creación de cuentas, la revocación de credenciales biométricas (Passkeys), re-enrolamiento ante pérdida de dispositivos, desactivación temporal y consulta de auditoría.

El acceso de administradores está protegido obligatoriamente por Passkeys (WebAuthn) vinculadas al hardware local (device-bound), lo que impide su sincronización en nubes personales por seguridad. Por lo tanto, cualquier pérdida de dispositivo o cambio de equipo debe ser gestionado a través de este script.

## Requisitos previos

1. Tener Node.js instalado en el equipo de TI.
2. Contar con el archivo `.env` configurado en la raíz del proyecto con las siguientes variables:
   ```env
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-secreta
   APP_URL=http://localhost:4200   # URL base del frontend para los enlaces de acceso

   # Configuración SMTP opcional para el script TI CLI (para enviar correos automáticamente)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=tu_correo@gmail.com
   SMTP_PASS=tu_contraseña_de_aplicacion
   ```

> [!CAUTION]
> La variable `SUPABASE_SERVICE_ROLE_KEY` otorga privilegios de superusuario y salta las políticas de RLS. **Nunca** compartas esta clave ni la subas al repositorio.

## Instalación de dependencias del script

Si ejecutas el script por primera vez desde la raíz del proyecto, asegúrate de tener instaladas las dependencias del proyecto (incluye `nodemailer` para el envío automático de correos):
```bash
npm install
```

## Comandos disponibles

Para ejecutar el script, navega a la raíz del proyecto y usa `node scripts/admin-manager.js` seguido del comando correspondiente:

### 1. Listar todos los administradores
Muestra una tabla compacta con todos los administradores registrados, su matrícula, estado de cuenta y si tienen la passkey enrolada.
```bash
node scripts/admin-manager.js list
```

### 2. Crear un nuevo administrador
Crea la cuenta en Supabase Auth con metadatos personalizados, inserta su registro en `public.users` con privilegios de administrador (`role_id: 1`), inicializa su perfil en `public.profiles` con su nombre y campus asignado, y envía un correo automático de invitación (Magic Link) estilizado con el diseño de Amati para enrolar su dispositivo en el primer acceso.

**Parámetros:**
- `email` (obligatorio): Correo institucional del nuevo administrador.
- `nombre` (opcional, por defecto 'Admin'): Nombre de pila del administrador.
- `apellido` (opcional, por defecto 'Institucional'): Apellidos del administrador.
- `campus` (opcional, por defecto null): Campus o facultad asignada.

```bash
node scripts/admin-manager.js create admin@buap.mx "Guillermo" "Avila Mora" "Facultad de Medicina"
```

> [!TIP]
> Si no configuras las variables SMTP en el archivo `.env` o la librería `nodemailer` no está instalada, el script emitirá una advertencia e imprimirá el enlace de enrolamiento directamente en la consola para que el área de TI lo entregue manualmente de forma segura.

### 3. Consultar estado detallado de un administrador
Muestra el ID del usuario, matrícula, estado (activo/suspendido), si la passkey es obligatoria, dispositivos registrados y los últimos 5 logs de auditoría.
```bash
node scripts/admin-manager.js status admin@buap.mx
```

### 4. Revocar credenciales (Passkeys) y sesiones
Elimina todas las passkeys del usuario en el servidor de Supabase y destruye de forma inmediata todas sus sesiones activas de base de datos (`auth.sessions`). Desactiva temporalmente la obligación de passkey (`passkey_only = false`) para permitir el acceso por enlace.
```bash
node scripts/admin-manager.js revoke admin@buap.mx
```

### 5. Re-enrolar administrador (Pérdida de dispositivo o nuevo equipo)
Revoca las credenciales anteriores y envía automáticamente un nuevo Magic Link al correo institucional del administrador para que registre su nueva Passkey desde su nuevo dispositivo.
```bash
node scripts/admin-manager.js reenroll admin@buap.mx
```

### 6. Desactivar administrador (Baja temporal)
Bloquea temporalmente el acceso de la cuenta y cierra todas sus sesiones activas. Las credenciales registradas no se eliminan.
```bash
node scripts/admin-manager.js disable admin@buap.mx
```

### 7. Reactivar administrador
Restaura el acceso de un administrador previamente desactivado.
```bash
node scripts/admin-manager.js enable admin@buap.mx
```

### 8. Actualizar correo electrónico institucional
Modifica el correo del administrador en el servicio de autenticación, revoca sus passkeys actuales por seguridad y envía el Magic Link de re-enrolamiento a su nuevo correo electrónico.
```bash
node scripts/admin-manager.js update-email admin-anterior@buap.mx admin-nuevo@buap.mx
```

---

## Logs y Auditoría

Todas las acciones ejecutadas por este script registran automáticamente una entrada en la tabla de base de datos `public.admin_audit_log` con el identificador del operador, el correo de la cuenta afectada, la acción realizada, la IP y la marca de tiempo UTC, garantizando la trazabilidad bajo cumplimiento estricto.
