const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');

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

client.on('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// Converter tempo (10s, 5m, 1h)
function parseTime(time) {
  const unit = time.slice(-1);
  const value = parseInt(time.slice(0, -1));

  if (unit === "s") return value * 1000;
  if (unit === "m") return value * 60000;
  if (unit === "h") return value * 3600000;

  return null;
}

// Enviar logs para canal "logs"
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

    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply("Sem permissão.");

    const member = message.mentions.members.first();
    const timeArg = args[1];
    const motivo = args.slice(2).join(" ") || "Não informado";

    if (!member || !timeArg)
      return message.reply("Uso correto: thl!mutechat @user 5m motivo");

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
  if (command === "unmute") {

    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply("Sem permissão.");

    const member = message.mentions.members.first();
    if (!member)
      return message.reply("Uso correto: thl!unmute @user");

    const mutedRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!mutedRole)
      return message.reply("Cargo Muted não existe.");

    await member.roles.remove(mutedRole);

    message.reply(`${member.user.tag} desmutado`);

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

    if (!message.member.permissions.has(PermissionsBitField.Flags.MuteMembers))
      return message.reply("Sem permissão.");

    const member = message.mentions.members.first();
    const timeArg = args[1];
    const motivo = args.slice(2).join(" ") || "Não informado";

    if (!member || !timeArg)
      return message.reply("Uso correto: thl!mutecall @user 5m motivo");

    const duration = parseTime(timeArg);
    if (!duration)
      return message.reply("Tempo inválido. Use: 10s, 5m, 1h");

    if (!member.voice.channel)
      return message.reply("O usuário não está em uma call.");

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

    if (!message.member.permissions.has(PermissionsBitField.Flags.MuteMembers))
      return message.reply("Sem permissão.");

    const member = message.mentions.members.first();
    if (!member)
      return message.reply("Uso correto: thl!unmutecall @user");

    if (!member.voice.channel)
      return message.reply("O usuário não está em uma call.");

    if (!member.voice.serverMute)
      return message.reply("O usuário não está mutado na call.");

    await member.voice.setMute(false);

    message.reply(`${member.user.tag} desmutado na call`);

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
