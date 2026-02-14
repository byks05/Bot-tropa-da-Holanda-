const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
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
// UTILS
// =============================
function parseDuration(time) {
  const match = time?.match(/^(\d+)([mh])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  if (unit === "m") return value >= 1 ? value * 60000 : null;
  if (unit === "h") return value >= 1 && value <= MAX_HOURS ? value * 3600000 : null;

  return null;
}

function isStaffOrEspecial(member) {
  return STAFF_ROLE_IDS.some(id => member.roles.cache.has(id)) || member.roles.cache.has(CARGO_ESPECIAL);
}

// =============================
// ANTI-SPAM
// =============================
const spamMap = new Map(); // usuarioId => [timestamps]

async function checkSpam(message) {
  const now = Date.now();
  const userId = message.author.id;

  if (!spamMap.has(userId)) spamMap.set(userId, []);
  const timestamps = spamMap.get(userId);

  timestamps.push(now);
  while (timestamps.length && now - timestamps[0] > 5000) timestamps.shift();

  if (timestamps.length >= 5) {
    spamMap.set(userId, []);
    let muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) muteRole = await message.guild.roles.create({ name: "Muted", permissions: [] });
    await message.member.roles.add(muteRole);
    const spamMsg = await message.reply("🔇 Você foi mutado por spam!");
    setTimeout(() => {
      message.delete().catch(() => {});
      spamMsg.delete().catch(() => {});
    }, 5000);
    return true;
  }
  return false;
}

// =============================
// FUNÇÃO GENÉRICA PARA MUTE
// =============================
async function muteMember({ member, type = "chat", durationMs, motivo, staff }) {
  const embed = new EmbedBuilder()
    .setColor(type === "chat" ? "Red" : "Orange")
    .setTitle(type === "chat" ? "🔇 Usuário Mutado" : "🎙 Usuário Mutado na Call")
    .setDescription(`${member} foi mutado no ${type === "chat" ? "chat" : "voice"}`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: durationMs ? `${Math.round(durationMs / 60000)}m` : "Indeterminado" },
      { name: "📄 Motivo", value: motivo || "Não informado" },
      { name: "👮 Staff", value: staff.tag }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (type === "chat") {
    let muteRole = member.guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) muteRole = await member.guild.roles.create({ name: "Muted", permissions: [] });
    await member.roles.add(muteRole);

    await member.guild.systemChannel?.send({ embeds: [embed] });
    sendLog(member.guild, embed);

    if (durationMs) setTimeout(async () => {
      if (member.roles.cache.has(muteRole.id)) await member.roles.remove(muteRole);
    }, durationMs);
  }

  if (type === "voice") {
    if (!member.voice.channel) return;
    await member.voice.setMute(true);
    sendLog(member.guild, embed);

    if (durationMs) setTimeout(async () => {
      if (member.voice.serverMute) await member.voice.setMute(false);
    }, durationMs);
  }
}

// =============================
// EVENTO DE MENSAGEM
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  if (await checkSpam(message)) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const member = message.mentions.members.first();

  if (!isStaffOrEspecial(message.member)) {
    const msg = await message.reply({ content: "Você não tem permissão para usar este comando." });
    setTimeout(() => {
      message.delete().catch(() => {});
      msg.delete().catch(() => {});
    }, 5000);
    return;
  }

  // =============================
  // SETAR CARGOS
  // =============================
  if (command === "setarcargo" && member) {
    const embed = new EmbedBuilder()
      .setTitle("🎯 Setar Cargo")
      .setDescription(`Escolha o(s) cargo(s) para ${member}`)
      .setColor("Blue");

    const rows = CATEGORIAS.map(cat =>
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`selectcargo_${member.id}_${cat.label}`)
          .setPlaceholder(cat.label)
          .setMinValues(1)
          .setMaxValues(cat.options.length)
          .addOptions(cat.options.map(opt => ({ label: opt.label, value: opt.id })))
      )
    );

    await message.reply({ embeds: [embed], components: rows });
    setTimeout(() => message.delete().catch(() => {}), 5000);
  }

  // =============================
  // REMOVER CARGOS
  // =============================
  if (command === "removercargo" && member) {
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

    await message.reply({ embeds: [embed], components: [row] });
    setTimeout(() => message.delete().catch(() => {}), 5000);
  }

  // =============================
  // MUTECHAT / MUTECALL
  // =============================
  if (["mutechat", "mutecall"].includes(command) && member) {
    const timeArg = args[0];
    const motivo = args.slice(1).join(" ") || "Não informado";
    const duration = parseDuration(timeArg);

    await muteMember({
      member,
      type: command === "mutechat" ? "chat" : "voice",
      durationMs: duration,
      motivo,
      staff: message.author
    });
  }

  // =============================
  // UNMUTECHAT / UNMUTECALL
  // =============================
  if (["unmutechat", "unmutecall"].includes(command) && member) {
    if (command === "unmutechat") {
      const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
      if (muteRole && member.roles.cache.has(muteRole.id)) {
        await member.roles.remove(muteRole);
        await message.reply(`🔊 ${member} foi desmutado no chat!`);
      } else {
        await message.reply(`${member} não está mutado no chat.`);
      }
    }

    if (command === "unmutecall") {
      if (member.voice.channel && member.voice.serverMute) {
        await member.voice.setMute(false);
        await message.reply(`🔊 ${member} foi desmutado na call!`);
      } else {
        await message.reply(`${member} não está mutado na call.`);
      }
    }

    message.delete().catch(() => {});
  }

  // =============================
  // CLEAR
  // =============================
  if (command === "clear") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

    const target = message.mentions.users.first();
    let amount = parseInt(args[0]) || 100;
    if (amount < 1 || amount > 100) return;

    if (target) {
      const messages = await message.channel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(m => m.author.id === target.id).first(amount);
      await message.channel.bulkDelete(userMessages, true).catch(() => {});
    } else {
      await message.channel.bulkDelete(amount, true).catch(() => {});
    }
    message.delete().catch(() => {});
  }
});

