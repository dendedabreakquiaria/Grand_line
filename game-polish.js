/* ===========================================================================
 * game-polish.js  -  "Grand Line Deluxe" (nomes completos, classes e comentários)
 * Carregado DEPOIS de game.js e game-updates.js.
 *
 * O QUE ESTE MÓDULO ADICIONA
 *   1) TRIPULAÇÃO (Nakama): Zoro, Nami, Usopp, Sanji, Chopper, Robin, Franky, Brook e Jinbe
 *      entram na luta como golpe de apoio e dão bônus de dano.
 *   2) STATUS DE COMBATE: queimadura, congelamento, choque e veneno ligados aos elementos.
 *   3) SENSAÇÃO DE COMBATE: golpes críticos, números de dano flutuantes, vibração, turno ativo
 *      destacado e animação de nocaute.
 *   4) CARTAZES DE PROCURADO: tela "VS" antes de cada luta, com recompensa (bounty).
 *   5) CONQUISTAS: objetivos que dão gemas para rolar títulos.
 *
 * FLUXO DE UMA JOGADA:  act() -> hit() -> applyStatusFromAttack() -> fx() -> next()
 *   next() -> beginTurn() (haki, recarga, veneno/queimadura, atordoamento) -> draw()
 * =========================================================================== */

/* ------------------------------ 1. TRIPULAÇÃO ---------------------------- */

/** Quantos turnos um nakama precisa esperar para ser chamado de novo. */
const CREW_COOLDOWN_TURNS = 4;

/** progressRequired = waves vencidas na História (arco * 30 + wave) necessárias para o nakama entrar. */
const CREW_MEMBERS = [
  { id: "zoro", name: "Zoro", emoji: "⚔️", progressRequired: 6, moveName: "Santoryu: Oni Giri", effectVariant: 23, effectColor: "#7dff9a", effectEmoji: "🗡️", basePower: 40, element: "fisico", description: "Três cortes simultâneos." },
  { id: "nami", name: "Nami", emoji: "🌩️", progressRequired: 40, moveName: "Thunderbolt Tempo", effectVariant: 13, effectColor: "#4fb3ff", effectEmoji: "⚡", basePower: 36, element: "raio", description: "Raios do Clima-Tact." },
  { id: "usopp", name: "Usopp", emoji: "🎯", progressRequired: 75, moveName: "Fogo Estrela Verde", effectVariant: 2, effectColor: "#9aff7a", effectEmoji: "⭐", basePower: 34, element: "fogo", description: "Chuva de estrelas explosivas." },
  { id: "sanji", name: "Sanji", emoji: "🦵", progressRequired: 110, moveName: "Diable Jambe", effectVariant: 21, effectColor: "#ff7a1a", effectEmoji: "🔥", basePower: 46, element: "fogo", description: "Chute em chamas." },
  { id: "chopper", name: "Chopper", emoji: "🩺", progressRequired: 150, moveName: "Rumble Ball", effectVariant: 3, effectColor: "#ff9ec8", effectEmoji: "💊", basePower: 0, healFraction: 0.25, hakiRestore: 30, description: "Cura 25% da vida e restaura haki." },
  { id: "robin", name: "Robin", emoji: "🖐️", progressRequired: 190, moveName: "Mil Fleur", effectVariant: 15, effectColor: "#d9a2ff", effectEmoji: "🌸", basePower: 48, element: "fisico", stunChance: 0.4, description: "Mãos gigantes; 40% de atordoar." },
  { id: "franky", name: "Franky", emoji: "🤖", progressRequired: 230, moveName: "Radical Beam", effectVariant: 1, effectColor: "#4fd2ff", effectEmoji: "🔷", basePower: 54, element: "raio", description: "Feixe de energia." },
  { id: "brook", name: "Brook", emoji: "💀", progressRequired: 265, moveName: "Hanauta Sanchou: Yahazu Giri", effectVariant: 26, effectColor: "#bfe8ff", effectEmoji: "🌙", basePower: 52, element: "gelo", hakiRestore: 25, description: "Corte gélido; restaura haki." },
  { id: "jinbe", name: "Jinbe", emoji: "🦈", progressRequired: 285, moveName: "Soco de Mil Telhas", effectVariant: 24, effectColor: "#7fd6ff", effectEmoji: "🌊", basePower: 62, element: "fisico", description: "Onda de choque do Karatê Homem-Peixe." }
];

