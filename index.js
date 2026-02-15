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
  const isEspecial = member.roles.cache.has(IDS.CARGO_ESPECIAL);
  if (isStaff || isEspecial) return;

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
// CAPSLOCK / MENSAGENS COM #
// =============================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const member = message.member;
  const content = message.content;

  const isAuthorized = IDS.STAFF.some(id => member.roles.cache.has(id));

  if (!isAuthorized) {
    const letters = content.replace(/[^a-zA-Z]/g, "");
    const firstUpperIndex = letters.search(/[A-Z]/);
    let upperLettersCount = 0;
    if (firstUpperIndex !== -1) {
      const lettersFromFirstUpper = letters.slice(firstUpperIndex);
      upperLettersCount = lettersFromFirstUpper.replace(/[^A-Z]/g, "").length;
      var upperRatio = lettersFromFirstUpper.length ? upperLettersCount / lettersFromFirstUpper.length : 0;
    } else {
      var upperRatio = 0;
    }

    if (upperRatio > 0.7 || content.includes("#")) {
      try {
        await message.delete();
        const embed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("⚠ Mensagem removida")
          .setDescription(`${member} digitou mensagem em CAPSLOCK ou com #`)
          .setTimestamp();
        sendLog(message.guild, embed);
      } catch (err) {
        console.error("Erro ao deletar mensagem:", err);
      }
      return;
    }
  }

  handleSpam(message);
});

// =============================
// COMANDOS
// =============================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot || !message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const member = message.member;

  if (!canUseCommand(member, command)) return;

  // =============================
  // RECRUTAMENTO (add / remove)
  // =============================
  if (command === "rec") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("Mencione alguém.");
    const action = args[0]?.toLowerCase();

    let rolesToAdd = [];
    let rolesToRemove = [];

    if (action === "add") {
      if (args[1] === "menina") {
        rolesToAdd = [
          "1468283328510558208",
          "1468026315285205094",
          "1470715382489677920"
        ];
      } else {
        rolesToAdd = [
          "1468283328510558208",
          "1468026315285205094"
        ];
      }
      await target.roles.add(rolesToAdd);
      message.channel.send(`✅ ${target} recebeu os cargos.`);
    } else if (action === "remove") {
      rolesToRemove = ["1468024885354959142"];
      await target.roles.remove(rolesToRemove);
      message.channel.send(`✅ ${target} perdeu os cargos.`);
    }
  }

  // =============================
  // MUTE / UNMUTE CHAT
  // =============================
  if (command === "mutechat" || command === "unmutechat") {
    const target = message.mentions.members.first();
    const time = parseDuration(args[1]);
    const reason = args.slice(2).join(" ") || "Sem motivo";

    if (!target) return message.reply("Mencione alguém.");
    if (command === "mutechat") {
      await target.timeout(time ?? null, reason).catch(() => {});
      message.channel.send(`✅ ${target} foi mutado no chat por ${time ? args[1] : "indefinidamente"} | Motivo: ${reason}`);
    } else {
      await target.timeout(null).catch(() => {});
      message.channel.send(`✅ ${target} foi desmutado no chat.`);
    }
  }

  // =============================
  // MUTE / UNMUTE CALL
  // =============================
  if (command === "mutecall" || command === "unmutecall") {
    const target = message.mentions.members.first();
    const time = parseDuration(args[1]);
    const reason = args.slice(2).join(" ") || "Sem motivo";

    if (!target) return message.reply("Mencione alguém.");
    if (command === "mutecall") {
      if (target.voice.channel) await target.voice.setMute(true, reason);
      message.channel.send(`✅ ${target} foi mutado na call por ${time ? args[1] : "indefinidamente"} | Motivo: ${reason}`);
      if (time) setTimeout(() => target.voice.setMute(false, "Tempo de mute expirou"), time);
    } else {
      if (target.voice.channel) await target.voice.setMute(false);
      message.channel.send(`✅ ${target} foi desmutado na call.`);
    }
  }
});

// =============================
// TICKET MENTION
// =============================
client.on("channelCreate", async (channel) => {
  if (channel.type === ChannelType.GuildText && channel.parentId === IDS.TICKET_CATEGORY) {
    channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
  }
});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);
