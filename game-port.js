/* ===========================================================================
 * game-port.js  -  MENU "PORTO" INTERATIVO + VIAGEM ENTRE ARCOS
 * Carregado por ÚLTIMO (depois de game.js, game-updates.js e game-polish.js).
 *
 * ÍNDICE DESTE ARQUIVO
 *   1) SHIP_SVG ............ desenho do navio (usado no menu e na viagem)
 *   2) PORT_MENU_BUTTONS ... lista dos botões do menu (emoji, nome, ação, cores do hover)
 *   3) class PortMenu ...... monta a tela inicial: céu, mar, navio, painel do jogador e botões
 *   4) menu() / portShipClick() ... funções chamadas pelo resto do jogo
 *   5) sail() .............. animação de viagem quando você troca de arco no mapa
 *   6) menu() final ........ primeira renderização do jogo
 *
 * FLUXO: index.html carrega os scripts -> este arquivo chama menu() -> o jogador
 * escolhe um botão -> a tela correspondente (story, pvpSetup, navy...) é desenhada.
 * =========================================================================== */

/* ----------------------------- 1. DESENHO DO NAVIO ------------------------ */
const SHIP_SVG = `<svg class="ship-svg" viewBox="0 0 220 170">
  <path d="M18 104Q10 80 34 74L44 86Q36 90 38 102z" fill="#9a6a34" stroke="#3a2410" stroke-width="3"/>   <!-- proa enrolada -->
  <path d="M30 98H196L176 146H58Q40 126 30 98z" fill="#c98a45" stroke="#3a2410" stroke-width="3"/>        <!-- casco -->
  <path d="M38 112H190M46 126H182" stroke="#8a5a2b" stroke-width="3"/>                                     <!-- tábuas -->
  <circle cx="84" cy="120" r="4" fill="#3a2410"/><circle cx="110" cy="120" r="4" fill="#3a2410"/><circle cx="136" cy="120" r="4" fill="#3a2410"/>
  <rect x="106" y="22" width="7" height="78" fill="#6b4423" stroke="#3a2410" stroke-width="2"/>           <!-- mastro -->
  <path d="M58 40H160" stroke="#6b4423" stroke-width="6" stroke-linecap="round"/>                          <!-- verga -->
  <path d="M62 44Q110 62 106 104H66Q56 76 62 44z" fill="#ffffff" stroke="#8aa0b0" stroke-width="2"/>       <!-- vela esquerda -->
  <path d="M113 44Q160 56 158 100H113z" fill="#f4f8fb" stroke="#8aa0b0" stroke-width="2"/>                 <!-- vela direita -->
  <path d="M74 52V98M86 56V100M98 58V102M126 54V98M138 54V98M150 56V96" stroke="#cfdbe4" stroke-width="2"/>
  <path d="M113 24L150 12L113 2z" fill="#111"/><circle cx="124" cy="12" r="3.4" fill="#fff"/>              <!-- bandeira pirata -->
</svg>`;

/* --------------------------- 2. BOTÕES DO MENU ---------------------------- */
/** emoji = ícone | label = nome | action = função chamada ao clicar | hoverFrom/hoverTo = cores ao passar o mouse. */
const PORT_MENU_BUTTONS = {
  right: [ // coluna da direita (como MAPS / PUB / ARENA da imagem de referência)
    { emoji: "🗺️", label: "Mapas", action: "story()", hoverFrom: "#5fe0ff", hoverTo: "#1a7fb0" },
    { emoji: "⚔️", label: "Arena", action: "pvpSetup()", hoverFrom: "#ff8a7a", hoverTo: "#c8231c" },
    { emoji: "⚓", label: "Marinha", action: "navy()", hoverFrom: "#9ab8ff", hoverTo: "#2a4aa8" },
    { emoji: "🍈", label: "Gacha", action: "gacha()", hoverFrom: "#d9a2ff", hoverTo: "#7a2fc8" }
  ],
  bottom: [ // linha de baixo (como TEAM / BAG / INFO / SHOP / SET da imagem)
    { emoji: "👥", label: "Equipe", action: "showCrewScreen()", hoverFrom: "#8affb0", hoverTo: "#1a9a4a" },
    { emoji: "🧬", label: "Raças", action: "showRaceScreen()", hoverFrom: "#ffc26a", hoverTo: "#d8601a" },
    { emoji: "🏆", label: "Conquistas", action: "showAchievements()", hoverFrom: "#ffe27a", hoverTo: "#d8a21a" },
    { emoji: "🔊", label: "Som", action: "tg()", hoverFrom: "#7ff3ff", hoverTo: "#1a8aa8" }
  ]
};