/** Progresso total na História: waves já vencidas somando todos os arcos. */
function storyProgress() { return S.arc * 30 + (S.wave - 1) + (S.done ? 30 : 0); }

/** Nakama já desbloqueados pelo progresso atual. */
function unlockedCrewMembers() { return CREW_MEMBERS.filter((member) => storyProgress() >= member.progressRequired); }

/** Chamado ao vencer uma wave: devolve o texto de aviso se alguém novo entrou na tripulação. */
function checkCrewUnlocks() {
  const newMembers = unlockedCrewMembers().filter((member) => !S.crewSeen.includes(member.id));
  if (!newMembers.length) return "";
  newMembers.forEach((member) => S.crewSeen.push(member.id));
  return " 🎉 Entrou na tripulação: " + newMembers.map((member) => member.emoji + " " + member.name).join(", ") + "!";
}

/** Botões de nakama mostrados na batalha (só para quem tem tripulação, ou seja, o jogador na História). */
function crewButtonsMarkup(fighter) {
  if (!fighter.crew || !fighter.crew.length) return "";
  const buttons = fighter.crew.map((member) => {
    const cooldown = (fighter.crewCooldown || {})[member.id] || 0;
    return `<button class="chip" ${cooldown ? "disabled" : ""} onclick="callCrewMember('${member.id}')">${member.emoji} ${member.name}${cooldown ? " ⏳" + cooldown : ""}</button>`;
  }).join("");
  return `<div class="chips crew-row"><b>Nakama:</b>${buttons}</div>`;
}

/* ------------- 1b. NAKAMA EM CENA: ROUPA DO ANIME, ENTRADA E GOLPE ------------- */

/** Momento (ms) em que o nakama investe e dispara o golpe, e duração total até passar o turno. */
const CREW_STRIKE_DELAY_MS = 850, CREW_TURN_DURATION_MS = 1900;

/** Aparência de cada nakama: reaproveita as peças do personagem + cores exatas do anime. */
Object.assign(BOSS_SKIN_DEFINITIONS, {
  "Zoro": buildBossSkin(0, 1, 5, 4, 3, 0, 3, { hairColor: "#3f9b4a" }),
  "Nami": buildBossSkin(0, 4, 5, 0, 0, 0, 0, { hairColor: "#f08a24", shirtColor: "#4fa8e8", pantsColor: "#2a5bd7" }),
  "Usopp": buildBossSkin(0, 5, 5, 0, 0, 0, 0, { hairColor: "#2a1a0a", shirtColor: "#e8a23a", pantsColor: "#3a7d44" }),
  "Sanji": buildBossSkin(0, 2, 5, 3, 3, 0, 0, { hairColor: "#f2d36b" }),
  "Chopper": buildBossSkin(5, 0, 2, 0, 0, 0, 0, { skinColor: "#c8905a", hairColor: "#8a5a2a", hatColor: "#ff9ec8", shirtColor: "#8a5a2a", pantsColor: "#2a5bd7" }),
  "Robin": buildBossSkin(0, 4, 5, 0, 3, 0, 0, { hairColor: "#111111", shirtColor: "#7a3f9a", pantsColor: "#1d1d1f" }),
  "Franky": buildBossSkin(6, 1, 5, 0, 0, 0, 0, { hairColor: "#2a8fff", shirtColor: "#ff7a3a", pantsColor: "#2a64a8", skinColor: "#f0c8a0" }),
  "Brook": buildBossSkin(0, 5, 1, 3, 3, 0, 0, { hairColor: "#111111", hatColor: "#14141a", skinColor: "#f4f4ee" }),
  "Jinbe": buildBossSkin(1, 0, 5, 4, 0, 0, 0, { hairColor: "#1d3f61", shirtColor: "#2a5aa8", skinColor: "#5f9dbf" })
});

