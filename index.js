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

// CARGOS DISPONÍVEIS PARA SETARCARGO
const CARGOS_RECRUTAMENTO = [
  { label: "Equipe Tropa da Holanda", id: "1468026315285205094" },
  { label: "Verificado", id: "1468283328510558208" }
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
// EVENTO DE MENSAGEM
// =============================
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const member = message.mentions.members.first();

  if (!STAFF_ROLE_IDS.some(id => message.member.roles.cache.has(id))) {
    return message.reply("Você não tem permissão para usar este comando.");
  }

  // =============================
  // SETAR CARGOS COM EMBED E BOTÕES
  // =============================
  if (command === "setarcargo") {
    if (!member) return message.reply("Mencione um usuário.");

    const embed = new EmbedBuilder()
      .setTitle("🎯 Setar Cargo")
      .setDescription(`Escolha o cargo para ${member}`)
      .setColor("Blue");

    const options = CARGOS_RECRUTAMENTO.map(cargo => ({
      label: cargo.label,
      value: cargo.id
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`selectcargo_${member.id}`)
        .setPlaceholder("Selecione o cargo")
        .addOptions(options)
    );

    await message.reply({ embeds: [embed], components: [row] });
  }

  // =============================
  // MUTE CHAT E CALL
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
  // UNMUTE CHAT
  // =============================
  if (command === "unmutechat") {
    if (!member) return message.reply("Mencione um usuário.");
    const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (muteRole) await member.roles.remove(muteRole);
    await message.reply(`🔊 ${member} foi desmutado.`);
  }

  // =============================
  // UNMUTE CALL
  // =============================
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
  if (interaction.isButton()) {
    if (!STAFF_ROLE_IDS.some(id => interaction.member.roles.cache.has(id)))
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
    if (!interaction.customId.startsWith("selectcargo_")) return;

    if (!STAFF_ROLE_IDS.some(id => interaction.member.roles.cache.has(id)))
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });

    const userId = interaction.customId.split("_")[1];
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const cargoId = interaction.values[0];
    const cargo = interaction.guild.roles.cache.get(cargoId);
    if (!cargo) return;

    await member.roles.add(cargo);
    await interaction.update({
      content: `✅ Cargo **${cargo.name}** adicionado para ${member}`,
      embeds: [],
      components: []
    });
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
