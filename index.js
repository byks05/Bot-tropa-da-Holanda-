// =============================
// IMPORTS
// =============================
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits
} = require("discord.js");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

// 🔥 PostgreSQL
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// =============================
// CLIENT & DATABASE
// =============================
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers // ⚠️ necessário para detectar saídas de membros
  ] 
});

// =============================
// CLIENT READY (PAINEL FIXO DE LOJA)
// =============================
client.once("clientReady", async () => {

  const canalEmbed = await client.channels.fetch("1474885764990107790").catch(() => null);
  if (!canalEmbed) return;

  const produtos = [
    { label: "Nitro 1 mês", value: "nitro_1", description: "💰 R$ 3" },
    { label: "Nitro 3 meses", value: "nitro_3", description: "💰 R$ 6" },
    { label: "Contas virgem +30 dias", value: "conta_virgem", description: "💰 R$ 5" },
    { label: "Ativação Nitro", value: "ativacao_nitro", description: "💰 R$ 1,50" },
    { label: "Spotify Premium", value: "spotify", description: "💰 R$ 5" },
    { label: "Molduras com icon personalizado", value: "moldura", description: "💰 R$ 2" },
    { label: "Y0utub3 Premium", value: "youtube", description: "💰 R$ 6" },
  ];

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("loja_select")
      .setPlaceholder("Selecione um produto...")
      .addOptions(produtos)
  );

  const textoPainel = `
# Produtos | Tropa da Holanda 🇳🇱
-# Compre Apenas com vendedor oficial <@1209478510847197216> , <@910351624189411408>  ou atendentes 🚨

> 🛒 ** Nitro mensal (1 mês/3 mês) **
> 🛒 **CONTA VIRGEM +30 Dias**

• Nunca tiverão nitro
• Email confirmado
• Altere o email!
• Ótimas para ativar nitro
• Full acesso (pode trocar email & senha)**

> 🛒 **Ativação do nitro**
> 🛒 **Spotify Premium**
> 🛒 **Molduras com icon personalizado**
> 🛒 **Youtube Premium**

-# Compre Apenas com o vendedor oficial <@1209478510847197216>, <@910351624189411408> e os atendentes 🚨`;

  try {
    // 🔥 Evita recriar se já existir mensagem do bot fixada
    const mensagens = await canalEmbed.messages.fetch({ limit: 10 });
    const mensagemExistente = mensagens.find(
      m => m.author.id === client.user.id && m.components.length > 0
    );

    if (mensagemExistente) return; // Já existe painel, não recria

    const mensagem = await canalEmbed.send({
      content: textoPainel,
      components: [row]
    });

    await mensagem.pin().catch(() => {});
    console.log("Painel da loja criado com sucesso.");

  } catch (err) {
    console.error("Erro ao atualizar o painel:", err);
  }
});
// =============================
// INTERAÇÃO DO SELECT MENU
// =============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "loja_select") return;

  const produto = interaction.values[0];
  const guild = interaction.guild;
  const categoriaId = "1474885663425036470";
  const ticketName = `ticket-${interaction.user.username}`;

  // Evita ticket duplicado
  const existingChannel = guild.channels.cache.find(
    c => c.name === ticketName && c.parentId === categoriaId
  );
  if (existingChannel) {
    // Reset do select menu para poder clicar de novo
    await interaction.update({ components: interaction.message.components });
    return interaction.followUp({ content: `❌ Você já possui um ticket aberto: ${existingChannel}`, ephemeral: true });
  }

  // Cria canal de ticket
  const channel = await guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: categoriaId,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ],
  });

  // Produtos com valores
  const produtosInfo = {
    nitro_1: { nome: "Nitro 1 mês", valor: "R$ 3" },
    nitro_3: { nome: "Nitro 3 meses", valor: "R$ 6" },
    conta_virgem: { nome: "Contas virgem +30 dias", valor: "R$ 5" },
    ativacao_nitro: { nome: "Ativação Nitro", valor: "R$ 1,50" },
    spotify: { nome: "Spotify Premium", valor: "R$ 5" },
    moldura: { nome: "Molduras com icon personalizado", valor: "R$ 2" },
    youtube: { nome: "Y0utub3 Premium", valor: "R$ 6" },
  };

  const prodSelecionado = produtosInfo[produto];

  const ticketEmbed = new EmbedBuilder()
    .setTitle(`🛒 Ticket de Compra - ${prodSelecionado.nome}`)
    .setDescription(
      `${interaction.user} abriu um ticket para comprar **${prodSelecionado.nome}** (${prodSelecionado.valor}).\n\n` +
      `Admins responsáveis: <@&1472589662144040960> <@&1468017578747105390>`
    )
    .setColor("Green")
    .setTimestamp();

  const fecharButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("fechar_ticket")
      .setLabel("🔒 Fechar Ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@&1472589662144040960> <@&1468017578747105390>`, embeds: [ticketEmbed], components: [fecharButton] });

  // Reset do select menu para permitir nova compra
  await interaction.update({ components: interaction.message.components });
  await interaction.followUp({ content: `✅ Ticket criado! Verifique o canal ${channel}`, ephemeral: true });
});

