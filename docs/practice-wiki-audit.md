# Auditoría de la partida de práctica contra la wiki oficial

Fecha: 2026-11-26 · Primera versión sobre la 3.39.0; actualizada a la 3.40.0 (`develop`,
commit `59ad26c`), que ya resolvió buena parte de lo encontrado.

## Qué es este documento

He leído en la wiki oficial (wiki.bloodontheclocktower.com, por su API) las páginas de los
personajes de las tres ediciones base que lleva la app (Trouble Brewing, Bad Moon Rising y
Sects & Violets), sobre todo las secciones **Summary**, **How to Run** y **Examples**, y las he
cruzado con lo que hacen hoy los jugadores inventados de la partida de práctica:

- `src/practiceBrain.js`: qué eligen de noche cuando les llega una tarjeta.
- `src/practiceDay.js`: qué piensan de los demás, qué dicen, a quién nominan y cómo votan.
- `src/store/practiceTown.js`: cuándo hablan, nominan y votan durante el día.
- `src/practicePersonality.js`: la personalidad de cada uno (cuánto se fía, razona, miente...).
- `src/components/modals/PracticeInbox.vue`: cómo responden a las tarjetas.

No he cambiado código. Es un informe para decidir qué mejorar.

Recordatorio de lo que ya está decidido en `ROADMAP.md`: la práctica es un **simulador**, no un
examen (no se corrige al Narrador), el Borracho y la Marioneta no se reparten nunca, y la
información de esbirros y demonio se da a mano. Este informe respeta todo eso: solo mira si los
jugadores inventados se comportan como lo haría un jugador real con ese personaje.

### Cómo leer cada ficha

- **Wiki**: lo que dice el personaje y lo que importa para jugarlo (con algún ejemplo de la wiki).
- **Hacemos**: lo que hace hoy el jugador inventado.
- **Huecos**: diferencias con la wiki o con el juego esperado. 🐞 marca un fallo (hace algo
  incorrecto), 🕳️ marca algo que falta.
- **Prioridad**: **Alta** (se nota en casi todas las partidas o rompe una regla), **Media** (se
  nota a menudo o empobrece mucho al personaje), **Baja** (detalle o caso raro), **OK** (bien
  como está).

Los "personajes pasivos" (no eligen nada, todo lo resuelve el Narrador) suelen salir **OK**:
el simulador no tiene que hacer nada salvo reclamarlos bien de día.

---

## Resumen

### Ya resuelto en la 3.40.0

La 3.40.0 (personalidades y "escuchar la plaza") arregló la mayoría de lo que salía como
prioridad alta en la primera versión de este informe:

- **Usan lo que otros cuentan en la plaza**: lo reclamado y la información que se dice pesan en
  las sospechas de todos, según lo que se fían de quien lo dice y su personalidad.
- **Los malvados inventan información** para su farol de Lavandera, Bibliotecario, Investigador,
  Chef, Empático y Pitonisa (por ejemplo, "Ana o Carlos es el Chef" para cubrir a un compañero).
- **Dos que reclaman el mismo personaje** hacen sospechar a todo el pueblo, no solo al dueño real.
- **La Lavandera, el Bibliotecario y el Investigador cruzan su tarjeta con lo reclamado** (y el
  "0" del Bibliotecario delata a quien diga ser Forastero).
- 🐞 **Empático arreglado**: cada número cuenta solo para los vecinos que tenía esa noche, y el
  mismo número noche tras noche ya no se suma sin límite.
- **El Guardián de Cuervos** elige a quien más duda, y **la Pitonisa** que piensa comprueba a
  sospechosos (y si da "Sí" con alguien de confianza, carga todo sobre el otro).
- **Un Demonio que piensa deja en paz al Soldado reclamado**, y el **Diablillo se pasa el
  demonio** más cuando el pueblo sospecha de él.
- **Prueba de la Virgen**: algunos aldeanos nominan a una Virgen reclamada los primeros días.
- **Los malvados ya no "leen la mente"**: eligen por lo dicho en público, no por lo que piensa
  cada bueno en privado.
- Algunos buenos se guardan su personaje el primer día.

### Lo que queda: prioridad media

1. **Faroles con información solo para 6 personajes de Trouble Brewing.** Un malvado que
   reclama un rol de información de BMR o S&V (Sirvienta, Oráculo, Relojero, Soñador,
   Matemático, Florista, Pregonero, Enterrador, Guardián de Cuervos...) sigue sin inventar nada.
2. **La información numérica o de sí/no sin elegir a nadie sigue sin usarse**: Chef (la propia),
   Relojero, Sirvienta, Matemático, Oráculo, Florista, Pregonero y Enterrador. Lo dicen, pero no
   cambia lo que piensa nadie. Florista y Pregonero son los que más se notan: la app ya guarda
   quién votó y quién nominó.
3. **El Asesino no busca a quien el Demonio no puede matar** (Soldado o Marinero reclamados,
   vecinos de la Dama del té, el Bufón): mata a quien el pueblo más confía, como cualquier malvado.
4. **Con el Vortox en el guion, ejecutan todos los días para siempre.** Basta con que esté en el
   guion. Si un día acaba sin ejecución y la partida sigue, ya se sabe que no hay Vortox, pero no
   lo recuerdan.
