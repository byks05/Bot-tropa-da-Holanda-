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
  InteractionType
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

// ================= IDs =================
const IDS = {
  PAINEL_CRIAR: "1478695189366177846",
  PAINEL_GERENCIAR: "1478697992071549081",

  CATEGORIA_VIP: "1478567017832251392",
  CATEGORIA_FOGO: "1478695052015308800",
  CATEGORIA_IMPERIO: "1478694889167257784",

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

  // ===== CRIAR TABELA AUTOMATICAMENTE =====
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calls_ativas (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        cargo_id TEXT NOT NULL,
        criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Tabela calls_ativas verificada/criada.");
  } catch (err) {
    console.error("❌ Erro ao criar tabela:", err);
  }

  // ===== PAINEL CRIAR =====
  const criarChannel = await client.channels.fetch(IDS.PAINEL_CRIAR);

  // Evitar duplicar
  const messagesCriar = await criarChannel.messages.fetch();
  if (!messagesCriar.size) {
    const rowCriar = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("criar_call").setLabel("🎙 Criar Call").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("deletar_call").setLabel("🗑 Deletar Call").setStyle(ButtonStyle.Danger)
    );

    await criarChannel.send({
      content: "🎛 **Painel de Criação de Calls VIP**",
      components: [rowCriar]
    });
  }

  // ===== PAINEL GERENCIAR =====
  const gerenciarChannel = await client.channels.fetch(IDS.PAINEL_GERENCIAR);

  const messagesGerenciar = await gerenciarChannel.messages.fetch();
  if (!messagesGerenciar.size) {
    const rowGerenciar = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("alterar_limite").setLabel("⚙ Alterar Limite").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("alterar_nome").setLabel("✏ Alterar Nome Call").setStyle(ButtonStyle.Secondary)
    );

    await gerenciarChannel.send({
      content: "⚙ **Painel de Gerenciamento de Calls**",
      components: [rowGerenciar]
    });
  }
});

// ================= FUNÇÃO CRIAR CALL =================
async function criarCall(interaction) {
  const guild = interaction.guild;
  const user = interaction.member;

  // Verifica cargo
  let tipo = null;
  if (user.roles.cache.has(IDS.CARGOS.SOL)) tipo = "sol";
  else if (user.roles.cache.has(IDS.CARGOS.BRISA)) tipo = "brisa";
  else if (user.roles.cache.has(IDS.CARGOS.FOGO)) tipo = "fogo";
  else if (user.roles.cache.has(IDS.CARGOS.IMPERIO)) tipo = "imperio";
  else return interaction.reply({ content: "❌ Você não possui VIP.", ephemeral: true });

  // Verifica call ativa
  const existente = await pool.query("SELECT * FROM calls_ativas WHERE user_id = $1", [user.id]);
  if (existente.rows.length)
    return interaction.reply({ content: "❌ Você já possui uma call ativa.", ephemeral: true });

  // Define categoria
  let categoria = IDS.CATEGORIA_VIP;
  if (tipo === "fogo") categoria = IDS.CATEGORIA_FOGO;
  if (tipo === "imperio") categoria = IDS.CATEGORIA_IMPERIO;

  // Cria cargo exclusivo da call
  const cargo = await guild.roles.create({
    name: `VIP-${user.user.username}`,
    color: tipo === "fogo" ? "Random" : tipo === "imperio" ? "Random" : "Default",
    mentionable: true
  });

  // Cria a call
  const canal = await guild.channels.create({
    name: `🎙 ${user.user.username}`,
    type: 2,
    parent: categoria,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.Connect] },
      { id: cargo.id, allow: [PermissionsBitField.Flags.Connect] },
      { id: user.id, allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MoveMembers] }
    ]
  });

  // Salva no banco
  await pool.query(
    "INSERT INTO calls_ativas (user_id, channel_id, tipo, cargo_id) VALUES ($1, $2, $3, $4)",
    [user.id, canal.id, tipo, cargo.id]
  );

  interaction.reply({ content: "✅ Call e cargo VIP criados com sucesso!", ephemeral: true });

  // Auto-delete 5 min se sol/brisa e call vazia
  if (tipo === "sol" || tipo === "brisa") {
    setTimeout(async () => {
      const canalCheck = guild.channels.cache.get(canal.id);
      if (canalCheck && canalCheck.members.size === 0) {
        await canalCheck.delete();
        await cargo.delete();
        await pool.query("DELETE FROM calls_ativas WHERE channel_id = $1", [canal.id]);
      }
    }, 300000);
  }
}

