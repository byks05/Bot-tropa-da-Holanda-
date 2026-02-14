const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
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

// =============================
// CONFIGURAÇÃO
// =============================
const PREFIX = "thl!";

const STAFF_ROLE_IDS = [
  "1468070328138858710",
  "1468069942451507221",
  "1468069638935150635",
  "1468017578747105390"
];

const CARGO_ESPECIAL = "1468066422490923081";

const CATEGORIAS = [
  {
    label: "Inicial",
    options: [
      { label: "Equipe Tropa da Holanda", id: "1468026315285205094" },
      { label: "Verificado", id: "1468283328510558208" }
    ]
  },
  {
    label: "Aliados",
    options: [
      { label: "Aliados", id: "1468279104624398509" }
    ]
  }
];

const MAX_HOURS = 999;

// =============================
// LOGS
// =============================
function sendLog(guild, embed) {
  const canalLogs = guild.channels.cache.find(c => c.name === "logs");
  if (canalLogs) canalLogs.send({ embeds: [embed] });
}

// =============================
// FUNÇÃO PARA VALIDAR TEMPO
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
// ANTI-SPAM POR MENSAGEM RÁPIDA
// =============================
const spamMap = new Map(); // usuarioId => [timestamps]

function checkSpam(message) {
  const now = Date.now();
  const userId = message.author.id;

  if (!spamMap.has(userId)) spamMap.set(userId, []);
  const timestamps = spamMap.get(userId);

  timestamps.push(now);
  while (timestamps.length && now - timestamps[0] > 5000) timestamps.shift();

  if (timestamps.length >= 5) {
    spamMap.set(userId, []);
    return true;
  }

  return false;
}

