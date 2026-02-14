const {
  Client,
  Gateconst 
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
const SPAM_MESSAGE_LIMIT = 5; 
const SPAM_MESSAGE_INTERVAL = 5000; 
const BIG_TEXT_LIMIT = 200; 
const BIG_TEXT_COUNT = 3; 
const MUTE_DURATION = 2 * 60 * 1000; 

// =============================
// LOGS
// =============================
function sendLog(guild, embed) {
  const canalLogs = guild.channels.cache.get("1468722726247338115"); // canal fixo
  if (canalLogs) canalLogs.send({ embeds: [embed] });
}

// =============================
// FUNÇÕES UTILS
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
// SISTEMA DE SPAM
// =============================
const messageHistory = new Map();
const bigMessageHistory = new Map();

async function handleSpam(message) {
  if (!message.guild || message.author.bot) return;

  const isStaff = STAFF_ROLE_IDS.some(id => message.member.roles.cache.has(id));
  const isEspecial = message.member.roles.cache.has(CARGO_ESPECIAL);
  if (isStaff || isEspecial) return;

  const userId = message.author.id;
  const now = Date.now();

  // Mensagens grandes
  if (message.content.length >= BIG_TEXT_LIMIT) {
    if (!bigMessageHistory.has(userId)) bigMessageHistory.set(userId, []);
    const arr = bigMessageHistory.get(userId);
    arr.push(now);
    while (arr.length > BIG_TEXT_COUNT) arr.shift();
    bigMessageHistory.set(userId, arr);
    if (arr.length >= BIG_TEXT_COUNT) {
      await muteMember(message.member, "Spam de texto grande", message);
      bigMessageHistory.set(userId, []);
    }
  }

  // Mensagens rápidas
  if (!messageHistory.has(userId)) messageHistory.set(userId, []);
  const msgs = messageHistory.get(userId);
  msgs.push(now);
  const filtered = msgs.filter(t => now - t <= SPAM_MESSAGE_INTERVAL);
  messageHistory.set(userId, filtered);
  if (filtered.length >= SPAM_MESSAGE_LIMIT) {
    await muteMember(message.member, "Spam de palavras rápidas", message);
    messageHistory.set(userId, []);
  }
}

// =============================
// FUNÇÃO DE MUTE
// =============================
async function muteMember(member, motivo, messageContext = null) {
  let muteRole = member.guild.roles.cache.find(r => r.name === "Muted");
  if (!muteRole) {
    muteRole = await member.guild.roles.create({ name: "Muted", permissions: [] });
  }

  await member.roles.add(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado")
    .setDescription(`${member} foi mutado automaticamente`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: "2 minutos" },
      { name: "📄 Motivo", value: motivo },
      { name: "👮 Staff", value: messageContext ? messageContext.client.user.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (messageContext) await messageContext.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);

  setTimeout(async () => {
    if (member.roles.cache.has(muteRole.id)) {
      await member.roles.remove(muteRole);
    }
  }, MUTE_DURATION);
}

// =============================
// FUNÇÃO DE UNMUTE
// =============================
async function unmuteMember(member, messageContext = null) {
  const muteRole = member.guild.roles.cache.find(r => r.name === "Muted");
  if (!muteRole) return;

  if (member.roles.cache.has(muteRole.id)) {
    await member.roles.remove(muteRole);

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("🔊 Usuário Desmutado")
      .setDescription(`${member} foi desmutado`)
      .addFields(
        { name: "🆔 ID", value: member.id },
        { name: "👮 Staff", value: messageContext ? messageContext.author.tag : "Sistema" }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: member.guild.name })
      .setTimestamp();

    if (messageContext) await messageContext.channel.send({ embeds: [embed] });
    sendLog(member.guild, embed);
  }
}

async function unmuteCall(member, messageContext = null) {
  if (!member.voice.channel) return;
  await member.voice.setMute(false);

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("🎙 Usuário Desmutado na Call")
    .setDescription(`${member} foi desmutado na call`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "👮 Staff", value: messageContext ? messageContext.author.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (messageContext) await messageContext.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);
}

// =============================
// EVENTO DE MENSAGEM
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  // =============================
  // CHECAGEM DE SETAMENTO
  // =============================
  const regexSetamento = /\bsetamento\b/i;
  if (regexSetamento.test(message.content)) {
    await message.channel.send("Confira o canal <#1468020392005337161>");
  }

  // =============================
  // SISTEMA DE SPAM
  // =============================
  await handleSpam(message);

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const member = message.mentions.members.first();
  if (!isStaffOrEspecial(message.member)) return message.reply("Você não tem permissão para usar este comando.");

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
  }

  // =============================
  // MUTE / UNMUTE CHAT E CALL
  // =============================
  if (["mutechat", "mutecall", "unmutechat", "unmutecall"].includes(command) && member) {
    const timeArg = args[0];
    const motivo = args.slice(1).join(" ") || "Não informado";
    const duration = parseDuration(timeArg);

    if (command === "mutechat") await muteMember(member, motivo, message);
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
      await message.reply({ embeds: [embed] });
      sendLog(message.guild, embed);

      setTimeout(async () => {
        if (member.voice.serverMute) await member.voice.setMute(false);
      }, duration);
    }

    if (command === "unmutechat") await unmuteMember(member, message);
    if (command === "unmutecall") await unmuteCall(member, message);
  }
});

