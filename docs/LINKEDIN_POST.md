# 📝 Publicación Lista para LinkedIn — CollabNotes Realtime

> **Consejo para máximo alcance orgánico en LinkedIn:**
> 1. **Sube `docs/demo-realtime.mp4`** directamente como vídeo nativo en la publicación (en LinkedIn el `.mp4` H.264 a `1920x1080` se ve mucho más nítido y fluido que un GIF y tiene reproducción automática en el feed; usa `docs/demo-realtime.gif` para el `README.md` de GitHub).
> 2. **No pongas enlaces externos dentro del cuerpo principal del post** (el algoritmo penaliza las publicaciones que sacan al usuario fuera de LinkedIn). Publica primero el texto + vídeo y pega inmediatamente debajo el **Primer Comentario** que tienes al final de este documento.

---

## 🏆 Versión 1 — Enfoque Producto + Ingeniería Full-Stack (Recomendada)

```text
Esta semana he terminado CollabNotes: un entorno de escritura colaborativa en tiempo real donde me propuse cuidar tanto la arquitectura de datos como el diseño de interfaz.

Cuando empiezas un editor colaborativo, pintar los bloques y abrir un canal de eventos es la parte sencilla. Lo verdaderamente delicado aparece cuando dos personas editan el mismo documento en el mismo segundo o cuando alguien intenta saltarse los permisos desde el cliente.

Cuatro decisiones técnicas y de diseño que han marcado el proyecto:

1. Control de Concurrencia Optimista (OCC) sin "Lost Updates"
Cada documento mantiene una columna entera `version` monótona. El auto-guardado ejecuta un Compare-And-Swap atómico (`WHERE id = $1 AND version = $2`). Si otro colaborador confirma una versión intermedia mientras estabas escribiendo, el motor detecta la colisión, ejecuta un merge determinista a 3 vías por bloque JSONB y consolida `v+1` sin pisar el trabajo de nadie.

2. Seguridad en el motor de PostgreSQL, no solo en la UI
La interfaz nunca decide en solitario quién puede leer o modificar una nota. Los roles (`owner`, `editor`, `viewer`) se aplican a nivel de fila mediante políticas Row Level Security (RLS) en PostgreSQL 15+, rechazando cualquier intento de mutación no autorizada (`SQLSTATE 42501`).

3. Modelo híbrido Relacional (ACID) + JSONB con índice GIN
Integridad referencial estricta (`ON DELETE CASCADE`, claves compuestas) para usuarios y permisos, combinada con bloques tipados en `JSONB` indexados con `GIN (jsonb_path_ops)` para búsquedas rápidas sobre el contenido.

4. Diseño editorial pensado por y para personas
Quería huir deliberadamente de la estética clónica actual de plantillas oscuras con gradientes morados. Diseñé un lienzo calmado en papel cálido (`#FAF8F5`) y tinta oscura (`#111110`), tipografía serif para lectura y un Inspector lateral oculto (`Ctrl/Cmd + I`) que muestra en vivo el árbol JSONB y el log de transacciones CAS.

Además, incluí un modo local "Zero-Config" con sesiones aisladas por pestaña y sincronización por BroadcastChannel para poder abrir dos usuarios distintos lado a lado nada más clonar el repo, sin configurar claves ni servidores externos.

¿Cómo soléis resolver los conflictos de escritura concurrente en vuestras aplicaciones: versionado optimista (OCC), CRDTs o bloqueos pesimistas?

#SoftwareEngineering #PostgreSQL #TypeScript #NextJS #DistributedSystems #ProductDesign #WebDevelopment
```

---

## ⚡ Versión 2 — Más Directa y Orientada a Demo Técnica

```text
¿Qué ocurre realmente en tu base de datos cuando dos usuarios editan el mismo documento en el mismo segundo?

Si haces un `UPDATE` tradicional con el último estado del cliente, el segundo en guardar borra silenciosamente los cambios del primero (el clásico problema de Lost Updates).

En el vídeo adjunto enseño cómo lo he resuelto en CollabNotes, un editor colaborativo en tiempo real construido con Next.js 15, TypeScript estricto y PostgreSQL:

• Compare-And-Swap atómico (`version = expected_version`) en cada guardado con debounce.
• Resolución de conflictos mediante merge a 3 vías a nivel de bloque sobre una columna híbrida `JSONB` indexada con `GIN`.
• Autorización real mediante políticas Row Level Security (RLS): un usuario `viewer` recibe cambios y cursores en vivo, pero cualquier intento de escritura cae bloqueado por el motor (`42501`).
• Interfaz editorial minimalista con paleta de comandos (`Cmd+K`) e inspector técnico en tiempo real (`Cmd+I`).

Lo he preparado con un modo local sin configuración (`npm install && npm run dev`) y aislamiento de sesión por ventana para poder probar dos roles distintos sincronizándose al instante en 30 segundos.

Dejo el repositorio con el código fuente, el esquema SQL y la Release v1.0.0 en el primer comentario por si queréis destriparlo. 👇

#Backend #PostgreSQL #TypeScript #NextJS #Concurrency #SoftwareArchitecture
```

---

## 💬 Texto para el Primer Comentario (Pegar justo después de publicar)

```text
🔗 Código fuente completo, esquema PostgreSQL (RLS + función RPC de Compare-And-Swap) e instrucciones para probar la demo a doble pantalla en 30 segundos:
https://github.com/Thepimen/collab-notes-realtime

📦 Release v1.0.0:
https://github.com/Thepimen/collab-notes-realtime/releases/tag/v1.0.0

🌐 Más proyectos de arquitectura y sistemas en mi portfolio:
https://luislazaro-dev.netlify.app
```
