// =============================
// IMPORTS
// =============================
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder
} = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =============================
// CONFIG
// =============================
const PREFIX = "thl!";

const IDS = {
  STAFF: [
    "1468017578747105390",
    "1468069638935150635"
  ],
  CARGO_ESPECIAL: "1468066422490923081",
  LOG_CHANNEL: "1468722726247338115",
  RULES_CHANNEL: "1468011045166518427",
  TICKET_CATEGORY: "1468014890500489447",
  RECRUITMENT_ROLE: "1468024687031484530"
};

// =============================
// UTILS
// =============================
const parseDuration = (time) => {
  const match = time?.match(/^(\d+)([mh])$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  return unit === "m" ? value * 60_000 : unit === "h" ? value * 3_600_000 : null;
};

const sendLog = (guild, embed) => {
  const channel = guild.channels.cache.get(IDS.LOG_CHANNEL);
  if (channel) channel.send({ embeds: [embed] });
};

// =============================
// MUTE / UNMUTE
// =============================
const MUTE_DURATION = 2 * 60 * 1000;

async function getMuteRole(guild) {
  let role = guild.roles.cache.find(r => r.name === "Muted");
  if (!role) {
    role = await guild.roles.create({ name: "Muted", permissions: [] });
  }
  return role;
}

async function muteMember(member, motivo, msg = null) {
  const muteRole = await getMuteRole(member.guild);
  if (member.roles.cache.has(muteRole.id)) return;
  await member.roles.add(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado")
    .setDescription(`${member} foi mutado`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: "2 minutos" },
      { name: "📄 Motivo", value: motivo },
      { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);

  setTimeout(async () => {
    try {
      if (member.roles.cache.has(muteRole.id)) await member.roles.remove(muteRole);
    } catch {}
  }, MUTE_DURATION);
}

async function unmuteMember(member, msg = null) {
  const muteRole = member.guild.roles.cache.find(r => r.name === "Muted");
  if (!muteRole || !member.roles.cache.has(muteRole.id)) return;
  await member.roles.remove(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("🔊 Usuário Desmutado")
    .setDescription(`${member} foi desmutado`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);
}

async function muteCall(member, tempo, motivo, msg = null) {
  if (!member.voice?.channel) return;
  try { await member.voice.setMute(true); } catch { return; }

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado na Call")
    .setDescription(`${member} foi mutado na call`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: tempo || "Indefinido" },
      { name: "📄 Motivo", value: motivo || "Não especificado" },
      { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);

  if (tempo) {
    const t = parseDuration(tempo);
    if (t) setTimeout(async () => { try { await member.voice.setMute(false); } catch {} }, t);
  }
}

async function unmuteCall(member, msg = null) {
  if (!member.voice?.channel) return;
  try { await member.voice.setMute(false); } catch { return; }

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("🎙 Usuário Desmutado na Call")
    .setDescription(`${member} foi desmutado na call`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);
}

// =============================
// SPAM / CAPS / BIG TEXT
// =============================
const messageHistory = new Map();
const bigMessageHistory = new Map();

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const { member, content, channel } = message;

  // Staff não sofre punições
  if (IDS.STAFF.some(id => member.roles.cache.has(id))) return;

  // ================= SPAM =================
  const userId = message.author.id;
  const now = Date.now();

  // Mensagem grande
  if (!channel.parentId === IDS.TICKET_CATEGORY && content.length >= 200) {
    const history = bigMessageHistory.get(userId) ?? [];
    history.push(now);
    if (history.length > 3) history.shift();
    bigMessageHistory.set(userId, history);
    if (history.length >= 3) {
      await muteMember(member, "Spam de texto grande", message);
      bigMessageHistory.set(userId, []);
      return;
    }
  }

  // Spam rápido
  const history = messageHistory.get(userId) ?? [];
  const filtered = [...history, now].filter(t => now - t <= 5000);
  messageHistory.set(userId, filtered);
  if (filtered.length >= 5) {
    await muteMember(member, "Spam de palavras rápidas", message);
    messageHistory.set(userId, []);
    return;
  }

  // ================= CAPSLOCK =================
  if (!channel.parentId === IDS.TICKET_CATEGORY) {
    let upperCount = (content.match(/[A-Z]/g) || []).length;
    if (upperCount >= 5) message.delete().catch(() => {});
  }

  // ================= PALAVRAS CHAVE =================
  const KEYWORDS = [
    { regex: /\bsetamento\b/i, reply: "Confira o canal <#1468020392005337161>", color: "Blue", deleteAfter: 30000 },
    { regex: /\bfaixas?\srosa\b/i, reply: "Servidor das Faixas Rosa da Tropa da Holanda. Somente meninas: https://discord.gg/seaaSXG5yJ", color: "Pink", deleteAfter: 15000 },
    { regex: /\bregras\b/i, reply: `<#${IDS.RULES_CHANNEL}>`, color: "Yellow", deleteAfter: 300000 },
    { regex: /\blink da tropa\b/i, reply: "Aqui está o link da Tropa da Holanda: https://discord.gg/tropadaholanda", color: "Purple", deleteAfter: 30000 }
  ];

  for (const k of KEYWORDS) {
    if (k.regex.test(content)) {
      try {
        const sent = await channel.send(k.reply);
        setTimeout(() => sent.delete().catch(() => {}), k.deleteAfter);
        const embed = new EmbedBuilder()
          .setColor(k.color)
          .setTitle("📌 Palavra Detectada")
          .setDescription(`${member} digitou palavra-chave`)
          .setTimestamp();
        sendLog(message.guild, embed);
        break;
      } catch (err) { console.error(err); }
    }
  }

  // ================= COMANDOS =================
  if (!content.startsWith(PREFIX)) return;
  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args[0].toLowerCase();

  // ----------------- REC -----------------
  if (cmd === "rec") {
    if (!IDS.STAFF.some(id => member.roles.cache.has(id))) return message.reply("❌ Você não tem permissão.");
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Mencione alguém.");

    const action = args[2]?.toLowerCase();
    const extra = args[3]?.toLowerCase();

    if (action === "add") {
      let rolesToAdd = ["1468283328510558208", "1468026315285205094"];
      if (extra === "menina") rolesToAdd.push("1470715382489677920");
      await target.roles.add(rolesToAdd).catch(() => message.reply("❌ Erro ao adicionar cargos."));
      return message.channel.send(`✅ ${target} recebeu: ${rolesToAdd.join(", ")}`);
    }

    if (action === "remove") {
      const rolesToRemove = ["1468024885354959142"];
      await target.roles.remove(rolesToRemove).catch(() => message.reply("❌ Erro ao remover cargos."));
      return message.channel.send(`✅ ${target} perdeu: ${rolesToRemove.join(", ")}`);
    }

    return message.reply("❌ Use: thl!rec @usuário add [menina] ou remove");
  }

  // ----------------- MUTE CHAT -----------------
  if (cmd === "mutechat") {
    if (!IDS.STAFF.some(id => member.roles.cache.has(id))) return message.reply("❌ Sem permissão.");
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Mencione alguém.");
    const motivo = args[2] || "Não especificado";
    await muteMember(target, motivo, message);
  }

  if (cmd === "unmutechat") {
    if (!IDS.STAFF.some(id => member.roles.cache.has(id))) return message.reply("❌ Sem permissão.");
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Mencione alguém.");
    await unmuteMember(target, message);
  }

  // ----------------- MUTE CALL -----------------
  if (cmd === "mutecall") {
    if (!IDS.STAFF.some(id => member.roles.cache.has(id))) return message.reply("❌ Sem permissão.");
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Mencione alguém.");
    const tempo = args[2]; 
    const motivo = args.slice(3).join(" ") || "Não especificado";
    await muteCall(target, tempo, motivo, message);
  }

  if (cmd === "unmutecall") {
    if (!IDS.STAFF.some(id => member.roles.cache.has(id))) return message.reply("❌ Sem permissão.");
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Mencione alguém.");
    await unmuteCall(target, message);
  }
});

// =============================
// EVENTO CREATE CHANNEL (TICKET)
// =============================
client.on("channelCreate", async channel => {
  if (channel.parentId === IDS.TICKET_CATEGORY || channel.name.toLowerCase().includes("ticket")) {
    channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
  }
});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);