/* -------------------------------- 3. MENU --------------------------------- */
class PortMenu {
  /** Frases que o navio "fala" quando você clica nele. */
  static shipPhrases = ["Vamos para a Grand Line!", "Eu vou ser o Rei dos Piratas!", "Yohohoho!", "Hora da aventura!", "Terra à vista!", "Nakama são tudo!"];

  /** Texto da "Meta" (botão dourado como o GOAL da referência): próxima conquista ou aviso de resgate. */
  static nextGoalText() {
    if (claimableAchievementCount() > 0) return "🎁 Resgate suas conquistas!";
    const nextAchievement = ACHIEVEMENTS.find((achievement) => !S.achievements[achievement.id]);
    return nextAchievement ? `🎯 ${nextAchievement.name}: ${Math.min(nextAchievement.goal, nextAchievement.progress(S))}/${nextAchievement.goal}` : "🎯 Todas as metas cumpridas!";
  }

  /** HTML de um botão; o badge (bolinha vermelha) aparece nas Conquistas quando há prêmio para resgatar. */
  static buttonMarkup(button) {
    const badgeCount = button.label === "Conquistas" ? claimableAchievementCount() : 0;
    return `<button class="port-btn" style="--hoverFrom:${button.hoverFrom};--hoverTo:${button.hoverTo}" onclick="${button.action}"><span class="port-btn-icon">${button.emoji}</span><span>${button.label}</span>${badgeCount ? `<i class="port-badge">${badgeCount}</i>` : ""}</button>`;
  }

  /** Desenha a tela inicial inteira. */
  static render() {
    setMode(0);
    VA = -1; // o mapa volta a mostrar o arco atual
    const experienceNeeded = need(S.lv), bounty = (S.lv * 8 + S.wins * 5 + Object.keys(S.fr).length * 3) * 1000000;
    const clouds = [0, 1, 2, 3].map((index) => `<span class="port-cloud" style="top:${4 + index * 9}%;animation-duration:${34 + index * 12}s;animation-delay:-${index * 11}s">☁️</span>`).join("");
    const birds = [0, 1].map((index) => `<span class="port-bird" style="top:${16 + index * 8}%;animation-delay:-${index * 6}s">🕊️</span>`).join("");
    const waves = [0, 1, 2].map((index) => `<i class="port-wave" style="bottom:${index * 11}%;opacity:${0.35 + index * 0.2};animation-duration:${9 - index * 2}s"></i>`).join("");
    app.innerHTML = `<div class="port">
      <div class="port-rays"></div>${clouds}${birds}
      <div class="port-sea">${waves}</div>
      <div class="port-ship" onclick="portShipClick()">${SHIP_SVG}<div class="port-bubble"></div></div>
      <div class="port-hud">
        <button class="port-avatar" onclick="showRaceScreen()" aria-label="Seu personagem">${stick(S.sk, 0, 0, 0)}</button>
        <div class="port-hud-info"><b>Capitão Lv.${S.lv}</b>
          <div class="bar"><i style="width:${100 * S.xp / experienceNeeded}%"></i></div><small>EXP ${S.xp}/${experienceNeeded}</small>
          <div class="port-wallet"><span class="by">฿ ${S.b}</span> <span class="gmz">💎 ${S.g}</span></div>
          <small>Recompensa: ฿ ${bounty.toLocaleString("pt-BR")}</small></div>
      </div>
      <button class="port-goal" onclick="showAchievements()">${PortMenu.nextGoalText()}</button>
      <div class="port-right">${PORT_MENU_BUTTONS.right.map(PortMenu.buttonMarkup).join("")}</div>
      <div class="port-bottom">${PORT_MENU_BUTTONS.bottom.map(PortMenu.buttonMarkup).join("")}</div>
    </div>`;
  }
}

/** Substitui o menu() antigo: todo o resto do jogo continua chamando menu() para voltar ao porto. */
function menu() { PortMenu.render(); }

