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
  return unit === "m" ? value * 60000 : value * 3600000;
};

const sendLog = (guild, embed) => {
  const channel = guild.channels.cache.get(IDS.LOG_CHANNEL);
  if (channel) channel.send({ embeds: [embed] });
};

const canUseCommand = (member) => {
  return IDS.STAFF.some(id => member.roles.cache.has(id));
};

// =============================
// MUTE ROLE
// =============================
async function getMuteRole(guild) {
  let role = guild.roles.cache.find(r => r.name === "Muted");
  if (!role) {
    role = await guild.roles.create({ name: "Muted", permissions: [] });
  }
  return role;
}

// =============================
// MUTE CHAT
// =============================
async function muteMember(member, motivo, duration, msg) {
  const muteRole = await getMuteRole(member.guild);
  if (member.roles.cache.has(muteRole.id)) return;

  await member.roles.add(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado (Chat)")
    .setDescription(`${member} foi mutado`)
    .addFields(
      { name: "Motivo", value: motivo },
      { name: "Tempo", value: `${duration / 60000} minutos` }
    )
    .setTimestamp();

  msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);

  setTimeout(async () => {
    if (member.roles.cache.has(muteRole.id)) {
      await member.roles.remove(muteRole);
    }
  }, duration);
}

async function unmuteMember(member, msg) {
  const muteRole = member.guild.roles.cache.find(r => r.name === "Muted");
  if (!muteRole) return;

  await member.roles.remove(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("🔊 Usuário Desmutado (Chat)")
    .setDescription(`${member} foi desmutado`)
    .setTimestamp();

  msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);
}

// =============================
// MUTE CALL
// =============================
async function muteCall(member, motivo, duration, msg) {
  if (!member.voice?.channel) {
    return msg.reply("Usuário não está em call.");
  }

  await member.voice.setMute(true);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado (Call)")
    .setDescription(`${member} foi mutado na call`)
    .addFields(
      { name: "Motivo", value: motivo },
      { name: "Tempo", value: `${duration / 60000} minutos` }
    )
    .setTimestamp();

  msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);

  setTimeout(async () => {
    await member.voice.setMute(false).catch(() => {});
  }, duration);
}

async function unmuteCall(member, msg) {
  if (!member.voice?.channel) {
    return msg.reply("Usuário não está em call.");
  }

  await member.voice.setMute(false);

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("🎙 Usuário Desmutado (Call)")
    .setDescription(`${member} foi desmutado na call`)
    .setTimestamp();

  msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);
}

// =============================
// MESSAGE CREATE
// =============================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (!canUseCommand(message.member)) return;

  // =============================
  // THL!REC
  // =============================
  if (command === "rec") {

    const user = message.mentions.members.first();
    if (!user) return message.reply("Mencione um usuário válido.");

    const subCommand = args.join(" ").toLowerCase().trim();

    if (subCommand === "add menina") {

      await user.roles.remove("1468024885354959142");

      await user.roles.add([
        "1472223890821611714",
        "1468283328510558208",
        "1468026315285205094"
      ]);

      return message.reply(`Cargos "menina" aplicados em ${user}`);
    }

    if (subCommand === "add") {

      await user.roles.remove("1468024885354959142");

      await user.roles.add([
        "1468283328510558208",
        "1468026315285205094"
      ]);

      return message.reply(`Cargos aplicados em ${user}`);
    }

    return message.reply("Use: thl!rec <@usuário> add ou add menina");
  }

  // =============================
  // MUTECHAT
  // =============================
  if (command === "mutechat") {
    const user = message.mentions.members.first();
    const duration = parseDuration(args[1]) || 120000;
    const motivo = args.slice(2).join(" ") || "Sem motivo";

    if (!user) return message.reply("Mencione um usuário válido.");
    await muteMember(user, motivo, duration, message);
  }

  if (command === "unmutechat") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("Mencione um usuário válido.");
    await unmuteMember(user, message);
  }

  // =============================
  // MUTECALL
  // =============================
  if (command === "mutecall") {
    const user = message.mentions.members.first();
    const duration = parseDuration(args[1]) || 120000;
    const motivo = args.slice(2).join(" ") || "Sem motivo";

    if (!user) return message.reply("Mencione um usuário válido.");
    await muteCall(user, motivo, duration, message);
  }

  if (command === "unmutecall") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("Mencione um usuário válido.");
    await unmuteCall(user, message);
  }

});

// =============================
// TICKET CREATE
// =============================
client.on("channelCreate", async (channel) => {
  if (channel.type === 0 && channel.parentId === IDS.TICKET_CATEGORY) {
    channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
  }
});

// =============================
client.login(process.env.TOKEN);