/** Dois desenhos de arma novos (índices 11 e 12 em SD2): Clima-Tact da Nami e Kabuto (estilingue) do Usopp. */
SD2.push(
  `<rect x="-14" y="-1.6" width="46" height="3.2" fill="#d8d8e0" stroke="#556"/><circle cx="32" r="3.6" fill="#4fb3ff"/><circle cx="-14" r="3" fill="#ffd34d"/>`,
  `<rect x="-8" y="-1.5" width="10" height="3" fill="#6b4423"/><path d="M2 0L18-9M2 0L18 9" stroke="#6b4423" stroke-width="3" fill="none"/><path d="M18-9Q8 0 18 9" stroke="#c8231c" stroke-width="1.5" fill="none"/>`
);

/** Arma que cada nakama segura (Zoro usa a Wado Ichimonji do catálogo). */
function crewWeaponFor(member) {
  if (member.id === "zoro") return SW.find((sword) => sword.n === "Wado Ichimonji");
  if (member.id === "nami") return { d: 11, c: "#4fb3ff" };
  if (member.id === "usopp") return { d: 12, c: "#6b4423" };
  return 0;
}

/** Desenho do nakama com a roupa do anime (usado na batalha e na tela da Tripulação). */
function crewPortraitMarkup(member) {
  const skin = BossSkinLibrary.skinFor(member.name, { r: 0, hr: 0, h: 5, s: 0, o: 0, c: 0, sc: 0, hk: 0 });
  return stick(skin, crewWeaponFor(member), 0, 0);
}

/** Entrada em cena: aura colorida, nakama deslizando, banner com o nome do golpe. A CSS .crew-cameo faz a investida. */
function showCrewCameo(member, attackerSide) {
  const stage = document.querySelector(".stage");
  if (!stage) return;
  stage.insertAdjacentHTML("beforeend", `<div class="crew-layer"><div class="crew-cameo${attackerSide ? " r" : ""}" style="--dir:${attackerSide ? -1 : 1};--c:${member.effectColor};${attackerSide ? "right" : "left"}:6%"><div class="crew-aura"></div>${crewPortraitMarkup(member)}<b class="crew-name">${member.name}</b></div><div class="move-banner" style="--c:${member.effectColor}">${member.emoji} ${member.moveName}</div></div>`);
}

/** No instante da investida: efeito principal do golpe + explosão de partículas + número de dano/cura. */
function performCrewAttackEffects(member, attackerSide, targetSide, numberText, numberClass, hitSomeone) {
  fx(member.effectVariant, attackerSide, targetSide, member.effectEmoji, member.effectColor);
  const effectsLayer = document.querySelector("#fx");
  if (effectsLayer) {
    const targetX = VisualEffectsDirector.positionOf(targetSide);
    let particlesMarkup = "";
    for (let index = 0; index < 14; index++) {
      const angle = Math.random() * Math.PI * 2, distance = 40 + Math.random() * 80;
      particlesMarkup += `<b class="vfx-particle" style="left:${targetX}%;--travelX:${Math.cos(angle) * distance}px;--travelY:${Math.sin(angle) * distance}px;animation-delay:${0.05 + Math.random() * 0.15}s">${index % 2 ? member.effectEmoji : member.emoji}</b>`;
    }
    effectsLayer.insertAdjacentHTML("beforeend", particlesMarkup);
  }
  setTimeout(() => {
    const targetFigure = document.querySelector("#f" + targetSide + " .fig");
    if (hitSomeone && targetFigure) targetFigure.classList.add("rc");
    spawnFloatingText(targetSide, numberText, numberClass);
  }, 380);
}