// ================= GERENCIAMENTO =================
client.on("interactionCreate", async (interaction) => {

  const member = interaction.member;

  // ===== BOTÃO CRIAR CALL =====
  if (interaction.isButton()) {
    if (interaction.customId === "criar_call") return criarCall(interaction);

    // ===== DELETAR CALL =====
    if (interaction.customId === "deletar_call") {
      const call = await pool.query("SELECT * FROM calls_ativas WHERE user_id = $1", [member.id]);
      if (!call.rows.length) return interaction.reply({ content: "❌ Você não possui call ativa.", ephemeral: true });

      const canal = interaction.guild.channels.cache.get(call.rows[0].channel_id);
      const cargo = interaction.guild.roles.cache.get(call.rows[0].cargo_id);

      if (!canal) return interaction.reply({ content: "❌ Call não encontrada.", ephemeral: true });

      await canal.delete();
      await cargo.delete();
      await pool.query("DELETE FROM calls_ativas WHERE user_id = $1", [member.id]);

      return interaction.reply({ content: "🗑 Sua call e cargo VIP foram deletados!", ephemeral: true });
    }

    // ===== ALTERAR LIMITE =====
    if (interaction.customId === "alterar_limite") {
      const call = await pool.query("SELECT * FROM calls_ativas WHERE user_id = $1", [member.id]);
      if (!call.rows.length) return interaction.reply({ content: "❌ Você não possui call ativa.", ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId("modal_limite")
        .setTitle("Alterar Limite da Call");

      const input = new TextInputBuilder()
        .setCustomId("input_limite")
        .setLabel("Quantidade máxima de usuários")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // ===== ALTERAR NOME =====
    if (interaction.customId === "alterar_nome") {
      const call = await pool.query("SELECT * FROM calls_ativas WHERE user_id = $1", [member.id]);
      if (!call.rows.length) return interaction.reply({ content: "❌ Você não possui call ativa.", ephemeral: true });

      if (!(call.rows[0].tipo === "fogo" || call.rows[0].tipo === "imperio"))
        return interaction.reply({ content: "❌ Somente Fogo e Império podem alterar o nome da call.", ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId("modal_nome")
        .setTitle("Alterar Nome da Call");

      const input = new TextInputBuilder()
        .setCustomId("input_nome")
        .setLabel("Novo nome da call")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }
  }

  // ===== MODAIS =====
  if (interaction.type === InteractionType.ModalSubmit) {
    const call = await pool.query("SELECT * FROM calls_ativas WHERE user_id = $1", [member.id]);
    if (!call.rows.length) return interaction.reply({ content: "❌ Você não possui call ativa.", ephemeral: true });

    const canal = interaction.guild.channels.cache.get(call.rows[0].channel_id);

    if (interaction.customId === "modal_limite") {
      const limite = parseInt(interaction.fields.getTextInputValue("input_limite"));
      if (isNaN(limite) || limite < 1) return interaction.reply({ content: "❌ Valor inválido.", ephemeral: true });

      await canal.edit({ userLimit: limite });
      return interaction.reply({ content: `✅ Limite alterado para ${limite} usuários.`, ephemeral: true });
    }

    if (interaction.customId === "modal_nome") {
      const novoNome = interaction.fields.getTextInputValue("input_nome");
      await canal.edit({ name: novoNome });
      return interaction.reply({ content: `✅ Nome alterado para ${novoNome}.`, ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