5. **La Gemela Malvada farolea un aldeano cualquiera** en lugar del personaje de su gemela buena
   (el ejemplo de la wiki: "las dos dicen ser el Oráculo").
6. **Viajeros sin comportamiento propio** (si los usáis): con el Obispo siguen nominando, con el
   Voudon votan los vivos, el Mendigo vota sin fichas, y el Pistolero, el Juez, el Carnicero y la
   Institutriz nunca usan su habilidad.

### Lo que queda: prioridad baja

Está en cada ficha: el Mayordomo elige el primer amo al azar, el Soñador puede elegir viajeros,
el Exorcista no queda en la diana del Demonio que eligió, el Cortesano no deduce qué Demonio hay,
el Filósofo elige un personaje al azar, la Mente Maestra no empuja a ejecutar a un bueno tras
morir el Demonio, nadie cuenta Forasteros para detectar al Barón, ningún malvado finge el disparo
del Exterminador, etc.

### Lo que está bien

Además de lo resuelto en la 3.40.0, ya encajaba con la wiki: el Mayordomo vota solo si vota su
amo; el Santo se protege y los malvados lo empujan; el empate del Alcalde con 3 vivos; el Espía
conoce a todo el equipo malvado; el Monje, Posadero y Abogado del Diablo protegen; el Exorcista,
el Marinero, la Sirvienta y el Encantador de Serpientes van a por quien más dudan; el Tahúr
apuesta por lo que otros reclamaron; el Po se carga y elige 3; la Niña de la luna y el Patoso
eligen en público al morir; el Malabarista adivina el día 1; el Erudito y el Artista van al
Narrador; el loco del Cerenovus reclama ese personaje; el Mutante nunca dice que es forastero; el
No Dashii no mata a sus vecinos envenenados; el Fang Gu salta a un forastero reclamado; la Pit-Hag
crea un demonio a veces; y el Lunático se cree el Demonio y juega como tal.

---

## Trouble Brewing

### Aldeanos

#### Lavandera (Washerwoman)
- **Wiki**: la primera noche ve a dos jugadores y un Aldeano: uno de los dos lo es. El Espía
  puede aparecer como Aldeano ("Ana o Carlos es el Guardián de Cuervos" con Carlos siendo el
  Espía).
- **Hacemos**: lo cuenta en la plaza y lo cruza con lo reclamado: si uno de los dos reclama
  ese Aldeano, confía en él; si lo reclama un tercero, sospecha de ese tercero. Un malvado que
  farolea de Lavandera se inventa la pareja (a menudo para cubrir a un compañero). ✅ (3.40.0)
- **Prioridad**: **OK**.

#### Bibliotecario (Librarian)
- **Wiki**: igual que la Lavandera con un Forastero, o "0" si no hay. El Recluso puede no contar.
- **Hacemos**: cruza con lo reclamado como la Lavandera, y con un "0" sospecha de quien diga
  ser Forastero. El malvado que farolea de Bibliotecario se inventa un "0" o una pareja. ✅ (3.40.0)
- **Huecos**: 🕳️ no cuenta forasteros (más de los esperados apunta al Barón).
- **Prioridad**: **Baja**.

#### Investigador (Investigator)
- **Wiki**: uno de dos jugadores es un Esbirro concreto. El Recluso puede salir como Esbirro.
- **Hacemos**: +1,75 a cada uno; si se fía de uno de los dos, todo va al otro. El malvado que
  farolea de Investigador señala a dos buenos (si es atrevido, al que más confía el pueblo). ✅ (3.40.0)
- **Huecos**: 🕳️ no relaciona el Esbirro visto con lo que pasa (p. ej. Envenenador →
  información rara).
- **Prioridad**: **Baja**.

#### Chef
- **Wiki**: cuántas parejas de malvados se sientan juntos. El Espía y el Recluso pueden
  alterar la cuenta.
- **Hacemos**: lo dice en la plaza ("Tengo un 1"), pero el número no cambia nada de lo que piensa.
  El malvado que farolea de Chef se inventa un 0 o un 1 (3.40.0).
- **Huecos**: 🕳️ un "0" con un sospechoso fuerte debería aliviar a sus vecinos; un "1+"
  debería hacer sospechar de los vecinos de un sospechoso.
- **Prioridad**: **Baja** (información difícil de usar incluso para personas).

#### Empático (Empath)
- **Wiki**: cada noche, cuántos de sus dos vecinos **vivos** son malvados. La información es la
  del amanecer (actúa después del Demonio). Ejemplo: el Soldado es ejecutado y el Monje muere de
  noche; ahora el Empático lee a los siguientes vivos (un Bibliotecario y un Pistolero malvado)
  y le sale un "1".
- **Hacemos**: cada número cuenta para los vecinos que tenía **esa** noche, y se promedia noche
  a noche en vez de sumarse; con un "1" y un vecino de confianza, carga todo sobre el otro. El
  malvado que farolea de Empático se inventa el número. ✅ (3.40.0, era un fallo)
- **Prioridad**: **OK**.