// =============================
// FECHAR TICKET
// =============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "fechar_ticket") return;

  if (!interaction.channel.name.startsWith("ticket-"))
    return interaction.reply({ content: "❌ Este botão só pode ser usado dentro de um ticket.", ephemeral: true });

  await interaction.channel.delete().catch(() => {});
});

// =============================
// PAINEL FIXO DE BATE-PONTO
// =============================
client.once("clientReady", async () => {
  const painelChannel = await client.channels.fetch("1474383177689731254").catch(() => null);
  if (!painelChannel) return;

  // Evita recriar painel se já existir
  const mensagens = await painelChannel.messages.fetch({ limit: 10 });
  const painelExistente = mensagens.find(
    m => m.author.id === client.user.id && m.components.length > 0
  );
  if (painelExistente) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("bateponto_abrir")
      .setLabel("🟢 Abrir")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("bateponto_status")
      .setLabel("📊 Status")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("bateponto_encerrar")
      .setLabel("🔴 Encerrar")
      .setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
    .setTitle("📌 Bate-Ponto | Tropa da Holanda")
    .setDescription("Clique nos botões abaixo para abrir seu ponto, verificar status ou encerrar.")
    .setColor("Green")
    .setTimestamp();

  const msg = await painelChannel.send({ embeds: [embed], components: [row] });
  await msg.pin().catch(() => {});
  console.log("Painel de bate-ponto fixo criado com sucesso!");
});

