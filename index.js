const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const PREFIX = "thl!";
const STAFF_ROLE_ID = "1471998602577711337";
const MAX_HOURS = 999;

// =============================
// LOG
// =============================
function sendLog(guild, embed) {
  const canalLogs = guild.channels.cache.find(c => c.name === "logs");
  if (canalLogs) canalLogs.send({ embeds: [embed] });
}

// =============================
// VALIDAR TEMPO (1m até 999h)
// =============================
function parseDuration(time) {
  const match = time?.match(/^(\d+)([mh])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  if (unit === "m") {
    if (value < 1) return null;
    return value * 60000;
  }

  if (unit === "h") {
    if (value < 1 || value > MAX_HOURS) return null;
    return value * 3600000;
  }

  return null;
}

// =============================
// COMANDOS
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (!message.member.roles.cache.has(STAFF_ROLE_ID))
    return message.reply("Você não tem permissão.");

  const member = message.mentions.members.first();
  if (!member) return message.reply("Mencione um usuário.");

  if (member.roles.cache.has(STAFF_ROLE_ID))
    return message.reply("Você não pode usar nesse cargo.");

  // 🔥 AQUI ESTÁ A CORREÇÃO
  const timeArg = args[1];
  const motivo = args.slice(2).join(" ") || "Não informado";
  const duration = parseDuration(timeArg);

  if (!duration && command !== "unmutechat" && command !== "unmutecall")
    return message.reply("Tempo inválido. Use de 1m até 999h.");

  // =============================
  // MUTE CHAT
  // =============================
  if (command === "mutechat") {

    let cargoMute = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!cargoMute) {
      cargoMute = await message.guild.roles.create({
        name: "Muted",
        permissions: []
      });
    }

    await member.roles.add(cargoMute);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`unmute_${member.id}`)
        .setLabel("Desmutar")
        .setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("🔇 Usuário Mutado")
      .setDescription(`${member} foi mutado no chat`)
      .addFields(
        { name: "🆔 ID", value: member.id },
        { name: "⏳ Tempo", value: timeArg },
        { name: "📄 Motivo", value: motivo },
        { name: "👮 Staff", value: message.author.tag }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: message.guild.name })
      .setTimestamp();

    message.reply({ embeds: [embed], components: [row] });
    sendLog(message.guild, embed);

    setTimeout(async () => {
      if (member.roles.cache.has(cargoMute.id)) {
        await member.roles.remove(cargoMute);
      }
    }, duration);
  }

  // =============================
  // UNMUTE CHAT
  // =============================
  if (command === "unmutechat") {
    const cargoMute = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!cargoMute) return;

    await member.roles.remove(cargoMute);
    message.reply(`🔊 ${member} foi desmutado.`);
  }

  // =============================
  // MUTE CALL
  // =============================
  if (command === "mutecall") {

    if (!member.voice.channel)
      return message.reply("O usuário não está em call.");

    await member.voice.setMute(true);

    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("🎙 Usuário Mutado na Call")
      .setDescription(`${member} foi silenciado na call`)
      .addFields(
        { name: "🆔 ID", value: member.id },
        { name: "⏳ Tempo", value: timeArg },
        { name: "📄 Motivo", value: motivo },
        { name: "👮 Staff", value: message.author.tag }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: message.guild.name })
      .setTimestamp();

    message.reply({ embeds: [embed] });
    sendLog(message.guild, embed);

    setTimeout(async () => {
      if (member.voice.serverMute) {
        await member.voice.setMute(false);
      }
    }, duration);
  }

  // =============================
  // UNMUTE CALL
  // =============================
  if (command === "unmutecall") {

    if (!member.voice.channel)
      return message.reply("O usuário não está em call.");

    await member.voice.setMute(false);
    message.reply(`🔊 ${member} foi desmutado na call.`);
  }

});

// =============================
// BOTÃO DESMUTAR
// =============================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith("unmute_")) {

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });

    const userId = interaction.customId.split("_")[1];
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const cargoMute = interaction.guild.roles.cache.find(r => r.name === "Muted");
    if (cargoMute) await member.roles.remove(cargoMute);

    await interaction.update({
      content: `🔊 ${member} foi desmutado por ${interaction.user.tag}`,
      embeds: [],
      components: []
    });
  }
});

client.login(process.env.TOKEN);
