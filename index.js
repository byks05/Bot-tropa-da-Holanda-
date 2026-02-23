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
// CLIENT READY (PAINEL ÚNICO)
// =============================
client.once("clientReady", async () => {
  const canalEmbed = await client.channels.fetch("1474885764990107790").catch(() => null);
  if (!canalEmbed) {
    console.log("Não foi possível achar o canal do painel. Verifique o ID e permissões.");
    return;
  }

  const produtos = [
    // Primeiro grupo
    { label: "Vip", value: "vip", description: "💰 6000 coins" },
    { label: "Robux", value: "robux", description: "💰 4000 coins" },
    { label: "Nitro", value: "nitro", description: "💰 2500 coins" },
    { label: "Ripa", value: "ripa", description: "💰 1700 coins" },
    { label: "Roupa personalizada", value: "roupa", description: "💰 1400 coins" },
    // Segundo grupo
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
Apenas para membros da equipe 
> 🛒 **Vip -#COMPRA COM COINS**
> 🛒 **Robux (Maximo de 200 Robux ) -#COMPRA COM COINS**
> 🛒 **Nitro -#COMPRA COM COINS**
> 🛒 **Ripa -#COMPRA COM COINS**
> 🛒 **Roupa personalizada -#COMPRA COM COINS**

> 🛒 **Nitro mensal (1 mês/3 meses) -#COMPRA COM R$**
> 🛒 **Contas virgem +30 Dias -#COMPRA COM R$**
> 🛒 **Ativação do Nitro -#COMPRA COM R$**
> 🛒 **Spotify Premium -#COMPRA COM R$**
> 🛒 **Molduras com icon personalizado -#COMPRA COM R$**
> 🛒 **Youtube Premium -#COMPRA COM R$**

-# Compre Apenas com o vendedor oficial <@1209478510847197216>, <@910351624189411408> e os atendentes 🚨
`;

  try {
    // 🔥 Evita conflito: atualiza painel existente se houver
    const mensagens = await canalEmbed.messages.fetch({ limit: 10 });
    const mensagemExistente = mensagens.find(
      m => m.author.id === client.user.id && m.components.length > 0
    );

    if (mensagemExistente) {
      await mensagemExistente.edit({ content: textoPainel, components: [row] });
      console.log("Painel da loja atualizado com sucesso.");
    } else {
      const mensagem = await canalEmbed.send({ content: textoPainel, components: [row] });
      await mensagem.pin().catch(() => {});
      console.log("Painel da loja criado com sucesso.");
    }

  } catch (err) {
    console.error("Erro ao enviar ou atualizar o painel:", err);
  }
});
// =====================
// PAINEL DE ADMIN FIXO FINALIZADO COM LOCK
// =====================
const adminChannelId = "1474384292015640626";
let painelMensagemId = null;
const MESSAGE_LIFETIME = 15000; // 15 segundos
const adminsAtivos = new Map(); // previne coletores duplicados

async function criarPainelAdmin(client) {
  try {
    const canal = await client.channels.fetch(adminChannelId);
    if (!canal) return console.log("Canal de administração não encontrado.");

    const botoesLinha1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("registro").setLabel("📋 Registro").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("resetUser").setLabel("🔄 Reset Usuário").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("resetAll").setLabel("🗑 Reset Todos").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("addCoins").setLabel("💰 Adicionar Coins").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("removeCoins").setLabel("➖ Remover Coins").setStyle(ButtonStyle.Danger)
    );

    const botoesLinha2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("resetCoins").setLabel("💳 Reset Coins").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("addTime").setLabel("⏱ Adicionar Tempo").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("removeTime").setLabel("➖ Remover Tempo").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("resetTime").setLabel("⏳ Reset Tempo").setStyle(ButtonStyle.Danger)
    );

    const conteudo = "🎛 Painel de Administração\nUse os botões abaixo para gerenciar usuários e pontos.";

    if (painelMensagemId) {
      const mensagem = await canal.messages.fetch(painelMensagemId).catch(() => null);
      if (mensagem) {
        await mensagem.edit({ content: conteudo, components: [botoesLinha1, botoesLinha2] });
        return;
      }
    }

    const novaMensagem = await canal.send({ content: conteudo, components: [botoesLinha1, botoesLinha2] });
    painelMensagemId = novaMensagem.id;

  } catch (err) {
    console.log("Erro ao criar painel de admin:", err);
  }
}

client.once("clientReady", () => criarPainelAdmin(client));

client.on("messageDelete", async message => {
  if (message.id === painelMensagemId) {
    painelMensagemId = null;
    criarPainelAdmin(client);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  const userId = interaction.user.id;

  if (adminsAtivos.get(userId)) {
    return interaction.reply({ content: "⚠️ Você já está interagindo com o painel, aguarde terminar.", ephemeral: true });
  }
  adminsAtivos.set(userId, true);

  async function processCollector(promptText, callback) {
    const msgPrompt = await interaction.reply({ content: promptText, ephemeral: false });
    const filter = m => m.author.id === userId;
    const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 60000 });

    collector.on("collect", async m => {
      await callback(m);
      m.delete().catch(() => {});
      msgPrompt.delete().catch(() => {});
      adminsAtivos.delete(userId);
    });

    collector.on("end", () => {
      adminsAtivos.delete(userId);
    });
  }

  switch (interaction.customId) {
    case "registro": {
      const res = await pool.query("SELECT user_id, ativo, total, coins FROM pontos ORDER BY total DESC");
      if (!res.rows.length) {
        const msg = await interaction.reply({ content: "Nenhum usuário encontrado.", ephemeral: false });
        setTimeout(() => msg.delete().catch(() => {}), MESSAGE_LIFETIME);
        adminsAtivos.delete(userId);
        return;
      }

      let mensagens = [];
      let currentMsg = "";
      res.rows.forEach((u, index) => {
        const horas = Math.floor(u.total / 3600000);
        const minutos = Math.floor((u.total % 3600000) / 60000);
        const segundos = Math.floor((u.total % 60000) / 1000);
        const linha = `**${index + 1}** - <@${u.user_id}> - ${u.ativo ? "🟢 Ativo" : "🔴 Inativo"} - ⏱ ${horas}h ${minutos}m ${segundos}s - 💰 ${u.coins || 0} coins\n`;
        if (currentMsg.length + linha.length > 1900) {
          mensagens.push(currentMsg);
          currentMsg = linha;
        } else {
          currentMsg += linha;
        }
      });
      if (currentMsg) mensagens.push(currentMsg);

      for (const msgText of mensagens) {
        const msg = await interaction.reply({ content: msgText, ephemeral: false });
        setTimeout(() => msg.delete().catch(() => {}), MESSAGE_LIFETIME);
      }
      adminsAtivos.delete(userId);
      break;
    }

    case "resetUser":
      await processCollector("Use `@usuário` para resetar ponto, tempo e coins.", async m => {
        const mention = m.mentions.users.first();
        if (!mention) return interaction.followUp({ content: "❌ Usuário não mencionado.", ephemeral: false });
        await pool.query("UPDATE pontos SET ativo=false, total=0, coins=0, canal=NULL WHERE user_id=$1", [mention.id]);
        const confirm = await interaction.followUp({ content: `✅ Ponto de <@${mention.id}> resetado!`, ephemeral: false });
        setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
      });
      break;

    case "resetAll":
      await pool.query("UPDATE pontos SET ativo=false, total=0, coins=0, canal=NULL");
      const msgAll = await interaction.reply({ content: "✅ Todos os usuários foram resetados!", ephemeral: false });
      setTimeout(() => msgAll.delete().catch(() => {}), MESSAGE_LIFETIME);
      adminsAtivos.delete(userId);
      break;

    case "addCoins":
      await processCollector("Use `@usuário quantidade` para adicionar coins.", async m => {
        const [mention, amount] = m.content.split(" ");
        const id = mention.replace(/[<@!>]/g, "");
        const coins = parseInt(amount);
        if (!id || isNaN(coins)) return interaction.followUp({ content: "❌ Formato inválido.", ephemeral: false });
        await pool.query("UPDATE pontos SET coins=COALESCE(coins,0)+$1 WHERE user_id=$2", [coins, id]);
        const confirm = await interaction.followUp({ content: `✅ Adicionados ${coins} coins para <@${id}>`, ephemeral: false });
        setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
      });
      break;

    case "removeCoins":
      await processCollector("Use `@usuário quantidade` para remover coins.", async m => {
        const [mention, amount] = m.content.split(" ");
        const id = mention.replace(/[<@!>]/g, "");
        const coins = parseInt(amount);
        if (!id || isNaN(coins)) return interaction.followUp({ content: "❌ Formato inválido.", ephemeral: false });
        await pool.query("UPDATE pontos SET coins=GREATEST(COALESCE(coins,0)-$1,0) WHERE user_id=$2", [coins, id]);
        const confirm = await interaction.followUp({ content: `✅ Removidos ${coins} coins de <@${id}>`, ephemeral: false });
        setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
      });
      break;

    case "resetCoins":
      await processCollector("Use `@usuário` para resetar coins.", async m => {
        const mention = m.mentions.users.first();
        if (!mention) return interaction.followUp({ content: "❌ Usuário não mencionado.", ephemeral: false });
        await pool.query("UPDATE pontos SET coins=0 WHERE user_id=$1", [mention.id]);
        const confirm = await interaction.followUp({ content: `✅ Coins de <@${mention.id}> resetados!`, ephemeral: false });
        setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
      });
      break;

    case "addTime":
      await processCollector("Use `@usuário quantidade[h/m/s]` para adicionar tempo.", async m => {
        const [mention, amount] = m.content.split(" ");
        const id = mention.replace(/[<@!>]/g, "");
        if (!id || !amount) return interaction.followUp({ content: "❌ Formato inválido.", ephemeral: false });
        let time = 0;
        if (amount.endsWith("h")) time = parseFloat(amount) * 3600000;
        else if (amount.endsWith("m")) time = parseFloat(amount) * 60000;
        else if (amount.endsWith("s")) time = parseFloat(amount) * 1000;
        else time = parseInt(amount);
        if (isNaN(time)) return interaction.followUp({ content: "❌ Quantidade inválida.", ephemeral: false });
        await pool.query("UPDATE pontos SET total=total+$1 WHERE user_id=$2", [time, id]);
        const confirm = await interaction.followUp({ content: `✅ Adicionados ${Math.floor(time/3600000)}h para <@${id}>`, ephemeral: false });
        setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
      });
      break;

    case "removeTime":
      await processCollector("Use `@usuário quantidade[h/m/s]` para remover tempo.", async m => {
        const [mention, amount] = m.content.split(" ");
        const id = mention.replace(/[<@!>]/g, "");
        if (!id || !amount) return interaction.followUp({ content: "❌ Formato inválido.", ephemeral: false });
        let time = 0;
        if (amount.endsWith("h")) time = parseFloat(amount) * 3600000;
        else if (amount.endsWith("m")) time = parseFloat(amount) * 60000;
        else if (amount.endsWith("s")) time = parseFloat(amount) * 1000;
        else time = parseInt(amount);
        if (isNaN(time)) return interaction.followUp({ content: "❌ Quantidade inválida.", ephemeral: false });
        await pool.query("UPDATE pontos SET total=GREATEST(total-$1,0) WHERE user_id=$2", [time, id]);
        const confirm = await interaction.followUp({ content: `✅ Removidos ${Math.floor(time/3600000)}h de <@${id}>`, ephemeral: false });
        setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
      });
      break;

    case "resetTime":
      await processCollector("Use `@usuário` para resetar tempo.", async m => {
        const mention = m.mentions.users.first();
        if (!mention) return interaction.followUp({ content: "❌ Usuário não mencionado.", ephemeral: false });
        await pool.query("UPDATE pontos SET total=0 WHERE user_id=$1", [mention.id]);
        const confirm = await interaction.followUp({ content: `✅ Tempo de <@${mention.id}> resetado!`, ephemeral: false });
        setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
      });
      break;
  }
});

// =====================
// SELECT MENU FIXO PONTO
// =====================
const entrarMenu = new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId("ponto_menu")
    .setPlaceholder("Selecione uma ação")
    .addOptions([{ label: "Entrar", value: "entrar", description: "Iniciar ponto" }])
);

// ID do canal fixo
const canalPainelId = "1474383177689731254";

// =====================
// FUNÇÃO PARA GARANTIR QUE O PAINEL EXISTE
// =====================
async function garantirPainel(client) {
  const canalPainel = await client.channels.fetch(canalPainelId);

  const mensagens = await canalPainel.messages.fetch({ limit: 50 });
  const painelExistente = mensagens.find(msg =>
    msg.components.some(row =>
      row.components.some(c => c.customId === "ponto_menu")
    )
  );

  if (!painelExistente) {
    await canalPainel.send({ content: "Selecione uma ação:", components: [entrarMenu] });
    console.log("Painel de ponto criado no canal fixo!");
  } else {
    console.log("Painel de ponto já existe.");
  }
}

// =====================
// QUANDO O BOT LIGA
// =====================
client.once("ready", async () => {
  await garantirPainel(client);
});

// =====================
// MONITORA SE ALGUÉM APAGOU A MENSAGEM
// =====================
client.on("messageDelete", async (message) => {
  if (message.channel.id !== canalPainelId) return;
  if (!message.components.some(row => row.components.some(c => c.customId === "ponto_menu"))) return;

  // recria o painel se a mensagem for apagada
  await garantirPainel(client);
  console.log("Painel de ponto reapareceu após exclusão!");
});

// =====================
// INTERAÇÃO DO SELECT MENU
// =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "ponto_menu") return;

  if (interaction.values[0] === "entrar") {
    const userId = interaction.user.id;
    const guild = interaction.guild;
    const categoriaId = "1474413150441963615"; // categoria para os canais do ponto

    // =====================
    // PEGANDO DADOS DO USUÁRIO NO POSTGRES
    // =====================
    let res = await pool.query("SELECT ativo, entrada, canal FROM pontos WHERE user_id = $1", [userId]);
    let userData = res.rows[0];

    if (!userData) {
      await pool.query(
        "INSERT INTO pontos (user_id, ativo, total, entrada, canal) VALUES ($1, false, 0, NULL, NULL)",
        [userId]
      );
      userData = { ativo: false, entrada: null, canal: null };
    }

    if (userData.ativo)
      return interaction.reply({ content: "❌ Você já iniciou seu ponto.", ephemeral: true });

    const now = Date.now();
    await pool.query("UPDATE pontos SET ativo = true, entrada = $1 WHERE user_id = $2", [now, userId]);

    // =====================
    // CRIA CANAL PRIVADO
    // =====================
    const canal = await guild.channels.create({
      name: `ponto-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: categoriaId,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });

    await pool.query("UPDATE pontos SET canal = $1 WHERE user_id = $2", [canal.id, userId]);

    // =====================
    // BOTÕES DO CANAL
    // =====================
    const botaoMenu = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("status")
        .setLabel("📊 Status")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("sair")
        .setLabel("🔴 Sair")
        .setStyle(ButtonStyle.Danger)
    );

    await canal.send({ content: `🟢 Ponto iniciado! <@${userId}>`, components: [botaoMenu] });

    // =====================
    // CONTADOR TEMPO REAL
    // =====================
    const intervaloTempo = setInterval(async () => {
      const check = await pool.query("SELECT ativo, entrada FROM pontos WHERE user_id = $1", [userId]);
      if (!check.rows[0]?.ativo) {
        clearInterval(intervaloTempo);
        return;
      }
      const tempoAtual = Date.now() - check.rows[0].entrada;
      const horas = Math.floor(tempoAtual / 3600000);
      const minutos = Math.floor((tempoAtual % 3600000) / 60000);
      const segundos = Math.floor((tempoAtual % 60000) / 1000);
      canal.setTopic(`⏱ Tempo ativo: ${horas}h ${minutos}m ${segundos}s`).catch(() => {});
    }, 1000);

    // =====================
    // INTERAÇÃO COM OS BOTÕES
    // =====================
    const filter = i => i.user.id === userId && ["status", "sair"].includes(i.customId);
    const collector = canal.createMessageComponentCollector({ filter, time: 86400000 });

    collector.on("collect", async i => {
      if (i.customId === "status") {
        const status = await pool.query("SELECT entrada FROM pontos WHERE user_id = $1", [userId]);
        if (!status.rows[0]?.entrada) return i.reply({ content: "❌ Nenhum ponto iniciado.", ephemeral: true });

        const tempoAtual = Date.now() - status.rows[0].entrada;
        const h = Math.floor(tempoAtual / 3600000);
        const m = Math.floor((tempoAtual % 3600000) / 60000);
        const s = Math.floor((tempoAtual % 60000) / 1000);
        await i.reply({ content: `⏱ Tempo acumulado: ${h}h ${m}m ${s}s`, ephemeral: true });
      } else if (i.customId === "sair") {
        await pool.query(
          "UPDATE pontos SET ativo = false, total = total + $1, canal = NULL WHERE user_id = $2",
          [Date.now() - now, userId]
        );
        clearInterval(intervaloTempo);
        await i.reply({ content: "🔴 Ponto finalizado!", ephemeral: true });
        canal.delete().catch(() => {});
      }
    });

    // =====================
    // RESET DO SELECT MENU PARA PODER CLICAR NOVAMENTE
    // =====================
    const resetMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ponto_menu")
        .setPlaceholder("Selecione uma ação")
        .addOptions([{ label: "Entrar", value: "entrar", description: "Iniciar ponto" }])
    );

    await interaction.update({
      content: "Selecione uma ação:", 
      components: [resetMenu]
    });

    await interaction.followUp({ content: "✅ Ponto iniciado com sucesso!", ephemeral: true });
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