// =============================
// INTERAÇÕES DO BATE-PONTO
// =============================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  const guild = interaction.guild;
  const user = interaction.user;

  // ================================
  // ABRIR PONTO
  // ================================
  if (interaction.customId === "bateponto_abrir") {
    // Evita duplicar canal
    const existingChannel = guild.channels.cache.find(
      c => c.name === `ponto-${user.username}` && c.parentId === "1474413150441963615"
    );
    if (existingChannel) {
      await interaction.reply({ content: `❌ Você já tem um ponto aberto: ${existingChannel}`, ephemeral: true });
      return;
    }

    // Cria canal exclusivo
    const canal = await guild.channels.create({
      name: `ponto-${user.username}`,
      type: ChannelType.GuildText,
      parent: "1474413150441963615",
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ],
    });

    // Salva canal e entrada no banco
    await pool.query(
      `INSERT INTO pontos (user_id, canal, guild_id, ativo, entrada, notificado, total, coins)
       VALUES ($1, $2, $3, true, NOW(), false, 0, 0)
       ON CONFLICT (user_id) DO UPDATE SET canal = $2, ativo = true, entrada = NOW()`,
      [user.id, canal.id, guild.id]
    );

    // Botões no canal do usuário
    const rowUser = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("bateponto_status_user")
        .setLabel("📊 Status")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("bateponto_encerrar_user")
        .setLabel("🔴 Encerrar")
        .setStyle(ButtonStyle.Danger)
    );

    await canal.send({ content: `📌 ${user} seu ponto foi aberto!`, components: [rowUser] });

    await interaction.reply({ content: `✅ Ponto aberto! Verifique o canal ${canal}`, ephemeral: true });

    // Loop de 20 minutos para perguntar se está ativo
    const checkAtivo = async () => {
      const ponto = (await pool.query("SELECT * FROM pontos WHERE user_id = $1", [user.id])).rows[0];
      if (!ponto || !ponto.ativo) return;

      const canalUser = guild.channels.cache.get(ponto.canal);
      if (!canalUser) return;

      const msgPergunta = await canalUser.send(`${user}, você está ativo? Responda **sim** para continuar.`);
      await pool.query("UPDATE pontos SET notificado = true WHERE user_id = $1", [user.id]);

      const filter = m => m.author.id === user.id && m.content.toLowerCase() === "sim";
      const collector = canalUser.createMessageCollector({ filter, time: 19 * 60 * 1000, max: 1 });

      collector.on("end", async collected => {
        if (collected.size === 0) {
          // Encerrar ponto automaticamente
          const entrada = ponto.entrada;
          const agora = new Date();
          const tempoMinutos = Math.floor((agora - entrada) / 60000);

          await pool.query(
            "UPDATE pontos SET total = total + $1, ativo = false WHERE user_id = $2",
            [tempoMinutos, user.id]
          );
          await canalUser.send(`⏰ Você não respondeu, ponto encerrado automaticamente. Tempo registrado: ${tempoMinutos} minutos.`);
          await canalUser.delete().catch(()=>{});
        } else {
          // Se respondeu, reinicia o loop
          setTimeout(checkAtivo, 20 * 60 * 1000);
        }
      });
    };

    setTimeout(checkAtivo, 20 * 60 * 1000);
  }

  // ================================
  // STATUS DO USUÁRIO
  // ================================
  if (interaction.customId === "bateponto_status_user") {
    const ponto = (await pool.query("SELECT * FROM pontos WHERE user_id = $1", [user.id])).rows[0];
    if (!ponto) {
      await interaction.reply({ content: "❌ Você não tem ponto aberto.", ephemeral: true });
      return;
    }
    await interaction.reply({
      content: `📊 **Status do Ponto**\n- Tempo acumulado: ${ponto.total} minutos\n- Coins: ${ponto.coins}\n- Ativo: ${ponto.ativo ? "Sim" : "Não"}`,
      ephemeral: true
    });
  }

  // ================================
  // ENCERRAR PONTO
  // ================================
  if (interaction.customId === "bateponto_encerrar_user") {
    const ponto = (await pool.query("SELECT * FROM pontos WHERE user_id = $1", [user.id])).rows[0];
    if (!ponto) {
      await interaction.reply({ content: "❌ Você não tem ponto aberto.", ephemeral: true });
      return;
    }

    const canalUser = guild.channels.cache.get(ponto.canal);
    if (!canalUser) return;

    const entrada = ponto.entrada;
    const agora = new Date();
    const tempoMinutos = Math.floor((agora - entrada) / 60000);

    await pool.query("UPDATE pontos SET total = total + $1, ativo = false WHERE user_id = $2", [tempoMinutos, user.id]);
    await canalUser.send(`⏰ Ponto encerrado manualmente. Tempo registrado: ${tempoMinutos} minutos.`);
    await canalUser.delete().catch(()=>{});
    await interaction.reply({ content: "✅ Seu ponto foi encerrado.", ephemeral: true });
  }
});

// =============================
// CONFIG
// =============================
const PREFIX = "thl!";

const IDS = {
  STAFF: ["1468069638935150635", "1468017578747105390"],
  LOG_CHANNEL: "1468722726247338115",
  TICKET_CATEGORY: "1468014890500489447",
  RECRUITMENT_ROLE: "1468024687031484530",
};
  

// =============================
// MESSAGE CREATE
// =============================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const content = message.content.toLowerCase();

  // =============================
  // RESPOSTAS AUTOMÁTICAS
  // =============================
  if (content.includes("setamento")) {
    const botMsg = await message.reply(
      "Todas as informações sobre o Setamento estão aqui <#1468020392005337161>"
    );
    setTimeout(() => botMsg.delete().catch(() => {}), 30000);
    return;
  }

  if (content.includes("faixa rosa") || content.includes("faixas rosa")) {
    const botMsg = await message.reply(
      "Link do servidor das Faixas Rosa 🎀 | Tropa Da Holanda 🇳🇱\nhttps://discord.gg/seaaSXG5yJ"
    );
    setTimeout(() => botMsg.delete().catch(() => {}), 30000);
    return;
  }

  if (content.includes("regras")) {
    const botMsg = await message.reply(
      "Aqui estão todas as regras do servidor <#1468011045166518427>"
    );
    setTimeout(() => botMsg.delete().catch(() => {}), 60000);
    return;
  }

  // =============================