// =============================
// EVENTO DE MENSAGEM
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  // =============================
  // ANTI-SPAM
  // =============================
  if (checkSpam(message)) {
    let muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) muteRole = await message.guild.roles.create({ name: "Muted", permissions: [] });
    await message.member.roles.add(muteRole);
    const spamMsg = await message.reply(`🔇 Você foi mutado por spam!`);
    setTimeout(() => {
      message.delete().catch(() => {});
      spamMsg.delete().catch(() => {});
    }, 5000);
    return;
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const member = message.mentions.members.first();
  const isStaff = STAFF_ROLE_IDS.some(id => message.member.roles.cache.has(id));
  const isEspecial = message.member.roles.cache.has(CARGO_ESPECIAL);

  if (!isStaff && !isEspecial) {
    const msg = await message.reply("Você não tem permissão para usar este comando.");
    setTimeout(() => {
      message.delete().catch(() => {});
      msg.delete().catch(() => {});
    }, 5000);
    return;
  }

  // =============================
  // SETAR CARGOS COM EMBED E BOTÕES
  // =============================
  if (command === "setarcargo") {
    if (!member) return message.reply("Mencione um usuário.");

    const embed = new EmbedBuilder()
      .setTitle("🎯 Setar Cargo")
      .setDescription(`Escolha o(s) cargo(s) para ${member}`)
      .setColor("Blue");

    const rows = CATEGORIAS.map(cat => {
      return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`selectcargo_${member.id}_${cat.label}`)
          .setPlaceholder(cat.label)
          .setMinValues(1)
          .setMaxValues(cat.options.length)
          .addOptions(cat.options.map(opt => ({ label: opt.label, value: opt.id })))
      );
    });

    const msg = await message.reply({ embeds: [embed], components: rows });
    setTimeout(() => message.delete().catch(() => {}), 5000);
  }

  // =============================
  // REMOVER CARGOS
  // =============================
  if (command === "removercargo") {
    if (!member) return message.reply("Mencione um usuário.");

    const userRoles = member.roles.cache.filter(r => r.id !== message.guild.id);
    if (!userRoles.size) return message.reply("Este usuário não possui cargos.");

    const embed = new EmbedBuilder()
      .setTitle("🗑 Remover Cargo")
      .setDescription(`Selecione os cargos que deseja remover de ${member}`)
      .setColor("Orange");

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`removercargo_${member.id}`)
        .setPlaceholder("Selecione os cargos")
        .setMinValues(1)
        .setMaxValues(userRoles.size)
        .addOptions(userRoles.map(r => ({ label: r.name, value: r.id })))
    );

    const msg = await message.reply({ embeds: [embed], components: [row] });
    setTimeout(() => message.delete().catch(() => {}), 5000);
  }

  // =============================
  // MUTE CHAT/CALL
  // =============================
  if (["mutechat", "mutecall"].includes(command)) {
    if (!member) return message.reply("Mencione um usuário.");
    const timeArg = args[1];
    const motivo = args.slice(2).join(" ") || "Não informado";
    const duration = parseDuration(timeArg);
    if (!duration) return message.reply("Tempo inválido. Use de 1m até 999h.");

    if (command === "mutechat") {
      let muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
      if (!muteRole) {
        muteRole = await message.guild.roles.create({ name: "Muted", permissions: [] });
      }

      await member.roles.add(muteRole);

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

      const msg = await message.reply({ embeds: [embed], components: [row] });
      sendLog(message.guild, embed);
      setTimeout(() => {
        message.delete().catch(() => {});
        msg.delete().catch(() => {});
      }, 5000);

      setTimeout(async () => {
        if (member.roles.cache.has(muteRole.id)) {
          await member.roles.remove(muteRole);
        }
      }, duration);
    }

    if (command === "mutecall") {
      if (!member.voice.channel) return message.reply("O usuário não está em call.");
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

      const msg = await message.reply({ embeds: [embed] });
      sendLog(message.guild, embed);
      setTimeout(() => {
        message.delete().catch(() => {});
        msg.delete().catch(() => {});
      }, 5000);

      setTimeout(async () => {
        if (member.voice.serverMute) {
          await member.voice.setMute(false);
        }
      }, duration);
    }
  }

  // =============================
  // CLEAR MENSAGENS
  // =============================
  if (command === "clear") {
    const target = message.mentions.users.first();
    const argsNumber = parseInt(args[0]);

    if (!message.member.permissions.has("MANAGE_MESSAGES")) 
        return message.reply("Você não tem permissão para usar este comando.");

    if (!args[0]) return message.reply("Use: thl!clear <número> ou thl!clear @usuário [número]");

    if (target) {
        const amount = args[1] ? parseInt(args[1]) : 100;
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply("Número inválido (1-100).");

        const messages = await message.channel.messages.fetch({ limit: 100 });
        const userMessages = messages.filter(msg => msg.author.id === target.id).first(amount);
        const msg = await message.channel.bulkDelete(userMessages, true);
        const reply = await message.channel.send(`🗑️ ${userMessages.length} mensagens de ${target.tag} apagadas!`);
        setTimeout(() => {
          message.delete().catch(() => {});
          reply.delete().catch(() => {});
        }, 5000);
    } else {
        if (isNaN(argsNumber) || argsNumber < 1 || argsNumber > 100) return message.reply("Número inválido (1-100).");
        const msg = await message.channel.bulkDelete(argsNumber, true);
        const reply = await message.channel.send(`🗑️ ${argsNumber} mensagens apagadas!`);
        setTimeout(() => {
          message.delete().catch(() => {});
          reply.delete().catch(() => {});
        }, 5000);
    }
  }
});

// =============================
// INTERAÇÕES (BOTÕES E SELECT MENUS)
// =============================
client.on("interactionCreate", async interaction => {
  const isStaff = STAFF_ROLE_IDS.some(id => interaction.member.roles.cache.has(id));
  const isEspecial = interaction.member.roles.cache.has(CARGO_ESPECIAL);

  if (!isStaff && !isEspecial) return interaction.reply({ content: "Sem permissão.", ephemeral: true });

  if (interaction.isButton()) {
    if (interaction.customId.startsWith("unmute_")) {
      const userId = interaction.customId.split("_")[1];
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      const muteRole = interaction.guild.roles.cache.find(r => r.name === "Muted");
      if (muteRole) await member.roles.remove(muteRole);

      await interaction.update({
        content: `🔊 ${member} foi desmutado por ${interaction.user.tag}`,
        embeds: [],
        components: []
      });
    }
  }

  if (interaction.isStringSelectMenu()) {
    const userId = interaction.customId.split("_")[1];
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    if (interaction.customId.startsWith("selectcargo_")) {
      const cargoIds = interaction.values;
      for (const cid of cargoIds) {
        const cargo = interaction.guild.roles.cache.get(cid);
        if (cargo && !member.roles.cache.has(cid)) {
          await member.roles.add(cargo);
        }
      }
      await interaction.update({
        content: `✅ Cargos adicionados para ${member}`,
        embeds: [],
        components: []
      });
    }

    if (interaction.customId.startsWith("removercargo_")) {
      const cargoIds = interaction.values;
      for (const cid of cargoIds) {
        if (member.roles.cache.has(cid)) {
          await member.roles.remove(cid);
        }
      }
      await interaction.update({
        content: `🗑 Cargos removidos de ${member}`,
        embeds: [],
        components: []
      });
    }
  }
});