/** Chama um nakama: o resultado (dano/cura) é calculado na hora; o nakama aparece, investe e some. */
function callCrewMember(memberId) {
  if (B.busy || B.over) return;
  const attacker = B.p[B.t], defender = B.p[1 - B.t], currentBattle = B, attackerSide = B.t;
  const member = CREW_MEMBERS.find((candidate) => candidate.id === memberId);
  if (!member || !attacker.crew || (attacker.crewCooldown || {})[memberId]) return;
  attacker.crewCooldown = attacker.crewCooldown || {};
  attacker.crewCooldown[memberId] = CREW_COOLDOWN_TURNS;
  let message = `${member.emoji} ${member.name} entra na luta: ${member.moveName}!`, damage = 0, numberText = "", numberClass = "crew";
  if (member.healFraction) { // Chopper cura em vez de atacar
    const healAmount = Math.round(attacker.max * member.healFraction);
    attacker.hp = Math.min(attacker.max, attacker.hp + healAmount);
    message += ` (+${healAmount} de vida)`;
    numberText = "+" + healAmount; numberClass = "heal";
  } else {
    const elementMultiplier = mult(member.element, defender.f ? defender.f.el : "fisico");
    damage = member.basePower * attacker.atk * (1 + S.lv * 0.03) * elementMultiplier * (0.9 + Math.random() * 0.2) * (1 - Math.min(0.7, defender.def));
    if (member.element === "fisico" && defender.f && defender.f.t === "Logia" && !attacker.arm) { damage *= 0.25; message += " (Logia intangível!)"; }
    damage = Math.round(damage);
    defender.hp = Math.max(0, defender.hp - damage);
    message += ` (-${damage})`;
    numberText = "-" + damage;
    if (member.stunChance && Math.random() < member.stunChance) { defender.stun = 1; message += " Atordoado!"; }
  }
  if (member.hakiRestore) attacker.hk = Math.min(100, attacker.hk + member.hakiRestore);
  B.log.push(message);
  B.hit = damage ? 1 - attackerSide : -1;
  B.busy = 1;
  showCrewCameo(member, attackerSide); // 1) o nakama entra em cena
  const targetSide = member.healFraction ? attackerSide : 1 - attackerSide;
  setTimeout(() => { if (B === currentBattle) performCrewAttackEffects(member, attackerSide, targetSide, numberText, numberClass, damage > 0); }, CREW_STRIKE_DELAY_MS); // 2) investida e golpe
  setTimeout(() => { currentBattle.busy = 0; if (B === currentBattle) next(); }, CREW_TURN_DURATION_MS); // 3) passa o turno
}

/** Tela com todos os nakama, o golpe de cada um e como desbloquear. */
function showCrewScreen() {
  setMode(0);
  const unlockedIds = unlockedCrewMembers().map((member) => member.id);
  const cards = CREW_MEMBERS.map((member) => {
    const unlocked = unlockedIds.includes(member.id);
    const requirement = `Chegue à wave ${member.progressRequired % 30 + 1} do arco ${Math.floor(member.progressRequired / 30) + 1}`;
    return `<div class="card" style="border-color:${unlocked ? "#3ddc84" : "#888"}"><div class="prev">${crewPortraitMarkup(member)}</div><h3>${member.emoji} ${member.name}</h3><b>${member.moveName}</b><p>${member.description}</p>${unlocked ? "<b>✓ Na tripulação</b>" : `<span class="off">${requirement}</span>`}</div>`;
  }).join("");
  app.innerHTML = back() + `<h2>Tripulação</h2><div class="card"><small>Os nakama entram na luta como golpe de apoio (recarga de ${CREW_COOLDOWN_TURNS} turnos) e cada um dá +2% de dano. Eles se juntam conforme você avança na História.</small></div><div class="two">${cards}</div>`;
}

