/* ===========================================================================
 * game-updates.js  (módulo de ATUALIZAÇÃO, com nomes completos e comentários)
 * Carregado DEPOIS de game.js: reutiliza o motor antigo e o estende.
 *
 * FLUXO GERAL DO JOGO
 *   menu() -> gacha() | pvpSetup() | story() | navy() | showRaceScreen()
 *   fight() / nfight() / pvpFight() -> battle() -> draw()
 *   o jogador clica -> act() / hk() -> fx() (VisualEffectsDirector) -> next()
 *   next() -> reviveIfPossible() -> fim da luta -> recompensas -> msg() / navy()
 *
 * DICIONÁRIO (nomes curtos do motor antigo -> significado)
 *   F = catálogo de frutas      SW = catálogo de espadas   S  = estado salvo do jogador
 *   B = estado da batalha       CL = cor por elemento      EP = emojis por elemento
 *   AFX = efeito visual por nome de ataque                 FM = sprites de transformação
 *   TH = temas dos mapas        BS = chefes da história    MR = missões do modo Marinheiro
 * =========================================================================== */

/* ------------------------------ 1. DADOS ---------------------------------- */

/** Buff extra aplicado a TODOS os ataques de espada (pedido do PDF: "buffar mais um pouquinho"). */
const SWORD_DAMAGE_BUFF_MULTIPLIER = 1.12;

/** Partículas "assinatura" de cada fruta: aparecem no impacto de TODOS os ataques (VFX geral). */
const FRUIT_SIGNATURE_PARTICLES = {
  "Bara Bara": ["🔪", "✂️"], "Bomu Bomu": ["💥", "💨"], "Hana Hana": ["🖐️", "🌸"], "Kilo Kilo": ["⚖️", "💢"],
  "Sube Sube": ["✨", "💫"], "Mochi Mochi": ["⚪", "🍡"], "Doku Doku": ["☠️", "🟣"], "Ito Ito": ["🧵", "〰️"],
  "Suna Suna": ["🏜️", "⏳"], "Moku Moku": ["💨", "☁️"], "Neko Neko": ["🐾", "💢"], "Mero Mero": ["💖", "💘"],
  "Mera Mera": ["🔥", "🔥"], "Hie Hie": ["❄️", "🧊"], "Goro Goro": ["⚡", "💫"], "Pika Pika": ["✨", "🌟"],
  "Yami Yami": ["⚫", "🕳️"], "Magu Magu": ["🌋", "🔥"], "Hito Hito": ["😂", "💥"], "Gura Gura": ["💥", "🪨"],
  "Ope Ope": ["🔵", "🫀"], "Tori Tori": ["🔥", "🪶"], "Uo Uo": ["🐉", "🔥"], "Yami Gura": ["🌑", "💥"],
  "Suke Suke": ["👻", "✨"], "Mane Mane": ["🎭", "💋"], "Supa Supa": ["🗡️", "✨"], "Ushi Ushi": ["🦒", "💢"],
  "Inu Inu": ["🐺", "💢"], "Kage Kage": ["👤", "🦇"]
};

/** Palavras-chave do nome do ataque -> variante de efeito (usado quando não há efeito manual em AFX). */
const ATTACK_NAME_KEYWORD_EFFECTS = [
  [/raio|volt|thunder|elthor|rel[aâ]mpago|shock/i, 11], [/soco|punho|punch|gatling|fist|rokuogan/i, 8],
  [/corte|l[aâ]mina|garra|kiri|shakushi|rankyaku|slash|lan[çc]a|shigan/i, 6],
  [/terremoto|quake|pis[aã]o|rachadura|fissura|pancada/i, 15], [/laser|luz|dourado|light|mantra/i, 1],
  [/tornado|tatsu|areia|vento|barchan/i, 29], [/sombra|soldados|buraco|black|abismo|doppel/i, 3],
  [/fogo|chama|magma|punk|fire|entei/i, 9], [/gaiola|fio|corda/i, 4], [/tiro|canh[aã]o|ball|bola|bomba/i, 9]
];

/** Efeitos escolhidos à mão, fiéis ao anime: nome do ataque -> [variante, emoji]. */
const ANIME_ACCURATE_ATTACK_EFFECTS = {
  "Garra do Dragão": [18, "🐲"], "Boro Breath": [27, "🔥"], "Kaifu": [28, "🌀"], "Tatsumaki": [29, "🌪️"],
  "Relâmpago do Dragão": [30, "⚡"], "Tatsumaki Kaifu": [31, "🌪️"],
  "Room": [32, "🔵"], "Shambles": [33, "🔄"], "Radio Knife": [34, "🔪"], "Counter Shock": [35, "⚡"], "Gamma Knife": [36, "🟣"],
  "Pistol de Borracha": [37, "🤜"], "Dawn Whip": [38, "☁️"], "Gatling Cartoon": [39, "👊"], "Gigant Bazooka": [37, "🤜"],
  "Rifle Gigante": [40, "🤜"], "Bajrang Gun": [40, "🤜"], "Fim do Mundo": [41, "💥"], "Fim do Mundo Negro": [41, "⚫"]
};

/** Monta a skin de um chefe com nomes completos (índices das peças do personagem + cores exatas). */
const buildBossSkin = (raceIndex, hairStyleIndex, hatIndex, shirtIndex, shoesIndex, capeIndex, scarIndex, colors = {}) =>
  ({ raceIndex, hairStyleIndex, hatIndex, shirtIndex, shoesIndex, capeIndex, scarIndex, ...colors });