// =============================
// INTERAÇÕES (Select Menus)
// =============================
client.on("interactionCreate", async (interaction) => {
  if (!isStaffOrEspecial(interaction.member)) return;

  if (!interaction.isStringSelectMenu()) return;

  const userId = interaction.customId.split("_")[1];
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  if (interaction.customId.startsWith("selectcargo_")) {
    for (const cid of interaction.values) {
      const cargo = interaction.guild.roles.cache.get(cid);
      if (cargo && !member.roles.cache.has(cid)) await member.roles.add(cid);
    }
    await interaction.update({ content: `✅ Cargos adicionados para ${member}`, embeds: [], components: [] });
  }

  if (interaction.customId.startsWith("removercargo_")) {
    for (const cid of interaction.values) {
      if (member.roles.cache.has(cid)) await member.roles.remove(cid);
    }
    await interaction.update({ content: `🗑 Cargos removidos de ${member}`, embeds: [], components: [] });
  }
});

// =============================
// READY
// =============================
client.once("ready", () => {
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", { type: "WATCHING" });
});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
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
// UTILS
// =============================
function parseDuration(time) {
  const match = time?.match(/^(\d+)([mh])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  if (unit === "m") return value >= 1 ? value * 60000 : null;
  if (unit === "h") return value >= 1 && value <= MAX_HOURS ? value * 3600000 : null;

  return null;
}

function isStaffOrEspecial(member) {
  return STAFF_ROLE_IDS.some(id => member.roles.cache.has(id)) || member.roles.cache.has(CARGO_ESPECIAL);
}

// =============================
// ANTI-SPAM
// =============================
const spamMap = new Map(); // usuarioId => [timestamps]

async function checkSpam(message) {
  const now = Date.now();
  const userId = message.author.id;

  if (!spamMap.has(userId)) spamMap.set(userId, []);
  const timestamps = spamMap.get(userId);

  timestamps.push(now);
  while (timestamps.length && now - timestamps[0] > 5000) timestamps.shift();

  if (timestamps.length >= 5) {
    spamMap.set(userId, []);
    let muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) muteRole = await message.guild.roles.create({ name: "Muted", permissions: [] });
    await message.member.roles.add(muteRole);
    const spamMsg = await message.reply("🔇 Você foi mutado por spam!");
    setTimeout(() => {
      message.delete().catch(() => {});
      spamMsg.delete().catch(() => {});
    }, 5000);
    return true;
  }
  return false;
}

// =============================
// FUNÇÃO GENÉRICA PARA MUTE
// =============================
async function muteMember({ member, type = "chat", durationMs, motivo, staff }) {
  const embed = new EmbedBuilder()
    .setColor(type === "chat" ? "Red" : "Orange")
    .setTitle(type === "chat" ? "🔇 Usuário Mutado" : "🎙 Usuário Mutado na Call")
    .setDescription(`${member} foi mutado no ${type === "chat" ? "chat" : "voice"}`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: durationMs ? `${Math.round(durationMs / 60000)}m` : "Indeterminado" },
      { name: "📄 Motivo", value: motivo || "Não informado" },
      { name: "👮 Staff", value: staff.tag }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (type === "chat") {
    let muteRole = member.guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) muteRole = await member.guild.roles.create({ name: "Muted", permissions: [] });
    await member.roles.add(muteRole);

    await member.guild.systemChannel?.send({ embeds: [embed] });
    sendLog(member.guild, embed);

    if (durationMs) setTimeout(async () => {
      if (member.roles.cache.has(muteRole.id)) await member.roles.remove(muteRole);
    }, durationMs);
  }

  if (type === "voice") {
    if (!member.voice.channel) return;
    await member.voice.setMute(true);
    sendLog(member.guild, embed);

    if (durationMs) setTimeout(async () => {
      if (member.voice.serverMute) await member.voice.setMute(false);
    }, durationMs);
  }
}