// COMANDOS COM PREFIXO
// =============================
if (!message.content.startsWith(PREFIX)) return;

const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
const command = args.shift().toLowerCase();
const userId = message.author.id;
const guild = message.guild;

// Busca os dados do usuário no PostgreSQL
let result = await pool.query(
  "SELECT * FROM pontos WHERE user_id = $1",
  [userId]
);

let data = result.rows[0];

// Se o usuário não existir no banco, cria automaticamente
if (!data) {
  await pool.query(
    "INSERT INTO pontos (user_id, total, ativo) VALUES ($1, 0, false)",
    [userId]
  );

  result = await pool.query(
    "SELECT * FROM pontos WHERE user_id = $1",
    [userId]
  );

  data = result.rows[0];
}

// =============================
// CONFIGURAÇÕES DE PERMISSÕES
// =============================
const ADM_IDS = ["1468017578747105390", "1468069638935150635"]; // IDs que podem usar addcoins/addtempo
const ALLOWED_REC = [
  "1468017578747105390",
  "1468069638935150635",
  "1468066422490923081"
];

  // =============================
// MUTE / UNMUTE CHAT
// =============================
if (command === "mutechat") {
  const user = message.mentions.members.first();
  const duration = parseDuration(args[1]) || 120000;
  const motivo = args.slice(2).join(" ") || "Sem motivo";
  if (!user) return message.reply("❌ Mencione um usuário válido.");

  const muteRole = await getMuteRole(message.guild);
  await user.roles.add(muteRole);
  message.reply(`${user} foi mutado no chat por ${duration/60000} minutos.`);

  setTimeout(async () => { if(user.roles.cache.has(muteRole.id)) await user.roles.remove(muteRole); }, duration);
}

if (command === "unmutechat") {
  const user = message.mentions.members.first();
  if (!user) return message.reply("❌ Mencione um usuário válido.");

  const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
  if(muteRole && user.roles.cache.has(muteRole.id)) await user.roles.remove(muteRole);
  message.reply(`${user} foi desmutado no chat.`);
}

// =============================
// MUTE / UNMUTE CALL
// =============================
if (command === "mutecall") {
  const user = message.mentions.members.first();
  const duration = parseDuration(args[1]) || 120000;
  if(!user) return message.reply("❌ Mencione um usuário válido.");
  if(!user.voice?.channel) return message.reply("❌ Usuário não está em call.");

  await user.voice.setMute(true);
  message.reply(`${user} foi mutado na call por ${duration/60000} minutos.`);

  setTimeout(() => user.voice.setMute(false).catch(()=>{}), duration);
}

if (command === "unmutecall") {
  const user = message.mentions.members.first();
  if(!user) return message.reply("❌ Mencione um usuário válido.");
  if(!user.voice?.channel) return message.reply("❌ Usuário não está em call.");

  await user.voice.setMute(false);
  message.reply(`${user} foi desmutado na call.`);
}

// =============================
// COMANDO RECADD
// =============================
if (command === "recadd") {
  const user = message.mentions.members.first();
  if (!user) return message.reply("❌ Mencione um usuário válido.");
  if (!message.member.roles.cache.some(r => ALLOWED_REC.includes(r.id)))
    return message.reply("❌ Sem permissão.");

  try {
    // Remove apenas o cargo específico antigo
    await user.roles.remove("1468024885354959142");

    // Adiciona cargos normais
    await user.roles.add("1468283328510558208");
    await user.roles.add("1468026315285205094");

    return message.reply(`✅ Cargos normais aplicados em ${user}`);
  } catch (err) {
    console.error(err);
  }
}