/* --------------------------- 2. STATUS DE COMBATE ------------------------- */

/** Elemento do golpe -> status que ele pode causar. */
const ELEMENT_STATUS_EFFECTS = {
  fogo: { statusName: "burn", icon: "🔥", chance: 0.35, turns: 3, label: "queimadura" },
  gelo: { statusName: "freeze", icon: "❄️", chance: 0.22, turns: 1, label: "congelamento" },
  raio: { statusName: "shock", icon: "⚡", chance: 0.25, turns: 1, label: "choque" }
};
/** Frutas Doku Doku envenenam em vez de usar o status do elemento. */
const POISON_EFFECT = { statusName: "poison", icon: "☠️", chance: 0.5, turns: 4, label: "veneno" };

/** Depois de um golpe que causou dano, tenta aplicar um status no defensor. */
function applyStatusFromAttack(attacker, defender, attack, damageDealt) {
  if (damageDealt <= 0 || defender.hp <= 0) return;
  const isPoisonFruit = attacker.f && attacker.f.n.startsWith("Doku Doku");
  const effect = isPoisonFruit ? POISON_EFFECT : ELEMENT_STATUS_EFFECTS[attack[2]];
  if (!effect) return;
  const isImmune = defender.f && defender.f.t === "Logia" && defender.f.el === attack[2]; // Logia do mesmo elemento é imune
  if (isImmune || (effect.statusName === "shock" && defender.f && defender.f.el === "borracha")) return; // borracha é imune a choque
  if (Math.random() >= effect.chance) return;
  defender.statusEffects = defender.statusEffects || {};
  defender.statusEffects[effect.statusName] = { turns: effect.turns, icon: effect.icon, label: effect.label };
  B.log.push(`${defender.n} sofre ${effect.label}! ${effect.icon}`);
}

/** Ícones de status mostrados embaixo do lutador. */
function statusIconsFor(fighter) {
  return Object.values(fighter.statusEffects || {}).map((effect) => " " + effect.icon).join("");
}

/** Início do turno de um lutador. Devolve true se ele perde a vez (atordoado, congelado ou paralisado). */
function beginTurn(fighter) {
  fighter.hk = Math.min(100, fighter.hk + (fighter.hkr || 15)); // regeneração de haki
  Object.keys(fighter.crewCooldown || {}).forEach((memberId) => { if (fighter.crewCooldown[memberId] > 0) fighter.crewCooldown[memberId]--; });
  let mustSkipTurn = false;
  const effects = fighter.statusEffects || (fighter.statusEffects = {});
  Object.keys(effects).forEach((statusName) => {
    const effect = effects[statusName];
    if (statusName === "burn" || statusName === "poison") { // dano ao longo do tempo
      const damage = Math.max(1, Math.round(fighter.max * (statusName === "burn" ? 0.06 : 0.05)));
      fighter.hp = Math.max(0, fighter.hp - damage);
      B.log.push(`${fighter.n} sofre ${damage} de ${effect.label}.`);
      queueFloatingText(B.p.indexOf(fighter), "-" + damage, "dot");
    }
    if (statusName === "freeze") { mustSkipTurn = true; B.log.push(`${fighter.n} está congelado e perde a vez!`); }
    if (statusName === "shock") {
      fighter.hk = Math.max(0, fighter.hk - 25);
      if (Math.random() < 0.4) { mustSkipTurn = true; B.log.push(`${fighter.n} é paralisado pelo choque!`); }
    }
    effect.turns--;
    if (effect.turns <= 0) delete effects[statusName];
  });
  if (fighter.stun) { fighter.stun = 0; mustSkipTurn = true; B.log.push(`${fighter.n} está atordoado e perde a vez.`); }
  return mustSkipTurn;
}

/* ------------------------- 3. SENSAÇÃO DE COMBATE ------------------------- */

/** Chance de golpe crítico (+50% de dano): base de 8%, maior com Haki de Armamento ativo. */
function criticalChanceFor(fighter) { return 0.08 + (fighter.arm ? 0.1 : 0); }