/** Skins dos chefes (aproximam o visual do anime usando as peças disponíveis + cores personalizadas). */
const BOSS_SKIN_DEFINITIONS = {
  "Alvida": buildBossSkin(0, 4, 5, 2, 1, 0, 0, { hairColor: "#3a2a2a", shirtColor: "#d86aa0" }),
  "Helmeppo": buildBossSkin(0, 2, 5, 1, 4, 0, 0, { hairColor: "#f2d36b" }),
  "Capitão Morgan": buildBossSkin(0, 5, 3, 1, 4, 2, 0, { hairColor: "#4a4a4a" }),
  "Mohji": buildBossSkin(0, 5, 5, 0, 0, 0, 0, { hairColor: "#e8802a", shirtColor: "#f2c230" }),
  "Cabaji": buildBossSkin(0, 3, 5, 0, 3, 0, 0, { hairColor: "#6b4a2a", shirtColor: "#f4f4f4" }),
  "Buggy, o Palhaço": buildBossSkin(0, 3, 1, 0, 1, 4, 0, { hairColor: "#2a64d8", shirtColor: "#ffffff", hatColor: "#c4252b" }),
  "Jango": buildBossSkin(0, 5, 1, 4, 0, 0, 0, { hairColor: "#111111", hatColor: "#333333", shirtColor: "#6a6a9a" }),
  "Capitão Kuro": buildBossSkin(0, 2, 5, 3, 3, 0, 0, { hairColor: "#111111", shirtColor: "#1a1a22" }),
  "Gin": buildBossSkin(0, 0, 5, 3, 3, 0, 0, { hairColor: "#2a1a0a", shirtColor: "#6b4a2a" }),
  "Don Krieg": buildBossSkin(0, 1, 1, 1, 3, 0, 0, { hairColor: "#2a2a2a", shirtColor: "#e8c35a", hatColor: "#c9a23a", pantsColor: "#c9a23a" }),
  "Mihawk": buildBossSkin(0, 0, 1, 0, 3, 1, 0, { hairColor: "#111111", hatColor: "#14141a", shirtColor: "#7a1f2a", capeColor: "#14141a" }),
  "Chew": buildBossSkin(1, 5, 5, 0, 0, 0, 0, { skinColor: "#7fb8d8", hairColor: "#2a2a2a", shirtColor: "#a8422a" }),
  "Kuroobi": buildBossSkin(1, 0, 5, 0, 0, 0, 0, { skinColor: "#4a6a8a", hairColor: "#111111", shirtColor: "#3a3a52" }),
  "Arlong": buildBossSkin(1, 5, 5, 0, 0, 0, 0, { skinColor: "#6aa7c8", hairColor: "#1d2f55", shirtColor: "#2b3a55" }),
  "Mr. 2 Bon Clay": buildBossSkin(0, 5, 5, 2, 1, 0, 0, { hairColor: "#f4f4f4", shirtColor: "#f08ac8" }),
  "Mr. 1 Daz Bones": buildBossSkin(0, 0, 5, 3, 3, 0, 0, { hairColor: "#222222", shirtColor: "#3a3a52" }),
  "Crocodile": buildBossSkin(0, 0, 5, 3, 3, 3, 3, { hairColor: "#111111", shirtColor: "#1a1a22", capeColor: "#6b5a3a" }),
  "Satori": buildBossSkin(0, 3, 5, 4, 0, 0, 0, { hairColor: "#e8c35a", shirtColor: "#e8d8a8" }),
  "Shura": buildBossSkin(0, 0, 5, 0, 0, 0, 0, { hairColor: "#6b3a1a", shirtColor: "#a83a2a" }),
  "Enel": buildBossSkin(0, 0, 5, 4, 0, 0, 0, { hairColor: "#111111", shirtColor: "#e87a1a", pantsColor: "#e87a1a" }),
  "Kaku": buildBossSkin(0, 0, 5, 3, 3, 0, 0, { hairColor: "#111111" }),
  "Jabra": buildBossSkin(0, 0, 5, 3, 3, 0, 0, { hairColor: "#111111" }),
  "Rob Lucci": buildBossSkin(0, 5, 1, 3, 3, 0, 0, { hairColor: "#111111", hatColor: "#111111" }),
  "Absalom": buildBossSkin(0, 5, 5, 3, 3, 0, 0, { hairColor: "#2a2a2a", shirtColor: "#3a2a4a" }),
  "Oz": buildBossSkin(6, 5, 5, 4, 0, 0, 0, { skinColor: "#8ab08a", hairColor: "#2a2a2a" }),
  "Gecko Moria": buildBossSkin(6, 5, 5, 1, 3, 0, 0, { skinColor: "#c8b8d8", hairColor: "#222222", shirtColor: "#4a2a6a" }),
  "Kizaru": buildBossSkin(0, 0, 5, 3, 3, 0, 0, { hairColor: "#6a5a3a", shirtColor: "#e8d23a", pantsColor: "#e8d23a" }),
  "Akainu": buildBossSkin(0, 0, 3, 3, 4, 0, 0, { hairColor: "#222222", shirtColor: "#a8201f", pantsColor: "#a8201f" }),
  "Barba Branca": buildBossSkin(6, 3, 3, 0, 3, 2, 4, { hairColor: "#f4f4f4", hatColor: "#f4f4f4", shirtColor: "#e0b890", capeColor: "#f4f4f4", pantsColor: "#e8e0b0" }),
  "Eustass Kid": buildBossSkin(0, 0, 5, 0, 3, 3, 0, { hairColor: "#d8302f", shirtColor: "#2a2a2a", capeColor: "#c9a23a" }),
  "Trafalgar Law": buildBossSkin(0, 0, 2, 0, 3, 0, 0, { hairColor: "#111111", shirtColor: "#f2c230", hatColor: "#f2efe6" }),
  "Roronoa Zoro": buildBossSkin(0, 1, 5, 4, 3, 0, 3, { hairColor: "#3f9b4a", shirtColor: "#3a7d44" }),
  "Doflamingo": buildBossSkin(0, 3, 5, 2, 3, 0, 0, { hairColor: "#f2d36b", shirtColor: "#ff7eb6" }),
  "Katakuri": buildBossSkin(0, 0, 5, 3, 3, 3, 0, { hairColor: "#d83a6a", capeColor: "#d8c8e8" }),
  "Kaido": buildBossSkin(0, 5, 5, 4, 3, 3, 0, { hairColor: "#111111", shirtColor: "#3a3a6a", capeColor: "#3a3a8a" }),
  "Barba Negra": buildBossSkin(0, 5, 1, 0, 3, 0, 0, { hairColor: "#111111", hatColor: "#222222", shirtColor: "#3a2a2a" }),
  "Shanks": buildBossSkin(0, 3, 5, 0, 3, 1, 2, { hairColor: "#d3341f", shirtColor: "#f4f4f4" }),
  "Portgas D. Ace": buildBossSkin(0, 0, 5, 0, 0, 0, 0, { hairColor: "#111111", shirtColor: "#f0f0f0" })
};
// Apelidos: o modo Marinheiro usa nomes ligeiramente diferentes para os mesmos personagens.
Object.assign(BOSS_SKIN_DEFINITIONS, {
  "Buggy": BOSS_SKIN_DEFINITIONS["Buggy, o Palhaço"], "Dracule Mihawk": BOSS_SKIN_DEFINITIONS["Mihawk"],
  "Edward Newgate": BOSS_SKIN_DEFINITIONS["Barba Branca"], "Shanks, o Ruivo": BOSS_SKIN_DEFINITIONS["Shanks"],
  "Kaido, o Rei das Feras": BOSS_SKIN_DEFINITIONS["Kaido"], "Marshall D. Teach": BOSS_SKIN_DEFINITIONS["Barba Negra"]
});

/** Segunda forma de chefes: ao serem derrotados pela primeira vez, eles se levantam transformados. */
const BOSS_SECOND_FORM_DEFINITIONS = {
  "Arlong": {
    displayName: "Arlong, Fúria Tubarão", healthMultiplier: 1.1, attackMultiplier: 1.25, reviveHealthFraction: 0.85,
    skinOverrides: { raceIndex: 6, skinColor: "#4f8fb8", hairColor: "#0f1d3a" },
    skillsText: "Tubarão Gigante:56|Kiribachi Furioso:62|Shark Arrow:58",
    message: "Arlong ruge e assume a SEGUNDA FORMA: Tubarão Furioso!"
  }
};

