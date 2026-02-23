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
  PermissionsBitField
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
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const pg = new Pool({
  connectionString: process.env.DATABASE_URL, // coloque seu DATABASE_URL no .env
});

// =============================
// FUNÇÃO REATIVAR PONTOS
// =============================
async function reativarPontosAtivos(pg, client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return console.error("Guild não encontrada.");

  const res = await pg.query('SELECT * FROM pontos WHERE ativo = TRUE AND canal_id IS NOT NULL');
  const data = {};
  res.rows.forEach(row => {
    data[row.user_id] = {
      total: row.total,
      entrada: row.entrada ? new Date(row.entrada).getTime() : null,
      ativo: row.ativo,
      canal: row.canal_id
    };
  });

  for (const [userId, info] of Object.entries(data)) {
    const user = await guild.members.fetch(userId).catch(() => null);
    const canal = guild.channels.cache.get(info.canal);
    if (!user || !canal) continue;

    const atualizarTempo = () => {
      const total = (info.total || 0) + (info.entrada ? Date.now() - info.entrada : 0);
      const horas = Math.floor(total / 3600000);
      const minutos = Math.floor((total % 3600000) / 60000);
      const segundos = Math.floor((total % 60000) / 1000);
      canal.setTopic(`⏱ Tempo ativo: ${horas}h ${minutos}m ${segundos}s`).catch(() => {});
    };

    const intervaloTempo = setInterval(() => {
      if (!info.ativo) {
        clearInterval(intervaloTempo);
        return;
      }
      atualizarTempo();
    }, 1000);

    const intervaloLembrete = setInterval(async () => {
      if (!info.ativo) {
        clearInterval(intervaloLembrete);
        return;
      }

      await canal.send(`⏰ <@${userId}> lembrete: use **thl!ponto status** para verificar seu tempo acumulado.`);

      const filtro = m => m.author.id === userId && m.channel.id === canal.id;
      try {
        await canal.awaitMessages({ filter: filtro, max: 1, time: 5 * 60 * 1000, errors: ['time'] });
      } catch {
        const tempoEncerrado = (info.total || 0) + (info.entrada ? Date.now() - info.entrada : 0);
        info.total = tempoEncerrado;
        info.ativo = false;
        info.entrada = null;

        await pg.query(
          'UPDATE pontos SET total=$1, entrada=$2, ativo=$3 WHERE user_id=$4',
          [info.total, null, info.ativo, userId]
        );

        await canal.send(`🔴 Nenhuma resposta recebida. Ponto encerrado automaticamente. Tempo total: ${Math.floor(tempoEncerrado/3600000)}h ${Math.floor((tempoEncerrado%3600000)/60000)}m ${Math.floor((tempoEncerrado%60000)/1000)}s`);
        canal.delete().catch(() => {});

        clearInterval(intervaloTempo);
        clearInterval(intervaloLembrete);
      }
    }, 20 * 60 * 1000);

    atualizarTempo();
  }
}

