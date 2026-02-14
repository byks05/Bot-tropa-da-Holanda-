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
// 🔒 SISTEMA DE PROTEÇÃO
// =============================
const AUTO_MUTE_TIME = 5 * 60000; // 5 minutos

// Anti-Spam
const messageCooldown = new Map();
const SPAM_LIMIT = 5;
const SPAM_INTERVAL = 5000;

// Anti-Caps
const CAPS_PERCENTAGE = 70;
const CAPS_MIN_LENGTH = 8;

// Anti-Raid
const joinTracker = [];
const RAID_LIMIT = 5;
const RAID_INTERVAL = 10000;

// =============================
// LOG
// =============================
function sendLog(guild, embed) {
  const canalLogs = guild.channels.cache.find(c => c.name === "logs");
  if (canalLogs) canalLogs.send({ embeds: [embed] });
}

// =============================
// CRIAR CARGO MUTED
// =============================
async function getMuteRole(guild) {
  let role = guild.roles.cache.find(r => r.name === "Muted");

  if (!role) {
    role = await guild.roles.create({
      name: "Muted",
      permissions: []
    });

    guild.channels.cache.forEach(async channel => {
      await channel.permissionOverwrites.edit(role, {
        SendMessages: false,
        Speak: false
      }).catch(() => {});
    });
  }

  return role;
}