/** 17 missões novas do modo Marinheiro (as 18 antigas continuam em MR). Formato: [nome, fruta, espada, golpes]. */
const ADDITIONAL_MARINE_MISSIONS = [
  ["Capone Bege", "", "", "Castelo Vivo:64|Tiro Fantasma:60"], ["Basil Hawkins", "", "", "Boneca de Palha:66|Ressurreição:62"],
  ["X Drake", "", "", "Dinossauro Vermelho:70|Garra Pré-Histórica:66"], ["Jewelry Bonney", "", "", "Envelhecer:68|Ataque Jovem:64"],
  ["Marco, a Fênix", "Tori Tori", "", "Chamas Azuis:72|Chute Fênix:70"], ["Portgas D. Ace", "Mera Mera", "", "Hiken:74|Entei:72"],
  ["Jozu", "", "", "Diamante Cortante:76|Soco de Diamante:72"], ["Vista", "", "Sabre da Marinha", "Ataque Floral:74|Corte das Rosas:76"],
  ["Charlotte Cracker", "Mochi Mochi", "", "Exército de Biscoito:78|Golpe Duplo:74"], ["Big Mom", "", "", "Fúria Soru Soru:86|Napoleão:82"],
  ["Kaido, o Rei das Feras", "Uo Uo", "", "Boro Breath:90|Tatsumaki Kaifu:94"], ["Dracule Mihawk", "", "Yoru (Mihawk)", "Corte Verde Mortal:92|Cruz do Falcão:88"],
  ["Shanks, o Ruivo", "", "Gryphon (Shanks)", "Haki do Rei:96|Corte do Imperador:92"], ["Marshall D. Teach", "Yami Yami", "", "Buraco Negro:96|Terremoto Negro:98"],
  ["Edward Newgate", "Gura Gura", "Murakumogiri", "Terremoto Total:100|Golpe do Imperador:96"],
  ["Monkey D. Luffy", "Hito Hito", "", "Gigant Bajrang Gun:104|Dawn Whip:98"], ["Gol D. Roger", "", "", "Divine Departure:110|Haki do Rei Pirata:106"]
];

/** Partículas e nuvens animadas dos cenários de batalha, por arco (0 a 9). */
const ARC_BACKDROP_PARTICLES = [["🐦", "🌊"], ["🎪", "🍂"], ["🍃", "🦋"], ["🐟", "🫧"], ["🦈", "🫧"], ["🌪️", "☀️"], ["⚡", "🕊️"], ["🕊️", "💧"], ["🦇", "🌫️"], ["🔥", "❄️"]];

/* -------------------- 2. ATUALIZAÇÕES NOS DADOS DAS FRUTAS ----------------- */

class FruitDataUpdater {
  /** Substitui os golpes/formas das frutas citadas no PDF e aplica o buff nas espadas. */
  static apply() {
    const findFruit = (namePart) => F.find((fruit) => fruit.n.includes(namePart));
    const parseAttacks = (text) => text.split("|").map((entry) => { const [name, power] = entry.split(":"); return [name, Number(power)]; });
    // FRUTA DO DRAGÃO: duas transformações em sequência (híbrido -> dragão completo) + golpes do anime.
    Object.assign(findFruit("Seiryu"), {
      forms: ["🐉Híbrido", "🐲Dragão Completo"], f: "🐉Híbrido",
      a: parseAttacks("Garra do Dragão:30|Boro Breath:38|Kaifu:44|Tatsumaki:52|Relâmpago do Dragão:60|Tatsumaki Kaifu:78")
    });
    // OPE OPE NO MI: Room, Shambles, Radio Knife, Counter Shock e Gamma Knife.
    Object.assign(findFruit("Ope Ope"), { a: parseAttacks("Room:26|Shambles:34|Radio Knife:42|Counter Shock:52|Gamma Knife:64") });
    // HITO HITO NO MI (Nika): golpes do Gear 5 em ordem crescente de poder.
    Object.assign(findFruit("Nika"), { a: parseAttacks("Pistol de Borracha:30|Gatling Cartoon:36|Dawn Whip:44|Gigant Bazooka:52|Rifle Gigante:60|Bajrang Gun:80") });
    Object.assign(AFX, ANIME_ACCURATE_ATTACK_EFFECTS);
    // Espadas: buff extra em todos os golpes.
    SW.forEach((sword) => sword.a.forEach((attack) => { attack[1] = Math.round(attack[1] * SWORD_DAMAGE_BUFF_MULTIPLIER); }));
    // Modo Marinheiro: mais batalhas.
    MR.push(...ADDITIONAL_MARINE_MISSIONS);
  }
}

/** Usado em act(): escolhe um efeito pela palavra-chave do nome quando não há efeito manual. */
function inferEffectVariantFromAttackName(attackLabel) {
  const match = ATTACK_NAME_KEYWORD_EFFECTS.find(([pattern]) => pattern.test(attackLabel));
  return match ? match[1] : null;
}

/* ------------------------- 3. DIRETOR DE EFEITOS VISUAIS ------------------- */

class VisualEffectsDirector {
  /** Variante numérica do golpe -> método que desenha o efeito (variantes 0 a 26 ficam no motor antigo). */
  static variantBuilders = {
    27: "buildBoroBreath", 28: "buildKaifu", 29: "buildTatsumaki", 30: "buildDragonLightning", 31: "buildTatsumakiKaifu",
    32: "buildRoom", 33: "buildShambles", 34: "buildRadioKnife", 35: "buildCounterShock", 36: "buildGammaKnife",
    37: "buildRubberPistol", 38: "buildDawnWhip", 39: "buildCartoonGatling", 40: "buildGiantFist", 41: "buildQuakeFinale"
  };

  /** Posição horizontal (em %) do lutador: lado 0 = esquerda, lado 1 = direita. */
  static positionOf(sideIndex) { return sideIndex ? 75 : 25; }