// =============================
// CLIENT READY
// =============================
client.on("ready", async () => {
  console.log(`${client.user.tag} está online!`);

  const guildId = "1468007116936843359"; // coloque aqui o ID da sua guild
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return console.error("Guild não encontrada.");

  // =============================
  // PAINEL FIXO DE LOJA
  // =============================
  const canalEmbed = client.channels.cache.get("1474885764990107790"); // Canal do painel fixo
  if (canalEmbed) {
    const produtos = [
      { label: "Nitro 1 mês", value: "nitro_1", description: "💰 3 R$" },
      { label: "Nitro 3 meses", value: "nitro_3", description: "💰 6 R$" },
      { label: "Contas virgem +30 dias", value: "conta_virgem", description: "💰 5 R$" },
      { label: "Ativação Nitro", value: "ativacao_nitro", description: "💰 1,50 R$" },
      { label: "Spotify Premium", value: "spotify", description: "💰 5 R$" },
      { label: "Molduras com icon personalizado", value: "moldura", description: "💰 2 R$" },
      { label: "Y0utub3 Premium", value: "youtube", description: "💰 6 R$" },
    ];

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("loja_select")
        .setPlaceholder("Selecione um produto...")
        .addOptions(produtos)
    );

    const textoPainel = `
# Produtos | Tropa da Holanda 🇳🇱
-# Compre Apenas com vendedor oficial <@1209478510847197216> , <@910351624189411408>  ou atendentes.

🛒 ** Nitro mensal (1 mês/3 mês) **
🛒 **CONTA VIRGEM +30 Dias**
• Nunca tiverão Nitro  
• Email confirmado  
• Altere o email!  
• Ótimas para ativar nitro  
• Full acesso (pode trocar email & senha)
🛒 **Ativação do nitro**  
Obs: após a compra do nitro receberá um link que terá que ser ativado, e nós mesmo ativamos.
🛒 **Spotify Premium**
🛒 **Molduras com icon personalizado**
🛒 **Youtube Premium**
-# Compre Apenas com o vendedor oficial <@1209478510847197216>, <@910351624189411408> e os atendentes 🚨`;

    // Apaga mensagens antigas do bot (opcional)
    const mensagens = await canalEmbed.messages.fetch({ limit: 10 });
    mensagens.forEach(msg => {
      if (msg.author.id === client.user.id) msg.delete().catch(() => {});
    });

    const mensagem = await canalEmbed.send({ content: textoPainel, components: [row] });
    await mensagem.pin().catch(() => {});
  }

  // =============================
  // REATIVAR PONTOS
  // =============================
  await reativarPontosAtivos(pg, client, guildId);
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
    nitro_1: { nome: "Nitro 1 mês", valor: "3 R$" },
    nitro_3: { nome: "Nitro 3 meses", valor: "6 R$" },
    conta_virgem: { nome: "Contas virgem +30 dias", valor: "5 R$" },
    ativacao_nitro: { nome: "Ativação Nitro", valor: "1,50 R$" },
    spotify: { nome: "Spotify Premium", valor: "5 R$" },
    moldura: { nome: "Molduras com icon personalizado", valor: "2 R$" },
    youtube: { nome: "Y0utub3 Premium", valor: "6 R$" },
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
// SISTEMA BATE PONTO
// =============================
const DATA_FILE = path.join(__dirname, "pontos.json");

// Garante que o arquivo exista
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

// Função para ler dados de forma segura
function getData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Erro ao ler pontos.json:", err);
    return {};
  }
}

// Função para salvar dados
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Erro ao salvar pontos.json:", err);
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
  const data = getData();

  // =============================
// COMANDO PONTO COMPLETO
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

  const data = getData();
  if (!data[userId]) {
    data[userId] = { ativo: false, entrada: null, total: 0, canal: null, notificado: false };
  }

  const sub = args[0]?.toLowerCase();

