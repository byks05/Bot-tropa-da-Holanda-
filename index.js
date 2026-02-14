const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
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
const MAX_HOURS = 999;

// =============================
// 🔒 CARGOS STAFF PERMITIDOS
// =============================
const STAFF_ROLE_IDS = [
  "1468070328138858710",
  "1468069942451507221",
  "1468069638935150635",
  "1468017578747105390"
];

// =============================
// 🔒 SISTEMA DE PROTEÇÃO
// =============================
const AUTO_MUTE_TIME = 5 * 60000; // 5 minutos
const messageCooldown = new Map();
const SPAM_LIMIT = 5;
const SPAM_INTERVAL = 5000;
const CAPS_PERCENTAGE = 70;
const CAPS_MIN_LENGTH = 8;
const joinTracker = [];
const RAID_LIMIT = 5;
const RAID_INTERVAL = 10000;

// =============================
// LOG
// =============================
function sendLog(guild, embed) {
  try {
    const canalLogs = guild.channels.cache.find(c => c.name === "logs");
    if (canalLogs) canalLogs.send({ embeds: [embed] }).catch(() => {});
  } catch {}
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
// CHECAR SE MEMBRO TEM PERMISSÃO
// =============================
function isStaff(member) {
  return STAFF_ROLE_IDS.some(id => member.roles.cache.has(id));
}

// =============================
// EVENTO MENSAGEM
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  const member = message.member;

  // =============================
  // 🚫 ANTI-SPAM
  // =============================
  const now = Date.now();
  const userData = messageCooldown.get(member.id) || { count: 0, lastMessage: now };
  if (now - userData.lastMessage > SPAM_INTERVAL) userData.count = 1;
  else userData.count += 1;
  userData.lastMessage = now;
  messageCooldown.set(member.id, userData);

  if (userData.count >= SPAM_LIMIT && !isStaff(member)) {
    try {
      const muteRole = await getMuteRole(message.guild);
      await member.roles.add(muteRole);

      const embed = new EmbedBuilder()
        .setColor("DarkRed")
        .setTitle("🚫 Auto Mute - Spam")
        .setDescription(`${member} foi mutado por spam.`)
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
      sendLog(message.guild, embed);

      setTimeout(() => member.roles.remove(muteRole).catch(() => {}), AUTO_MUTE_TIME);
      userData.count = 0;
    } catch {}
    return;
  }

  // =============================
  // 🔗 ANTI-LINK
  // =============================
  const linkRegex = /(https?:\/\/|www\.)/i;
  if (linkRegex.test(message.content) && !isStaff(member)) {
    try {
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

      setTimeout(() => member.roles.remove(muteRole).catch(() => {}), AUTO_MUTE_TIME);
    } catch {}
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
      if (percentage >= CAPS_PERCENTAGE && !isStaff(member)) {
        try {
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

          setTimeout(() => member.roles.remove(muteRole).catch(() => {}), AUTO_MUTE_TIME);
        } catch {}
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
  if (!isStaff(member)) return message.reply("Você não tem permissão.");

  const alvo = message.mentions.members.first();
  if (!alvo && command !== "setarcargo") return message.reply("Mencione um usuário.");

  // ===== CORREÇÃO: setarcargo não precisa de tempo
  let timeArg, motivo, duration;
  if (command !== "setarcargo") {
    timeArg = args[1];
    motivo = args.slice(2).join(" ") || "Não informado";
    duration = parseDuration(timeArg);
    if (!duration && !["unmutechat","unmutecall"].includes(command))
      return message.reply("Tempo inválido. Use de 1m até 999h.");
  }

  // =============================
  // MUTE CHAT
  // =============================
  if (command === "mutechat") {
    try {
      const muteRole = await getMuteRole(message.guild);
      await alvo.roles.add(muteRole);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`unmute_${alvo.id}`).setLabel("Desmutar").setStyle(ButtonStyle.Success)
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
      setTimeout(() => alvo.roles.remove(muteRole).catch(() => {}), duration);
    } catch {}
  }

  // =============================
  // UNMUTE CHAT
  // =============================
  if (command === "unmutechat") {
    try {
      const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
      if (!muteRole) return;
      await alvo.roles.remove(muteRole);
      message.reply(`🔊 ${alvo} foi desmutado.`);
    } catch {}
  }

  // =============================
  // MUTE CALL
  // =============================
  if (command === "mutecall") {
    try {
      if (!alvo.voice.channel) return message.reply("O usuário não está em call.");
      await alvo.voice.setMute(true);

      const embed = new EmbedBuilder()
        .setColor("Orange")
        .setTitle("🎙 Usuário Mutado na Call")
        .setDescription(`${alvo} foi silenciado`)
        .addFields(
          { name: "⏳ Tempo", value: timeArg },
          { name: "📄 Motivo", value: motivo }
        )
        .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: message.guild.name })
        .setTimestamp();

      message.reply({ embeds: [embed] });
      sendLog(message.guild, embed);
      setTimeout(() => alvo.voice.setMute(false).catch(() => {}), duration);
    } catch {}
  }

  // =============================
  // UNMUTE CALL
  // =============================
  if (command === "unmutecall") {
    try {
      if (!alvo.voice.channel) return message.reply("O usuário não está em call.");
      await alvo.voice.setMute(false);
      message.reply(`🔊 ${alvo} foi desmutado na call.`);
    } catch {}
  }

  // =============================
  // SETAR CARGO (INTERATIVO)
  // =============================
  if (command === "setarcargo") {
    const target = alvo || member; // fallback

    const categoriaMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`categoria_${target.id}`)
        .setPlaceholder("Selecione a categoria")
        .addOptions([
          {
            label: "Recrutamento",
            description: "Escolha cargos de recrutamento",
            value: "recrutamento"
          }
        ])
    );

    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("📋 Seleção de Categoria")
      .setDescription(`Escolha uma categoria de cargos para ${target}`)
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }));

    message.reply({ embeds: [embed], components: [categoriaMenu] });
  }
});

