MUNDO VIVO 3.8.1 — MULTIJUGADOR + GUARDADO DE PARTIDA (PC y móvil)

CORRECCIÓN 3.8.1
- Arreglado el bug de la pistola/escopeta que a veces se quedaba “tiesa” (apuntando
  fijo a un solo lugar) al moverse. La causa era que las coordenadas del ratón se
  tomaban respecto a la ventana en vez del canvas, y además el aim no se soltaba
  cuando el cursor salía del juego. Ahora el arma sigue correctamente al ratón
  (o al NPC más cercano en móvil) y deja de “congelarse” al caminar/correr.

Archivos: index.html (juego), server.js (salas, chat, guardado), package.json, .gitignore,
          iconos (favicon.ico, icon-192/512.png, apple-touch-icon.png) y manifest.json (PWA)

PUBLICAR EN RENDER
1. Sube todos los archivos (index.html, server.js, package.json, .gitignore, iconos y manifest.json) a un repositorio de GitHub.
2. En Render crea un Web Service conectado a ese repositorio.
3. Build Command: npm install      Start Command: npm start
4. Environment: DATA_DIR = /var/data
5. Settings > Persistent Disk: Mount Path /var/data, 1 GB.
6. Publica y espera a "Live".
Sin el disco persistente las partidas se pierden al reiniciar el servicio.

CÓMO JUGAR
- Todos abren la misma URL. El primero deja el código de sala vacío; los demás escriben su código.
- En la pantalla de inicio eliges Modo PC o Modo móvil (se detecta solo; también puedes cambiarlo
  en pleno juego con el botón 📱/💻 del panel de misión).
- PC: WASD/flechas mover · Shift correr · Espacio saltar · clic o F disparar (apunta el ratón)
  · E coger · Q rapidez · B escudo · G o Enter chat.
- Móvil: joystick izquierdo; CORRER (activar/desactivar), SALTAR, COGER, FUEGO (apunta solo al NPC
  más cercano), ⚡ rapidez y 🛡️ escudo.
- Se guardan: monedas, misiones, skins y skin equipada (cada ~10 s y al cerrar/ocultar la pestaña).
- Perfil: en "Perfil y recuperar partida" puedes copiar tu código y pegarlo en otro dispositivo
  para recuperar tu partida.

CAMBIOS RESPECTO A 3.7
Seguridad / servidor
- CORREGIDO: el servidor publicaba toda la carpeta (server.js y player-saves.json con todos los
  perfiles). Ahora solo se sirve index.html.
- Guardado con escritura diferida, copia del archivo si se daña, límite de peticiones por IP,
  sala máx. 16 jugadores, límite de chat/disparos, validación de datos.
Errores corregidos
- Escribir en el chat/nombre activaba poderes, disparos y +500 monedas (teclas K, Q, B, F, E...).
- Las misiones de "explorar X segundos" nunca avanzaban (se atascaba en la misión 4).
- Correr no sumaba a las misiones de caminar; el aviso de "misión completada" nunca se veía.
- El mensaje de estado se sobrescribía en cada fotograma (no se leía nada); el HUD tocaba el DOM
  a 60 veces por segundo.
- Móvil: botones DISPARAR/COGER duplicados y superpuestos, HUD tapando los controles, canvas
  desajustado por la barra del navegador, zoom al escribir, crash en iOS antiguos (roundRect).
- Los jugadores remotos siempre se veían azules y el chat se ocultaba si dos tenían el mismo nombre.
- La hierba y el camino del parque no se movían con la cámara; árboles sobre las avenidas;
  estanque atravesable y solapado con un edificio.
- Los NPC lejanos iban más lentos, se quedaban congelados lejos del origen, y los reaparecidos
  salían delante del jugador. Los NPC se llevaban las monedas del suelo.
- Si el servidor no respondía no se cargaba el guardado local; ahora gana la copia más reciente.
- Dos monedas distintas (cartera + botín) unificadas en una sola cartera (las partidas antiguas
  se migran automáticamente).
Mejoras
- Joystick analógico, disparo mantenido, apuntado con ratón / auto-apuntado en móvil.
- Minimapa, regeneración de vida, enfriamiento de poderes, monedas que se recogen solas,
  indicador "[E] Coger", el arma se ve en la mano, balas de otros jugadores visibles,
  movimiento suave de jugadores remotos, chat con aviso de mensajes nuevos, pantalla completa
  en móvil, rendimiento mucho mejor con 1.000 NPC (colisiones y dibujo optimizados).

NOTA: la tecla K (+500 monedas) sigue siendo el "código secreto" del juego original.
Para quitarla, borra la línea  else if(k==='k')activatePower('coins');  en index.html.

ARMAS CON IMAGEN (3.8+)
- La pistola y la escopeta usan imágenes recortadas, incrustadas dentro de index.html (base64),
  así que no hace falta subir archivos extra. Se ven en el suelo, en la mano del jugador y de los NPC.

ELEGIR GÉNERO (hombre / mujer)
- En la pantalla de inicio eliges "Hombre" o "Mujer". Se recuerda en el dispositivo y se guarda en la partida.
- Los demás jugadores ven tu personaje según lo que elegiste; los NPC son mitad hombres, mitad mujeres.