// =============================
// ENTRAR (com persistência e lembrete seguro)
// =============================
if (sub === "entrar") {
  if (message.channel.id !== CANAL_ENTRAR)
    return message.reply("❌ Comandos de ponto só podem ser usados neste canal.");

  if (!data[userId]) data[userId] = {};
  if (data[userId].ativo)
    return message.reply("❌ Você já iniciou seu ponto.");

  // Marca usuário como ativo e salva hora de entrada
  data[userId].ativo = true;
  data[userId].entrada = Date.now();
  data[userId].notificado = false;
  saveData(data);

  // Cria canal privado apenas se não existir
  let canal;
  if (data[userId].canal) {
    // tenta buscar o canal existente
    canal = guild.channels.cache.get(data[userId].canal) || await guild.channels.create({
      name: `ponto-${message.author.username}`,
      type: 0,
      parent: categoriaId,
      permissionOverwrites: [
        { id: guild.id, deny: ["ViewChannel"] },
        { id: userId, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }
      ]
    });
    data[userId].canal = canal.id;
    saveData(data);
  } else {
    canal = await guild.channels.create({
      name: `ponto-${message.author.username}`,
      type: 0,
      parent: categoriaId,
      permissionOverwrites: [
        { id: guild.id, deny: ["ViewChannel"] },
        { id: userId, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }
      ]
    });
    data[userId].canal = canal.id;
    saveData(data);
  }

  await message.reply(`🟢 Ponto iniciado! Canal criado: <#${canal.id}>`);
  await canal.send(`🟢 Ponto iniciado! <@${userId}>`);

  // Função que calcula tempo acumulado
  const tempoAtualizado = () => {
    const info = data[userId];
    if (!info?.ativo || !info.entrada) return 0;
    return Date.now() - info.entrada;
  };

  // Contador em tempo real
  const intervaloTempo = setInterval(() => {
    const info = data[userId];
    if (!info?.ativo) {
      clearInterval(intervaloTempo);
      clearInterval(intervaloLembrete);
      return;
    }
    const total = (info.total || 0) + tempoAtualizado();
    const horas = Math.floor(total / 3600000);
    const minutos = Math.floor((total % 3600000) / 60000);
    const segundos = Math.floor((total % 60000) / 1000);
    canal.setTopic(`⏱ Tempo ativo: ${horas}h ${minutos}m ${segundos}s`).catch(() => {});
  }, 1000);

  // Lembrete a cada 20 min e fechamento automático se não houver resposta
  const intervaloLembrete = setInterval(async () => {
    const info = data[userId];
    if (!info?.ativo) {
      clearInterval(intervaloLembrete);
      return;
    }

    const msgLembrete = await canal.send(`⏰ <@${userId}> lembrete: use **thl!ponto status** para verificar seu tempo acumulado.`);

    // Espera 5 minutos para o usuário responder no canal dele
    const filtro = m => m.author.id === userId && m.channel.id === canal.id;
    try {
      await canal.awaitMessages({ filter: filtro, max: 1, time: 5 * 60 * 1000, errors: ['time'] });

      // Se respondeu, apenas continua
      return;
    } catch {
      // Se não respondeu, encerra ponto automaticamente
      const info = data[userId];
      const tempoEncerrado = (info.total || 0) + tempoAtualizado();
      info.total = tempoEncerrado;
      info.ativo = false;
      info.entrada = null;
      saveData(data);

      await canal.send(`🔴 Nenhuma resposta recebida. Ponto encerrado automaticamente. Tempo total: ${Math.floor(tempoEncerrado/3600000)}h ${Math.floor((tempoEncerrado%3600000)/60000)}m ${Math.floor((tempoEncerrado%60000)/1000)}s`);

      // Fecha canal
      canal.delete().catch(() => {});
      clearInterval(intervaloTempo);
      clearInterval(intervaloLembrete);
    }
  }, 20 * 60 * 1000);
}
  
  // =============================
  // SAIR
  // =============================
  if (sub === "sair") {

    if (!data[userId].ativo)
      return message.reply("❌ Você não iniciou ponto.");

    const tempo = Date.now() - data[userId].entrada;
    data[userId].total += tempo;
    data[userId].ativo = false;
    data[userId].entrada = null;
    data[userId].notificado = false;
    const canalId = data[userId].canal;
    data[userId].canal = null;
    saveData(data);

    if (canalId) {
      const canal = guild.channels.cache.get(canalId);
      if (canal) {
        await canal.send("🔴 Ponto finalizado. Canal será fechado.");
        setTimeout(() => canal.delete().catch(() => {}), 3000);
      }
    }

    return message.reply(`🔴 Ponto finalizado! Tempo registrado com sucesso.`);
  }

// =============================
// STATUS
// =============================
if (sub === "status") {
  const userId = message.member.id;
  const info = data[userId];
  if (!info) return message.reply("❌ Nenhum ponto ou coins registrado para você.");

  // Verifica se o comando foi enviado no canal correto
  if (!info.canal || message.channel.id !== info.canal) {
    return message.reply("❌ Este comando só funciona no seu canal de ponto privado.");
  }

  // Total de tempo = ponto + addtempo
  let total = info.total || 0;
  if (info.ativo && info.entrada) total += Date.now() - info.entrada;

  // Calcula horas, minutos e segundos
  const horas = Math.floor(total / 3600000);
  const minutos = Math.floor((total % 3600000) / 60000);
  const segundos = Math.floor((total % 60000) / 1000);

  // Coins do usuário (addcoins + conversão de tempo)
  const coins = info.coins || 0;

  // Cargo atual baseado em roles
  const member = message.member;
  const encontrado = CARGOS.find(c => member.roles.cache.has(c.id));
  const cargoAtual = encontrado ? `<@&${encontrado.id}>` : "Nenhum";

  // Status ativo ou inativo
  const status = info.ativo ? "🟢 Ativo" : "🔴 Inativo";

  // Mensagem final
  return message.reply(
    `📊 **Seu Status**\n` +
    `Tempo acumulado: ${horas}h ${minutos}m ${segundos}s\n` +
    `Coins: ${coins} 💰\n` +
    `Status: ${status}\n` +
    `Cargo atual: ${cargoAtual}`
  );
}
  
