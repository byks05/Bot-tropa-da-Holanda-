const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const prefix = "thl!";
const allowedRoleId = "1471998602577711337";

client.on('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// ===============================
// ⏳ CONVERTER TEMPO
// ===============================
function parseTime(time) {
  const unit = time.slice(-1);
  const value = parseInt(time.slice(0, -1));

  if (unit === "s") return value * 1000;
  if (unit === "m") return value * 60000;
  if (unit === "h") return value * 3600000;

  return null;
}

// ===============================
// 📜 ENVIAR LOG
// ===============================
async function sendLog(guild, embed) {
  const logChannel = guild.channels.cache.find(c => c.name === "logs");
  if (logChannel) {
    logChannel.send({ embeds: [embed] });
  }
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ===============================
  // 🔇 MUTE CHAT
  // ===============================
  if (command === "mutechat") {

    if (!message.member.roles.cache.has(allowedRoleId))
      return message.reply("Você não tem permissão.");

    const member = message.mentions.members.first();
    const timeArg = args[1];
    const motivo = args.slice(2).join(" ") || "Não informado";

    if (!member || !timeArg)
      return message.reply("Uso: thl!mutechat @user 5m motivo");

    if (member.roles.cache.has(allowedRoleId))
      return message.reply("Você não pode mutar alguém com esse cargo.");

    const duration = parseTime(timeArg);
    if (!duration)
      return message.reply("Tempo inválido. Use: 10s, 5m, 1h");

    let mutedRole = message.guild.roles.cache.find(r => r.name === "Muted");

    if (!mutedRole) {
      mutedRole = await message.guild.roles.create({
        name: "Muted",
        permissions: []
      });

      message.guild.channels.cache.forEach(async channel => {
        await channel.permissionOverwrites.create(mutedRole, {
          SendMessages: false
        });
      });
    }

    await member.roles.add(mutedRole);

    message.reply(`${member.user.tag} mutado por ${timeArg}`);

    const embed = new EmbedBuilder()
      .setTitle("🔇 MUTE CHAT")
      .setColor("Red")
      .addFields(
        { name: "Usuário", value: member.user.tag, inline: true },
        { name: "Staff", value: message.author.tag, inline: true },
        { name: "Tempo", value: timeArg, inline: true },
        { name: "Motivo", value: motivo }
      )
      .setTimestamp();

    sendLog(message.guild, embed);

    setTimeout(async () => {
      if (member.roles.cache.has(mutedRole.id)) {
        await member.roles.remove(mutedRole);
      }
    }, duration);
  }

  // ===============================
  // 🔊 UNMUTE CHAT
  // ===============================
  if (command === "unmutechat") {

    if (!message.member.roles.cache.has(allowedRoleId))
      return message.reply("Você não tem permissão.");

    const member = message.mentions.members.first();
    if (!member)
      return message.reply("Uso: thl!unmutechat @user");

    let mutedRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!mutedRole)
      return message.reply("Cargo Muted não existe.");

    await member.roles.remove(mutedRole);

    message.reply(`${member.user.tag} desmutado.`);

    const embed = new EmbedBuilder()
      .setTitle("🔊 UNMUTE CHAT")
      .setColor("Green")
      .addFields(
        { name: "Usuário", value: member.user.tag, inline: true },
        { name: "Staff", value: message.author.tag, inline: true }
      )
      .setTimestamp();

    sendLog(message.guild, embed);
  }

  // ===============================
  // 🎙 MUTE CALL
  // ===============================
  if (command === "mutecall") {

    if (!message.member.roles.cache.has(allowedRoleId))
      return message.reply("Você não tem permissão.");

    const member = message.mentions.members.first();
    const timeArg = args[1];
    const motivo = args.slice(2).join(" ") || "Não informado";

    if (!member || !timeArg)
      return message.reply("Uso: thl!mutecall @user 5m motivo");

    if (member.roles.cache.has(allowedRoleId))
      return message.reply("Você não pode mutar alguém com esse cargo.");

    const duration = parseTime(timeArg);
    if (!duration)
      return message.reply("Tempo inválido. Use: 10s, 5m, 1h");

    if (!member.voice.channel)
      return message.reply("O usuário não está em call.");

    await member.voice.setMute(true);

    message.reply(`${member.user.tag} mutado na call por ${timeArg}`);

    const embed = new EmbedBuilder()
      .setTitle("🎙 MUTE CALL")
      .setColor("Orange")
      .addFields(
        { name: "Usuário", value: member.user.tag, inline: true },
        { name: "Staff", value: message.author.tag, inline: true },
        { name: "Tempo", value: timeArg, inline: true },
        { name: "Motivo", value: motivo }
      )
      .setTimestamp();

    sendLog(message.guild, embed);

    setTimeout(async () => {
      if (member.voice.serverMute) {
        await member.voice.setMute(false);
      }
    }, duration);
  }

  // ===============================
  // 🔊 UNMUTE CALL
  // ===============================
  if (command === "unmutecall") {

    if (!message.member.roles.cache.has(allowedRoleId))
      return message.reply("Você não tem permissão.");

    const member = message.mentions.members.first();
    if (!member)
      return message.reply("Uso: thl!unmutecall @user");

    if (!member.voice.channel)
      return message.reply("O usuário não está em call.");

    await member.voice.setMute(false);

    message.reply(`${member.user.tag} desmutado na call.`);

    const embed = new EmbedBuilder()
      .setTitle("🔊 UNMUTE CALL")
      .setColor("Green")
      .addFields(
        { name: "Usuário", value: member.user.tag, inline: true },
        { name: "Staff", value: message.author.tag, inline: true }
      )
      .setTimestamp();

    sendLog(message.guild, embed);
  }

});

client.login(process.env.TOKEN);