// =============================
// EVENTO DE MENSAGEM
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  if (await checkSpam(message)) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const member = message.mentions.members.first();

  if (!isStaffOrEspecial(message.member)) {
    const msg = await message.reply({ content: "Você não tem permissão para usar este comando." });
    setTimeout(() => {
      message.delete().catch(() => {});
      msg.delete().catch(() => {});
    }, 5000);
    return;
  }

  // =============================
  // SETAR CARGOS
  // =============================
  if (command === "setarcargo" && member) {
    const embed = new EmbedBuilder()
      .setTitle("🎯 Setar Cargo")
      .setDescription(`Escolha o(s) cargo(s) para ${member}`)
      .setColor("Blue");

    const rows = CATEGORIAS.map(cat =>
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`selectcargo_${member.id}_${cat.label}`)
          .setPlaceholder(cat.label)
          .setMinValues(1)
          .setMaxValues(cat.options.length)
          .addOptions(cat.options.map(opt => ({ label: opt.label, value: opt.id })))
      )
    );

    await message.reply({ embeds: [embed], components: rows });
    setTimeout(() => message.delete().catch(() => {}), 5000);
  }

  // =============================
  // REMOVER CARGOS
  // =============================
  if (command === "removercargo" && member) {
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

    await message.reply({ embeds: [embed], components: [row] });
    setTimeout(() => message.delete().catch(() => {}), 5000);
  }

  // =============================
  // MUTECHAT / MUTECALL
  // =============================
  if (["mutechat", "mutecall"].includes(command) && member) {
    const timeArg = args[0];
    const motivo = args.slice(1).join(" ") || "Não informado";
    const duration = parseDuration(timeArg);

    await muteMember({
      member,
      type: command === "mutechat" ? "chat" : "voice",
      durationMs: duration,
      motivo,
      staff: message.author
    });
  }

  // =============================
  // UNMUTECHAT / UNMUTECALL
  // =============================
  if (["unmutechat", "unmutecall"].includes(command) && member) {
    if (command === "unmutechat") {
      const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
      if (muteRole && member.roles.cache.has(muteRole.id)) {
        await member.roles.remove(muteRole);
        await message.reply(`🔊 ${member} foi desmutado no chat!`);
      } else {
        await message.reply(`${member} não está mutado no chat.`);
      }
    }

    if (command === "unmutecall") {
      if (member.voice.channel && member.voice.serverMute) {
        await member.voice.setMute(false);
        await message.reply(`🔊 ${member} foi desmutado na call!`);
      } else {
        await message.reply(`${member} não está mutado na call.`);
      }
    }

    message.delete().catch(() => {});
  }

  // =============================
  // CLEAR
  // =============================
  if (command === "clear") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

    const target = message.mentions.users.first();
    let amount = parseInt(args[0]) || 100;
    if (amount < 1 || amount > 100) return;

    if (target) {
      const messages = await message.channel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(m => m.author.id === target.id).first(amount);
      await message.channel.bulkDelete(userMessages, true).catch(() => {});
    } else {
      await message.channel.bulkDelete(amount, true).catch(() => {});
    }
    message.delete().catch(() => {});
  }
});

// =============================
// INTERAÇÕES (Select Menus)
// =============================
client.on("interactionCreate", async (interaction) => {
  if (!isStaffOrEspecial(interaction.member)) return;

  if (!interaction.isStringSelectMenu()) return;

  const userId = interaction.customId.split("_")[1];
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  if (interaction.customId.startsWith("selectcargo_")) {
    for (const cid of interaction.values) {
      const cargo = interaction.guild.roles.cache.get(cid);
      if (cargo && !member.roles.cache.has(cid)) await member.roles.add(cid);
    }
    await interaction.update({ content: `✅ Cargos adicionados para ${member}`, embeds: [], components: [] });
  }

  if (interaction.customId.startsWith("removercargo_")) {
    for (const cid of interaction.values) {
      if (member.roles.cache.has(cid)) await member.roles.remove(cid);
    }
    await interaction.update({ content: `🗑 Cargos removidos de ${member}`, embeds: [], components: [] });
  }
});

// =============================
// READY
// =============================
client.once("ready", () => {
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", { type: "WATCHING" });
});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);