/** Duração de cada golpe antes de passar o turno (um pouco maior para os números flutuantes aparecerem). */
function attackDurationFor(effectVariant) {
  const durations = { 14: 1500, 27: 1500, 30: 1400, 31: 1500, 32: 1300, 41: 1400, 40: 1300, 38: 1200 };
  return durations[effectVariant] || 1150;
}

/** Atraso até o defensor reagir ao golpe (igual ao usado nas animações de movimento). */
function defenderReactionDelayFor(effectVariant) {
  return { 14: 1050, 27: 750, 31: 800, 41: 600, 30: 450 }[effectVariant] || 380;
}

/** Números flutuantes que sobem a partir do lutador (dano, cura, veneno, esquiva). */
function spawnFloatingText(sideIndex, text, cssClass) {
  const layer = document.querySelector("#fx");
  if (layer) layer.insertAdjacentHTML("beforeend", `<b class="float-text ${cssClass}" style="left:${VisualEffectsDirector.positionOf(sideIndex)}%">${text}</b>`);
}

/** Guarda um texto para aparecer logo depois do próximo draw() (o draw apaga a camada de efeitos). */
function queueFloatingText(sideIndex, text, cssClass) {
  B.pendingFloatingTexts = B.pendingFloatingTexts || [];
  B.pendingFloatingTexts.push({ sideIndex, text, cssClass });
}

function flushFloatingTexts() {
  const pendingTexts = B.pendingFloatingTexts || [];
  B.pendingFloatingTexts = [];
  pendingTexts.forEach((pending) => spawnFloatingText(pending.sideIndex, pending.text, pending.cssClass));
}

/** Jogada de ataque completa (substitui o act() antigo): crítico, status, efeitos, números e vibração. */
function act(attackIndex) {
  if (B.busy || B.over) return;
  const attacker = B.p[B.t], defender = B.p[1 - B.t], currentBattle = B, attack = acts(attacker)[attackIndex];
  if (!attack || attack[3] > attacker.hk) return;
  attacker.hk -= attack[3];
  const healthBefore = defender.hp;
  attacker.criticalHit = Math.random() < criticalChanceFor(attacker);
  const resultMessage = hit(attacker, defender, attack); // calcula o dano e o texto (motor antigo)
  const damageDealt = healthBefore - defender.hp, wasCritical = attacker.criticalHit;
  attacker.criticalHit = false;
  B.log.push(resultMessage);
  B.hit = 1 - B.t;
  B.busy = 1;
  applyStatusFromAttack(attacker, defender, attack, damageDealt);
  fx(attack[6], B.t, 1 - B.t, attack[5], attack[7] || attack[2]);
  mv(B.t, defender, attack[6]);
  if (typeof AC !== "undefined" && AC && mus) nt(90 + Math.random() * 60, 0.2, "sawtooth", 0.12);
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(wasCritical ? [30, 40, 60] : 25);
  const defenderSide = 1 - B.t;
  setTimeout(() => {
    if (B !== currentBattle) return;
    if (damageDealt > 0) spawnFloatingText(defenderSide, "-" + damageDealt + (wasCritical ? "!" : ""), wasCritical ? "crit" : "");
    else if (/desviou/.test(resultMessage)) spawnFloatingText(defenderSide, "ESQUIVOU!", "miss");
  }, defenderReactionDelayFor(attack[6]));
  setTimeout(() => { currentBattle.busy = 0; if (B === currentBattle) next(); }, attackDurationFor(attack[6]));
}

/** Fim da luta: marca quem caiu (animação de nocaute) e mostra o botão Continuar. */
function finishBattle(defeatedFighter) {
  B.over = 1;
  B.win = defeatedFighter === B.p[0] ? 1 : 0; // B.win guarda o índice de quem VENCEU
  B.koIndex = B.p.indexOf(defeatedFighter);
  B.log.push(`${B.p[B.win].n} venceu!`);
  draw();
  flushFloatingTexts();
}

