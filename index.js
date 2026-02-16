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
  const isEspecial = member.roles.cache.has(IDS.CARGO_ESPECIAL);
  if (isStaff || isEspecial) return;

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

async function muteMember(member, motivo, msg = null, duration = MUTE_DURATION) {
  const muteRole = await getMuteRole(member.guild);
  if (member.roles.cache.has(muteRole.id)) return;
  await member.roles.add(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado")
    .setDescription(`${member} foi mutado automaticamente`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: `${duration / 60000} minutos` },
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

async function muteCall(member, motivo, durationMs, msg = null) {
  if (!member.voice?.channel) return;
  try { await member.voice.setMute(true); } catch { return; }

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

  setTimeout(async () => {
    try { await member.voice.setMute(false); } catch {}
  }, durationMs);
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
// MESSAGE CREATE
// =============================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  handleSpam(message);

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (!canUseCommand(message.member, command)) return;

  // ----------------------------
  // THL!REC (ATUALIZADO CORRETAMENTE)
  // ----------------------------
  if (command === "rec") {

    const user = message.mentions.members.first();
    if (!user) {
      return message.reply("Mencione um usuário válido.");
    }

    const subCommand = args.slice(1).join(" ").toLowerCase().trim();

    try {

      if (subCommand === "add menina") {
        await user.roles.add([
          "1472223890821611714",
          "1468283328510558208",
          "1468026315285205094"
        ]);
        return message.reply(`Cargos "menina" adicionados em ${user}`);
      }

      if (subCommand === "add") {
        await user.roles.add([
          "1468283328510558208",
          "1468026315285205094"
        ]);
        return message.reply(`Cargos adicionados em ${user}`);
      }

      if (subCommand === "remove") {
        await user.roles.remove([
          "1468024885354959142"
        ]);
        return message.reply(`Cargos removidos de ${user}`);
      }

      return message.reply("Use: thl!rec <@usuário> add, remove ou add menina");

    } catch (error) {
      console.error("Erro no comando rec:", error);
      return message.reply("Erro ao executar comando. Verifique a hierarquia dos cargos.");
    }
  }

  // ----------------------------
  // THL!MUTECHAT
  // ----------------------------
  if (command === "mutechat") {
    const user = message.mentions.members.first();
    const timeArg = args[1];
    const motivo = args.slice(2).join(" ") || "Sem motivo";
    const duration = parseDuration(timeArg) || MUTE_DURATION;
    if (!user) return message.reply("Mencione um usuário válido.");
    await muteMember(user, motivo, message, duration);
    return;
  }

  if (command === "unmutechat") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("Mencione um usuário válido.");
    await unmuteMember(user, message);
    return;
  }

  // ----------------------------
  // THL!MUTECALL
  // ----------------------------
  if (command === "mutecall") {
    const user = message.mentions.members.first();
    const timeArg = args[1];
    const motivo = args.slice(2).join(" ") || "Sem motivo";
    const duration = parseDuration(timeArg) || MUTE_DURATION;
    if (!user) return message.reply("Mencione um usuário válido.");
    await muteCall(user, motivo, duration, message);
    return;
  }

  if (command === "unmutecall") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("Mencione um usuário válido.");
    await unmuteCall(user, message);
    return;
  }
});

// =============================
// TICKET CREATE AUTOMÁTICO
// =============================
client.on("channelCreate", async (channel) => {
  if (channel.type === 0 && channel.parentId === IDS.TICKET_CATEGORY) {
    channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
  }
});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);