  /** Ponto de entrada: toca o efeito do golpe e depois as partículas assinatura da fruta. */
  static play(effectVariant, attackerSide, defenderSide, emoji, colorOrElement) {
    const effectsLayer = document.querySelector("#fx");
    if (!effectsLayer || window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const builderName = this.variantBuilders[effectVariant];
    if (builderName) {
      effectsLayer.innerHTML = this[builderName]({
        attackerX: this.positionOf(attackerSide), defenderX: this.positionOf(defenderSide),
        color: CL[colorOrElement] || colorOrElement || "#ffffff", emoji
      });
    } else {
      legacyAttackEffect(effectVariant, attackerSide, defenderSide, emoji, colorOrElement); // variantes antigas
    }
    this.emitSignatureParticles(attackerSide, this.positionOf(defenderSide));
  }

  /** Explosão de partículas temáticas (emojis da fruta) no ponto de impacto. */
  static emitSignatureParticles(attackerSide, targetX) {
    const layer = document.querySelector("#fx");
    const attacker = typeof B !== "undefined" && B && B.p ? B.p[attackerSide] : null;
    if (!layer || !attacker || !attacker.f) return;
    const fruitPrefix = Object.keys(FRUIT_SIGNATURE_PARTICLES).find((prefix) => attacker.f.n.startsWith(prefix));
    const particleEmojis = fruitPrefix ? FRUIT_SIGNATURE_PARTICLES[fruitPrefix] : EP[attacker.f.el].slice(0, 2);
    let particlesMarkup = "";
    for (let index = 0; index < 12; index++) {
      const angle = Math.random() * Math.PI * 2, distance = 40 + Math.random() * 70;
      particlesMarkup += `<b class="vfx-particle" style="left:${targetX}%;--travelX:${Math.cos(angle) * distance}px;--travelY:${Math.sin(angle) * distance}px;animation-delay:${0.3 + Math.random() * 0.15}s">${particleEmojis[index % particleEmojis.length]}</b>`;
    }
    layer.insertAdjacentHTML("beforeend", particlesMarkup);
  }

  /** Treme a arena depois de um atraso (impactos fortes). */
  static shakeArena(delayMilliseconds) {
    setTimeout(() => { const arena = document.querySelector(".arena"); if (arena) arena.classList.add("qk"); }, delayMilliseconds);
  }

  /* ---- FRUTA DO DRAGÃO ---- */
  /** Boro Breath: bola de fogo carregando na boca, feixe de calor devastador e explosão. */
  static buildBoroBreath(context) {
    const beamStart = Math.min(context.attackerX, context.defenderX);
    let flamesMarkup = "";
    for (let index = 0; index < 5; index++) flamesMarkup += `<b class="p vfx-trail" style="--a:${context.attackerX}%;--b:${context.defenderX}%;top:${16 + index * 3}%;animation-delay:${0.5 + index * 0.06}s">🔥</b>`;
    this.shakeArena(700);
    return `<i class="vfx-fire-charge" style="left:${context.attackerX}%"></i>
      <i class="vfx-fire-beam" style="left:${beamStart}%;transform-origin:${context.attackerX > context.defenderX ? "right" : "left"}"></i>
      ${flamesMarkup}<i class="vfx-flash" style="--c:#ffb347;animation-delay:.6s"></i>`;
  }

  /** Kaifu: lâminas de vento cortantes voando em leque até o alvo. */
  static buildKaifu(context) {
    let bladesMarkup = "";
    for (let index = 0; index < 5; index++) bladesMarkup += `<i class="vfx-wind-blade" style="--a:${context.attackerX}%;--b:${context.defenderX}%;--tilt:${(index - 2) * 12}deg;--c:#c8fff0;top:${22 + index * 11}%;animation-delay:${index * 0.09}s"></i>`;
    return bladesMarkup + `<i class="sl" style="left:${context.defenderX}%;--c:#c8fff0;animation-delay:.45s"></i><i class="sl s2" style="left:${context.defenderX}%;--c:#c8fff0;animation-delay:.55s"></i>`;
  }

  /** Tatsumaki: três tornados gigantes engolindo o inimigo. */
  static buildTatsumaki(context) {
    let tornadoesMarkup = "";
    [0, 1, 2].forEach((index) => { tornadoesMarkup += `<b class="vfx-tornado" style="--a:${context.attackerX}%;--b:${context.defenderX + (index - 1) * 8}%;top:${28 + index * 8}%;animation-delay:${index * 0.15}s">🌪️</b>`; });
    return tornadoesMarkup + `<i class="vfx-flash" style="--c:#bfe0ff;animation-delay:.7s"></i>`;
  }

  /** Relâmpagos: nuvens se formam no alto e raios caem sobre o alvo. */
  static buildDragonLightning(context) {
    let cloudsMarkup = "", boltsMarkup = "";
    for (let index = 0; index < 5; index++) cloudsMarkup += `<b class="vfx-cloud" style="left:${12 + index * 19}%;animation-delay:${index * 0.05}s">☁️</b>`;
    [-10, 0, 10, -4].forEach((offset, index) => {
      boltsMarkup += skt(context.defenderX + offset, "#bfe3ff").replace('style="', `style="opacity:0;animation-delay:${0.35 + index * 0.12}s;`);
    });
    return cloudsMarkup + boltsMarkup + `<i class="vfx-flash" style="--c:#bfe3ff;animation-delay:.4s"></i>`;
  }

  /** Tatsumaki Kaifu: tornados que disparam lâminas de vento em todas as direções. */
  static buildTatsumakiKaifu(context) {
    let tornadoesMarkup = "", bladesMarkup = "";
    [0, 1].forEach((index) => { tornadoesMarkup += `<b class="vfx-tornado" style="--a:${context.attackerX}%;--b:${context.defenderX + (index ? 10 : -10)}%;top:${30 + index * 10}%;animation-delay:${index * 0.2}s">🌪️</b>`; });
    for (let index = 0; index < 12; index++) bladesMarkup += `<i class="vfx-radial-blade" style="left:${context.defenderX}%;top:46%;--angle:${index * 30}deg;animation-delay:${0.45 + index * 0.03}s"></i>`;
    this.shakeArena(600);
    return tornadoesMarkup + bladesMarkup + `<i class="vfx-flash" style="--c:#dfffff;animation-delay:.7s"></i>`;
  }

  /* ---- OPE OPE NO MI ---- */
  /** Room: esfera azulada se expande a partir do usuário. */
  static buildRoom(context) {
    return `<i class="vfx-room-expand" style="left:${context.attackerX}%"></i><i class="vfx-room-expand" style="left:${context.attackerX}%;animation-delay:.25s"></i><i class="vfx-flash" style="--c:#7fd6ff;animation-delay:.2s"></i>`;
  }

  /** Shambles: portais azuis nos dois lugares e a troca de posição. */
  static buildShambles(context) {
    return `<i class="vfx-portal" style="left:${context.attackerX}%"></i><i class="vfx-portal" style="left:${context.defenderX}%;animation-delay:.15s"></i><b class="vfx-swap" style="--a:${context.attackerX}%;--b:${context.defenderX}%">🔄</b><i class="vfx-flash" style="--c:#7fd6ff;animation-delay:.3s"></i>`;
  }

  /** Radio Knife: cortes limpos que atravessam o corpo sem sangue. */
  static buildRadioKnife(context) {
    return [0, 1, 2].map((index) => `<i class="sl" style="left:${context.defenderX}%;top:${24 + index * 14}%;--c:#7fd6ff;animation-delay:${index * 0.1}s"></i>`).join("") + `<i class="vfx-flash" style="--c:#7fd6ff;animation-delay:.3s"></i>`;
  }

  /** Counter Shock: descarga elétrica direto nos órgãos. */
  static buildCounterShock(context) {
    return crk(context.defenderX, "#bfe3ff") + skt(context.defenderX, "#bfe3ff") + `<i class="vfx-flash" style="--c:#bfe3ff;animation-delay:.15s"></i>`;
  }

  /** Gamma Knife: anéis que se fecham no alvo (ataque interno). */
  static buildGammaKnife(context) {
    const rings = [0, 1, 2].map((index) => `<i class="vfx-implode" style="left:${context.defenderX}%;animation-delay:${index * 0.18}s"></i>`).join("");
    return rings + `<i class="bm" style="--c:#b48cff;left:${Math.min(context.attackerX, context.defenderX)}%;transform-origin:${context.attackerX > context.defenderX ? "right" : "left"};height:6px;top:50%;animation-duration:.4s"></i>`;
  }

  /* ---- HITO HITO NO MI (Gear 5): estilo cartoon, elástico e engraçado ---- */
  /** Pistol: braço de borracha estica, o punho acerta e o braço volta com um BOING. */
  static buildRubberPistol(context) {
    const fromRight = context.attackerX > context.defenderX;
    return `<i class="vfx-rubber-arm" style="left:${Math.min(context.attackerX, context.defenderX)}%;transform-origin:${fromRight ? "right" : "left"}"></i>
      <b class="vfx-rubber-fist" style="--a:${context.attackerX}%;--b:${context.defenderX}%">${fromRight ? "🤛" : "🤜"}</b>
      <b class="vfx-comic" style="left:${context.defenderX}%;animation-delay:.35s">BOING!</b>`;
  }

  /** Dawn Whip: braço vira chicote em arco, com nuvens de risada. */
  static buildDawnWhip(context) {
    const fromRight = context.attackerX > context.defenderX;
    return `<svg class="vfx-whip" viewBox="0 0 100 60" preserveAspectRatio="none" style="left:${Math.min(context.attackerX, context.defenderX)}%;${fromRight ? "transform:scaleX(-1);" : ""}"><path d="M0 52Q50 -24 100 38" fill="none" stroke="#f7d2a8" stroke-width="9" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg>
      <b class="vfx-comic" style="left:${context.defenderX}%;animation-delay:.4s">CRACK!</b>
      <b class="vfx-cloud" style="left:${context.defenderX}%;top:40%;animation-delay:.45s">☁️</b>`;
  }

  /** Gatling: rajada de punhos cartunescos. */
  static buildCartoonGatling(context) {
    let fistsMarkup = "";
    for (let index = 0; index < 8; index++) fistsMarkup += `<b class="p" style="--a:${context.attackerX}%;--b:${context.defenderX}%;top:${28 + (index % 4) * 10}%;animation-delay:${index * 0.06}s">${index % 2 ? "👊" : "🤜"}</b>`;
    for (let index = 0; index < 3; index++) fistsMarkup += `<b class="p vfx-trail" style="--a:${context.attackerX}%;--b:${context.defenderX}%;top:${20 + index * 18}%;animation-delay:${0.2 + index * 0.1}s">😂</b>`;
    return fistsMarkup;
  }

  /** Rifle Gigante / Bajrang Gun: punho gigante caindo sobre o inimigo. */
  static buildGiantFist(context) {
    const fromRight = context.attackerX > context.defenderX;
    this.shakeArena(450);
    return `<b class="vfx-giant-fist" style="left:${context.defenderX}%">${fromRight ? "🤛" : "🤜"}</b><b class="vfx-cloud" style="left:${context.defenderX - 12}%;top:48%;animation-delay:.3s">☁️</b><b class="vfx-cloud" style="left:${context.defenderX + 12}%;top:48%;animation-delay:.35s">☁️</b><i class="vfx-flash" style="--c:#ffffff;animation-delay:.45s"></i>`;
  }

  /* ---- GURA GURA NO MI (Terremoto) ---- */
  /** Último ataque: o braço gira (animação .swing), racha o ar e cria 2 ondas, uma na frente e outra atrás do inimigo. */
  static buildQuakeFinale(context) {
    const delayed = (markup, seconds) => markup.replace('style="', `style="animation-delay:${seconds}s;opacity:0;`);
    const crackInFrontOfFist = context.attackerX + (context.defenderX > context.attackerX ? 12 : -12);
    this.shakeArena(550);
    return crk(crackInFrontOfFist, context.color) + delayed(crk(context.defenderX - 16, context.color), 0.3) + delayed(crk(context.defenderX + 16, context.color), 0.3)
      + `<i class="qw" style="left:${context.defenderX - 8}%;--dx:-34px"></i><i class="qw b" style="left:${context.defenderX + 8}%;--dx:34px"></i><i class="fl" style="--c:#bfeaff;animation-delay:.55s"></i>`;
  }
}

/** Substitui o fx() antigo: o motor continua chamando fx(), que agora delega ao diretor de efeitos. */
function fx(effectVariant, attackerSide, defenderSide, emoji, colorOrElement) {
  VisualEffectsDirector.play(effectVariant, attackerSide, defenderSide, emoji, colorOrElement);
}

/** Duração (ms) de cada golpe antes de o turno passar; golpes longos precisam de mais tempo. */
function attackDurationFor(effectVariant) {
  const durations = { 14: 1500, 27: 1500, 30: 1400, 31: 1500, 32: 1200, 41: 1300, 40: 1200, 38: 1100 };
  return durations[effectVariant] || 900;
}

/** Movimento do atacante (investida / braços para o alto / soco) e reação do defensor. */
function mv(attackerSide, defender, effectVariant) {
  const attackerFigure = document.querySelector("#f" + attackerSide + " .fig"), defenderFigure = document.querySelector("#f" + (1 - attackerSide) + " .fig");
  const punchVariants = [8, 15, 16, 37, 38, 39, 40, 41];
  if (attackerFigure) {
    if (effectVariant === 14) { attackerFigure.classList.add("up"); setTimeout(() => attackerFigure.classList.remove("up"), 700); }
    else { attackerFigure.classList.add("lg"); if (punchVariants.includes(effectVariant)) attackerFigure.classList.add("swing"); }
  }
  const reactionDelays = { 14: 1050, 27: 750, 31: 800, 41: 600, 30: 450 };
  setTimeout(() => { if (defenderFigure) defenderFigure.classList.add(defender.f && defender.f.t === "Logia" ? "rcl" : "rc"); }, reactionDelays[effectVariant] || 380);
}

/* ---------------------- 4. SPRITES DE TRANSFORMAÇÃO ------------------------ */

/** Desenha criaturas "meio humano, meio animal" (lobo e dragão híbrido) reutilizando as mesmas peças. */
class HybridBeastmanSprite {
  /** options: headType ("wolf" | "dragon") e as cores usadas em cada parte. */
  constructor(options) { this.options = options; }