#### Pitonisa (Fortune Teller)
- **Wiki**: cada noche elige a dos jugadores (vivos o muertos, incluida ella) y sabe si alguno es
  el Demonio. Hay un "falso positivo" (Red Herring) que es un bueno.
- **Hacemos**: si es de las que piensan (según su personalidad), elige a los que más duda; si
  no, al azar. Un "Sí" con alguien de confianza (o ella misma) carga todo sobre el otro. ✅ (3.40.0)
- **Huecos**: 🕳️ no piensa en el Red Herring (un "Sí" repetido siempre sobre el mismo que luego
  resulta bueno), ni vuelve a comprobar a uno de un "Sí" anterior para separarlos.
- **Prioridad**: **Baja**.

#### Enterrador (Undertaker)
- **Wiki**: cada noche (salvo la primera) sabe qué personaje fue ejecutado hoy. El Espía/Recluso
  pueden registrar otra cosa.
- **Hacemos**: lo cuenta en la plaza. No cambia lo que piensa nadie.
- **Huecos**: 🕳️ si el ejecutado había reclamado otro personaje, mentía: quien lo defendió o
  votó en contra gana sospecha; si era cierto, su información anterior queda confirmada.
- **Prioridad**: **Baja**.

#### Monje (Monk)
- **Wiki**: cada noche salvo la primera, protege a otro jugador del Demonio.
- **Hacemos**: protege a quien más confía, nunca a sí mismo. ✅
- **Huecos**: podría preferir a un poderoso que se ha destapado (Pitonisa, Empático, Alcalde),
  pero "en quien más confío" ya se le parece.
- **Prioridad**: **OK**.

#### Exterminador (Slayer)
- **Wiki**: una vez por partida, de día y en público, elige a un jugador: si es el Demonio, muere.
  Un malvado puede fingir que es el Exterminador y "disparar" (no pasa nada).
- **Hacemos**: dispara cuando está bastante seguro (o al azar desde el día 3). ✅
- **Huecos**: 🕳️ ningún malvado finge el disparo para dar credibilidad a su farol de
  Exterminador. 🕳️ No da un minuto para que el pueblo opine (la wiki recomienda dejar discutir).
- **Prioridad**: **Baja**.

#### Soldado (Soldier)
- **Wiki**: el Demonio no puede matarlo. Si lo ataca, esa noche no muere nadie.
- **Hacemos**: pasivo; lo reclama de día.
- **Huecos**: ✅ un Demonio que piensa ya no lo ataca (3.40.0). 🕳️ Un bueno podría farolear de
  Soldado para atraer el ataque (muy típico); los buenos nunca farolean otro personaje.
- **Prioridad**: **Baja**.

#### Guardián de Cuervos (Ravenkeeper)
- **Wiki**: si muere de noche, elige a un jugador (vivo o muerto) y ve su personaje.
- **Hacemos**: elige a quien más duda, y lo que ve cambia lo que piensa. ✅ (3.40.0)
- **Prioridad**: **OK**.

#### Alcalde (Mayor)
- **Wiki**: con 3 vivos y sin ejecución, gana el bueno. Si muere de noche, puede morir otro.
- **Hacemos**: con 3 vivos y un Alcalde reclamado, los buenos solo nominan o votan si están muy
  seguros. ✅
- **Huecos**: los malvados podrían reclamar Alcalde para bloquear la ejecución final (ya puede
  pasar por azar, no a propósito).
- **Prioridad**: **OK**.

#### Virgen (Virgin)
- **Wiki**: la primera vez que la nominan, si quien nomina es un Aldeano, este es ejecutado al
  momento. Si el nominador es Forastero o malvado, no pasa nada y se vota normal.
- **Hacemos**: algunos aldeanos (según su personalidad) nominan a una Virgen reclamada los dos
  primeros días para probarla. ✅ (3.40.0)
- **Huecos**: 🕳️ nadie saca conclusiones del resultado (si el nominador no muere, no es Aldeano
  o la Virgen miente). 🕳️ Los malvados no usan la Virgen (pueden nominarla sin riesgo).
- **Prioridad**: **Baja**.

### Forasteros

#### Mayordomo (Butler)
- **Wiki**: cada noche elige un amo (no a sí mismo); mañana solo puede votar si su amo vota.
  Nunca está obligado a votar.
- **Hacemos**: mantiene al amo casi siempre (75 %); solo levanta la mano si su amo la levanta. ✅
- **Huecos**: 🕳️ el primer amo se elige al azar; lo esperado es alguien de confianza.
- **Prioridad**: **Baja**.

