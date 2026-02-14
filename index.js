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
const MAX_HOURS = 999;

// CARGOS DISPONÍVEIS
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

// =============================
// LOGS
// =============================
function sendLog(guild, embed) {
  const canalLogs = guild.channels.cache.find(c => c.name === "logs");
  if (canalLogs) canalLogs.send({ embeds: [embed] });
}

// =============================
// PARSE TEMPO
// =============================
function parseDuration(time) {
  const match = time?.match(/^(\d+)([mh])$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  if (unit === "m") return value * 60000;
  if (unit === "h") return value * 3600000;
  return null;
}

// =============================
// FUNÇÃO UNIFICADA DE MUTE
// =============================
async function muteUser({ member, guild, timeArg, motivo, tipo, staff }) {
  const duration = parseDuration(timeArg);
  if (!duration) return;

  let embed = new EmbedBuilder()
    .setColor(tipo === "chat" ? "Red" : "Orange")
    .setTitle(tipo === "chat" ? "🔇 Usuário Mutado" : "🎙 Usuário Mutado na Call")
    .setDescription(`${member} foi mutado${tipo === "chat" ? " no chat" : " na call"}`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: timeArg },
      { name: "📄 Motivo", value: motivo },
      { name: "👮 Staff", value: staff.tag }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: guild.name })
    .setTimestamp();

  // Ação de mute
  if (tipo === "chat") {
    let muteRole = guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) muteRole = await guild.roles.create({ name: "Muted", permissions: [] });
    await member.roles.add(muteRole);
  } else {
    if (!member.voice.channel) return;
    await member.voice.setMute(true);
  }

  // Mensagem no chat + logs
  guild.channels.cache
    .find(c => c.isTextBased())
    ?.send({ embeds: [embed] });
  sendLog(guild, embed);

  // Desmute automático
  setTimeout(async () => {
    if (tipo === "chat") {
      let muteRole = guild.roles.cache.find(r => r.name === "Muted");
      if (muteRole && member.roles.cache.has(muteRole.id)) await member.roles.remove(muteRole);
    } else {
      if (member.voice.serverMute) await member.voice.setMute(false);
    }
  }, duration);
}

// =============================
// CONTROLE DE SPAM
// =============================
const spamData = {};
const BIG_MESSAGE_LIMIT = 200; // caracteres grandes
const FAST_MESSAGE_LIMIT = 5; // número de mensagens rápidas
const FAST_TIME_WINDOW = 5000; // 5 segundos
const BIG_MESSAGE_COUNT = 3; // 3 vezes para mute
const ALLOWED_IDS = [...STAFF_ROLE_IDS, CARGO_ESPECIAL];

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  // ==============================
  // ANTI-SPAM AUTOMÁTICO
  // ==============================
  if (!ALLOWED_IDS.some(id => message.member.roles.cache.has(id))) return;

  const userId = message.author.id;
  if (!spamData[userId]) spamData[userId] = { bigMsg: 0, fastMsg: [], lastTime: Date.now() };

  // Grandes mensagens
  if (message.content.length > BIG_MESSAGE_LIMIT) {
    spamData[userId].bigMsg++;
    await message.delete().catch(() => {});
    if (spamData[userId].bigMsg >= BIG_MESSAGE_COUNT) {
      spamData[userId].bigMsg = 0;
      await muteUser({
        member: message.member,
        guild: message.guild,
        timeArg: "2m",
        motivo: "Spam de texto",
        tipo: "chat",
        staff: client.user
      });
    }
  }

  // Mensagens rápidas
  const now = Date.now();
  spamData[userId].fastMsg.push(now);
  spamData[userId].fastMsg = spamData[userId].fastMsg.filter(t => now - t <= FAST_TIME_WINDOW);
  if (spamData[userId].fastMsg.length >= FAST_MESSAGE_LIMIT) {
    spamData[userId].fastMsg = [];
    await muteUser({
      member: message.member,
      guild: message.guild,
      timeArg: "2m",
      motivo: "Spam de palavras",
      tipo: "chat",
      staff: client.user
    });
  }

  // ==============================
  // COMANDOS PREFIX
  // ==============================
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const member = message.mentions.members.first();
  const isStaff = STAFF_ROLE_IDS.some(id => message.member.roles.cache.has(id));
  const isEspecial = message.member.roles.cache.has(CARGO_ESPECIAL);

  if (!isStaff && !isEspecial) return;

  // ======= COMANDOS =======
  if (command === "setarcargo") {
    if (!member) return message.reply("Mencione um usuário.");

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

    await message.reply({ embeds: [embed], components: [row] });
  }

  if (["mutechat", "mutecall"].includes(command)) {
    if (!member) return message.reply("Mencione um usuário.");
    const timeArg = args[0];
    const motivo = args.slice(1).join(" ") || "Não informado";
    await muteUser({
      member,
      guild: message.guild,
      timeArg,
      motivo,
      tipo: command === "mutechat" ? "chat" : "call",
      staff: message.author
    });
  }
});

// =============================
// INTERAÇÕES
// =============================
client.on("interactionCreate", async interaction => {
  const isStaff = STAFF_ROLE_IDS.some(id => interaction.member.roles.cache.has(id));
  const isEspecial = interaction.member.roles.cache.has(CARGO_ESPECIAL);
  if (!isStaff && !isEspecial) return interaction.reply({ content: "Sem permissão.", ephemeral: true });

  if (!interaction.isStringSelectMenu()) return;

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
});

// =============================
// READY
// =============================
client.on("ready", () => {
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", {
    type: "WATCHING"
  });
});

client.login(process.env.TOKEN);e({
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

client.login(process.env.TOKEN);