// =============================
// INTERAÇÕES (BOTÕES E SELECT MENUS)
// =============================
client.on("interactionCreate", async interaction => {
  const isStaff = STAFF_ROLE_IDS.some(id => interaction.member.roles.cache.has(id));
  const isEspecial = interaction.member.roles.cache.has(CARGO_ESPECIAL);
  if (!isStaff && !isEspecial) return;

  if (interaction.isStringSelectMenu()) {
    const userId = interaction.customId.split("_")[1];
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    if (interaction.customId.startsWith("selectcargo_")) {
      const cargoIds = interaction.values;
      for (const cid of cargoIds) {
        const cargo = interaction.guild.roles.cache.get(cid);
        if (cargo && !member.roles.cache.has(cid)) await member.roles.add(cargo);
      }
      await interaction.update({ content: `✅ Cargos adicionados para ${member}`, embeds: [], components: [] });
    }

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
client.once("ready", () => {
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", { type: "WATCHING" });
});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);wayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
const SPAM_MESSAGE_LIMIT = 5;
const SPAM_MESSAGE_INTERVAL = 5000;
const BIG_TEXT_LIMIT = 200;
const BIG_TEXT_COUNT = 3;
const MUTE_DURATION = 2 * 60 * 1000; // 2 minutos

// =============================
// LOGS
// =============================
function sendLog(guild, embed) {
  const canalLogs = guild.channels.cache.get("1468722726247338115");
  if (canalLogs) canalLogs.send({ embeds: [embed] });
}

// =============================
// FUNÇÕES UTILS
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
// SISTEMA DE SPAM
// =============================
const messageHistory = new Map();
const bigMessageHistory = new Map();

async function handleSpam(message) {
  if (!message.guild || message.author.bot) return;

  const isStaff = STAFF_ROLE_IDS.some(id => message.member.roles.cache.has(id));
  const isEspecial = message.member.roles.cache.has(CARGO_ESPECIAL);
  if (isStaff || isEspecial) return;

  const userId = message.author.id;
  const now = Date.now();

  // Mensagens grandes
  if (message.content.length >= BIG_TEXT_LIMIT) {
    if (!bigMessageHistory.has(userId)) bigMessageHistory.set(userId, []);
    const arr = bigMessageHistory.get(userId);
    arr.push(now);
    while (arr.length > BIG_TEXT_COUNT) arr.shift();
    bigMessageHistory.set(userId, arr);
    if (arr.length >= BIG_TEXT_COUNT) {
      await muteMember(message.member, "Spam de texto grande", message);
      bigMessageHistory.set(userId, []);
    }
  }

  // Mensagens rápidas
  if (!messageHistory.has(userId)) messageHistory.set(userId, []);
  const msgs = messageHistory.get(userId);
  msgs.push(now);
  const filtered = msgs.filter(t => now - t <= SPAM_MESSAGE_INTERVAL);
  messageHistory.set(userId, filtered);
  if (filtered.length >= SPAM_MESSAGE_LIMIT) {
    await muteMember(message.member, "Spam de palavras rápidas", message);
    messageHistory.set(userId, []);
  }
}

// =============================
// FUNÇÃO DE MUTE
// =============================
async function muteMember(member, motivo, messageContext = null) {
  let muteRole = member.guild.roles.cache.find(r => r.name === "Muted");
  if (!muteRole) {
    muteRole = await member.guild.roles.create({ name: "Muted", permissions: [] });
  }

  await member.roles.add(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado")
    .setDescription(`${member} foi mutado automaticamente`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: "2 minutos" },
      { name: "📄 Motivo", value: motivo },
      { name: "👮 Staff", value: messageContext ? messageContext.client.user.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (messageContext) await messageContext.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);

  setTimeout(async () => {
    if (member.roles.cache.has(muteRole.id)) {
      await member.roles.remove(muteRole);
    }
  }, MUTE_DURATION);
}

// =============================
// EVENTO DE MENSAGEM
// =============================
client.on("messageCreate", async message => {
  if (!message.guild) return;

  await handleSpam(message);

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const member = message.mentions.members.first();
  if (!isStaffOrEspecial(message.member)) return message.reply("Você não tem permissão para usar este comando.");

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
  }

  // =============================
  // MUTE CHAT / CALL
  // =============================
  if (["mutechat", "mutecall"].includes(command) && member) {
    const timeArg = args[0];
    const motivo = args.slice(1).join(" ") || "Não informado";
    const duration = parseDuration(timeArg);

    if (command === "mutechat") {
      await muteMember(member, motivo, message);
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

      await message.reply({ embeds: [embed] });
      sendLog(message.guild, embed);

      setTimeout(async () => {
        if (member.voice.serverMute) await member.voice.setMute(false);
      }, duration);
    }
  }

  // =============================
  // UNMUTE CHAT / CALL
  // =============================
  if (["unmutechat", "unmutecall"].includes(command) && member) {
    if (command === "unmutechat") {
      const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
      if (!muteRole || !member.roles.cache.has(muteRole.id)) {
        return message.reply("Este usuário não está mutado no chat.");
      }
      await member.roles.remove(muteRole);

      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("🔊 Usuário Desmutado")
        .setDescription(`${member} foi desmutado no chat`)
        .addFields(
          { name: "🆔 ID", value: member.id },
          { name: "👮 Staff", value: message.author.tag }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: message.guild.name })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      sendLog(message.guild, embed);
    }

    if (command === "unmutecall") {
      if (!member.voice.channel) return message.reply("O usuário não está em call.");
      if (!member.voice.serverMute) return message.reply("O usuário não está mutado na call.");

      await member.voice.setMute(false);

      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("🎙 Usuário Desmutado na Call")
        .setDescription(`${member} foi desmutado na call`)
        .addFields(
          { name: "🆔 ID", value: member.id },
          { name: "👮 Staff", value: message.author.tag }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: message.guild.name })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      sendLog(message.guild, embed);
    }
  }
});