/** Passa o turno (substitui o next() antigo): status, recarga dos nakama, haki e fim de luta. */
function next() {
  reviveIfPossible(); // chefes com segunda forma (Arlong)
  let defeatedFighter = B.p.find((fighter) => fighter.hp <= 0);
  if (defeatedFighter) return finishBattle(defeatedFighter);
  B.t = 1 - B.t;
  let activeFighter = B.p[B.t];
  const firstTurnWasSkipped = beginTurn(activeFighter);
  reviveIfPossible();
  defeatedFighter = B.p.find((fighter) => fighter.hp <= 0);
  if (defeatedFighter) return finishBattle(defeatedFighter);
  if (firstTurnWasSkipped) { // perdeu a vez: o oponente joga de novo
    B.t = 1 - B.t;
    activeFighter = B.p[B.t];
    beginTurn(activeFighter);
    defeatedFighter = B.p.find((fighter) => fighter.hp <= 0);
    if (defeatedFighter) return finishBattle(defeatedFighter);
  }
  draw();
  flushFloatingTexts();
  if (activeFighter.ai) setTimeout(ai, 900);
}

/* ------------------------ 4. CARTAZES DE PROCURADO ------------------------ */

/** Recompensa (bounty) calculada pelos atributos do lutador. */
function bountyFor(fighter) {
  const rarityBonus = (fighter.f ? fighter.f.r * 90 + 40 : 0) + (fighter.s ? fighter.s.r * 70 : 0);
  return Math.round(fighter.max * 1.2 + fighter.atk * 120 + rarityBonus) * 100000;
}

/** Tela "VS" com os dois cartazes de PROCURADO antes da luta (toque para pular). */
function showVersusSplash(firstFighter, secondFighter, title) {
  const currentBattle = B;
  currentBattle.busy = 1; // bloqueia os botões durante a apresentação
  const poster = (fighter) => `<div class="wanted-poster"><div class="wanted-title">PROCURADO</div><div class="wanted-photo">${stick(fighter.k, fighter.s, 0, 0)}</div><b>${fighter.n}</b><div class="wanted-bounty">฿ ${bountyFor(fighter).toLocaleString("pt-BR")}</div><small>${fighter.f ? fighter.f.n : "Sem fruta"}</small></div>`;
  document.body.insertAdjacentHTML("beforeend", `<div id="versus" class="versus-splash"><div class="versus-posters">${poster(firstFighter)}<div class="versus-text">VS</div>${poster(secondFighter)}</div><small>${title}</small></div>`);
  const closeSplash = () => {
    const splash = document.querySelector("#versus");
    if (splash) splash.remove();
    if (B === currentBattle) currentBattle.busy = 0;
  };
  document.querySelector("#versus").onclick = closeSplash;
  setTimeout(closeSplash, 2000);
}

/** Substitui battle(): inicia a luta (motor antigo) e abre a apresentação com os cartazes. */
function battle(firstFighter, secondFighter, title, onBattleEnd, hudMarkup, musicSettings) {
  legacyBattle(firstFighter, secondFighter, title, onBattleEnd, hudMarkup, musicSettings);
  showVersusSplash(firstFighter, secondFighter, title);
}

/* ----------------------------- 5. CONQUISTAS ------------------------------ */