// =============================
// BOTÕES E SELECT MENUS
// =============================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  // ===== BOTÃO DESMUTAR
  if (interaction.isButton() && interaction.customId.startsWith("unmute_")) {
    try {
      if (!isStaff(interaction.member))
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
    } catch {}
  }

  // ===== SELECT MENU
  if (interaction.isStringSelectMenu()) {
    try {
      const [tipo, userId] = interaction.customId.split("_");
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) return interaction.reply({ content: "Usuário não encontrado.", ephemeral: true });
      if (!isStaff(interaction.member))
        return interaction.reply({ content: "Sem permissão.", ephemeral: true });

      // ===== CATEGORIA
      if (tipo === "categoria") {
        if (interaction.values[0] === "recrutamento") {
          const cargos = [
            { id: "1468026315285205094", label: "Equipe Tropa da Holanda" },
            { id: "1468283328510558208", label: "Verificado" }
          ];

          const cargoMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`cargo_${member.id}`)
              .setPlaceholder("Selecione o cargo")
              .addOptions(
                cargos.map(c => ({
                  label: c.label,
                  value: c.id,
                  description: `Dar cargo ${c.label} para ${member.user.username}`
                }))
              )
          );

          const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle(`📌 Cargos de Recrutamento`)
            .setDescription(`Selecione o cargo para ${member}`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

          await interaction.update({ embeds: [embed], components: [cargoMenu] });
        }
      }

      // ===== CARGO
      if (tipo === "cargo") {
        const roleId = interaction.values[0];
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.reply({ content: "Cargo não encontrado.", ephemeral: true });
        if (member.roles.cache.has(role.id))
          return interaction.reply({ content: `${member} já possui o cargo ${role.name}.`, ephemeral: true });

        await member.roles.add(role);

        const embed = new EmbedBuilder()
          .setColor("Purple")
          .setTitle("✅ Cargo Adicionado")
          .setDescription(`${member} recebeu o cargo **${role.name}**`)
          .addFields(
            { name: "👮 Staff", value: interaction.user.tag },
            { name: "🆔 ID do usuário", value: member.id }
          )
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        interaction.update({ embeds: [embed], components: [] });
        sendLog(interaction.guild, embed);
      }
    } catch {}
  }
});