// =============================
// BIO DO BOT
// =============================
client.on("ready", () => {
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", {
    type: "WATCHING"
  });
});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);essage.guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) muteRole = await message.guild.roles.create({ name: "Muted", permissions: [] });
    await message.member.roles.add(muteRole);
    message.reply(`🔇 Você foi mutado por spam!`);
  }
});

// =============================
// INTERAÇÕES (BOTÕES E SELECT MENUS)
// =============================
client.on("interactionCreate", async interaction => {
  const isStaff = STAFF_ROLE_IDS.some(id => interaction.member.roles.cache.has(id));
  const isEspecial = interaction.member.roles.cache.has(CARGO_ESPECIAL);

  if (interaction.isButton()) {
    if (!isStaff && !isEspecial)
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });

    if (interaction.customId.startsWith("unmute_")) {
      const userId = interaction.customId.split("_")[1];
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      const muteRole = interaction.guild.roles.cache.find(r => r.name === "Muted");
      if (muteRole) await member.roles.remove(muteRole);

      await interaction.update({
        content: `🔊 ${member} foi desmutado por ${interaction.user.tag}`,
        embeds: [],
        components: []
      });
    }
  }

  if (interaction.isStringSelectMenu()) {
    const userId = interaction.customId.split("_")[1];
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    if (!isStaff && !isEspecial)
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });

    if (interaction.customId.startsWith("selectcargo_")) {
      const cargoIds = interaction.values;
      for (const cid of cargoIds) {
        const cargo = interaction.guild.roles.cache.get(cid);
        if (cargo && !member.roles.cache.has(cid)) {
          await member.roles.add(cargo);
        }
      }
      await interaction.update({
        content: `✅ Cargos adicionados para ${member}`,
        embeds: [],
        components: []
      });
    }

    if (interaction.customId.startsWith("removercargo_")) {
      const cargoIds = interaction.values;
      for (const cid of cargoIds) {
        if (member.roles.cache.has(cid)) {
          await member.roles.remove(cid);
        }
      }
      await interaction.update({
        content: `🗑 Cargos removidos de ${member}`,
        embeds: [],
        components: []
      });
    }
  }
});

// =============================
// BIO DO BOT
// =============================
client.on("ready", () => {
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", {
    type: "WATCHING"
  });
});

client.login(process.env.TOKEN);= interaction.member.roles.cache.has(CARGO_ESPECIAL);

  if (!isStaff && !isEspecial) return;

  if (interaction.isStringSelectMenu()) {
    const userId = interaction.customId.split("_")[1];
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    // SETAR CARGOS
    if (interaction.customId.startsWith("selectcargo_")) {
      const cargoIds = interaction.values;
      for (const cid of cargoIds) {
        const cargo = interaction.guild.roles.cache.get(cid);
        if (cargo && !member.roles.cache.has(cid)) await member.roles.add(cargo);
      }
      await interaction.update({ content: `✅ Cargos adicionados para ${member}`, embeds: [], components: [] });
    }

    // REMOVER CARGOS
    if (interaction.customId.startsWith("removercargo_")) {
      const cargoIds = interaction.values;
      for (const cid of cargoIds) {
        if (member.roles.cache.has(cid)) await member.roles.remove(cid);
      }
      await interaction.update({ content: `🗑 Cargos removidos de ${member}`, embeds: [], components: [] });
    }
  }
});

// =============================
// READY
// =============================
client.on("ready", () => {
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", { type: "WATCHING" });
});

client.login(process.env.TOKEN);
