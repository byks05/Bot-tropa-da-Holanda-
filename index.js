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

const canUseCommand = (member) => {
  return IDS.STAFF.some(id => member.roles.cache.has(id));
};

// =============================
// SPAM / BIG MESSAGES / CAPSLOCK
// =============================
const messageHistory = new Map();
const bigMessageHistory = new Map();

async function handleSpam(message) {
  const { member, author, content, channel } = message;
  if (!message.guild || author.bot) return;
  if (canUseCommand(member)) return; // staff ignorada

  const isTicketChannel = channel.parentId === IDS.TICKET_CATEGORY || channel.name.toLowerCase().includes("ticket");
  if (isTicketChannel) return; // libera tudo nos tickets

  const userId = author.id;
  const now = Date.now();

  // Texto grande
  if (content.length >= 200) {
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
  }

  // CAPSLOCK / #
  let capsCount = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char >= "A" && char <= "Z") capsCount++;
    if (char === "#") capsCount++;
  }
  if (capsCount >= 2) {
    await message.delete().catch(() => {});
    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("⚠️ Mensagem apagada")
      .setDescription(`${member} enviou mensagem em capslock ou com #`)
      .setTimestamp();
    sendLog(message.guild, embed);
    return;
  }
}

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
    .setDescription(`${member} foi mutado automaticamente`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: "2 minutos" },
      { name: "📄 Motivo", value: motivo },
      { name: "👮 Staff", value: msg ? msg.client.user.tag : "Sistema" }
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
    .addFields({ name: "🆔 ID", value: member.id }, { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" })
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);
}

async function muteCall(member, durationMs, motivo, msg = null) {
  if (!member.voice?.channel) return;
  try { await member.voice.setMute(true); } catch { return; }
  setTimeout(async () => {
    try { await member.voice.setMute(false); } catch {}
  }, durationMs);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado na Call")
    .setDescription(`${member} foi mutado na call`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: `${durationMs / 60000} minutos` },
      { name: "📄 Motivo", value: motivo },
      { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);
}

async function unmuteCall(member, msg = null) {
  if (!member.voice?.channel) return;
  try { await member.voice.setMute(false); } catch { return; }

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("🎙 Usuário Desmutado na Call")
    .setDescription(`${member} foi desmutado na call`)
    .addFields({ name: "🆔 ID", value: member.id }, { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" })
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);
}

// =============================
// MESSAGE CREATE
// =============================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // --- SPAM / CAPSLOCK / MENSAGENS GRANDES ---
  handleSpam(message);

  // --- PALAVRAS-CHAVE ---
  const KEYWORDS = [
    { regex: /\bsetamento\b/i, reply: "Confira o canal <#1468020392005337161>", color: "Blue", deleteAfter: 30000 },
    { regex: /\bfaixas?\srosa\b/i, reply: "Servidor das Faixas Rosa da Tropa da Holanda. Somente meninas: https://discord.gg/seaaSXG5yJ", color: "Pink", deleteAfter: 15000 },
    { regex: /\bregras\b/i, reply: `<#${IDS.RULES_CHANNEL}>`, color: "Yellow", deleteAfter: 300000 },
    { regex: /\blink da tropa\b/i, reply: "Aqui está o link da Tropa da Holanda: https://discord.gg/tropadaholanda", color: "Purple", deleteAfter: 30000 }
  ];

  for (const k of KEYWORDS) {
    if (k.regex.test(message.content)) {
      try {
        const sent = await message.channel.send(k.reply);
        setTimeout(() => sent.delete().catch(() => {}), k.deleteAfter);
        const embed = new EmbedBuilder().setColor(k.color).setTitle("📌 Palavra Detectada").setDescription(`${message.author} digitou palavra-chave`).setTimestamp();
        sendLog(message.guild, embed);
        break;
      } catch (err) { console.error(err); }
    }
  }

  // --- COMANDOS ---
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "rec") {
    if (!canUseCommand(message.member)) return;
    const target = message.mentions.members.first();
    if (!target) return message.reply("Mencione alguém para usar este comando.");
    const action = args[0]?.toLowerCase();
    const roleName = args[1]?.toLowerCase();

    if (action === "add") {
      let rolesToAdd = ["1468283328510558208", "1468026315285205094"];
      if (roleName === "menina") rolesToAdd.push("1470715382489677920");
      await target.roles.add(rolesToAdd);
      message.channel.send(`✅ ${target} recebeu os cargos.`);
    } else if (action === "remove") {
      await target.roles.remove(["1468024885354959142"]);
      message.channel.send(`✅ ${target} teve os cargos removidos.`);
    }
  }

  if (cmd === "mutechat") {
    if (!canUseCommand(message.member)) return;
    const target = message.mentions.members.first();
    const motivo = args.slice(1).join(" ") || "Sem motivo";
    if (!target) return;
    await muteMember(target, motivo, message);
  }

  if (cmd === "unmutechat") {
    if (!canUseCommand(message.member)) return;
    const target = message.mentions.members.first();
    if (!target) return;
    await unmuteMember(target, message);
  }

  if (cmd === "mutecall") {
    if (!canUseCommand(message.member)) return;
    const target = message.mentions.members.first();
    const durationMs = parseDuration(args[1]) || 2 * 60_000;
    const motivo = args.slice(2).join(" ") || "Sem motivo";
    if (!target) return;
    await muteCall(target, durationMs, motivo, message);
  }

  if (cmd === "unmutecall") {
    if (!canUseCommand(message.member)) return;
    const target = message.mentions.members.first();
    if (!target) return;
    await unmuteCall(target, message);
  }
});

// =============================
// NOVO CANAL DE TICKET
// =============================
client.on("channelCreate", async (channel) => {
  if (channel.type !== 0) return; // apenas texto
  if (channel.parentId !== IDS.TICKET_CATEGORY && !channel.name.toLowerCase().includes("ticket")) return;
  channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);