// =============================
// VALIDAR TEMPO
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
// EVENTO DE MENSAGEM
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  const member = message.member;

  // =============================
  // 🚫 ANTI-SPAM
  // =============================
  const now = Date.now();
  const userData = messageCooldown.get(member.id) || {
    count: 0,
    lastMessage: now
  };

  if (now - userData.lastMessage > SPAM_INTERVAL) {
    userData.count = 1;
  } else {
    userData.count += 1;
  }

  userData.lastMessage = now;
  messageCooldown.set(member.id, userData);

  if (userData.count >= SPAM_LIMIT && !member.roles.cache.has(STAFF_ROLE_ID)) {
    const muteRole = await getMuteRole(message.guild);
    await member.roles.add(muteRole);

    const embed = new EmbedBuilder()
      .setColor("DarkRed")
      .setTitle("🚫 Auto Mute - Spam")
      .setDescription(`${member} foi mutado por spam.`)
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
    sendLog(message.guild, embed);

    setTimeout(() => {
      member.roles.remove(muteRole).catch(() => {});
    }, AUTO_MUTE_TIME);

    userData.count = 0;
    return;
  }

  // =============================
  // 🔗 ANTI-LINK
  // =============================
  const linkRegex = /(https?:\/\/|www\.)/i;

  if (linkRegex.test(message.content) && !member.roles.cache.has(STAFF_ROLE_ID)) {
    await message.delete().catch(() => {});

    const muteRole = await getMuteRole(message.guild);
    await member.roles.add(muteRole);

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("🔗 Auto Mute - Link")
      .setDescription(`${member} enviou link.`)
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
    sendLog(message.guild, embed);

    setTimeout(() => {
      member.roles.remove(muteRole).catch(() => {});
    }, AUTO_MUTE_TIME);

    return;
  }

  // =============================
  // 🔠 ANTI-CAPS
  // =============================
  const content = message.content;

  if (content.length >= CAPS_MIN_LENGTH) {
    const letters = content.replace(/[^a-zA-Z]/g, "");
    const upper = letters.replace(/[^A-Z]/g, "");

    if (letters.length > 0) {
      const percentage = (upper.length / letters.length) * 100;

      if (percentage >= CAPS_PERCENTAGE && !member.roles.cache.has(STAFF_ROLE_ID)) {
        await message.delete().catch(() => {});

        const muteRole = await getMuteRole(message.guild);
        await member.roles.add(muteRole);

        const embed = new EmbedBuilder()
          .setColor("Orange")
          .setTitle("🔠 Auto Mute - Caps")
          .setDescription(`${member} usou CAPS excessivo.`)
          .setTimestamp();

        message.channel.send({ embeds: [embed] });
        sendLog(message.guild, embed);

        setTimeout(() => {
          member.roles.remove(muteRole).catch(() => {});
        }, AUTO_MUTE_TIME);

        return;
      }
    }
  }

  // =============================
  // COMANDOS
  // =============================
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (!member.roles.cache.has(STAFF_ROLE_ID))
    return message.reply("Você não tem permissão.");

  const alvo = message.mentions.members.first();
  if (!alvo) return message.reply("Mencione um usuário.");

  if (alvo.roles.cache.has(STAFF_ROLE_ID))
    return message.reply("Você não pode usar nesse cargo.");

  const timeArg = args[1];
  const motivo = args.slice(2).join(" ") || "Não informado";
  const duration = parseDuration(timeArg);

  if (!duration && command !== "unmutechat" && command !== "unmutecall")
    return message.reply("Tempo inválido. Use de 1m até 999h.");

  // =============================
  // MUTE CHAT
  // =============================
  if (command === "mutechat") {
    const muteRole = await getMuteRole(message.guild);
    await alvo.roles.add(muteRole);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`unmute_${alvo.id}`)
        .setLabel("Desmutar")
        .setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("🔇 Usuário Mutado")
      .setDescription(`${alvo} foi mutado no chat`)
      .addFields(
        { name: "🆔 ID", value: alvo.id },
        { name: "⏳ Tempo", value: timeArg },
        { name: "📄 Motivo", value: motivo },
        { name: "👮 Staff", value: message.author.tag }
      )
      .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: message.guild.name })
      .setTimestamp();

    message.reply({ embeds: [embed], components: [row] });
    sendLog(message.guild, embed);

    setTimeout(() => {
      alvo.roles.remove(muteRole).catch(() => {});
    }, duration);
  }

  if (command === "unmutechat") {
    const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) return;

    await alvo.roles.remove(muteRole);
    message.reply(`🔊 ${alvo} foi desmutado.`);
  }

  if (command === "mutecall") {
    if (!alvo.voice.channel)
      return message.reply("O usuário não está em call.");

    await alvo.voice.setMute(true);

    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("🎙 Usuário Mutado na Call")
      .setDescription(`${alvo} foi silenciado`)
      .addFields(
        { name: "⏳ Tempo", value: timeArg },
        { name: "📄 Motivo", value: motivo }
      )
      .setTimestamp();

    message.reply({ embeds: [embed] });
    sendLog(message.guild, embed);

    setTimeout(() => {
      alvo.voice.setMute(false).catch(() => {});
    }, duration);
  }

  if (command === "unmutecall") {
    if (!alvo.voice.channel)
      return message.reply("O usuário não está em call.");

    await alvo.voice.setMute(false);
    message.reply(`🔊 ${alvo} foi desmutado na call.`);
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

    const muteRole = interaction.guild.roles.cache.find(r => r.name === "Muted");
    if (muteRole) await member.roles.remove(muteRole);

    await interaction.update({
      content: `🔊 ${member} foi desmutado.`,
      embeds: [],
      components: []
    });
  }
});

// =============================
// 🚨 ANTI RAID
// =============================
client.on("guildMemberAdd", async member => {
  const now = Date.now();
  joinTracker.push(now);

  while (joinTracker.length && now - joinTracker[0] > RAID_INTERVAL) {
    joinTracker.shift();
  }

  if (joinTracker.length >= RAID_LIMIT) {
    const embed = new EmbedBuilder()
      .setColor("DarkRed")
      .setTitle("🚨 RAID DETECTADO")
      .setDescription("Muitos membros entrando rapidamente.")
      .setTimestamp();

    sendLog(member.guild, embed);

    member.guild.channels.cache.forEach(channel => {
      if (channel.permissionOverwrites) {
        channel.permissionOverwrites.edit(
          member.guild.roles.everyone,
          { SendMessages: false }
        ).catch(() => {});
      }
    });

    joinTracker.length = 0;
  }
});

client.login(process.env.TOKEN);
