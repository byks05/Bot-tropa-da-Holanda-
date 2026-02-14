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

// CARGO ESPECÍFICO QUE PODE GERENCIAR CARGOS
const MANAGE_ROLE_ID = "1468066422490923081";

// CARGOS DISPONÍVEIS POR CATEGORIA
const CATEGORIES = {
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
// VERIFICA PERMISSÕES
// =============================
function canManageRoles(member) {
  return member.roles.cache.has(MANAGE_ROLE_ID) || member.permissions.has(PermissionsBitField.Flags.Administrator);
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

  if (!canManageRoles(message.member)) {
    return message.reply("Você não tem permissão para usar este comando.");
  }

  // =============================
  // SETAR CARGOS
  // =============================
  if (command === "setarcargo") {
    if (!member) return message.reply("Mencione um usuário.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`categoria_Inicial_${member.id}`)
        .setLabel("Inicial")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`categoria_Aliados_${member.id}`)
        .setLabel("Aliados")
        .setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🎯 Escolha uma Categoria")
      .setDescription(`Selecione a categoria para ${member}`)
      .setColor("Blue");

    await message.reply({ embeds: [embed], components: [row] });
  }

  // =============================
  // REMOVER CARGOS
  // =============================
  if (command === "removercargo") {
    if (!member) return message.reply("Mencione um usuário.");

    const userRoles = member.roles.cache
      .filter(r => !r.managed && r.id !== member.guild.id)
      .map(r => ({ label: r.name, value: r.id }));

    if (!userRoles.length) return message.reply("O usuário não possui cargos removíveis.");

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`remover_${member.id}`)
        .setPlaceholder("Selecione cargos para remover")
        .addOptions(userRoles)
        .setMinValues(1)
        .setMaxValues(userRoles.length)
    );

    const embed = new EmbedBuilder()
      .setTitle("🗑 Remover Cargos")
      .setDescription(`Selecione os cargos de ${member} que deseja remover`)
      .setColor("Red");

    await message.reply({ embeds: [embed], components: [row] });
  }
});

// =============================
// INTERAÇÕES (BOTÕES E SELECT MENUS)
// =============================
client.on("interactionCreate", async interaction => {
  if (!canManageRoles(interaction.member)) {
    return interaction.reply({ content: "Sem permissão.", ephemeral: true });
  }

  // ======== BOTÕES DE CATEGORIA ========
  if (interaction.isButton() && interaction.customId.startsWith("categoria_")) {
    const [_, categoria, userId] = interaction.customId.split("_");
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const cargos = CATEGORIES[categoria];
    if (!cargos || !cargos.length) return;

    const options = cargos.map(c => ({ label: c.label, value: c.id }));
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`selectcargo_${member.id}`)
        .setPlaceholder("Selecione cargos")
        .addOptions(options)
        .setMinValues(1)
        .setMaxValues(options.length)
    );

    await interaction.update({
      content: `Selecione os cargos da categoria **${categoria}** para ${member}`,
      components: [row]
    });
  }

  // ======== SELECT MENU DE CARGOS ========
  if (interaction.isStringSelectMenu()) {
    const memberId = interaction.customId.split("_")[1];
    const member = await interaction.guild.members.fetch(memberId).catch(() => null);
    if (!member) return;

    if (interaction.customId.startsWith("selectcargo_")) {
      // Adiciona os cargos selecionados
      for (const cargoId of interaction.values) {
        const role = interaction.guild.roles.cache.get(cargoId);
        if (role && !member.roles.cache.has(role.id)) await member.roles.add(role);
      }

      await interaction.update({
        content: `✅ Cargos adicionados para ${member}`,
        embeds: [],
        components: []
      });
    }

    if (interaction.customId.startsWith("remover_")) {
      // Remove os cargos selecionados
      for (const cargoId of interaction.values) {
        const role = interaction.guild.roles.cache.get(cargoId);
        if (role && member.roles.cache.has(role.id)) await member.roles.remove(role);
      }

      await interaction.update({
        content: `✅ Cargos removidos de ${member}`,
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

client.login(process.env.TOKEN);=== "removercargo") {
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
