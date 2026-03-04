require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
  EmbedBuilder
} = require("discord.js");

const { Pool } = require("pg");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ================== IDS ==================
const IDS = {
  CATEGORIA_VIP: "1478567017832251392",
  CATEGORIA_FOGO: "1478695052015308800",
  CATEGORIA_IMPERIO: "147869488916725784", // ajuste se precisar
  CARGOS: {
    SOL: "1478567864175693865",
    BRISA: "1478567921243521266",
    FOGO: "1478567970711273675",
    IMPERIO: "1478568023358050425"
  }
};

// ================= READY =================
client.once("ready", async () => {
  console.log(`🔥 Bot online como ${client.user.tag}`);

  // ===== TABELA calls_ativas =====
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calls_ativas (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        cargo_id TEXT,
        criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        vip_termino TIMESTAMP
      );
    `);
    console.log("✅ Tabela calls_ativas pronta.");
  } catch (err) {
    console.error("❌ Erro ao criar tabela:", err);
  }
});

// ================= COMANDO NE!VIP =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "vip") return;

  const member = interaction.member;

  // ===== Verifica se já tem call ativa =====
  const existente = await pool.query(
    "SELECT * FROM calls_ativas WHERE user_id = $1",
    [member.id]
  );

  const vipRole = Object.entries(IDS.CARGOS).find(([key, id]) =>
    member.roles.cache.has(id)
  );

  if (!vipRole)
    return interaction.reply({ content: "❌ Você não possui nenhum VIP.", ephemeral: true });

  const tipoVIP = vipRole[0].toLowerCase(); // sol, brisa, fogo, imperio

  // ===== Criação da primeira vez =====
  if (!existente.rows.length) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("criar_call")
        .setLabel("🎛 Criar Minha Call")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("criar_cargo")
        .setLabel("🛠 Criar Meu Cargo")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("fechar_painel")
        .setLabel("❌ Fechar Painel")
        .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle(`Painel VIP - ${member.user.username}`)
      .setDescription(`VIP Ativo: ${tipoVIP.toUpperCase()}\nUse os botões abaixo para criar sua call e cargo.`)
      .setColor("#FFAA00")
      .setTimestamp();

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // ===== Painel de gerenciamento para quem já tem call =====
  const callInfo = existente.rows[0];
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("gerenciar_limite")
      .setLabel("⚙ Alterar Limite")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("alterar_nome_call")
      .setLabel("✏ Alterar Nome da Call")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("alterar_nome_cargo")
      .setLabel("✏ Alterar Nome do Cargo")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("deletar_call")
      .setLabel("🗑 Deletar Call")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("fechar_painel")
      .setLabel("❌ Fechar Painel")
      .setStyle(ButtonStyle.Secondary)
  );

  const embed = new EmbedBuilder()
    .setTitle(`Painel VIP - ${member.user.username}`)
    .setDescription(
      `VIP: ${tipoVIP.toUpperCase()}\nCall ativa: ${callInfo.channel_id}\nVIP termina em: ${callInfo.vip_termino || "Indefinido"}`
    )
    .setColor("#FFAA00")
    .setTimestamp();

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
});

// ================= INTERAÇÕES BOTÕES =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const member = interaction.member;

  // ===== Fechar painel =====
  if (interaction.customId === "fechar_painel") {
    return interaction.message.delete().catch(() => {});
  }

  // ===== Criar Call =====
  if (interaction.customId === "criar_call") {
    const vipRole = Object.entries(IDS.CARGOS).find(([key, id]) =>
      member.roles.cache.has(id)
    );
    const tipoVIP = vipRole[0].toLowerCase();

    let categoria = IDS.CATEGORIA_VIP;
    if (tipoVIP === "fogo") categoria = IDS.CATEGORIA_FOGO;
    if (tipoVIP === "imperio") categoria = IDS.CATEGORIA_IMPERIO;

    const canal = await interaction.guild.channels.create({
      name: tipoVIP === "sol" || tipoVIP === "brisa" ? `Call-${member.user.username}` : `Call-Temporaria`,
      type: 2,
      parent: categoria,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, allow: [PermissionsBitField.Flags.Connect] }
      ]
    });

    // Permissão especial pro Império
    if (tipoVIP === "imperio" || tipoVIP === "fogo") {
      await canal.permissionOverwrites.edit(member.id, {
        ManageChannels: true,
        MoveMembers: true
      });
    }

    await pool.query(
      "INSERT INTO calls_ativas (user_id, channel_id, tipo) VALUES ($1, $2, $3)",
      [member.id, canal.id, tipoVIP]
    );

    return interaction.reply({ content: "✅ Call criada com sucesso!", ephemeral: true });
  }

  // ===== Criar Cargo =====
  if (interaction.customId === "criar_cargo") {
    return interaction.reply({ content: "🛠 Criação de cargo será via modal (implementável conforme seu fluxo de nomes).", ephemeral: true });
  }
});

// ================= AUTO DELETE TEMPORÁRIAS =====
client.on("voiceStateUpdate", async (oldState) => {
  if (!oldState.channelId) return;
  const canal = oldState.guild.channels.cache.get(oldState.channelId);
  if (!canal) return;

  if (canal.members.size !== 0) return;

  const call = await pool.query(
    "SELECT * FROM calls_ativas WHERE channel_id = $1",
    [canal.id]
  );
  if (!call.rows.length) return;

  const tipo = call.rows[0].tipo;
  if (tipo === "sol" || tipo === "brisa") {
    setTimeout(async () => {
      const canalCheck = oldState.guild.channels.cache.get(canal.id);
      if (canalCheck && canalCheck.members.size === 0) {
        await canalCheck.delete();
        await pool.query("DELETE FROM calls_ativas WHERE channel_id = $1", [canal.id]);
      }
    }, 300000); // 5 min
  }
});

client.login(process.env.TOKEN);