/** progress(S) devolve o progresso atual do jogador; goal é a meta; rewardGems é o prêmio. */
const ACHIEVEMENTS = [
  { id: "firstBlood", name: "Primeiro Sangue", description: "Vença 1 batalha", goal: 1, progress: (state) => state.wins, rewardGems: 3 },
  { id: "pirate25", name: "Pirata de Respeito", description: "Vença 25 batalhas", goal: 25, progress: (state) => state.wins, rewardGems: 8 },
  { id: "pirate100", name: "Terror dos Mares", description: "Vença 100 batalhas", goal: 100, progress: (state) => state.wins, rewardGems: 20 },
  { id: "fruits10", name: "Caçador de Frutas", description: "Tenha 10 frutas diferentes", goal: 10, progress: (state) => Object.keys(state.fr).length, rewardGems: 8 },
  { id: "fruits20", name: "Colecionador", description: "Tenha 20 frutas diferentes", goal: 20, progress: (state) => Object.keys(state.fr).length, rewardGems: 20 },
  { id: "level10", name: "Veterano", description: "Chegue ao nível 10", goal: 10, progress: (state) => state.lv, rewardGems: 8 },
  { id: "level25", name: "Lenda Viva", description: "Chegue ao nível 25", goal: 25, progress: (state) => state.lv, rewardGems: 20 },
  { id: "arc3", name: "Navegante", description: "Chegue ao arco 3", goal: 3, progress: (state) => state.arc + 1, rewardGems: 6 },
  { id: "arc10", name: "Rei dos Mares", description: "Chegue ao arco 10", goal: 10, progress: (state) => state.arc + 1, rewardGems: 30 },
  { id: "marine5", name: "Marinheiro Honrado", description: "Capture 5 piratas", goal: 5, progress: (state) => state.ms, rewardGems: 8 },
  { id: "marine18", name: "Almirante", description: "Capture 18 piratas", goal: 18, progress: (state) => state.ms, rewardGems: 20 },
  { id: "crew9", name: "Bando Completo", description: "Recrute os 9 nakama", goal: 9, progress: () => unlockedCrewMembers().length, rewardGems: 20 },
  { id: "secretFruit", name: "Sorte do Rei", description: "Obtenha uma fruta Secreta", goal: 1, progress: (state) => F.filter((fruit) => fruit.r === 5 && state.fr[fruit.n]).length, rewardGems: 15 },
  { id: "lunarRace", name: "Filho da Lua", description: "Obtenha a raça Lunar", goal: 1, progress: (state) => (state.rc[7] ? 1 : 0), rewardGems: 15 }
];

function claimableAchievementCount() {
  return ACHIEVEMENTS.filter((achievement) => !S.achievements[achievement.id] && achievement.progress(S) >= achievement.goal).length;
}

function claimAchievement(achievementId) {
  const achievement = ACHIEVEMENTS.find((candidate) => candidate.id === achievementId);
  if (!achievement || S.achievements[achievementId] || achievement.progress(S) < achievement.goal) return;
  S.achievements[achievementId] = 1;
  S.g += achievement.rewardGems;
  save();
  showAchievements();
}

function showAchievements() {
  setMode(0);
  const cards = ACHIEVEMENTS.map((achievement) => {
    const progress = Math.min(achievement.goal, achievement.progress(S)), isDone = progress >= achievement.goal, isClaimed = !!S.achievements[achievement.id];
    const action = isDone && !isClaimed ? `<button class="chip on" onclick="claimAchievement('${achievement.id}')">Resgatar 💎${achievement.rewardGems}</button>` : isClaimed ? "<small>Resgatado</small>" : "";
    return `<div class="card"><b>${isClaimed ? "✓ " : "🏆 "}${achievement.name}</b> <small>${achievement.description}</small><div class="bar"><i style="width:${100 * progress / achievement.goal}%"></i></div><small>${progress}/${achievement.goal}</small> ${action}</div>`;
  }).join("");
  app.innerHTML = back() + `<h2>Conquistas</h2><div class="card"><small>Complete objetivos para ganhar 💎 gemas e rolar títulos pirata no Gacha. Você tem <span class="gmz">💎 ${S.g}</span></small></div>${cards}`;
}

/* ----------------------------- 6. INICIALIZAÇÃO --------------------------- */
S.crewSeen = S.crewSeen || unlockedCrewMembers().map((member) => member.id); // quem já está desbloqueado não gera aviso
S.achievements = S.achievements || {};
save();
