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
// PARSE DURAÇÃO
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
// ANTI-SPAM
// =============================
const userSpam = new Map();

function checkSpam(message) {
  const userId = message.author.id;
  const now = Date.now();
  if (!userSpam.has(userId)) userSpam.set(userId, { msgs: [], lastText: "", textCount: 0 });

  const data = userSpam.get(userId);

  // Limpa mensagens antigas (>10s)
  data.msgs = data.msgs.filter(t => now - t < 10000);

  // Texto grande
  if (message.content.length > 150) data.textCount++;
  else data.textCount = 0;

  data.msgs.push(now);

  let reason = null;
  if (data.textCount >= 3) reason = "Spam de texto";
  else if (data.msgs.length >= 5) reason = "Spam de palavras";

  return reason;
}

// =============================
// FUNÇÃO MUTE
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
    if (member.voice.channel) await member.voice.setMute(true);
  }

  // Mensagem no chat + logs
  guild.channels.cache.find(c => c.isTextBased())?.send({ embeds: [embed] });
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
// EVENTO DE MENSAGEM
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  // Anti-spam para usuários autorizados
  const isStaff = STAFF_ROLE_IDS.some(id => message.member.roles.cache.has(id));
  const isEspecial = message.member.roles.cache.has(CARGO_ESPECIAL);
  if (isStaff || isEspecial) {
    const spamReason = checkSpam(message);
    if (spamReason) {
      await muteUser({
        member: message.member,
        guild: message.guild,
        timeArg: "2m",
        motivo: spamReason,
        tipo: "chat",
        staff: client.user
      });
      return message.delete().catch(() => {});
    }
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const member = message.mentions.members.first();

  if (!member) return;

  if (!isStaff && !isEspecial) {
    return message.reply("Você não tem permissão para usar este comando.");
  }

  // =============================
  // SETAR CARGOS
  // =============================
  if (command === "setarcargo") {
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

    await message.reply({ embeds: [embed], components: rows });
  }

  // =============================
  // REMOVER CARGOS
  // =============================
  if (command === "removercargo") {
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
  // MUTE CHAT/CALL
  // =============================
  if (["mutechat", "mutecall"].includes(command)) {
    const timeArg = args[1];
    const motivo = args.slice(2).join(" ") || "Não informado";
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
// INTERAÇÕES (BOTÕES E SELECT MENUS)
// =============================
client.on("interactionCreate", async interaction => {
  const isStaff = STAFF_ROLE_IDS.some(id => interaction.member.roles.cache.has(id));
  const isEspecial = interaction.member.roles.cache.has(CARGO_ESPECIAL);

  if (!isStaff && !isEspecial)
    return interaction.reply({ content: "Sem permissão.", ephemeral: true });

  // =============================
  // SETAR/REMOVER CARGOS
  // =============================
  if (interaction.isStringSelectMenu()) {
    const userId = interaction.customId.split("_")[1];
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    if (interaction.customId.startsWith("selectcargo_")) {
      for (const cid of interaction.values) {
        const cargo = interaction.guild.roles.cache.get(cid);
        if (cargo && !member.roles.cache.has(cid)) await member.roles.add(cargo);
      }
      await interaction.update({ content: `✅ Cargos adicionados para ${member}`, embeds: [], components: [] });
    }

    if (interaction.customId.startsWith("removercargo_")) {
      for (const cid of interaction.values) {
        if (member.roles.cache.has(cid)) await member.roles.remove(cid);
      }
      await interaction.update({ content: `🗑 Cargos removidos de ${member}`, embeds: [], components: [] });
    }
  }
});

// =============================
// BOT ONLINE
// =============================
client.on("ready", () => {
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", { type: "WATCHING" });
});

client.login(process.env.TOKEN);