  renderTail() {
    const { furColor, tailTipColor } = this.options;
    return `<path d="M62 106Q98 112 92 80" stroke="${furColor}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M92 84q1-6 0-10" stroke="${tailTipColor}" stroke-width="8" stroke-linecap="round"/>`;
  }

  renderLegs() {
    const { trouserColor, furColor } = this.options;
    return `<path d="M38 84L30 112M62 84L70 112" stroke="${trouserColor}" stroke-width="14" stroke-linecap="round"/><ellipse cx="29" cy="117" rx="10" ry="4.5" fill="${furColor}" stroke="#111" stroke-width="1.5"/><ellipse cx="71" cy="117" rx="10" ry="4.5" fill="${furColor}" stroke="#111" stroke-width="1.5"/>`;
  }

  renderTorso() {
    const { headType, coatColor, chestColor, sashColor } = this.options;
    if (headType === "dragon") { // peito de escamas + casaco de pelos roxo (Kaido)
      return `<path d="M30 50Q50 43 70 50L75 92H25z" fill="${chestColor}" stroke="#000" stroke-width="2"/><path d="M36 60q4 4 8 0M46 60q4 4 8 0M56 60q4 4 8 0M40 70q4 4 8 0M52 70q4 4 8 0" stroke="#ffffff66" stroke-width="1.4" fill="none"/><path d="M20 50Q50 38 80 50L88 98H72L66 62H34L28 98H12z" fill="${coatColor}" stroke="#000" stroke-width="2"/><path d="M26 82h48v9H26z" fill="#efe6d2" stroke="#000"/>`;
    }
    return `<path d="M30 50Q50 43 70 50L75 92H25z" fill="${coatColor}" stroke="#000" stroke-width="2"/><path d="M44 48l6 20 6-20z" fill="#fff"/><path d="M26 82h48v8H26z" fill="${sashColor}"/>`; // terno + faixa
  }