// =============================
// INTERAÇÕES (BOTÕES E SELECT MENUS)
// =============================
client.on("interactionCreate", async interaction => {
  const isStaff = STAFF_ROLE_IDS.some(id => interaction.member.roles.cache.has(id));
  const isEspecial = interaction.member.roles.cache.has(CARGO_ESPECIAL);
  if (!isStaff && !isEspecial) return;

  if (interaction.isStringSelectMenu()) {
    const userId = interaction.customId.split("_")[1];
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    if (interaction.customId.startsWith("selectcargo_")) {
      const cargoIds = interaction.values;
      for (const cid of cargoIds) {
        const cargo = interaction.guild.roles.cache.get(cid);
        if (cargo && !member.roles.cache.has(cid)) await member.roles.add(cargo);
      }
      await interaction.update({ content: `✅ Cargos adicionados para ${member}`, embeds: [], components: [] });
    }

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
client.once("ready", () => {
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", { type: "WATCHING" });
});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);
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
const SPAM_MESSAGE_LIMIT = 5; 
const SPAM_MESSAGE_INTERVAL = 5000; 
const BIG_TEXT_LIMIT = 200; 
const BIG_TEXT_COUNT = 3; 
const MUTE_DURATION = 2 * 60 * 1000; 

// =============================
// LOGS
// =============================
function sendLog(guild, embed) {
  const canalLogs = guild.channels.cache.get("1468722726247338115"); // canal fixo
  if (canalLogs) canalLogs.send({ embeds: [embed] });
}

// =============================
// FUNÇÕES UTILS
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
// SISTEMA DE SPAM
// =============================
const messageHistory = new Map();
const bigMessageHistory = new Map();

async function handleSpam(message) {
  if (!message.guild || message.author.bot) return;

  const isStaff = STAFF_ROLE_IDS.some(id => message.member.roles.cache.has(id));
  const isEspecial = message.member.roles.cache.has(CARGO_ESPECIAL);
  if (isStaff || isEspecial) return;

  const userId = message.author.id;
  const now = Date.now();

  // Mensagens grandes
  if (message.content.length >= BIG_TEXT_LIMIT) {
    if (!bigMessageHistory.has(userId)) bigMessageHistory.set(userId, []);
    const arr = bigMessageHistory.get(userId);
    arr.push(now);
    while (arr.length > BIG_TEXT_COUNT) arr.shift();
    bigMessageHistory.set(userId, arr);
    if (arr.length >= BIG_TEXT_COUNT) {
      await muteMember(message.member, "Spam de texto grande", message);
      bigMessageHistory.set(userId, []);
    }
  }

  // Mensagens rápidas
  if (!messageHistory.has(userId)) messageHistory.set(userId, []);
  const msgs = messageHistory.get(userId);
  msgs.push(now);
  const filtered = msgs.filter(t => now - t <= SPAM_MESSAGE_INTERVAL);
  messageHistory.set(userId, filtered);
  if (filtered.length >= SPAM_MESSAGE_LIMIT) {
    await muteMember(message.member, "Spam de palavras rápidas", message);
    messageHistory.set(userId, []);
  }
}

// =============================
// FUNÇÃO DE MUTE
// =============================
async function muteMember(member, motivo, messageContext = null) {
  let muteRole = member.guild.roles.cache.find(r => r.name === "Muted");
  if (!muteRole) {
    muteRole = await member.guild.roles.create({ name: "Muted", permissions: [] });
  }

  await member.roles.add(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado")
    .setDescription(`${member} foi mutado automaticamente`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: "2 minutos" },
      { name: "📄 Motivo", value: motivo },
      { name: "👮 Staff", value: messageContext ? messageContext.client.user.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (messageContext) await messageContext.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);

  setTimeout(async () => {
    if (member.roles.cache.has(muteRole.id)) {
      await member.roles.remove(muteRole);
    }
  }, MUTE_DURATION);
}

// =============================
// FUNÇÃO DE UNMUTE
// =============================
async function unmuteMember(member, messageContext = null) {
  const muteRole = member.guild.roles.cache.find(r => r.name === "Muted");
  if (!muteRole) return;

  if (member.roles.cache.has(muteRole.id)) {
    await member.roles.remove(muteRole);

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("🔊 Usuário Desmutado")
      .setDescription(`${member} foi desmutado`)
      .addFields(
        { name: "🆔 ID", value: member.id },
        { name: "👮 Staff", value: messageContext ? messageContext.author.tag : "Sistema" }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: member.guild.name })
      .setTimestamp();

    if (messageContext) await messageContext.channel.send({ embeds: [embed] });
    sendLog(member.guild, embed);
  }
}

async function unmuteCall(member, messageContext = null) {
  if (!member.voice.channel) return;
  await member.voice.setMute(false);

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("🎙 Usuário Desmutado na Call")
    .setDescription(`${member} foi desmutado na call`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "👮 Staff", value: messageContext ? messageContext.author.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (messageContext) await messageContext.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);
}

// =============================
// EVENTO DE MENSAGEM
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  // =============================
  // CHECAGEM DE SETAMENTO
  // =============================
  const regexSetamento = /\bsetamento\b/i;
  if (regexSetamento.test(message.content)) {
    await message.channel.send("Confira o canal <#1468020392005337161>");
  }

  // =============================
  // SISTEMA DE SPAM
  // =============================
  await handleSpam(message);

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const member = message.mentions.members.first();
  if (!isStaffOrEspecial(message.member)) return message.reply("Você não tem permissão para usar este comando.");

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
  }

  // =============================
  // MUTE / UNMUTE CHAT E CALL
  // =============================
  if (["mutechat", "mutecall", "unmutechat", "unmutecall"].includes(command) && member) {
    const timeArg = args[0];
    const motivo = args.slice(1).join(" ") || "Não informado";
    const duration = parseDuration(timeArg);

    if (command === "mutechat") await muteMember(member, motivo, message);
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
      await message.reply({ embeds: [embed] });
      sendLog(message.guild, embed);

      setTimeout(async () => {
        if (member.voice.serverMute) await member.voice.setMute(false);
      }, duration);
    }

    if (command === "unmutechat") await unmuteMember(member, message);
    if (command === "unmutecall") await unmuteCall(member, message);
  }
});

// =============================
// INTERAÇÕES (BOTÕES E SELECT MENUS)
// =============================
client.on("interactionCreate", async interaction => {
  const isStaff = STAFF_ROLE_IDS.some(id => interaction.member.roles.cache.has(id));
  const isEspecial = interaction.member.roles.cache.has(CARGO_ESPECIAL);
  if (!isStaff && !isEspecial) return;

  if (interaction.isStringSelectMenu()) {
    const userId = interaction.customId.split("_")[1];
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    if (interaction.customId.startsWith("selectcargo_")) {
      const cargoIds = interaction.values;
      for (const cid of cargoIds) {
        const cargo = interaction.guild.roles.cache.get(cid);
        if (cargo && !member.roles.cache.has(cid)) await member.roles.add(cargo);
      }
      await interaction.update({ content: `✅ Cargos adicionados para ${member}`, embeds: [], components: [] });
    }

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
client.once("ready", () => {
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", { type: "WATCHING" });
});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);
