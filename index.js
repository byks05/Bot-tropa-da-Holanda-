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

// CARGO ESPECIAL: só pode setar/remover cargos
const SPECIAL_ROLE_ID = "1468066422490923081";

// =============================
// CATEGORIAS E CARGOS
// =============================
const CARGO_CATEGORIES = {
  Inicial: [
    { label: "Equipe Tropa da Holanda", id: "1468026315285205094" },
    { label: "Verificado", id: "1468283328510558208" }
  ],
  Aliados: [
    { label: "Aliados", id: "1468279104624398509" }
  ]
};

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
// VERIFICA PERMISSÃO
// =============================
function hasPermission(member, command) {
  if (STAFF_ROLE_IDS.some(id => member.roles.cache.has(id))) return true;
  if (member.roles.cache.has(SPECIAL_ROLE_ID)) {
    return ["setarcargo", "removercargo"].includes(command);
  }
  return false;
}

// =============================
// EVENTO DE MENSAGEM
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const member = message.mentions.members.first();

  if (!hasPermission(message.member, command)) {
    return message.reply("Você não tem permissão para usar este comando.");
  }

  // =============================
  // SETAR CARGOS COM EMBED E SELECT MENU
  // =============================
  if (command === "setarcargo") {
    if (!member) return message.reply("Mencione um usuário.");

    const row = new ActionRowBuilder();
    for (const category in CARGO_CATEGORIES) {
      row.addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`selectcargo_${category}_${member.id}`)
          .setPlaceholder(category)
          .setMinValues(1)
          .setMaxValues(CARGO_CATEGORIES[category].length)
          .addOptions(
            CARGO_CATEGORIES[category].map(c => ({ label: c.label, value: c.id }))
          )
      );
    }

    const embed = new EmbedBuilder()
      .setTitle("🎯 Setar Cargo")
      .setDescription(`Escolha os cargos para ${member}`)
      .setColor("Blue");

    await message.reply({ embeds: [embed], components: [row] });
  }

  // =============================
  // REMOVER CARGOS
  // =============================
  if (command === "removercargo") {
    if (!member) return message.reply("Mencione um usuário.");

    const userRoles = member.roles.cache.filter(r => r.id !== member.guild.id);
    if (!userRoles.size) return message.reply("Usuário não possui cargos.");

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`removercargo_${member.id}`)
        .setPlaceholder("Selecione os cargos para remover")
        .setMinValues(1)
        .setMaxValues(userRoles.size)
        .addOptions(userRoles.map(r => ({ label: r.name, value: r.id })))
    );

    const embed = new EmbedBuilder()
      .setTitle("❌ Remover Cargo")
      .setDescription(`Selecione os cargos que deseja remover de ${member}`)
      .setColor("Red");

    await message.reply({ embeds: [embed], components: [row] });
  }

  // =============================
  // MUTE CHAT / CALL
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

      await message.reply({ embeds: [embed], components: [row] });
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

  // =============================
  // UNMUTE CHAT / CALL
  // =============================
  if (command === "unmutechat") {
    if (!member) return message.reply("Mencione um usuário.");
    const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (muteRole) await member.roles.remove(muteRole);
    await message.reply(`🔊 ${member} foi desmutado.`);
  }

  if (command === "unmutecall") {
    if (!member) return message.reply("Mencione um usuário.");
    if (!member.voice.channel) return message.reply("O usuário não está em call.");
    await member.voice.setMute(false);
    await message.reply(`🔊 ${member} foi desmutado na call.`);
  }
});

// =============================
// INTERAÇÕES (BOTÕES E SELECT MENUS)
// =============================
client.on("interactionCreate", async interaction => {
  // =============================
  // BOTÕES
  // =============================
  if (interaction.isButton()) {
    const cmd = interaction.customId.startsWith("unmute_") ? "mutechat" : "";
    if (!hasPermission(interaction.member, cmd))
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

  // =============================
  // SELECT MENUS
  // =============================
  if (interaction.isStringSelectMenu()) {
    let commandType = "";
    if (interaction.customId.startsWith("selectcargo_")) commandType = "setarcargo";
    if (interaction.customId.startsWith("removercargo_")) commandType = "removercargo";

    if (!hasPermission(interaction.member, commandType))
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });

    const userId = interaction.customId.split("_")[interaction.customId.startsWith("selectcargo_") ? 2 : 1];
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    if (commandType === "setarcargo") {
      for (const cargoId of interaction.values) {
        const cargo = interaction.guild.roles.cache.get(cargoId);
        if (cargo) await member.roles.add(cargo);
      }
      await interaction.update({
        content: `✅ Cargos adicionados para ${member}`,
        embeds: [],
        components: []
      });
    }

    if (commandType === "removercargo") {
      for (const cargoId of interaction.values) {
        const cargo = interaction.guild.roles.cache.get(cargoId);
        if (cargo) await member.roles.remove(cargo);
      }
      await interaction.update({
        content: `❌ Cargos removidos de ${member}`,
        embeds: [],
        components: []
      });
    }
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

client.login(process.env.TOKEN);
