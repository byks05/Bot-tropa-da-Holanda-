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
  CARGO_ESPECIAL: "1468066422490923081", // Apenas para thl!rec
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

const canUseCommand = (member, command) => {
  const isStaff = IDS.STAFF.some(id => member.roles.cache.has(id));
  const allowedSpecialCommands = ["rec"];
  return isStaff || (command === "rec" && member.roles.cache.has(IDS.CARGO_ESPECIAL));
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

async function muteMember(member, motivo, msg = null, duration = MUTE_DURATION) {
  const muteRole = await getMuteRole(member.guild);
  if (member.roles.cache.has(muteRole.id)) return;
  await member.roles.add(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado")
    .setDescription(`${member} foi mutado`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: `${duration/60000} minutos` },
      { name: "📄 Motivo", value: motivo ?? "Não especificado" },
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
  }, duration);
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

async function muteCall(member, motivo, msg = null, duration = MUTE_DURATION) {
  if (!member.voice.channel) return;
  try { await member.voice.setMute(true); } catch { return; }

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado na Call")
    .setDescription(`${member} foi mutado`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: `${duration/60000} minutos` },
      { name: "📄 Motivo", value: motivo ?? "Não especificado" },
      { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);

  setTimeout(async () => {
    try { if (member.voice.mute) await member.voice.setMute(false); } catch {}
  }, duration);
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
// EVENTO MESSAGE CREATE
// =============================
const messageHistory = new Map();
const bigMessageHistory = new Map();

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const member = message.member;
  const content = message.content;

  // --- MENÇÃO AUTOMÁTICA NO TICKET ---
  if (
    message.channel.parentId === IDS.TICKET_CATEGORY || 
    message.channel.name.toLowerCase().includes("ticket")
  ) {
    await message.channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
  }

  // --- SPAM / TEXTO GRANDE / CAPSLOCK ---
  const userId = message.author.id;
  const isStaff = IDS.STAFF.some(id => member.roles.cache.has(id));

  if (!isStaff && message.channel.parentId !== IDS.TICKET_CATEGORY) {
    // CapsLock
    const upperLetters = content.replace(/[^A-Z]/g, "").length;
    if (upperLetters >= 5) {
      await message.delete().catch(() => {});
      await message.channel.send(`${member}, mensagens em caps lock não são permitidas.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      return;
    }

    // Texto grande
    if (content.length >= 200) {
      const history = bigMessageHistory.get(userId) ?? [];
      history.push(Date.now());
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
    const filtered = [...history, Date.now()].filter(t => Date.now() - t <= 5000);
    messageHistory.set(userId, filtered);
    if (filtered.length >= 5) {
      await muteMember(member, "Spam de palavras rápidas", message);
      messageHistory.set(userId, []);
      return;
    }
  }

  // --- COMANDOS ---
  if (!content.startsWith(PREFIX)) return;
  const args = content.trim().split(/\s+/);
  const command = args[0].slice(PREFIX.length).toLowerCase();

  if (!canUseCommand(member, command)) return;

  // --- THL!REC ---
  if (command === "rec") {
    const sub = args[2]?.toLowerCase();
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Usuário não encontrado.");

    const addIds = ["1468283328510558208","1468026315285205094"];
    const addMeninaIds = ["1468283328510558208","1468026315285205094","1470715382489677920"];
    const removeIds = ["1468024885354959142"];

    try {
      if (sub === "add") await target.roles.add(addIds);
      else if (sub === "remove") await target.roles.remove(removeIds);
      else if (sub === "menina") await target.roles.add(addMeninaIds);
      else return message.reply("❌ Subcomando inválido. Use add, remove ou menina.");
      await message.reply(`✅ Comando executado com sucesso.`);
    } catch (err) { console.error(err); message.reply("❌ Não foi possível executar o comando."); }
  }

  // --- MUTE / UNMUTE ---
  if (command === "mutechat") {
    const target = message.mentions.members.first();
    const duration = parseDuration(args[2]) ?? MUTE_DURATION;
    const motivo = args.slice(3).join(" ") || null;
    if (!target) return message.reply("❌ Usuário não encontrado.");
    await muteMember(target, motivo, message, duration);
  }

  if (command === "unmutechat") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Usuário não encontrado.");
    await unmuteMember(target, message);
  }

  if (command === "mutecall") {
    const target = message.mentions.members.first();
    const duration = parseDuration(args[2]) ?? MUTE_DURATION;
    const motivo = args.slice(3).join(" ") || null;
    if (!target) return message.reply("❌ Usuário não encontrado.");
    await muteCall(target, motivo, message, duration);
  }

  if (command === "unmutecall") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Usuário não encontrado.");
    await unmuteCall(target, message);
  }
});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);
