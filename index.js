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
// REMOVE USUÁRIO DO BANCO AO SAIR
// =============================
client.on("guildMemberRemove", async (member) => {
  try {
    // Remove do banco de pontos
    await pool.query("DELETE FROM pontos WHERE user_id = $1", [member.id]);
    
    // Se tiver outras tabelas como "clientes" ou "sessoes", remova também
    await pool.query("DELETE FROM clientes WHERE user_id = $1", [member.id]);
    await pool.query("DELETE FROM sessoes WHERE userid = $1", [member.id]);

    console.log(`✅ Usuário ${member.user.tag} removido do banco.`);
  } catch (err) {
    console.error("❌ Erro ao remover usuário do banco:", err);
  }
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
// FUNÇÃO REGISTRAR PONTO
// =============================
async function registrarPonto(userId) {
  try {
    // Buscar pontos atuais
    const res = await pool.query(
      'SELECT pontos FROM pontos WHERE user_id = $1',
      [userId]
    );

    let pontos = 1;

    if (res.rows.length === 0) {
      // Inserir novo usuário
      await pool.query(
        'INSERT INTO pontos (user_id, pontos) VALUES ($1, $2)',
        [userId, pontos]
      );
    } else {
      // Atualizar pontos
      pontos = res.rows[0].pontos + 1;
      await pool.query(
        'UPDATE pontos SET pontos = $1 WHERE user_id = $2',
        [pontos, userId]
      );
    }

    return pontos;
  } catch (err) {
    console.error("Erro ao registrar ponto:", err);
    throw err;
  }
}
  
// =============================
// UTILS
// =============================

// Converte tempo em ms (ex: "10m" ou "2h")
const parseDuration = (time) => {
  if (!time) return null;
  const match = time.match(/^(\d+)([mh])$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  return unit === "m" ? value * 60000 : value * 3600000;
};

// Envia embed de log para o canal configurado
const sendLog = (guild, embed) => {
  const channel = guild.channels.cache.get(IDS.LOG_CHANNEL);
  if (channel) channel.send({ embeds: [embed] }).catch(console.error);
};

// Verifica se o membro pode usar comando de staff
const canUseCommand = (member) => IDS.STAFF.some((id) => member.roles.cache.has(id));

// Pega ou cria cargo de mute
async function getMuteRole(guild) {
  let role = guild.roles.cache.find((r) => r.name === "Muted");
  if (!role) {
    try {
      role = await guild.roles.create({
        name: "Muted",
        permissions: [],
      });
    } catch (err) {
      console.error("Erro ao criar cargo Muted:", err);
    }
  }
  return role;
}

// Lista de cargos e metas (em ms)
const CARGOS = [
  // 24h
  { id: "1468021327129743483", meta: 24 * 3600000 },
  { id: "1468021411720335432", meta: 24 * 3600000 },
  { id: "1468021554993561661", meta: 24 * 3600000 },
  { id: "1468021724598501376", meta: 24 * 3600000 },
  { id: "1468021924943888455", meta: 24 * 3600000 },
  { id: "1468652058973569078", meta: 24 * 3600000 },
  { id: "1474353689723535572", meta: 24 * 3600000 },
  { id: "1474353834485612687", meta: 24 * 3600000 },
  { id: "1474353946205098097", meta: 24 * 3600000 },
  { id: "1474364575297175694", meta: 24 * 3600000 },
  { id: "1474364617756250132", meta: 24 * 3600000 },
  { id: "1474354117362188350", meta: 24 * 3600000 },
  { id: "1474354176816451710", meta: 24 * 3600000 },
  { id: "1474354212350726225", meta: 24 * 3600000 },
  { id: "1474354265240899727", meta: 24 * 3600000 },
  { id: "1474364646629838970", meta: 24 * 3600000 },
  { id: "1468026315285205094", meta: 24 * 3600000 },
  // 48h
  { id: "1468018959797452881", meta: 48 * 3600000 },
  { id: "1473797846862921836", meta: 48 * 3600000 },
  { id: "1468018098354393098", meta: 48 * 3600000 },
  { id: "1468019077984293111", meta: 48 * 3600000 },
  { id: "1468019282633035857", meta: 48 * 3600000 },
  { id: "1468019717938614456", meta: 48 * 3600000 },
  { id: "1468716461773164739", meta: 48 * 3600000 },
];

// Pega cargo atual do membro baseado nos cargos que ele possui
const getCargoAtual = (member) => {
  const cargosPossiveis = CARGOS.filter((c) => member.roles.cache.has(c.id));
  if (!cargosPossiveis.length) return "Nenhum cargo";
  // Pega o cargo com maior meta
  cargosPossiveis.sort((a, b) => b.meta - a.meta);
  return `<@&${cargosPossiveis[0].id}>`;
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
// COMANDO PONTO COMPLETO (PostgreSQL)
// =============================
if (command === "ponto") {

  const categoriaId = "1474413150441963615"; // categoria dos canais de ponto
  const CANAL_ENTRAR = "1474383177689731254"; // canal onde usar 'entrar'
  const userId = message.author.id;
  const guild = message.guild;

  // Apenas cargos permitidos podem usar ponto
  const ALLOWED_PONTO = [
    "1468017578747105390",
    "1468069638935150635",
    "1468026315285205094"
  ];

  if (!message.member.roles.cache.some(r => ALLOWED_PONTO.includes(r.id))) {
    return message.reply("❌ Você não tem permissão para usar este comando.");
  }

  const sub = args[0]?.toLowerCase();
  // =============================
// ENTRAR
// =============================
if (sub === "entrar") {

  if (message.channel.id !== CANAL_ENTRAR)
    return message.reply("❌ Comandos de ponto só podem ser usados neste canal.");

  // pega os dados do usuário no Postgres
  let res = await pool.query("SELECT ativo, entrada, canal FROM pontos WHERE user_id = $1", [userId]);
  let userData = res.rows[0];

  // se não existe, cria
  if (!userData) {
    await pool.query(
      "INSERT INTO pontos (user_id, ativo, total, entrada, canal) VALUES ($1, false, 0, NULL, NULL)",
      [userId]
    );
    userData = { ativo: false, entrada: null, canal: null };
  }

  if (userData.ativo)
    return message.reply("❌ Você já iniciou seu ponto.");

  // atualiza ativo e entrada
  await pool.query(
    "UPDATE pontos SET ativo = true, entrada = $1 WHERE user_id = $2",
    [Date.now(), userId]
  );

  // cria canal privado
  const canal = await guild.channels.create({
    name: `ponto-${message.author.username}`,
    type: ChannelType.GuildText, // tipo correto
    parent: categoriaId,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ]
  });

  // salva canal no banco
  await pool.query(
    "UPDATE pontos SET canal = $1 WHERE user_id = $2",
    [canal.id, userId]
  );

  await message.reply(`🟢 Ponto iniciado! Canal criado: <#${canal.id}>`);
  await canal.send(`🟢 Ponto iniciado! <@${userId}>`);

  // contador tempo real
  const intervaloTempo = setInterval(async () => {
    const check = await pool.query("SELECT ativo, entrada FROM pontos WHERE user_id = $1", [userId]);
    if (!check.rows[0]?.ativo) {
      clearInterval(intervaloTempo);
      clearInterval(intervaloLembrete);
      return;
    }
    const tempoAtual = Date.now() - check.rows[0].entrada;
    const horas = Math.floor(tempoAtual / 3600000);
    const minutos = Math.floor((tempoAtual % 3600000) / 60000);
    const segundos = Math.floor((tempoAtual % 60000) / 1000);
    canal.setTopic(`⏱ Tempo ativo: ${horas}h ${minutos}m ${segundos}s`).catch(() => {});
  }, 1000);

  // lembrete 20 em 20 min
  const intervaloLembrete = setInterval(async () => {
    const check = await pool.query("SELECT ativo FROM pontos WHERE user_id = $1", [userId]);
    if (!check.rows[0]?.ativo) {
      clearInterval(intervaloLembrete);
      return;
    }
    canal.send(`⏰ <@${userId}> lembrete: use **thl!ponto status** para verificar seu tempo acumulado.`).catch(() => {});
  }, 20 * 60 * 1000);

  return;
}
  
  // =============================
  // SAIR
  // =============================
  else if (sub === "sair") {

    if (!userData.ativo)
      return message.reply("❌ Você não iniciou ponto.");

    const tempo = Date.now() - Number(userData.entrada);
    const novoTotal = Number(userData.total) + tempo;

    await pool.query(
      "UPDATE pontos SET ativo = false, entrada = NULL, total = $1 WHERE user_id = $2",
      [novoTotal, userId]
    );

    if (userData.canal) {
      const canal = guild.channels.cache.get(userData.canal);
      if (canal) {
        await canal.send("🔴 Ponto finalizado.");
        canal.delete().catch(() => {});
      }
    }

    return message.reply("🔴 Ponto finalizado com sucesso.");
  }

  // =============================
  // STATUS
  // =============================
  else if (sub === "status") {

    const check = await pool.query("SELECT * FROM pontos WHERE user_id = $1", [userId]);
    const info = check.rows[0];

    if (!info)
      return message.reply("❌ Nenhum registro encontrado.");

    if (!info.canal || message.channel.id !== info.canal)
      return message.reply("❌ Este comando só funciona no seu canal privado.");

    let total = Number(info.total);
    if (info.ativo && info.entrada)
      total += Date.now() - Number(info.entrada);

    const horas = Math.floor(total / 3600000);
    const minutos = Math.floor((total % 3600000) / 60000);
    const segundos = Math.floor((total % 60000) / 1000);

    const coins = Number(info.coins);
    const status = info.ativo ? "🟢 Ativo" : "🔴 Inativo";

    return message.reply(
      `📊 **Seu Status**\n` +
      `Tempo: ${horas}h ${minutos}m ${segundos}s\n` +
      `Coins: ${coins} 💰\n` +
      `Status: ${status}`
    );
  }

// =============================
// REGISTRO
// =============================
else if (sub === "registro") {

  const res = await pool.query("SELECT * FROM pontos");
  const ranking = res.rows;

  if (ranking.length === 0)
    return message.reply("Nenhum registro encontrado.");

  // 🔥 Ordena pelo tempo total (incluindo ativo)
  ranking.sort((a, b) => {
    const totalA = Number(a.total) + (a.ativo && a.entrada ? Date.now() - Number(a.entrada) : 0);
    const totalB = Number(b.total) + (b.ativo && b.entrada ? Date.now() - Number(b.entrada) : 0);
    return totalB - totalA;
  });

  let linhas = [];
  let contador = 1;

  for (const info of ranking) {

    let total = Number(info.total);
    if (info.ativo && info.entrada)
      total += Date.now() - Number(info.entrada);

    const horas = Math.floor(total / 3600000);
    const minutos = Math.floor((total % 3600000) / 60000);
    const segundos = Math.floor((total % 60000) / 1000);

    const member = await guild.members.fetch(info.user_id).catch(() => null);

    const encontrado = member
      ? CARGOS.find(c => member.roles.cache.has(c.id))
      : null;

    const cargoAtual = encontrado ? `<@&${encontrado.id}>` : "Nenhum";
    const status = info.ativo ? "🟢 Ativo" : "🔴 Inativo";

    linhas.push(
      `${contador}. <@${info.user_id}> → ${horas}h ${minutos}m ${segundos}s | ${status} | ${cargoAtual}`
    );

    contador++;
  }

  // 🔥 MONTA TEXTO COMPLETO
  const header = `📊 **Ranking de Atividade – Todos os Usuários**\n\n`;
  const MAX = 1900; // margem de segurança
  let mensagens = [];
  let atual = header;

  for (const linha of linhas) {
    if ((atual + linha + "\n").length > MAX) {
      mensagens.push(atual);
      atual = "";
    }
    atual += linha + "\n";
  }

  if (atual.length > 0) mensagens.push(atual);

  // 🔥 ENVIA SEM CRASHAR
  for (let i = 0; i < mensagens.length; i++) {
    if (i === 0) {
      await message.reply(mensagens[i]);
    } else {
      await message.channel.send(mensagens[i]);
    }
  }
}

  // =============================
  // RESET
  // =============================
  else if (sub === "reset") {

    if (!canUseCommand(message.member))
      return message.reply("❌ Você não tem permissão para usar este comando.");

    await pool.query(`
      UPDATE pontos
      SET total = 0,
          entrada = CASE
            WHEN ativo = true THEN ${Date.now()}
            ELSE NULL
          END
    `);

    return message.reply("✅ Todas as horas foram resetadas com sucesso!");
  }
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
// COMANDO ADDCOINS
// =============================
if (command === "addcoins") {

  const membro = message.mentions.users.first();
  if (!membro) return message.reply("Mencione um usuário.");

  const valor = Number(args[1]);
  if (isNaN(valor)) return message.reply("Informe um número válido.");

  await pool.query(
    "UPDATE pontos SET total = total + $1 WHERE user_id = $2",
    [valor, membro.id]
  );

  message.reply(`💰 ${valor} coins adicionadas para <@${membro.id}>.`);
}

// =============================
// COMANDO ADDTEMPO
// =============================
if (command === "addtempo") {

  const membro = message.mentions.users.first();
  if (!membro) return message.reply("Mencione um usuário.");

  const tempoArg = args[1];
  if (!tempoArg) return message.reply("Informe o tempo. Ex: 3h, 30m, 10s");

  let ms = 0;

  const match = tempoArg.match(/^(\d+)(h|m|s)$/);
  if (!match) return message.reply("Formato inválido. Use: 3h, 30m ou 10s");

  const valor = Number(match[1]);
  const tipo = match[2];

  if (tipo === "h") ms = valor * 3600000;
  if (tipo === "m") ms = valor * 60000;
  if (tipo === "s") ms = valor * 1000;

  await pool.query(
    "UPDATE pontos SET total = total + $1 WHERE user_id = $2",
    [ms, membro.id]
  );

  message.reply(`✅ Tempo adicionado para <@${membro.id}>.`);
}

// =============================
// COMANDO CONVERTER TEMPO EM COINS
// =============================
if (command === "converter") {

  const userId = message.author.id;

  if (!args[0])
    return message.reply("❌ Use: thl!converter <quantidade>h/m (ex: 2h ou 30m)");

  // Buscar dados no banco
  const res = await pool.query(
    "SELECT total, ativo, entrada, coins FROM pontos WHERE user_id = $1",
    [userId]
  );

  if (res.rows.length === 0)
    return message.reply("❌ Você não tem tempo registrado.");

  let { total, ativo, entrada, coins } = res.rows[0];

  total = Number(total) || 0;
  coins = Number(coins) || 0;

  if (ativo && entrada)
    total += Date.now() - Number(entrada);

  const totalMinutos = Math.floor(total / 60000);

  // Parse entrada
  const input = args[0].toLowerCase();
  let minutos = 0;

  if (input.endsWith("h")) {
    const h = parseFloat(input.replace("h", ""));
    if (isNaN(h) || h <= 0) return message.reply("❌ Quantidade inválida.");
    minutos = h * 60;
  }
  else if (input.endsWith("m")) {
    const m = parseFloat(input.replace("m", ""));
    if (isNaN(m) || m <= 0) return message.reply("❌ Quantidade inválida.");
    minutos = m;
  }
  else {
    return message.reply("❌ Formato inválido. Use h ou m (ex: 2h ou 30m)");
  }

  if (minutos > totalMinutos)
    return message.reply(`❌ Você só tem ${totalMinutos} minutos disponíveis.`);

  const minutosEmMs = minutos * 60000;

  const novosCoins = Math.floor(minutos * (100 / 60));
  const novoTotal = total - minutosEmMs;
  const saldoFinal = coins + novosCoins;

  // Atualiza banco
  await pool.query(
    "UPDATE pontos SET total = $1, coins = $2 WHERE user_id = $3",
    [novoTotal, saldoFinal, userId]
  );

  const horasConvertidas = Math.floor(minutos / 60);
  const minutosConvertidos = Math.floor(minutos % 60);

  return message.reply(
`✅ Conversão realizada com sucesso!
Tempo convertido: ${horasConvertidas}h ${minutosConvertidos}m
Coins recebidos: ${novosCoins} 💰
Novo saldo: ${saldoFinal} 💰`
  );
}   

// =============================
// COMANDO FECHAR TODOS PONTOS
// =============================
if (command === "fechartodos") {

  // Roles que podem usar
  const ALLOWED_ROLES = ["1468017578747105390","1468069638935150635"];
  if (!message.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id)))
    return message.reply("❌ Sem permissão para usar este comando.");

  // Coloque aqui o ID da categoria dos canais de ponto
  const CATEGORIA_PONTOS = "1474413150441963615";

  try {
    // Pega todos os canais de texto dentro da categoria
    const canais = message.guild.channels.cache.filter(
      c => c.parentId === CATEGORIA_PONTOS && c.isTextBased()
    );

    if (canais.size === 0)
      return message.reply("❌ Nenhum canal de ponto ativo encontrado.");

    let fechados = 0;

    for (const canal of canais.values()) {
      try {
        // Deleta o canal
        await canal.delete();

        // Atualiza o banco: marca como inativo e zera o campo canal
        await pool.query(
          "UPDATE pontos SET ativo = false, canal = NULL WHERE canal = $1",
          [canal.id]
        );

        fechados++;
      } catch {
        // Ignora erro de canal já deletado ou sem permissão
        continue;
      }
    }

    return message.reply(`✅ ${fechados} canais de ponto foram fechados e registros atualizados com sucesso.`);

  } catch (err) {
    console.error("Erro ao fechar pontos:", err);
    return message.reply("❌ Ocorreu um erro ao tentar fechar os canais de ponto.");
  }
}

 // =============================
// COMANDO LOJA - LISTA DE PRODUTOS
// =============================
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, EmbedBuilder } = require("discord.js");

if (command === "ponto" && args[0]?.toLowerCase() === "loja") {
  const embed = new EmbedBuilder()
    .setTitle("🛒 Loja de Produtos")
    .setDescription(
      "**Selecione o produto que deseja comprar digitando `thl!comprar <produto>`:**\n\n" +
      "💎 Robux → 4000 coins\n" +
      "⚡ Nitro → 2500 coins\n" +
      "🔨 Ripa → 1700 coins\n" +
      "👑 Vip → 6000 coins\n" +
      "👕 Roupa Personalizada → 1400 coins"
    )
    .setColor("Blue");

  const msg = await message.reply({ embeds: [embed] });

  // Apaga a mensagem da lista após 15 segundos
  setTimeout(() => {
    msg.delete().catch(() => {});
  }, 15000);
}

// =============================
// COMANDO COMPRAR
// =============================
if (command === "comprar") {
  const produtoArg = args[0]?.toLowerCase();
  if (!produtoArg) return message.reply("❌ Use: thl!comprar <produto>");

  const produtos = {
    robux: { nome: "Robux", preco: 4000 },
    nitro: { nome: "Nitro", preco: 2500 },
    ripa: { nome: "Ripa", preco: 1700 },
    vip: { nome: "Vip", preco: 6000 },
    roupa: { nome: "Roupa Personalizada", preco: 1400 }
  };

  const produto = produtos[produtoArg];
  if (!produto) return message.reply("❌ Produto inválido.");

  const userId = message.author.id;

  // 🔥 BUSCA COINS NO BANCO
  const res = await pool.query(
    "SELECT coins FROM pontos WHERE user_id = $1",
    [userId]
  );

  if (res.rows.length === 0)
    return message.reply("❌ Você não possui registro no sistema.");

  const coins = Number(res.rows[0].coins) || 0;

  // Checa saldo
  if (coins < produto.preco) {
    return message.reply(`❌ Você não tem coins suficientes para comprar **${produto.nome}**.`);
  }

  // 🔥 SUBTRAI COINS NO BANCO
  const novoSaldo = coins - produto.preco;

  await pool.query(
    "UPDATE pontos SET coins = $1 WHERE user_id = $2",
    [novoSaldo, userId]
  );

  const guild = message.guild;
  const categoriaId = "1474366472326222013"; // Categoria de tickets

  const existingChannel = guild.channels.cache.find(c => 
    c.name === `ticket-${message.author.username}` && c.parentId === categoriaId
  );

  if (existingChannel)
    return message.reply(`❌ Você já possui um ticket aberto: ${existingChannel}`);

  // Cria canal de ticket
  const channel = await guild.channels.create({
    name: `ticket-${message.author.username}`,
    type: ChannelType.GuildText,
    parent: categoriaId,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: message.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  // Embed do ticket
  const ticketEmbed = new EmbedBuilder()
    .setTitle(`🛒 Ticket de Compra - ${produto.nome}`)
    .setDescription(
      `${message.author} abriu um ticket para comprar **${produto.nome}**.\n\n` +
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

  await channel.send({
    content: `<@&1472589662144040960> <@&1468017578747105390>`,
    embeds: [ticketEmbed],
    components: [fecharButton]
  });

  message.reply(`✅ Ticket criado com sucesso! Verifique o canal ${channel} para finalizar sua compra.`);
}


// =============================
// FECHAR TICKET
// =============================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "fechar_ticket") return;

  if (!interaction.channel.name.startsWith("ticket-"))
    return interaction.reply({ content: "❌ Este botão só pode ser usado dentro de um ticket.", ephemeral: true });

  await interaction.channel.delete().catch(() => {});
});

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
  // =============================
// RESETAR COINS
// =============================
if (command === "resetcoins") {
  const ALLOWED_ROLES = ["1468017578747105390","1468069638935150635"];
  if (!message.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id)))
    return message.reply("❌ Sem permissão para usar este comando.");

  const user = message.mentions.members.first();
  if (!user) return message.reply("❌ Mencione um usuário válido.");

  try {
    await pool.query(
      "UPDATE pontos SET coins = 0 WHERE user_id = $1",
      [user.id]
    );
    return message.reply(`✅ Coins de ${user.user.tag} foram resetados para 0.`);
  } catch (err) {
    console.error("Erro ao resetar coins:", err);
    return message.reply("❌ Ocorreu um erro ao resetar os coins.");
  }
}

// =============================
// RESETAR TEMPO
// =============================
if (command === "resettempo") {
  const ALLOWED_ROLES = ["1468017578747105390","1468069638935150635"];
  if (!message.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id)))
    return message.reply("❌ Sem permissão para usar este comando.");

  const user = message.mentions.members.first();
  if (!user) return message.reply("❌ Mencione um usuário válido.");

  try {
    await pool.query(
      "UPDATE pontos SET total = 0 WHERE user_id = $1",
      [user.id]
    );
    return message.reply(`✅ Tempo de ${user.user.tag} foi resetado para 0.`);
  } catch (err) {
    console.error("Erro ao resetar tempo:", err);
    return message.reply("❌ Ocorreu um erro ao resetar o tempo.");
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
