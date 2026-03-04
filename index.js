require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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
        criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Tabela calls_ativas verificada/criada.");
  } catch (err) {
    console.error("❌ Erro ao criar tabela:", err);
  }

  const criarChannel = await client.channels.fetch(IDS.PAINEL_CRIAR);
  const gerenciarChannel = await client.channels.fetch(IDS.PAINEL_GERENCIAR);

  // ===== PAINEL CRIAR =====
  const rowCriar = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("criar_sol").setLabel("☀ Sol Nascente").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("criar_brisa").setLabel("🌊 Brisa do Litoral").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("criar_fogo").setLabel("🔥 Fogo do Sertão").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("criar_imperio").setLabel("👑 Império Nordestino").setStyle(ButtonStyle.Success)
  );

  await criarChannel.send({
    content: "🎛 **Painel de Criação de Calls VIP**",
    components: [rowCriar]
  });

  // ===== PAINEL GERENCIAR =====
  const rowGerenciar = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("gerenciar_call").setLabel("⚙ Gerenciar Minha Call").setStyle(ButtonStyle.Secondary)
  );

  await gerenciarChannel.send({
    content: "⚙ **Painel de Gerenciamento de Calls**",
    components: [rowGerenciar]
  });
});

// ================= FUNÇÃO CRIAR CALL =================

async function criarCall(interaction, tipo) {

  const guild = interaction.guild;
  const user = interaction.member;

  const existente = await pool.query(
    "SELECT * FROM calls_ativas WHERE user_id = $1",
    [user.id]
  );

  if (existente.rows.length)
    return interaction.reply({ content: "❌ Você já possui uma call ativa.", ephemeral: true });

  let categoria = IDS.CATEGORIA_VIP;
  if (tipo === "fogo") categoria = IDS.CATEGORIA_FOGO;
  if (tipo === "imperio") categoria = IDS.CATEGORIA_IMPERIO;

  const canal = await guild.channels.create({
    name: `Call-${user.user.username}`,
    type: 2,
    parent: categoria,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionsBitField.Flags.Connect]
      }
    ]
  });

  if (tipo === "imperio") {
    await canal.permissionOverwrites.edit(user.id, {
      ManageChannels: true,
      MoveMembers: true
    });
  }

  await pool.query(
    "INSERT INTO calls_ativas (user_id, channel_id, tipo) VALUES ($1, $2, $3)",
    [user.id, canal.id, tipo]
  );

  interaction.reply({ content: "✅ Call criada com sucesso!", ephemeral: true });
}

// ================= INTERAÇÕES =================

client.on("interactionCreate", async interaction => {

  if (!interaction.isButton()) return;

  const member = interaction.member;

  // ===== CRIAR =====

  if (interaction.customId === "criar_sol") {
    if (!member.roles.cache.has(IDS.CARGOS.SOL))
      return interaction.reply({ content: "❌ Você não possui o cargo.", ephemeral: true });

    criarCall(interaction, "sol");
  }

  if (interaction.customId === "criar_brisa") {
    if (!member.roles.cache.has(IDS.CARGOS.BRISA))
      return interaction.reply({ content: "❌ Você não possui o cargo.", ephemeral: true });

    criarCall(interaction, "brisa");
  }

  if (interaction.customId === "criar_fogo") {
    if (!member.roles.cache.has(IDS.CARGOS.FOGO))
      return interaction.reply({ content: "❌ Você não possui o cargo.", ephemeral: true });

    criarCall(interaction, "fogo");
  }

  if (interaction.customId === "criar_imperio") {
    if (!member.roles.cache.has(IDS.CARGOS.IMPERIO))
      return interaction.reply({ content: "❌ Você não possui o cargo.", ephemeral: true });

    criarCall(interaction, "imperio");
  }

  // ===== GERENCIAR =====

  if (interaction.customId === "gerenciar_call") {

    const call = await pool.query(
      "SELECT * FROM calls_ativas WHERE user_id = $1",
      [member.id]
    );

    if (!call.rows.length)
      return interaction.reply({ content: "❌ Você não possui call ativa.", ephemeral: true });

    const tipo = call.rows[0].tipo;
    const canal = interaction.guild.channels.cache.get(call.rows[0].channel_id);

    if (!canal)
      return interaction.reply({ content: "❌ Call não encontrada.", ephemeral: true });

    if (tipo === "sol" || tipo === "brisa") {
      await canal.delete();
      await pool.query("DELETE FROM calls_ativas WHERE user_id = $1", [member.id]);
      return interaction.reply({ content: "🗑 Call deletada com sucesso!", ephemeral: true });
    }

    interaction.reply({ content: "⚙ Você pode gerenciar limite manualmente nas configurações da call.", ephemeral: true });
  }
});

// ================= AUTO DELETE 5 MIN =================

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
        await pool.query(
          "DELETE FROM calls_ativas WHERE channel_id = $1",
          [canal.id]
        );

      }

    }, 300000); // 5 minutos
  }
});

client.login(process.env.TOKEN);
