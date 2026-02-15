// =============================
// IMPORTS
// =============================
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ChannelType 
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

const canUseCommand = (member, command) => {
  const isStaff = IDS.STAFF.some(id => member.roles.cache.has(id));
  const hasSpecial = member.roles.cache.has(IDS.CARGO_ESPECIAL);
  const allowedSpecialCommands = ["rec"];
  return isStaff || (hasSpecial && allowedSpecialCommands.includes(command));
};

// =============================
// SPAM / BIG MESSAGES
// =============================
const messageHistory = new Map();
const bigMessageHistory = new Map();

async function handleSpam(message) {
  if (!message.guild || message.author.bot) return;
  const { member, author, content } = message;
  const userId = author.id;
  const now = Date.now();
  const isStaff = IDS.STAFF.some(id => member.roles.cache.has(id));
  if (isStaff) return;

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

async function muteCall(member, time, motivo, msg = null) {
  if (!member.voice?.channel) return;
  try { await member.voice.setMute(true); } catch { return; }

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado na Call")
    .setDescription(`${member} foi mutado na call`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: time },
      { name: "📄 Motivo", value: motivo },
      { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);

  const durMs = parseDuration(time);
  if (durMs) setTimeout(async () => { try { await member.voice.setMute(false); } catch {} }, durMs);
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
// REC COMMAND
// =============================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // SPAM / CAPSLOCK
  handleSpam(message);

  const staffIds = IDS.STAFF;

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  // REC
  if (command === "rec") {
    if (!staffIds.some(id => message.member.roles.cache.has(id))) {
      return message.reply("Você não tem permissão para usar este comando!");
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply("Marque um usuário para dar ou remover cargo.");

    const subCommand = args[0]?.toLowerCase();

    try {
      if (subCommand === "add") {
        await member.roles.add(["1468283328510558208","1468026315285205094"]);
        message.channel.send(`Cargos adicionados a ${member}`);
      } else if (subCommand === "remove") {
        await member.roles.remove(["1468024885354959142"]);
        message.channel.send(`Cargos removidos de ${member}`);
      } else if (subCommand === "add" && args[1]?.toLowerCase() === "menina") {
        await member.roles.add(["1468283328510558208","1468026315285205094","1470715382489677920"]);
        message.channel.send(`Cargos "menina" adicionados a ${member}`);
      } else {
        message.reply("Use: add, remove ou add menina");
      }
    } catch (err) {
      console.error(err);
      message.reply("Erro ao executar comando.");
    }
  }
});

// =============================
// NOVOS CANAIS DE TICKET
// =============================
client.on("channelCreate", async (channel) => {
  if (channel.type !== 0) return;
  if (
    channel.parentId === IDS.TICKET_CATEGORY ||
    channel.name.toLowerCase().includes("ticket")
  ) {
    try {
      await channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
    } catch (err) { console.error("Erro ao enviar menção no canal:", err); }
  }
});

// =============================
// BOT LOGIN
// =============================
client.login(process.env.TOKEN);
