MUNDO VIVO 3.7 — MULTIJUGADOR + GUARDADO DE PARTIDA

Incluye:
- index.html: juego con controles de PC y móvil.
- server.js: salas multijugador, chat y API de guardado.
- package.json: dependencias y comando de inicio.

PUBLICAR EN RENDER
1. Descomprime este ZIP.
2. Sube los archivos index.html, server.js y package.json a un repositorio de GitHub.
3. En Render crea un servicio nuevo de tipo Web Service y conecta ese repositorio.
4. Build Command: npm install
5. Start Command: npm start
6. En Environment agrega:
   DATA_DIR = /var/data
7. En Settings crea un Persistent Disk:
   Mount Path: /var/data
   Size: 1 GB
8. Publica el servicio y espera a que aparezca Live.

IMPORTANTE SOBRE EL DISCO:
El guardado permanente en Render necesita un Persistent Disk montado en /var/data.
Sin ese disco, los archivos guardados podrían perderse al reiniciar o volver a desplegar el servicio.

CÓMO JUGAR Y GUARDAR
1. Todos abren la misma URL HTTPS del servicio.
2. El primer jugador deja vacío el código de sala y pulsa CREAR / ENTRAR.
3. Comparte el código que aparece en pantalla.
4. Tus amigos escriben el mismo código y entran.
5. La partida guarda automáticamente monedas, misiones, skins desbloqueadas y skin equipada.
6. El perfil se identifica con un ID guardado en el navegador. Si borras los datos del navegador o cambias de dispositivo,
   ese perfil local no se recupera automáticamente. No borres los datos del navegador si quieres conservarlo.

LÍMITES DE ESTA VERSIÓN
- Cada navegador tiene su propio perfil de guardado; no hay cuentas con contraseña ni recuperación entre dispositivos.
- El guardado se envía al servidor aproximadamente cada 10 segundos y al salir/ocultar la pestaña.
- El multijugador sincroniza presencia, posición y chat. No sincroniza el progreso, monedas ni NPC entre todos.