  renderArms() {
    const { coatColor, furColor } = this.options;
    return `<path d="M30 52L12 72L16 94M70 52L88 72L84 94" stroke="${coatColor}" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M13 78L16 96M87 78L84 96" stroke="${furColor}" stroke-width="9" stroke-linecap="round"/><circle cx="16" cy="99" r="6" fill="${furColor}" stroke="#111" stroke-width="1.5"/><circle cx="84" cy="99" r="6" fill="${furColor}" stroke="#111" stroke-width="1.5"/><path d="M11 104l-2 7M16 105v7M21 104l2 7M79 104l-2 7M84 105v7M89 104l2 7" stroke="#111" stroke-width="2" stroke-linecap="round"/>`;
  }

  renderHead() {
    const { headType, furColor, accentColor, hairColor, hornColor } = this.options;
    const angryEyes = `<path d="M40 29l8 4M60 29l-8 4" stroke="#111" stroke-width="2.6" stroke-linecap="round"/><circle cx="44" cy="34" r="1.6" fill="#ffe27a"/><circle cx="56" cy="34" r="1.6" fill="#ffe27a"/>`;
    if (headType === "dragon") { // chifres dourados, bigode e presas
      return `<circle cx="50" cy="26" r="20" fill="${hairColor}"/><path d="M38 20Q28 2 36 -2M62 20Q72 2 64 -2" stroke="${hornColor}" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="50" cy="34" rx="14" ry="13" fill="${furColor}" stroke="#111" stroke-width="2"/><path d="M40 40q10 7 20 0" fill="${accentColor}" stroke="#111"/>${angryEyes}<path d="M40 44q-10 4-14 12M60 44q10 4 14 12" stroke="${hornColor}" stroke-width="2.4" fill="none"/><path d="M44 42l2 5 2-5M52 42l2 5 2-5" fill="#fff"/>`;
    }
    return `<circle cx="50" cy="27" r="19" fill="${hairColor}"/><path d="M36 24l2-16 10 10zM64 24l-2-16-10 10z" fill="${furColor}" stroke="#111" stroke-width="1.5"/><ellipse cx="50" cy="34" rx="14" ry="13" fill="${furColor}" stroke="#111" stroke-width="2"/><ellipse cx="50" cy="43" rx="9" ry="7" fill="${accentColor}" stroke="#111" stroke-width="1.5"/>${angryEyes}<path d="M47 39h6l-3 4z" fill="#111"/><path d="M43 46q7 5 14 0" stroke="#111" stroke-width="1.6" fill="none"/><path d="M45 46l1.5 4 1.5-4M52 46l1.5 4 1.5-4" fill="#fff"/>`; // lobo
  }