// =============================
// 🚨 ANTI RAID
// =============================
client.on("guildMemberAdd", async member => {
  try {
    const now = Date.now();
    joinTracker.push(now);
    while (joinTracker.length && now - joinTracker[0] > RAID_INTERVAL) joinTracker.shift();
    if (joinTracker.length >= RAID_LIMIT) {
      const embed = new EmbedBuilder()
        .setColor("DarkRed")
        .setTitle("🚨 RAID DETECTADO")
        .setDescription("Muitos membros entrando rapidamente.")
        .setTimestamp();

      sendLog(member.guild, embed);

      // bloqueia envio temporário por 10s
      member.guild.channels.cache.forEach(channel => {
        if (channel.permissionOverwrites) {
          channel.permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: false }).catch(() => {});
          setTimeout(() => {
            channel.permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: true }).catch(() => {});
          }, 10000);
        }
      });

      joinTracker.length = 0;
    }
  } catch {}
});

client.login(process.env.TOKEN);  const muteRole = interaction.guild.roles.cache.find(r => r.name === "Muted");
    if (muteRole) await member.roles.remove(muteRole);

    await interaction.update({
      content: `🔊 ${member} foi desmutado.`,
      embeds: [],
      components: []
    });
  }

  // ===== SELECT MENU
  if (interaction.isStringSelectMenu()) {
    const [tipo, userId] = interaction.customId.split("_");
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return interaction.reply({ content: "Usuário não encontrado.", ephemeral: true });
    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });

    // ===== CATEGORIA
    if (tipo === "categoria") {
      if (interaction.values[0] === "recrutamento") {
        const cargos = [
          { id: "1468026315285205094", label: "Equipe Tropa da Holanda" },
          { id: "1468283328510558208", label: "Verificado" }
        ];

        const cargoMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`cargo_${member.id}`)
            .setPlaceholder("Selecione o cargo")
            .addOptions(
              cargos.map(c => ({
                label: c.label,
                value: c.id,
                description: `Dar cargo ${c.label} para ${member.user.username}`
              }))
            )
        );

        const embed = new EmbedBuilder()
          .setColor("Green")
          .setTitle(`📌 Cargos de Recrutamento`)
          .setDescription(`Selecione o cargo para ${member}`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

        await interaction.update({ embeds: [embed], components: [cargoMenu] });
      }
    }

    // ===== CARGO
    if (tipo === "cargo") {
      const roleId = interaction.values[0];
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.reply({ content: "Cargo não encontrado.", ephemeral: true });
      if (member.roles.cache.has(role.id))
        return interaction.reply({ content: `${member} já possui o cargo ${role.name}.`, ephemeral: true });

      await member.roles.add(role);

      const embed = new EmbedBuilder()
        .setColor("Purple")
        .setTitle("✅ Cargo Adicionado")
        .setDescription(`${member} recebeu o cargo **${role.name}**`)
        .addFields(
          { name: "👮 Staff", value: interaction.user.tag },
          { name: "🆔 ID do usuário", value: member.id }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      interaction.update({ embeds: [embed], components: [] });
      sendLog(interaction.guild, embed);
    }
  }
});

// =============================
// 🚨 ANTI RAID
// =============================
client.on("guildMemberAdd", async member => {
  const now = Date.now();
  joinTracker.push(now);
  while (joinTracker.length && now - joinTracker[0] > RAID_INTERVAL) joinTracker.shift();
  if (joinTracker.length >= RAID_LIMIT) {
    const embed = new EmbedBuilder()
      .setColor("DarkRed")
      .setTitle("🚨 RAID DETECTADO")
      .setDescription("Muitos membros entrando rapidamente.")
      .setTimestamp();

    sendLog(member.guild, embed);

    member.guild.channels.cache.forEach(channel => {
      if (channel.permissionOverwrites) {
        channel.permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: false }).catch(() => {});
      }
    });

    joinTracker.length = 0;
  }
});