// =============================
// REGISTRO (Ranking Completo)
// =============================
if (sub === "registro") {
  const ranking = Object.entries(data)
    .sort((a, b) => (b[1].total || 0) - (a[1].total || 0));

  if (ranking.length === 0) return message.reply("Nenhum registro encontrado.");

  let texto = "";
  let contador = 1;

  for (const [uid, info] of ranking) {
    let total = info.total || 0;
    if (info.ativo && info.entrada) total += Date.now() - info.entrada;

    const horas = Math.floor(total / 3600000);
    const minutos = Math.floor((total % 3600000) / 60000);
    const segundos = Math.floor((total % 60000) / 1000);

    const member = await guild.members.fetch(uid).catch(() => null);
    const encontrado = member ? CARGOS.find(c => member.roles.cache.has(c.id)) : null;
    const cargoAtual = encontrado ? `<@&${encontrado.id}>` : "Nenhum";
    const status = info.ativo ? "🟢 Ativo" : "🔴 Inativo";

    texto += `${contador}. <@${uid}> → ${horas}h ${minutos}m ${segundos}s | ${status} | ${cargoAtual}\n`;
    contador++;
  }

  return message.reply(`📊 **Ranking de Atividade – Todos os Usuários**\n\n${texto}`);
}
  
  // =============================
  // RESETAR HORAS DE TODOS
  // =============================
  if (sub === "reset") {

    // Apenas staff pode usar
    if (!canUseCommand(message.member))
      return message.reply("❌ Você não tem permissão para usar este comando.");

    for (const uid in data) {
      data[uid].total = 0;
      data[uid].entrada = data[uid].ativo ? Date.now() : null;
    }

    saveData(data);
    return message.reply("✅ Todas as horas de todos os usuários foram resetadas com sucesso!");
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
  if (!message.member.roles.cache.some(r => ADM_IDS.includes(r.id)))
    return message.reply("❌ Você não tem permissão.");

  const user = message.mentions.members.first();
  const coins = parseInt(args[1]);
  if (!user || isNaN(coins)) return message.reply("❌ Use: thl!addcoins <@usuário> <quantidade>");

  if (!data[user.id]) data[user.id] = { total: 0, coins: 0, ativo: false, entrada: null };
  data[user.id].coins += coins;
  saveData(data);

  message.reply(`✅ Adicionados ${coins} coins para ${user}`);
}

// =============================
// COMANDO ADDTEMPO
// =============================
if (command === "addtempo") {
  const user = message.mentions.members.first();
  if (!user) return message.reply("❌ Mencione um usuário válido.");

  const valor = args[1]; // Ex: 3h ou 45m
  if (!valor) return message.reply("❌ Informe o tempo para adicionar (ex: 3h ou 45m).");

  let milissegundos = 0;
  if (valor.endsWith("h")) {
    milissegundos = parseInt(valor) * 60 * 60 * 1000;
  } else if (valor.endsWith("m")) {
    milissegundos = parseInt(valor) * 60 * 1000;
  } else {
    return message.reply("❌ Formato inválido. Use h para horas ou m para minutos.");
  }

  const userId = user.id;
  if (!data[userId]) data[userId] = { total: 0, coins: 0, ativo: false, entrada: null };

  data[userId].total += milissegundos;
  saveData(data);

  message.reply(`✅ ${user} recebeu ${valor} de tempo.`);
}