  render() { return this.renderTail() + this.renderLegs() + this.renderTorso() + this.renderArms() + this.renderHead(); }
}

// FM (sprites de transformação) é indexado pelo nome da forma, sem o emoji. Cada função recebe a cor da fruta.
FM["Lobo"] = (furColor) => new HybridBeastmanSprite({ headType: "wolf", furColor, accentColor: "#d9dde3", hairColor: "#2a2018", tailTipColor: "#222222", trouserColor: "#1a1a22", coatColor: "#1a1a22", sashColor: "#c8231c" }).render();
FM["Híbrido"] = (scaleColor) => new HybridBeastmanSprite({ headType: "dragon", furColor: scaleColor, accentColor: "#e8c35a", hairColor: "#111111", hornColor: "#e8c35a", tailTipColor: "#e8c35a", trouserColor: "#2a3a2a", coatColor: "#3a2f7a", chestColor: "#2a64c0" }).render();

/** Dragão Azul oriental completo (Seiryu) com nuvens de chamas (Homuragumo) e barriga dourada. */
FM["Dragão Completo"] = (bodyColor) => `<g class="dragon-sway">
  <g fill="#ff9a1a" opacity=".9"><circle cx="14" cy="108" r="13"/><circle cx="34" cy="114" r="12"/><circle cx="60" cy="112" r="14"/><circle cx="84" cy="106" r="12"/></g>
  <g fill="#ffd34d" opacity=".9"><circle cx="20" cy="110" r="7"/><circle cx="46" cy="114" r="7"/><circle cx="72" cy="110" r="8"/></g>
  <path d="M4 100C24 52 38 108 60 78S86 52 90 40" stroke="#0b1d44" stroke-width="20" fill="none" stroke-linecap="round"/>
  <path d="M4 100C24 52 38 108 60 78S86 52 90 40" stroke="${bodyColor}" stroke-width="15" fill="none" stroke-linecap="round"/>
  <path d="M4 100C24 52 38 108 60 78S86 52 90 40" stroke="#e8c35a" stroke-width="5" fill="none" stroke-dasharray="2 3" stroke-linecap="round"/>
  <path d="M14 70l-4-12 9 6zM32 60l0-12 8 8zM54 76l2-12 8 8zM74 58l4-12 6 9z" fill="#0b1d44"/>
  <path d="M84 40Q86 20 100 22Q108 30 100 44Q94 52 84 48z" fill="${bodyColor}" stroke="#0b1d44" stroke-width="2"/>
  <path d="M90 22Q86 8 94 2M98 22Q100 8 104 4" stroke="#e8c35a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M86 34q-8 4-14 14M100 40q8 6 10 16" stroke="#e8c35a" stroke-width="2" fill="none"/>
  <circle cx="97" cy="30" r="2.6" fill="#ffe27a"/><path d="M96 42l2 6 2-6" fill="#fff"/><path d="M100 38q8 2 8 8-4-4-8-2z" fill="#ff7a1a"/></g>`;

/** Luffy no Gear 5: cabelo e roupa de nuvem branca, sorriso enorme, faixa roxa e sandálias. */
FM["Gear 5"] = () => `<circle cx="50" cy="52" r="52" fill="#ffffff" opacity=".28"/>
  <g fill="#fff" stroke="#cfd8ff" stroke-width="1.5"><circle cx="70" cy="46" r="8"/><circle cx="82" cy="40" r="9"/><circle cx="94" cy="30" r="8"/></g>
  <path d="M38 84L32 112M62 84L68 112" stroke="#f7d2a8" stroke-width="9" stroke-linecap="round"/>
  <ellipse cx="31" cy="116" rx="9" ry="4" fill="#8b5a2b" stroke="#111"/><ellipse cx="69" cy="116" rx="9" ry="4" fill="#8b5a2b" stroke="#111"/>
  <path d="M30 78h40l4 18H26z" fill="#fff" stroke="#cfd8ff" stroke-width="2"/><path d="M26 96q6 6 12 0t12 0 12 0 12 0" fill="#fff" stroke="#cfd8ff"/>
  <rect x="34" y="48" width="32" height="32" rx="8" fill="#f7d2a8" stroke="#111" stroke-width="2"/>
  <path d="M44 54l12 14M56 54l-12 14" stroke="#c8695a" stroke-width="2"/>
  <path d="M30 76h40v8H30z" fill="#7a4fd0" stroke="#111"/><path d="M66 80q16 4 22-6" stroke="#7a4fd0" stroke-width="5" fill="none"/>
  <path d="M36 52L18 38L20 22M64 52L84 60L96 52" stroke="#f7d2a8" stroke-width="9" fill="none" stroke-linecap="round"/>
  <circle cx="20" cy="20" r="7" fill="#f7d2a8" stroke="#111"/><circle cx="96" cy="52" r="7" fill="#f7d2a8" stroke="#111"/>
  <g fill="#fff" stroke="#cfd8ff" stroke-width="1.5"><circle cx="38" cy="20" r="9"/><circle cx="50" cy="13" r="10"/><circle cx="62" cy="20" r="9"/><circle cx="32" cy="30" r="6"/><circle cx="68" cy="30" r="6"/></g>
  <circle cx="50" cy="34" r="12" fill="#f7d2a8" stroke="#111" stroke-width="2"/>
  <path d="M38 36q12 14 24 0z" fill="#fff" stroke="#111" stroke-width="2"/>
  <circle cx="44" cy="30" r="3" fill="#fff" stroke="#111"/><circle cx="56" cy="30" r="3" fill="#fff" stroke="#111"/><circle cx="44" cy="30" r="1.4" fill="#d83a8a"/><circle cx="56" cy="30" r="1.4" fill="#d83a8a"/>`;

/* ----------------------- 5. TRANSFORMAÇÕES POR ESTÁGIO --------------------- */

/** Devolve uma "visão" da fruta com o nome da forma ATUAL (o motor antigo usa fruit.f para escolher o sprite). */
function currentFormView(fighter) {
  const availableForms = fighter.f.forms || [fighter.f.f];
  return { ...fighter.f, f: availableForms[Math.max(0, fighter.tf - 1)] };
}

/** Executa um estágio de transformação (híbrido -> completo) e aplica efeitos especiais da fruta. */
function performTransformation(fighter) {
  const availableForms = fighter.f.forms || [fighter.f.f];
  fighter.tf = Math.min(availableForms.length, fighter.tf + 1); // sobe um estágio
  B.tfi = B.t;                                                   // pede a animação de surgimento no próximo draw()
  B.log.push(`${fighter.n} se transforma: ${availableForms[fighter.tf - 1].slice(2)}! Ataques de fruta +${35 * fighter.tf}%.`);
  if (fighter.f.n.includes("Nika")) { // Tambores da Libertação: vida e haki renovados
    fighter.hp = Math.min(fighter.max, fighter.hp + Math.round(fighter.max * 0.2));
    fighter.hk = Math.min(100, fighter.hk + 30);
    B.log.push("Os Tambores da Libertação ecoam! Vida e haki renovados, e o campo fica elástico e divertido.");
    [0, 1, 2, 3].forEach((beat) => setTimeout(() => { if (typeof AC !== "undefined" && AC && mus) nt(70, 0.25, "sine", 0.3); }, beat * 220));
  }
}

/** Classe extra do palco: com Gear 5 ativo, o campo inteiro vira borracha (efeito no ambiente). */
function stageModifierClasses() {
  return B.p.some((fighter) => fighter.tf && fighter.f && fighter.f.n.includes("Nika")) ? " rubber-world" : "";
}

/** Domo azul do Room (visível enquanto algum lutador tiver o Room ativo). */
function roomDomeMarkup() { return B.p.some((fighter) => fighter.room) ? '<div class="room-dome"></div>' : ""; }

/* ------------------- 6. CHEFES: SKINS E SEGUNDA FORMA ---------------------- */

class BossSkinLibrary {
  /** Mistura a skin aleatória com a skin do chefe (índices de peças + cores exatas do anime). */
  static skinFor(bossName, baseSkin) {
    const definition = BOSS_SKIN_DEFINITIONS[bossName];
    if (!definition) return baseSkin;
    return {
      ...baseSkin, r: definition.raceIndex ?? baseSkin.r, hr: definition.hairStyleIndex ?? baseSkin.hr, h: definition.hatIndex ?? baseSkin.h,
      s: definition.shirtIndex ?? baseSkin.s, o: definition.shoesIndex ?? baseSkin.o, c: definition.capeIndex ?? baseSkin.c, sc: definition.scarIndex ?? baseSkin.sc,
      hairColor: definition.hairColor, hatColor: definition.hatColor, shirtColor: definition.shirtColor,
      pantsColor: definition.pantsColor, capeColor: definition.capeColor, skinColor: definition.skinColor
    };
  }
}

/** Chamado ao criar um chefe: aplica a skin do anime e registra a segunda forma (se existir). */
function configureBossFighter(bossFighter, bossName) {
  bossFighter.k = BossSkinLibrary.skinFor(bossName, bossFighter.k);
  if (BOSS_SECOND_FORM_DEFINITIONS[bossName]) bossFighter.secondForm = BOSS_SECOND_FORM_DEFINITIONS[bossName];
}

/** Chamado no início de next(): se um chefe com segunda forma "morreu" pela primeira vez, ele se levanta transformado. */
function reviveIfPossible() {
  B.p.forEach((fighter) => {
    if (fighter.hp > 0 || !fighter.secondForm || fighter.revived) return;
    const form = fighter.secondForm;
    fighter.revived = true;
    fighter.n = form.displayName;
    fighter.max = Math.round(fighter.max * form.healthMultiplier);
    fighter.hp = Math.round(fighter.max * form.reviveHealthFraction);
    fighter.atk *= form.attackMultiplier;
    fighter.sk = form.skillsText.split("|").map((entry) => { const [name, power] = entry.split(":"); return [name, Number(power)]; });
    fighter.k = { ...fighter.k, r: form.skinOverrides.raceIndex, skinColor: form.skinOverrides.skinColor, hairColor: form.skinOverrides.hairColor };
    B.log.push(form.message);
  });
}

/* --------------------------- 7. TELA DE RAÇAS ------------------------------ */

/** Tela dedicada às raças: mostra todas, indica as bloqueadas e deixa equipar as que você já tem. */
function showRaceScreen() {
  setMode(0);
  const equippedRace = RACES[S.sk.r];
  const raceCards = RACES.map((race, raceIndex) => {
    const isOwned = !!S.rc[raceIndex], isEquipped = S.sk.r === raceIndex;
    const action = !isOwned ? '<span class="off">Bloqueada (role no Gacha)</span>' : isEquipped ? "<b>Equipada ✓</b>" : `<button class="chip on" onclick="equipRace(${raceIndex})">Equipar</button>`;
    return `<div class="card" style="border-color:${RC[race.r]}"><h3 style="${cs(race.r)}">${race.i} ${race.n}</h3><small>${RN[race.r]}</small><p>${race.b}</p>${action}</div>`;
  }).join("");
  app.innerHTML = back() + `<div id="raceScreen"><h2>Raças</h2><div class="card"><div class="prev">${stick(S.sk, 0, 0, 1)}</div><b>Equipada: ${equippedRace.i} ${equippedRace.n}</b><br><small>${equippedRace.b}</small></div><div class="two">${raceCards}</div><small>Role raças no Gacha (baú de raça). A Lunar é a mais rara.</small></div>`;
}

/** Equipa uma raça já desbloqueada e atualiza a tela atual (raças, história ou marinheiro). */
function equipRace(raceIndex) {
  if (!S.rc[raceIndex]) return;
  S.sk.r = raceIndex;
  save();
  if (document.querySelector("#raceScreen")) showRaceScreen(); else RS();
}

/** Chips coloridos (cor da raridade) para equipar raças dentro das telas de História e Marinheiro. */
function raceChipsMarkup() {
  return `<div class="chips">${RACES.map((race, raceIndex) => S.rc[raceIndex] ? `<button class="chip" style="${rs(race.r, S.sk.r === raceIndex)}" onclick="equipRace(${raceIndex})">${race.i} ${race.n}</button>` : "").join("")}</div>`;
}

/* ------------------- 8. CENÁRIOS ANIMADOS E MAPA INTERATIVO ---------------- */

/** Cenário da batalha: o desenho antigo + nuvens, ondas e partículas em movimento por arco. */
function bgf() {
  const baseMarkup = legacyBackdropMarkup(), arcIndex = BGK[0], particles = ARC_BACKDROP_PARTICLES[arcIndex];
  let animatedLayers = `<i class="bg-wave-strip"></i>`;
  [0, 1, 2].forEach((index) => { animatedLayers += `<span class="bg-cloud" style="top:${6 + index * 14}%;animation-duration:${22 + index * 9}s;animation-delay:-${index * 8}s">☁️</span>`; });
  for (let index = 0; index < 6; index++) animatedLayers += `<span class="bg-particle" style="left:${8 + index * 16}%;top:${30 + (index % 3) * 18}%;animation-duration:${3 + index}s">${particles[index % 2]}</span>`;
  return baseMarkup.slice(0, -6) + animatedLayers + "</div>"; // insere antes do </div> final
}

/** Onda anterior (para animar o barco indo do nó antigo ao novo depois de vencer um NPC). */
let MAP_PREVIOUS_WAVE = 0;

/** Mapa interativo: ilhas, ondas, trilha animada, barco que navega entre as waves e botão de avançar. */
function mapv() {
  const viewedArc = VA < 0 ? S.arc : VA, theme = TH[viewedArc], columnX = [34, 92, 150, 208, 266];
  const nodePosition = (index) => [Math.floor(index / 5) % 2 ? columnX[4 - index % 5] : columnX[index % 5], 34 + Math.floor(index / 5) * 58];
  let pathData = "", nodesMarkup = "";
  for (let index = 0; index < 30; index++) {
    const [x, y] = nodePosition(index), waveNumber = index + 1, isBoss = waveNumber % 5 === 0;
    const isCurrent = viewedArc === S.arc && waveNumber === S.wave && !S.done;
    const isDone = viewedArc < S.arc || (viewedArc === S.arc && (waveNumber < S.wave || S.done));
    pathData += (index ? "L" : "M") + x + " " + y;
    nodesMarkup += `<g class="nd${isCurrent ? " cu" : ""}" onclick="mn(${waveNumber},${viewedArc})"><circle cx="${x}" cy="${y}" r="${isBoss ? 15 : 12}" fill="${isCurrent ? "#f2c230" : isDone ? "#3ddc84" : isBoss ? "#e8574a" : "#fffc"}" stroke="#10304f" stroke-width="${isCurrent ? 4 : 2}"/><text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="central" font-size="${isBoss ? 15 : 11}" font-weight="700" fill="#10304f">${isDone ? "✓" : waveNumber === 30 ? "👑" : isBoss ? "☠" : waveNumber}</text></g>`;
  }
  let shipMarkup = "";
  if (viewedArc === S.arc && !S.done) {
    const [currentX, currentY] = nodePosition(S.wave - 1);
    if (MAP_PREVIOUS_WAVE && MAP_PREVIOUS_WAVE === S.wave - 1) { // barco navegando do nó anterior ao atual
      const [previousX, previousY] = nodePosition(MAP_PREVIOUS_WAVE - 1);
      shipMarkup = `<text class="ship-slide" x="${previousX}" y="${previousY - 22}" style="--dx:${currentX - previousX}px;--dy:${currentY - previousY}px" text-anchor="middle" font-size="18">⛵</text>`;
    } else shipMarkup = `<text class="sh" x="${currentX}" y="${currentY - 22}" text-anchor="middle" font-size="18">⛵</text>`;
  }
  MAP_PREVIOUS_WAVE = 0;
  const islandsMarkup = `<g opacity=".9"><ellipse cx="62" cy="64" rx="24" ry="8" fill="#d8b86a"/><ellipse cx="62" cy="60" rx="16" ry="8" fill="#4cc38a"/><ellipse cx="240" cy="122" rx="22" ry="7" fill="#d8b86a"/><ellipse cx="240" cy="118" rx="14" ry="7" fill="#4cc38a"/><ellipse cx="46" cy="238" rx="20" ry="7" fill="#d8b86a"/><ellipse cx="46" cy="234" rx="12" ry="6" fill="#4cc38a"/><ellipse cx="258" cy="296" rx="22" ry="7" fill="#d8b86a"/><ellipse cx="258" cy="292" rx="14" ry="7" fill="#4cc38a"/></g><g font-size="14"><text x="60" y="60">🌴</text><text x="238" y="118">🌴</text><text x="44" y="234">🏝️</text><text x="256" y="292">🌴</text></g>`;
  const arcButtons = ARC.map((arc, arcIndex) => `<button class="chip${arcIndex === viewedArc ? " on" : ""}" onclick="va(${arcIndex})">${arcIndex < S.arc ? "✓" : arcIndex > S.arc ? "🔒" : "⚓"}${arcIndex + 1}</button>`).join("");
  setTimeout(() => { if (document.querySelector("#mi") && viewedArc === S.arc && !S.done) mn(S.wave, viewedArc); }, 0); // painel já mostra o botão de avançar
  return `<div class="chips ac">${arcButtons}</div><div class="map"><div class="mt">Arco ${viewedArc + 1}: ${ARC[viewedArc][0]}</div><div class="sea" style="--c1:${theme[0]};--c2:${theme[1]}"><i class="bg-wave-strip map-waves"></i>${theme[2].map((emoji, decorIndex) => `<span class="dc" style="left:${DP[decorIndex][0]};top:${DP[decorIndex][1]}">${emoji}</span>`).join("")}<span class="cp">🧭</span><svg viewBox="0 0 300 340">${islandsMarkup}<path class="trail" d="${pathData}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>${nodesMarkup}${shipMarkup}</svg></div><div id="mi" class="mi">Toque numa wave para ver os detalhes.</div></div>`;
}

/* ------------------------------ 9. INICIALIZAÇÃO --------------------------- */
FruitDataUpdater.apply();   // aplica as novas frutas, golpes, buff das espadas e missões extras