client.login(process.env.TOKEN);.members.fetch(userId).catch(() => null);
    if (!member) return;

    const muteRole = interaction.guild.roles.cache.find(r => r.name === "Muted");
    if (muteRole) await member.roles.remove(muteRole);

    await interaction.update({
      content: `🔊 ${member} foi desmutado.`,
      embeds: [],
      components: []
    });
  }

  // ===== SELECT MENU
  if (interaction.isStringSelectMenu()) {
    const [tipo, userId] = interaction.customId.split("_");
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return interaction.reply({ content: "Usuário não encontrado.", ephemeral: true });

    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });

    // ===== CATEGORIA
    if (tipo === "categoria") {
      if (interaction.values[0] === "recrutamento") {
        const cargos = [
          { id: "1468026315285205094", label: "Equipe Tropa da Holanda" },
          { id: "1468283328510558208", label: "Verificado" }
        ];

        const cargoMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`cargo_${member.id}`)
            .setPlaceholder("Selecione o cargo")
            .addOptions(
              cargos.map(c => ({
                label: c.label,
                value: c.id,
                description: `Dar cargo ${c.label} para ${member.user.username}`
              }))
            )
        );

        const embed = new EmbedBuilder()
          .setColor("Green")
          .setTitle(`📌 Cargos de Recrutamento`)
          .setDescription(`Selecione o cargo para ${member}`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

        await interaction.update({ embeds: [embed], components: [cargoMenu] });
      }
    }

    // ===== CARGO
    if (tipo === "cargo") {
      const roleId = interaction.values[0];
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.reply({ content: "Cargo não encontrado.", ephemeral: true });

      if (member.roles.cache.has(role.id))
        return interaction.reply({ content: `${member} já possui o cargo ${role.name}.`, ephemeral: true });

      await member.roles.add(role);

      const embed = new EmbedBuilder()
        .setColor("Purple")
        .setTitle("✅ Cargo Adicionado")
        .setDescription(`${member} recebeu o cargo **${role.name}**`)
        .addFields(
          { name: "👮 Staff", value: interaction.user.tag },
          { name: "🆔 ID do usuário", value: member.id }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      interaction.update({ embeds: [embed], components: [] });
      sendLog(interaction.guild, embed);
    }
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

client.login(process.env.TOKEN);muteRole = interaction.guild.roles.cache.find(r => r.name === "Muted");
    if (muteRole) await member.roles.remove(muteRole);

    await interaction.update({
      content: `🔊 ${member} foi desmutado.`,
      embeds: [],
      components: []
    });
  }

  // ======= SELECT MENU
  if (interaction.isStringSelectMenu()) {
    const [tipo, userId] = interaction.customId.split("_");
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return interaction.reply({ content: "Usuário não encontrado.", ephemeral: true });

    if (!isStaff(interaction.member))
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });

    // ===== CATEGORIA
    if (tipo === "categoria") {
      if (interaction.values[0] === "recrutamento") {
        const cargos = [
          { id: "1468026315285205094", label: "Equipe Tropa da Holanda" },
          { id: "1468283328510558208", label: "Verificado" }
        ];

        const cargoMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`cargo_${member.id}`)
            .setPlaceholder("Selecione o cargo")
            .addOptions(
              cargos.map(c => ({
                label: c.label,
                value: c.id,
                description: `Dar cargo ${c.label} para ${member.user.username}`
              }))
            )
        );

        const embed = new EmbedBuilder()
          .setColor("Green")
          .setTitle(`📌 Cargos de Recrutamento`)
          .setDescription(`Selecione o cargo para ${member}`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

        await interaction.update({ embeds: [embed], components: [cargoMenu] });
      }
    }

    // ===== CARGO
    if (tipo === "cargo") {
      const roleId = interaction.values[0];
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.reply({ content: "Cargo não encontrado.", ephemeral: true });

      if (member.roles.cache.has(role.id))
        return interaction.reply({ content: `${member} já possui o cargo ${role.name}.`, ephemeral: true });

      await member.roles.add(role);

      const embed = new EmbedBuilder()
        .setColor("Purple")
        .setTitle("✅ Cargo Adicionado")
        .setDescription(`${member} recebeu o cargo **${role.name}**`)
        .addFields(
          { name: "👮 Staff", value: interaction.user.tag },
          { name: "🆔 ID do usuário", value: member.id }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      interaction.update({ embeds: [embed], components: [] });
      sendLog(interaction.guild, embed);
    }
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