/** Clique no navio: ele pula e solta uma frase (parte interativa do menu). */
function portShipClick() {
  const ship = document.querySelector(".port-ship"), bubble = document.querySelector(".port-bubble");
  if (!ship || !bubble) return;
  bubble.textContent = PortMenu.shipPhrases[Math.floor(Math.random() * PortMenu.shipPhrases.length)];
  bubble.classList.remove("show");
  ship.classList.remove("jump");
  void ship.offsetWidth; // força o navegador a reiniciar as animações
  ship.classList.add("jump");
  bubble.classList.add("show");
  if (typeof AC !== "undefined" && AC && mus) [523, 659, 784].forEach((frequency, index) => setTimeout(() => nt(frequency, 0.25, "triangle", 0.12), index * 90));
}

/* ------------------------ 5. VIAGEM ENTRE ARCOS --------------------------- */
/**
 * Animação em tela cheia quando você troca de arco (ou volta para um arco anterior).
 * Camadas: céu que muda de cor, sol/lua, nuvens, pássaros, ilha do destino chegando,
 * três ondas em parallax, navio com esteira de espuma, cartão com o nome do arco e barra de viagem.
 * Indo para frente o navio vai da esquerda para a direita; voltando, ele navega espelhado ao contrário.
 */
function sail(fromArcIndex, toArcIndex, onArrival) {
  const isForward = toArcIndex > fromArcIndex, fromTheme = TH[fromArcIndex], toTheme = TH[toArcIndex];
  const isNightArc = toArcIndex === 8; // Thriller Bark é noturno
  const clouds = [0, 1, 2, 3, 4].map((index) => `<span class="voyage-cloud" style="top:${3 + index * 8}%;animation-duration:${10 + index * 4}s;animation-delay:-${index * 3}s">☁️</span>`).join("");
  const birds = [0, 1, 2].map((index) => `<span class="voyage-bird" style="top:${18 + index * 7}%;animation-delay:-${index * 1.6}s">🕊️</span>`).join("");
  const waves = [0, 1, 2].map((index) => `<i class="port-wave" style="bottom:${index * 12}%;opacity:${0.4 + index * 0.2};animation-duration:${5 - index}s"></i>`).join("");
  document.body.insertAdjacentHTML("beforeend", `<div id="sail" class="voyage${isForward ? "" : " bk"}" style="--shipFrom:${isForward ? -32 : 100}%;--shipTo:${isForward ? 54 : 6}%;--islandFrom:${isForward ? 112 : -46}%;--islandTo:${isForward ? 66 : 4}%">
    <div class="voyage-sky" style="background:linear-gradient(${fromTheme[0]},${fromTheme[1]})"></div>
    <div class="voyage-sky voyage-sky-to" style="background:linear-gradient(${toTheme[0]},${toTheme[1]})"></div>
    <div class="voyage-sun">${isNightArc ? "🌕" : "☀️"}</div>${clouds}${birds}
    <div class="voyage-island">${toTheme[2].join("")}</div>
    <div class="voyage-sea">${waves}</div>
    <div class="voyage-ship"><div class="voyage-ship-inner">${SHIP_SVG}</div><i class="voyage-wake"></i></div>
    <div class="voyage-title"><small>ARCO ${toArcIndex + 1}</small><h2>${ARC[toArcIndex][0]}</h2><small>${isForward ? "Zarpando de" : "Voltando de"} ${ARC[fromArcIndex][0]}</small></div>
    <div class="voyage-progress"><i></i></div><small class="voyage-skip">toque para pular</small></div>`);
  if (typeof AC !== "undefined" && AC && mus) [392, 494, 587, 784].forEach((frequency, index) => setTimeout(() => nt(frequency, 0.4, "triangle", 0.12), 2400 + index * 140)); // fanfarra de chegada
  let finished = false;
  const finishVoyage = () => {
    if (finished) return;
    finished = true;
    const voyage = document.querySelector("#sail");
    if (voyage) voyage.remove();
    if (onArrival) onArrival();
  };
  document.querySelector("#sail").onclick = finishVoyage; // toque para pular
  setTimeout(finishVoyage, 3800);
}

/* --------------------------- 6. PRIMEIRA TELA ----------------------------- */
menu(); // única chamada inicial: todos os módulos já foram carregados