#### Recluso (Recluse)
- **Wiki**: puede registrar como malvado, Esbirro o Demonio, incluso muerto.
- **Hacemos**: pasivo; lo reclama.
- **Huecos**: 🕳️ los buenos no rebajan una sospecha que venga de un Recluso reclamado ("la
  Pitonisa dio Sí sobre el Recluso: puede ser él").
- **Prioridad**: **Baja**.

#### Santo (Saint)
- **Wiki**: si muere ejecutado, gana el mal.
- **Hacemos**: los buenos lo dejan en paz (−1,2), los malvados lo empujan (+1). Si va a morir,
  dice que es el Santo y nomina para salir del tajo. ✅
- **Prioridad**: **OK**.

#### Borracho (Drunk)
- No se reparte nunca (decisión del proyecto). **No aplica.**

### Esbirros

#### Envenenador (Poisoner)
- **Wiki**: cada noche envenena a un jugador (esa noche y el día siguiente).
- **Hacemos**: envenena a quien el pueblo más confía, y no repite víctima si puede. ✅
- **Huecos**: podría preferir a quien se ha destapado como rol de información.
- **Prioridad**: **OK**.

#### Espía (Spy)
- **Wiki**: ve el grimorio cada noche; puede registrar como bueno o como Aldeano/Forastero.
- **Hacemos**: tras ver el grimorio conoce a todo el equipo malvado y farolea un personaje que no
  está en juego. ✅
- **Huecos**: 🕳️ sus faroles de información no aprovechan el grimorio que ha visto (podría
  inventar datos "perfectos", coherentes con quién es quién).
- **Prioridad**: **OK** (lo pendiente es general).

#### Mujer Escarlata (Scarlet Woman)
- **Wiki**: con 5 o más vivos, si muere el Demonio, ella pasa a serlo.
- **Hacemos**: al recibir "Eres el Diablillo" juega como Demonio. ✅
- **Huecos**: 🕳️ con 5+ vivos el equipo malvado no necesita salvar al Demonio a toda costa (y a
  veces le conviene que lo ejecuten para "limpiarse"). Hoy todos los malvados intentan salvarlo.
- **Prioridad**: **Baja**.

#### Barón (Baron)
- **Wiki**: +2 Forasteros (solo en la preparación).
- **Hacemos**: lo cubre el selector de personajes, no el simulador.
- **Huecos**: 🕳️ nadie razona "hay demasiados forasteros: hay Barón".
- **Prioridad**: **Baja**.

### Demonio

#### Diablillo (Imp)
- **Wiki**: mata cada noche salvo la primera. Si se mata a sí mismo, un esbirro vivo pasa a ser
  el Diablillo. Puede atacar a un muerto para reforzar un farol (por ejemplo de Soldado).
- **Hacemos**: mata a quien el pueblo más confía (por lo dicho en público), deja en paz al
  Soldado reclamado si piensa, y se pasa el demonio más a menudo cuando el pueblo sospecha de él.
  ✅ (3.40.0)
- **Huecos**: 🕳️ no evita a quien probablemente proteja el Monje. 🕳️ Nunca ataca a un muerto
  para sostener un farol.
- **Prioridad**: **Baja**.

---

## Bad Moon Rising

### Aldeanos

#### Abuela (Grandmother)
- **Wiki**: empieza sabiendo un buen jugador y su personaje (su nieto). Si el Demonio mata al
  nieto, ella también muere.
- **Hacemos**: confía plenamente en el nieto (−2). ✅
- **Huecos**: 🕳️ podría callarse quién es su nieto para no ponerlo en la diana del Demonio (hoy
  lo cuenta como cualquier otra información).
- **Prioridad**: **OK**.

#### Marinero (Sailor)
- **Wiki**: cada noche elige a un vivo: él o el elegido queda borracho. Sobrio, no puede morir.
  Si elige a un malvado, el Narrador suele emborrachar al Marinero.
- **Hacemos**: elige a quien más duda (repite el 30 %). ✅
- **Huecos**: 🕳️ un Marinero reclamado a veces se ofrece a ser ejecutado para "demostrarlo"
  (ejemplo de la wiki), y el Demonio debería evitar atacarlo.
- **Prioridad**: **Baja**.

#### Sirvienta (Chambermaid)
- **Wiki**: elige a dos vivos (no a sí misma) y sabe cuántos despertaron por su habilidad.
- **Hacemos**: elige a los que más duda. El número no se usa.
- **Huecos**: 🕳️ debería elegir a gente que reclama personajes que despiertan y cruzarlo ("dice
  ser el Exorcista y me salió 0": miente o está borracho).
- **Prioridad**: **Media** (sin cruzar, su información no sirve de nada en el simulador).

#### Posadero (Innkeeper)
- **Wiki**: elige a dos jugadores que no pueden morir esa noche; uno queda borracho.
- **Hacemos**: protege a los dos en quien más confía (nunca a sí mismo). ✅
- **Prioridad**: **OK**.

#### Tahúr (Gambler)
- **Wiki**: cada noche salvo la primera, elige a un jugador y adivina su personaje; si falla,
  muere. Puede elegir a muertos o a sí mismo.
- **Hacemos**: apuesta por alguien en quien cree, con el personaje que reclamó; o por el más
  sospechoso como Demonio si está bastante seguro. ✅
- **Huecos**: 🕳️ nunca apuesta sobre un muerto ni sobre sí mismo (las apuestas "seguras" que
  hacen los jugadores reales para no morir y seguir pareciendo el Tahúr).
- **Prioridad**: **Baja**.

#### Exorcista (Exorcist)
- **Wiki**: elige a un jugador (distinto a la noche anterior); si es el Demonio, este sabe quién
  es el Exorcista y no despierta. Ejemplo: elige al Pukka: no ataca, pero el envenenado de la
  noche anterior muere igualmente.
- **Hacemos**: elige a quien más duda, distinto a la noche anterior. ✅ El Demonio que recibe
  la tarjeta "este personaje te eligió" con el Exorcista ya lo empuja (+2).
- **Huecos**: 🕳️ el Demonio debería además querer matarlo esa o la siguiente noche.
  🕳️ El Exorcista no deduce nada de "nadie murió esta noche".
- **Prioridad**: **Baja**.

#### Chismoso (Gossip)
- **Wiki**: cada día puede hacer una declaración pública; si es verdad, esa noche muere alguien.
- **Hacemos**: declara "X es el Demonio" cuando duda o de vez en cuando. ✅
- **Huecos**: 🕳️ solo hay un tipo de frase. Las declaraciones típicas para sacar información
  ("hay un Asesino en juego", "mis dos vecinos son buenos") no existen.
- **Prioridad**: **Baja**.

#### Cortesano (Courtier)
- **Wiki**: una vez por partida elige un personaje (no un jugador): queda borracho 3 noches y 3
  días. No sabe si estaba en juego.
- **Hacemos**: 60 % un Demonio del guion al azar, si no un Esbirro.
- **Huecos**: 🕳️ podría deducir qué Demonio hay por las muertes (dos muertes por noche →
  Shabaloth; noche sin muertes → Po o Zombuul; muertes con retraso → Pukka).
- **Prioridad**: **Baja**.

#### Profesor (Professor)
- **Wiki**: una vez por partida, resucita a un muerto si es Aldeano.
- **Hacemos**: espera a que haya muertos y elige a quien cree que era un Aldeano. ✅
- **Prioridad**: **OK**.

#### Juglar (Minstrel) · Dama del té (Tea Lady) · Bufón (Fool) · Pacifista (Pacifist)
- **Wiki**: pasivos (todo lo resuelve el Narrador).
- **Hacemos**: los reclaman. La Dama del té aparece en la lista de "protectores" de
  `practiceBrain.js`, pero no elige nada, así que no tiene efecto.
- **Huecos**: 🕳️ los malvados no evitan a los vecinos buenos de la Dama del té ni al Bufón;
  🕳️ el Bufón y el Pacifista podrían ofrecerse para una ejecución.
- **Prioridad**: **Baja**.

### Forasteros

#### Matón (Goon)
- **Wiki**: el primero que lo elige de noche queda borracho y el Matón cambia a su bando.
- **Hacemos**: si el Narrador le manda "Eres el Matón" con el nuevo bando, se pone de ese lado. ✅
- **Prioridad**: **OK**.

#### Lunático (Lunatic)
- **Wiki**: cree ser el Demonio; ve "esbirros" y faroles que pueden ser falsos; el Demonio real
  sabe quién es y a quién elige.
- **Hacemos**: con la tarjeta "Eres el …" juega como Demonio: mata, farolea y protege a sus
  "esbirros". ✅ El Demonio real empuja al Lunático (+2), que es una estrategia válida.
- **Huecos**: 🕳️ el Demonio real no copia los ataques del Lunático (la wiki pone de ejemplo al
  Zombuul atacando a los mismos para sostener la ilusión).
- **Prioridad**: **OK**.

#### Manitas (Tinker)
- Pasivo; el Narrador decide. **OK**.

#### Niña de la luna (Moonchild)
- **Wiki**: al saber que ha muerto, elige en público a un vivo; si es bueno, muere esa noche.
- **Hacemos**: al morir (de día o al amanecer) elige en público: si es buena, a quien más duda; si
  es malvada, a quien el pueblo más confía. ✅
- **Prioridad**: **OK**.

### Esbirros

#### Padrino (Godfather)
- **Wiki**: sabe qué Forasteros hay; si uno muere de día, esa noche mata a alguien. Puede
  matarse a sí mismo para parecer bueno.
- **Hacemos**: cuando el Narrador le pide elegir, ataca como cualquier malvado. ✅
- **Huecos**: 🕳️ no usa la lista de Forasteros (quien reclame un Forastero que no está miente:
  probablemente un compañero o un bueno que farolea). 🕳️ Los malvados no empujan a ejecutar a
  Forasteros para activar al Padrino.
- **Prioridad**: **Baja**.

#### Abogado del Diablo (Devil's Advocate)
- **Wiki**: cada noche elige a un vivo (distinto a la anterior): si lo ejecutan mañana, no muere.
- **Hacemos**: protege al compañero del que más duda el pueblo (o a sí mismo). ✅
- **Prioridad**: **OK**.

#### Asesino (Assassin)
- **Wiki**: una vez por partida, de noche (salvo la primera), mata a alguien aunque esté protegido.
- **Hacemos**: si decide usarla (cada noche más probable), mata a quien el pueblo más confía.
- **Huecos**: 🕳️ debería ir a por quien el Demonio no puede matar: el Soldado o el Marinero
  reclamados, un vecino de la Dama del té, el Bufón, o alguien que claramente protege el Monje.
- **Prioridad**: **Media**.

#### Mente Maestra (Mastermind)
- **Wiki**: si el Demonio muere ejecutado, se juega un día más; si ese día ejecutan a un bueno,
  gana el mal.
- **Hacemos**: nada especial.
- **Huecos**: 🕳️ el día extra, los malvados deberían nominar y votar con fuerza a un bueno. Los
  buenos no saben que el Demonio ha muerto (el Narrador no lo dice), así que para ellos no
  cambia nada.
- **Prioridad**: **Baja**.

### Demonios

#### Zombuul
- **Wiki**: solo ataca si nadie murió hoy. La primera vez que muere, sigue vivo pero registra
  como muerto.
- **Hacemos**: ataca como cualquier demonio cuando el Narrador lo despierta.
- **Huecos**: 🕳️ los malvados no evitan matar de día para dejarle atacar; el Zombuul "muerto" no
  finge estar muerto de forma especial.
- **Prioridad**: **Baja**.

#### Pukka
- **Wiki**: actúa también la primera noche; su víctima queda envenenada y muere la noche siguiente.
- **Hacemos**: elige desde la primera noche y no repite víctima. ✅
- **Prioridad**: **OK**.

#### Shabaloth
- **Wiki**: mata a dos por noche; puede "regurgitar" a uno.
- **Hacemos**: elige a los dos en quien más confía el pueblo. ✅
- **Prioridad**: **OK**.

#### Po
- **Wiki**: puede no elegir a nadie; la noche siguiente elige a tres (y debe hacerlo).
- **Hacemos**: 20 % de noches no elige a nadie; la siguiente elige 3 (uno en la tarjeta, dos en
  el chat). ✅
- **Huecos**: lo esperado es "cargar" cuando hay un Monje/Posadero activo o antes del día final,
  no al azar.
- **Prioridad**: **Baja**.

---

## Sects & Violets

### Aldeanos

#### Relojero (Clockmaker)
- **Wiki**: empieza sabiendo cuántos pasos hay del Demonio a su Esbirro más cercano.
- **Hacemos**: lo dice; no cambia lo que piensa.
- **Huecos**: 🕳️ con un sospechoso fuerte de ser Esbirro, el número apunta a candidatos a Demonio.
- **Prioridad**: **Baja**.

#### Soñador (Dreamer)
- **Wiki**: elige a alguien (no a sí mismo ni a viajeros): ve un personaje bueno y uno malo, uno
  es el correcto. El Narrador puede mostrar el farol del malvado.
- **Hacemos**: elige a quien más duda; +1 de sospecha al elegido. ✅
- **Huecos**: 🐞 puede elegir a un viajero (la regla "no Travellers" no se lee). 🕳️ No cruza con
  lo reclamado: si el elegido reclama otro personaje distinto al bueno que salió, el malo es casi
  seguro.
- **Prioridad**: **Baja** (viajeros) / **Media** (cruce con reclamos).

#### Encantador de Serpientes (Snake Charmer)
- **Wiki**: elige a un vivo; si es el Demonio, se intercambian personaje y bando, y el antiguo
  Demonio queda envenenado.
- **Hacemos**: elige a quien más duda; si recibe "Eres el …" y el bando, juega como el nuevo
  Demonio. ✅
- **Prioridad**: **OK**.

#### Matemático (Mathematician)
- **Wiki**: cuántas habilidades funcionaron mal desde el amanecer.
- **Hacemos**: lo dice; no cambia nada.
- **Huecos**: 🕳️ un número alto debería hacer dudar de la información de esa noche.
- **Prioridad**: **Baja**.

#### Florista (Flowergirl)
- **Wiki**: cada noche salvo la primera, sabe si un Demonio votó hoy.
- **Hacemos**: lo dice; no cambia nada.
- **Huecos**: 🕳️ un "No" debería aliviar a todos los que votaron ese día y un "Sí" cargar sobre
  ellos. La app ya guarda quién votó (historial de votos).
- **Prioridad**: **Media**.

#### Pregonero (Town Crier)
- **Wiki**: cada noche salvo la primera, sabe si un Esbirro nominó hoy.
- **Hacemos**: lo dice; no cambia nada.
- **Huecos**: 🕳️ igual que la Florista, con quién nominó.
- **Prioridad**: **Media**.

#### Oráculo (Oracle)
- **Wiki**: cuántos muertos son malvados.
- **Hacemos**: lo dice; no cambia nada.
- **Huecos**: 🕳️ un "0" con un ejecutado del que se sospechaba mucho debería hacer replantear.
- **Prioridad**: **Baja**.

#### Erudito (Savant)
- **Wiki**: cada día puede visitar al Narrador y oír dos cosas: una verdadera y una falsa.
- **Hacemos**: cada día pide sus dos cosas por el chat privado. ✅
- **Huecos**: lo que contesta el Narrador es texto libre y el simulador no puede entenderlo; es
  un límite razonable. 🕳️ Un malvado que farolea de Erudito podría "ir a ver al Narrador" (la
  wiki dice que el Narrador le sigue el juego).
- **Prioridad**: **OK**.

#### Costurera (Seamstress)
- **Wiki**: una vez por partida, elige a dos (no a sí misma) y sabe si son del mismo bando.
- **Hacemos**: compara a uno de confianza con uno sospechoso; un "No" hace dudar de los dos. ✅
- **Huecos**: 🕳️ con un "No" y uno de los dos de confianza, debería cargar todo sobre el otro;
  con un "Sí", confiar algo más en ambos.
- **Prioridad**: **Baja**.

#### Filósofo (Philosopher)
- **Wiki**: una vez por partida elige un personaje bueno y gana su habilidad; si ese personaje
  está en juego, queda borracho.
- **Hacemos**: lo usa la primera noche casi siempre (80 %) con un Aldeano al azar del guion.
- **Huecos**: 🕳️ al azar; lo esperado es un personaje fuerte que falte, o el que reclama un
  sospechoso (para emborracharlo si miente). 🕳️ Si el Narrador no cambia su ficha en el grimorio,
  sigue jugando como Filósofo y no usa la habilidad ganada al elegir.
- **Prioridad**: **Baja**.

#### Artista (Artist)
- **Wiki**: una vez por partida, de día, pregunta en privado algo de sí o no.
- **Hacemos**: pregunta "¿X es el Demonio?" cuando duda (o al azar desde el día 3) y usa la
  respuesta. ✅
- **Prioridad**: **OK**.

#### Malabarista (Juggler)
- **Wiki**: el primer día adivina en público hasta 5 personajes; esa noche sabe cuántos acertó.
- **Hacemos**: lo hace el día 1 con lo que reclaman los que cree y un Demonio sobre el más
  sospechoso. ✅
- **Huecos**: 🕳️ el número de aciertos no se usa después.
- **Prioridad**: **Baja**.

#### Sabio (Sage)
- **Wiki**: si el Demonio lo mata, sabe que es uno de dos jugadores.
- **Hacemos**: +1,75 a cada uno de los dos. ✅
- **Prioridad**: **OK**.

### Forasteros

#### Mutante (Mutant)
- **Wiki**: si se muestra "loco" por ser Forastero, el Narrador puede ejecutarlo.
- **Hacemos**: nunca reclama un Forastero; farolea un Aldeano libre. ✅
- **Prioridad**: **OK**.

#### Adorable (Sweetheart) · Barbero (Barber)
- **Wiki**: pasivos al morir (un borracho para siempre; el Demonio puede intercambiar a dos).
- **Hacemos**: si el Narrador pide al Demonio elegir a dos por el Barbero, elige a dos buenos de
  confianza.
- **Huecos**: 🕳️ el Demonio con el Barbero no considera "no hacer nada" ni intercambiarse a sí
  mismo (ejemplos de la wiki).
- **Prioridad**: **Baja**.

#### Patoso (Klutz)
- **Wiki**: al saber que ha muerto elige en público a un vivo; si es malvado, su equipo pierde.
- **Hacemos**: elige en público a quien más confía. ✅
- **Prioridad**: **OK**.

### Esbirros

#### Gemela Malvada (Evil Twin)
- **Wiki**: ella y un bueno se conocen. Si ejecutan al bueno, gana el mal; el bien no puede
  ganar mientras vivan los dos. Ejemplo: "ambas reclaman ser el Oráculo".
- **Hacemos**: la gemela buena sospecha mucho de la malvada (+3) y la malvada empuja a la buena
  (+2). ✅
- **Huecos**: 🕳️ la malvada farolea un aldeano cualquiera en lugar del personaje de su gemela
  buena. (Que el pueblo sospeche de "dos dicen ser lo mismo" ya funciona desde la 3.40.0.)
- **Prioridad**: **Media**.

#### Bruja (Witch)
- **Wiki**: maldice a uno: si nomina mañana, muere.
- **Hacemos**: maldice a quien el pueblo más confía.
- **Huecos**: lo esperado es maldecir a quien más nomina o va a nominar (los más activos). Es
  una variación aceptable.
- **Prioridad**: **Baja**.

#### Cerenovus
- **Wiki**: elige a un jugador y un personaje bueno: mañana debe convencer de que es ese
  personaje o puede ser ejecutado.
- **Hacemos**: elige jugador y personaje (a menudo uno que otro reclamó, para crear conflicto); el
  loco lo reclama y no dice nada más. ✅
- **Prioridad**: **OK**.

#### Pit-Hag
- **Wiki**: cambia a un jugador a un personaje que no esté en juego; si crea un Demonio, las
  muertes de esa noche son arbitrarias.
- **Hacemos**: suele convertir a alguien en un Forastero que nadie reclamó; desde la noche 3, a
  veces convierte a un compañero en Demonio. ✅
- **Prioridad**: **OK**.

### Demonios

#### No Dashii
- **Wiki**: sus dos Aldeanos vecinos más cercanos (saltando Forasteros y Esbirros, vivos o
  muertos) están envenenados.
- **Hacemos**: no mata a sus vecinos vivos, para no malgastar el veneno. ✅
- **Huecos**: los envenenados son los Aldeanos más cercanos, no los vecinos vivos; pero el No
  Dashii tampoco sabe quién es Aldeano, así que es una aproximación razonable.
- **Prioridad**: **OK**.

#### Vigormortis
- **Wiki**: los Esbirros que mata conservan la habilidad y envenenan a un Aldeano vecino.
- **Hacemos**: a veces (10 %) mata a uno de sus esbirros. ✅
- **Prioridad**: **OK**.

#### Vortox
- **Wiki**: toda la información de Aldeanos es falsa; si un día no hay ejecución, gana el mal.
- **Hacemos**: con el Vortox **en el guion** y nadie a punto de morir, en el último aviso nominan
  y votan mucho antes. Sin días de prudencia.
- **Huecos**: 🕳️ si un día acaba sin ejecución y la partida sigue, ya se sabe que no hay Vortox,
  pero lo siguen haciendo. 🕳️ No sospechan que su información sea falsa (información
  contradictoria con todo lo demás apunta al Vortox).
- **Prioridad**: **Media** (con S&V afecta a todos los días).

#### Fang Gu
- **Wiki**: el primer Forastero que mata pasa a ser un Fang Gu malvado y el viejo muere.
- **Hacemos**: a veces salta a un Forastero reclamado (más si el pueblo sospecha de él). ✅
- **Prioridad**: **OK**.

---

## Viajeros (si los usáis en la práctica)

La práctica reparte personajes de la bolsa; los viajeros solo aparecen si el Narrador los añade.
Ninguno tiene comportamiento propio de día:

| Viajero | Wiki | Hoy | Prioridad |
|---|---|---|---|
| Obispo (Bishop) | Solo el Narrador nomina | 🐞 los jugadores siguen nominando | Media |
| Voudon | Solo votan los muertos y el Voudon | 🐞 votan también los vivos | Media |
| Mendigo (Beggar) | Necesita fichas de voto de los muertos | 🐞 vota como cualquiera | Baja |
| Pistolero (Gunslinger) | Tras el primer recuento, puede matar a un votante | 🕳️ nunca dispara | Baja |
| Juez (Judge) | Una vez fuerza que una ejecución pase o falle | 🕳️ nunca lo usa | Baja |
| Carnicero (Butcher) | Tras la primera ejecución puede nominar otra vez | 🕳️ nunca lo usa | Baja |
| Institutriz (Matron) | Intercambia asientos | 🕳️ nunca lo usa | Baja |
| Burócrata / Ladrón | Voto ×3 / voto negativo a alguien | elige al azar (Burócrata debería elegir a un aliado; Ladrón a un rival) | Baja |
| Meretriz (Harlot) | El elegido decide si se revela | el "sí/no" es una tirada que no mira el personaje (un Demonio puede revelarse) | Baja |
| Coleccionista de Huesos | Devuelve la habilidad a un muerto | elige como el Profesor (un muerto en quien cree) ✅ | OK |
| Resto (Barista, Aprendiz, Chivo expiatorio, Pervertido) | Los resuelve el Narrador | — | OK |

El destierro de viajeros se vota con una moneda al aire (50 %). Lo esperado es desterrar al
viajero del que se sospecha.

---

## Interacciones entre personajes y comportamiento general

Lo que no depende de un solo personaje pero la wiki da por hecho:

1. **Compartir y usar información pública**: ✅ resuelto en la 3.40.0.
2. **Faroles con información** (Media): ✅ para 6 personajes de TB; falta el resto (ver resumen).
3. **Contradicciones de reclamo**: ✅ resuelto en la 3.40.0.
4. **Cuentas de Forasteros** (Baja): más Forasteros reclamados de lo normal apunta al Barón, al
   Padrino o al Fang Gu; menos, al Vigormortis o al Padrino.
5. **Lo que nadie ve de noche**: ✅ resuelto en la 3.40.0 (los malvados leen solo lo dicho en
   la plaza).
6. **Historial de votos y nominaciones** (Media): quién votó a quién no se usa nunca, ni por la
   Florista y el Pregonero ni por el pueblo en general ("siempre vota para salvar a X").
7. **Protegidos que el Demonio evita** (Media): ✅ el Soldado reclamado (3.40.0); faltan el
   Marinero, los vecinos de la Dama del té y el que protege el Monje. Y el Asesino justo al revés.
8. **Ejecuciones que se pueden pedir** (Baja): el Bufón, el Marinero, el Pacifista y a veces el
   Santo falso se ofrecen o se dejan ejecutar para demostrar algo.

---

## Propuesta de orden de trabajo

Lo de prioridad alta ya está hecho en la 3.40.0. Para lo que queda, recomiendo este orden (cada
bloque es una mejora pequeña que se puede probar por separado):

1. Florista y Pregonero con el historial de votos y nominaciones (y, de paso, el Enterrador y el
   Oráculo contra lo reclamado por los ejecutados).
2. El Asesino va a por quien el Demonio no puede matar.
3. El Vortox: recordar el día sin ejecución.
4. La Gemela Malvada reclama el personaje de su gemela.
5. Faroles con información para los roles de información de BMR y S&V.
6. Sirvienta, Relojero, Chef y Matemático usando su número.
7. Viajeros (Obispo y Voudon primero, porque hoy rompen una regla) y el resto de prioridad baja.

## Lo que no he podido comprobar

He leído el código y la wiki, no he jugado partidas de práctica para este informe. Algunos
comportamientos dependen de qué tarjetas mande el Narrador (por ejemplo, si al Filósofo se le
cambia la ficha en el grimorio o no), así que conviene confirmarlos en una partida real.
