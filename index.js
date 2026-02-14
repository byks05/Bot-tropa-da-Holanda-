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

// CARGOS DE STAFF PARA USAR COMANDOS
const STAFF_ROLE_IDS = [
  "1468070328138858710",
  "1468069942451507221",
  "1468069638935150635",
  "1468017578747105390"
];

// CARGO ESPECÍFICO QUE SÓ PODE SETAR/REMOVER CARGOS
const CARGO_ESPECIAL = "1468066422490923081";

// CARGOS DISPONÍVEIS PARA SETARCARGO
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
// VARIÁVEIS DE ANTI-SPAM/TEXTO
// =============================
const userMessages = new Map(); // Para contar mensagens rápidas
const userBigText = new Map(); // Para contar mensagens grandes
const BIG_TEXT_LIMIT = 200; // Quantos caracteres é considerado "grande"
const BIG_TEXT_MAX = 3; // Quantas vezes pode mandar mensagem grande antes de mutar
const FAST_MSG_MAX = 5; // Quantas mensagens rápidas
const FAST_MSG_TIME = 5000; // 5 segundos para contar mensagens rápidas

// =============================
// FUNÇÃO COMUM DE MUTE AUTOMÁTICO
// =============================
async function autoMute(member, reason, durationMs, guild) {
  // Mute de chat
  let muteRole = guild.roles.cache.find(r => r.name === "Muted");
  if (!muteRole) {
    muteRole = await guild.roles.create({ name: "Muted", permissions: [] });
  }

  await member.roles.add(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado")
    .setDescription(`${member} foi mutado automaticamente`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: `${Math.floor(durationMs / 60000)} min` },
      { name: "📄 Motivo", value: reason }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: guild.name })
    .setTimestamp();

  await guild.channels.cache
    .filter(c => c.isTextBased())
    .first()
    ?.send({ embeds: [embed] }); // envia no chat público
  sendLog(guild, embed); // envia nos logs

  setTimeout(async () => {
    if (member.roles.cache.has(muteRole.id)) {
      await member.roles.remove(muteRole);
    }
  }, durationMs);
}

// =============================
// DETECTAR SPAM/TEXTO GRANDE
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  const isStaff = STAFF_ROLE_IDS.some(id => message.member.roles.cache.has(id));
  const isEspecial = message.member.roles.cache.has(CARGO_ESPECIAL);

  if (isStaff || isEspecial) return; // staff autorizado ignora

  const now = Date.now();

  // --- Mensagem grande ---
  if (message.content.length >= BIG_TEXT_LIMIT) {
    let count = userBigText.get(message.author.id) || 0;
    count++;
    userBigText.set(message.author.id, count);

    if (count >= BIG_TEXT_MAX) {
      userBigText.set(message.author.id, 0); // reset
      await autoMute(message.member, "Spam de texto grande", 120000, message.guild); // 2 min
    }
  }

  // --- Mensagens rápidas ---
  let arr = userMessages.get(message.author.id) || [];
  arr = arr.filter(t => now - t < FAST_MSG_TIME);
  arr.push(now);
  userMessages.set(message.author.id, arr);

  if (arr.length >= FAST_MSG_MAX) {
    userMessages.set(message.author.id, []);
    await autoMute(message.member, "Spam de mensagens rápidas", 120000, message.guild); // 2 min
  }

  // =============================
  // COMANDOS MANUAIS
  // =============================
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const member = message.mentions.members.first();

  if (!isStaff && !isEspecial) {
    return message.reply("Você não tem permissão para usar este comando.");
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

    await message.reply({ embeds: [embed], components: rows });
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

    await message.reply({ embeds: [embed], components: [row] });
  }

  // =============================
  // MUTE CHAT/CALL MANUAL
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

      await message.reply({ embeds: [embed] });
      sendLog(message.guild, embed);

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

      await message.reply({ embeds: [embed] });
      sendLog(message.guild, embed);

      setTimeout(async () => {
        if (member.voice.serverMute) {
          await member.voice.setMute(false);
        }
      }, duration);
    }
  }
});

// =============================
// INTERAÇÕES (BOTÕES E SELECT MENUS)
// =============================
client.on("interactionCreate", async interaction => {
  const isStaff = STAFF_ROLE_IDS.some(id => interaction.member.roles.cache.has(id));
  const isEspecial = interaction.member.roles.cache.has(CARGO_ESPECIAL);

  if (interaction.isStringSelectMenu()) {
    const userId = interaction.customId.split("_")[1];
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    if (!isStaff && !isEspecial)
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });

    // SETAR CARGOS
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

    // REMOVER CARGOS
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
// BOT ONLINE
// =============================
client.on("ready", () => {
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", {
    type: "WATCHING"
  });
});

client.login(process.env.TOKEN);
