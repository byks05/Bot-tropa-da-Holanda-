// index.js
const { 
  Client, 
  GatewayIntentBits, 
  StringSelectMenuBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType
} = require('discord.js');
const { Pool } = require("pg");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// -------------------
// PostgreSQL
// -------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pontos (
      user_id TEXT PRIMARY KEY,
      total BIGINT DEFAULT 0,
      ativo BOOLEAN DEFAULT false,
      canal_id TEXT,
      coins BIGINT DEFAULT 0
    );
  `);
}

createTables().catch(console.error);

// -------------------
// Configs e IDs
// -------------------
const ADM_IDS = ["1468017578747105390", "1468069638935150635"];
const ALLOWED_REC = ["1468017578747105390","1468069638935150635","1468066422490923081"];
const IDS = {
  TICKET_CATEGORY: "1474366472326222013",
  RECRUITMENT_ROLE: "1472589662144040960",
  LOG_CHANNEL: "1474380000000000000",
  STAFF: ["1468017578747105390", "1468069638935150635"]
};
const CATEGORIA_PONTO = "1474413150441963615";
const CARGOS = [
  { id: "1468021327129743483", meta: 24 * 3600000 },
  { id: "1468018959797452881", meta: 48 * 3600000 }
];

// -------------------
// Funções utilitárias
// -------------------
function canUseCommand(member) {
  return IDS.STAFF.some(id => member.roles.cache.has(id)) || ADM_IDS.includes(member.id);
}

function parseDuration(str) {
  if (!str) return null;
  if (str.endsWith("h")) return parseFloat(str) * 60 * 60 * 1000;
  if (str.endsWith("m")) return parseFloat(str) * 60 * 1000;
  return null;
}

function getCargoAtual(member) {
  const cargosPossiveis = CARGOS.filter(c => member.roles.cache.has(c.id));
  if (!cargosPossiveis.length) return "Nenhum cargo";
  cargosPossiveis.sort((a, b) => b.meta - a.meta);
  return `<@&${cargosPossiveis[0].id}>`;
}

// -------------------
// READY EVENT
// -------------------
client.once("ready", async () => {
  console.log(`Bot logado como ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) return console.error("Servidor não encontrado.");

  // Recupera sessões ativas
  const result = await pool.query("SELECT * FROM pontos WHERE ativo = true");
  for (const user of result.rows) {
    try {
      let canalExistente = guild.channels.cache.find(
        c => c.parentId === CATEGORIA_PONTO && c.name === `ponto-${user.user_id}`
      );

      if (!canalExistente) {
        canalExistente = await guild.channels.create({
          name: `ponto-${user.user_id}`,
          type: ChannelType.GuildText,
          parent: CATEGORIA_PONTO,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.user_id, allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ] 
            }
          ]
        });

        await pool.query("UPDATE pontos SET canal_id = $1 WHERE user_id = $2", [canalExistente.id, user.user_id]);
      }

      await canalExistente.send("⚠️ Sessão recuperada após reinício do bot.");

      const canalLogs = guild.channels.cache.get(IDS.LOG_CHANNEL);
      if (canalLogs) canalLogs.send(`Sessão do usuário <@${user.user_id}> recuperada.`);
    } catch (err) {
      console.error("Erro ao recriar canal:", err);
    }
  }

  // PAINEL DE LOJA
  const canalEmbed = guild.channels.cache.get("1474885764990107790");
  if (!canalEmbed) return console.error("Canal do painel fixo não encontrado.");

  const produtos = [
    { label: "Nitro 1 mês", value: "nitro_1", description: "💰 3 R$" },
    { label: "Nitro 3 meses", value: "nitro_3", description: "💰 6 R$" },
    { label: "Contas virgem +30 dias", value: "conta_virgem", description: "💰 5 R$" },
    { label: "Ativação Nitro", value: "ativacao_nitro", description: "💰 1,50 R$" },
    { label: "Spotify Premium", value: "spotify", description: "💰 5 R$" },
    { label: "Molduras com icon personalizado", value: "moldura", description: "💰 2 R$" },
    { label: "Youtube Premium", value: "youtube", description: "💰 6 R$" },
  ];

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("loja_select")
      .setPlaceholder("Selecione um produto...")
      .addOptions(produtos)
  );

  const textoPainel = `# Produtos | Tropa da Holanda 🇳🇱
-# Compre Apenas com vendedor oficial <@1209478510847197216>, <@910351624189411408> ou atendentes.`;

  const mensagens = await canalEmbed.messages.fetch({ limit: 10 });
  mensagens.forEach(msg => { if (msg.author.id === client.user.id) msg.delete().catch(() => {}); });

  const mensagem = await canalEmbed.send({ content: textoPainel, components: [row] });
  await mensagem.pin().catch(() => {});
});