// =============================
// COMANDO CONVERTER TEMPO EM COINS
// =============================
if (command === "converter") {
  const userId = message.author.id;
  const info = data[userId];
  if (!info) return message.reply("❌ Você não tem tempo registrado para converter.");

  if (!args[0]) return message.reply("❌ Use: thl!converter <quantidade>h/m (ex: 2h ou 30m)");

  // Parse de horas ou minutos
  const input = args[0].toLowerCase();
  let minutos = 0;
  if (input.endsWith("h")) {
    const h = parseFloat(input.replace("h", ""));
    if (isNaN(h) || h <= 0) return message.reply("❌ Quantidade inválida.");
    minutos = h * 60;
  } else if (input.endsWith("m")) {
    const m = parseFloat(input.replace("m", ""));
    if (isNaN(m) || m <= 0) return message.reply("❌ Quantidade inválida.");
    minutos = m;
  } else {
    return message.reply("❌ Formato inválido. Use h ou m (ex: 2h ou 30m)");
  }

  // Calcula tempo total disponível (ponto + addtempo)
  let total = info.total || 0;
  if (info.ativo && info.entrada) total += Date.now() - info.entrada;
  const totalMinutos = Math.floor(total / 60000);

  if (minutos > totalMinutos) return message.reply(`❌ Você só tem ${totalMinutos} minutos disponíveis.`);

  // Subtrai tempo do total
  const minutosEmMs = minutos * 60000;
  info.total -= minutosEmMs;

  // Calcula coins (1h = 100 coins → 1m ≈ 1,6667 coins)
  const coins = Math.floor(minutos * (100 / 60));
  info.coins = (info.coins || 0) + coins;

  saveData(data);

  // Formata horas e minutos convertidos
  const horasConvertidas = Math.floor(minutos / 60);
  const minutosConvertidos = Math.floor(minutos % 60);

  return message.reply(`✅ Conversão realizada com sucesso!
Tempo convertido: ${horasConvertidas}h ${minutosConvertidos}m
Coins recebidos: ${coins} 💰
Novo saldo de coins: ${info.coins} 💰`);
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
  if (!data[userId]) data[userId] = { coins: 0 };
  const info = data[userId];

  // Checa saldo
  if ((info.coins || 0) < produto.preco) {
    return message.reply(`❌ Você não tem coins suficientes para comprar **${produto.nome}**.`);
  }

  // Subtrai coins
  info.coins -= produto.preco;
  saveData(data);

  const guild = message.guild;
  const categoriaId = "1474366472326222013"; // Categoria de tickets
  const existingChannel = guild.channels.cache.find(c => 
    c.name === `ticket-${message.author.username}` && c.parentId === categoriaId
  );
  if (existingChannel) return message.reply(`❌ Você já possui um ticket aberto: ${existingChannel}`);

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

  // Botão de fechar ticket
  const fecharButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("fechar_ticket")
      .setLabel("🔒 Fechar Ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@&1472589662144040960> <@&1468017578747105390>`, embeds: [ticketEmbed], components: [fecharButton] });

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
});  

// =============================
// RECUPERA SESSÕES APÓS RESTART
// =============================
client.on("ready", async () => {
  const data = getData();
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const categoriaId = "1468715109722357782";

  for (const userId in data) {
    if (data[userId].ativo) {
      try {
        const canal = await guild.channels.create({
          name: `ponto-recuperado`,
          type: 0,
          parent: categoriaId,
          permissionOverwrites: [
            { id: guild.id, deny: ["ViewChannel"] },
            { id: userId, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }
          ]
        });

        data[userId].canal = canal.id;
        saveData(data);

        canal.send("⚠️ Sessão recuperada após reinício do bot.");

      } catch (err) {
        console.log("Erro ao recriar canal:", err);
      }
    }
  }

  console.log(`Bot online como ${client.user.tag}`);

  // Criação da tabela PostgreSQL
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pontos (
      user_id TEXT PRIMARY KEY,
      total BIGINT DEFAULT 0,
      ativo BOOLEAN DEFAULT false,
      entrada BIGINT,
      canal TEXT
    );
  `);
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