// =============================
// COMANDO RECADDMENINA
// =============================
if (command === "recaddmenina") {
  const user = message.mentions.members.first();
  if (!user) return message.reply("❌ Mencione um usuário válido.");
  if (!message.member.roles.cache.some(r => ALLOWED_REC.includes(r.id)))
    return message.reply("❌ Sem permissão.");

  try {
    // Remove apenas o cargo específico antigo
    await user.roles.remove("1468024885354959142");

    // Adiciona os três cargos para "menina"
    await user.roles.add("1472223890821611714"); // cargo 1
    await user.roles.add("1468283328510558208"); // cargo 2
    await user.roles.add("1468026315285205094"); // cargo 3

    return message.reply(`✅ Cargos "menina" aplicados em ${user}`);
  } catch (err) {
    console.error(err);
  }
}

// =============================
// COMANDO RECALIADOS
// =============================
if (command === "recaliados") {
  const user = message.mentions.members.first();
  if (!user) return message.reply("❌ Mencione um usuário válido.");
  if (!message.member.roles.cache.some(r => ALLOWED_REC.includes(r.id)))
    return message.reply("❌ Sem permissão.");

  try {
    // Remove apenas o cargo específico antigo
    await user.roles.remove("1468024885354959142");

    // Adiciona cargos aliados
    await user.roles.add("1468279104624398509");
    await user.roles.add("1468283328510558208");

    return message.reply(`✅ Cargos aliados aplicados em ${user}`);
  } catch (err) {
    console.error(err);
  }
}
// =============================
  // COMPRACONFIRMADA
  // =============================
  if (command === "compraconfirmada") {

    const user = message.mentions.members.first();
    if (!user)
      return message.reply("❌ Mencione um usuário válido.");

    const ALLOWED_ROLES = ["1468017578747105390","1468069638935150635"];

    if (!message.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id)))
      return message.reply("❌ Sem permissão para usar esse comando.");

    const CARGO_COMPRADOR = "1475111107114041447";

    try {

      if (!user.roles.cache.has(CARGO_COMPRADOR)) {
        await user.roles.add(CARGO_COMPRADOR);
      }

      const res = await pool.query(
        "SELECT compras FROM clientes WHERE user_id = $1",
        [user.id]
      );

      let quantidade = 1;

      if (res.rows.length === 0) {
        await pool.query(
          "INSERT INTO clientes (user_id, compras) VALUES ($1, $2)",
          [user.id, quantidade]
        );
      } else {
        quantidade = Number(res.rows[0].compras) + 1;

        await pool.query(
          "UPDATE clientes SET compras = $1 WHERE user_id = $2",
          [quantidade, user.id]
        );
      }

      return message.reply(
        `✅ Compra confirmada para ${user.user.tag}! Total de compras: **${quantidade}**`
      );

    } catch (err) {
      console.error("Erro ao registrar compra:", err);
      return message.reply("❌ Ocorreu um erro ao registrar a compra.");
    }
  }
  // =============================
// LISTA CLIENTES - REGISTRO CONTÍNUO
// =============================
if (command === "listaclientes") {

  const ALLOWED_ROLES = ["1468017578747105390","1468069638935150635"];
  if (!message.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id)))
    return message.reply("❌ Sem permissão para usar este comando.");

  try {

    const res = await pool.query(
      "SELECT user_id, compras FROM clientes ORDER BY compras DESC"
    );

    if (res.rows.length === 0)
      return message.reply("❌ Nenhum cliente registrado.");

    let texto = "📋 **REGISTRO DE CLIENTES**\n\n";

    for (const row of res.rows) {
      texto += `👤 <@${row.user_id}> — 🛒 ${row.compras} compras\n`;
    }

    // Quebrar em partes se ultrapassar 2000 caracteres
    const limite = 1900;
    for (let i = 0; i < texto.length; i += limite) {
      await message.channel.send(texto.slice(i, i + limite));
    }

  } catch (err) {
    console.error("Erro ao listar clientes:", err);
    return message.reply("❌ Ocorreu um erro ao buscar os clientes.");
  }
}
});
  // =============================
// TICKET MENTION
// =============================
client.on("channelCreate", async (channel) => {
  if (channel.parentId === IDS.TICKET_CATEGORY) {
    channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
  }
});

client.login(process.env.TOKEN);