// -------------------
// INTERAÇÕES
// -------------------
client.on("interactionCreate", async interaction => {
  const guild = interaction.guild;

  // SELECT MENU LOJA
  if (interaction.isStringSelectMenu() && interaction.customId === "loja_select") {
    const produto = interaction.values[0];
    const categoriaId = "1474885663425036470";
    const ticketName = `ticket-${interaction.user.username}`;

    if (guild.channels.cache.find(c => c.name === ticketName && c.parentId === categoriaId)) {
      return interaction.reply({ content: `❌ Você já possui um ticket aberto`, ephemeral: true });
    }

    const channel = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: categoriaId,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ],
    });

    const produtosInfo = {
      nitro_1: { nome: "Nitro 1 mês", valor: "3 R$" },
      nitro_3: { nome: "Nitro 3 meses", valor: "6 R$" },
      conta_virgem: { nome: "Contas virgem +30 dias", valor: "5 R$" },
      ativacao_nitro: { nome: "Ativação Nitro", valor: "1,50 R$" },
      spotify: { nome: "Spotify Premium", valor: "5 R$" },
      moldura: { nome: "Molduras com icon personalizado", valor: "2 R$" },
      youtube: { nome: "Youtube Premium", valor: "6 R$" },
    };

    const prodSelecionado = produtosInfo[produto];
    const ticketEmbed = new EmbedBuilder()
      .setTitle(`🛒 Ticket de Compra - ${prodSelecionado.nome}`)
      .setDescription(`${interaction.user} abriu um ticket para comprar **${prodSelecionado.nome}** (${prodSelecionado.valor}).\nAdmins responsáveis: <@&${IDS.RECRUITMENT_ROLE}>`)
      .setColor("Green")
      .setTimestamp();

    const fecharButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("fechar_ticket")
        .setLabel("🔒 Fechar Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: `<@&${IDS.RECRUITMENT_ROLE}>`, embeds: [ticketEmbed], components: [fecharButton] });
    await interaction.reply({ content: `✅ Ticket criado! Verifique o canal ${channel}`, ephemeral: true });
  }

  // BUTTON FECHAR TICKET
  if (interaction.isButton() && interaction.customId === "fechar_ticket") {
    if (!interaction.channel.name.startsWith("ticket-"))
      return interaction.reply({ content: "❌ Este botão só pode ser usado dentro de um ticket.", ephemeral: true });
    await interaction.channel.delete().catch(() => {});
  }
});

// -------------------
// COMANDO REC
// -------------------
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  const prefix = "thl!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift()?.toLowerCase();
  if (command !== "rec") return;

  const user = message.mentions.members.first();
  if (!user) return message.reply("❌ Mencione um usuário válido.");
  if (!message.member.roles.cache.some(r => ALLOWED_REC.includes(r.id))) return message.reply("❌ Sem permissão.");

  const subCommand = args[1]?.toLowerCase();
  const secondArg = args[2]?.toLowerCase();

  try {
    if (subCommand === "add" && secondArg === "menina") {
      await user.roles.remove("1468024885354959142");
      await user.roles.add(["1472223890821611714","1468283328510558208","1468026315285205094"]);
      return message.reply(`✅ Cargos "menina" aplicados em ${user}`);
    }

    if (subCommand === "add") {
      await user.roles.remove("1468024885354959142");
      await user.roles.add(["1468283328510558208","1468026315285205094"]);
      return message.reply(`✅ Cargos aplicados em ${user}`);
    }

    return message.reply("❌ Use: thl!rec <@usuário> add ou add menina");
  } catch (err) {
    console.error(err);
    return message.reply("❌ Erro ao executar comando.");
  }
});

// -------------------
// MENTION AUTOMÁTICO
// -------------------
client.on("channelCreate", channel => {
  if (channel.parentId === IDS.TICKET_CATEGORY) {
    channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
  }
});

// -------------------
// LOGIN
// -------------------
client.login(process.env.TOKEN);
