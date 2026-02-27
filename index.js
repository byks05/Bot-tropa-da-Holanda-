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
const { Pool } = require("pg");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

// 🔥 PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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
  const canalEmbed = await client.channels.fetch("1476189793439453347")
  if (!canalEmbed) {
    console.log("Não foi possível achar o canal do painel. Verifique o ID e permissões.");
    return;
  }

  const produtos = [
  { label: "Vip", value: "vip", description: "🪙 6000 coins" },
  { label: "Robux", value: "robux", description: "🪙 4000 coins" },
  { label: "Nitro", value: "nitro", description: "🪙 2500 coins" },
  { label: "Ripa", value: "ripa", description: "🪙 1700 coins" },
  { label: "Roupa personalizada", value: "roupa", description: "🪙 1400 coins" },
];

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("loja_select")
      .setPlaceholder("Selecione um produto...")
      .addOptions(produtos)
  );

  const textoPainel = `
# Resgate Coins | Tropa da Holanda 🇳🇱
-# Resgate seus itens apenas com eles <@&1468017578747105390>  <@&1472589662144040960> 🚨

***Apenas para membros da equipe***
> 🛒 **Vip**
-# **🪙 6000 coins**
> 🛒 **Robux**
-# **MAXIMO DE 200 - 🪙 4000 coins**
> 🛒 **Nitro**
-# **🪙 2500 coins**
> 🛒 **Ripa**
-# **🪙 1700 coins**
> 🛒 **Roupa personalizada**
-# **🪙 1400 coins**

-# Resgate seus itens apenas com eles <@&1468017578747105390>  <@&1472589662144040960> 🚨
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
// =============================
// INTERAÇÃO DO SELECT MENU
// =============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "loja_select") return;

  const produtos = [
  { label: "Vip", value: "vip", description: "🪙 6000 coins" },
  { label: "Robux", value: "robux", description: "🪙 4000 coins" },
  { label: "Nitro", value: "nitro", description: "🪙 2500 coins" },
  { label: "Ripa", value: "ripa", description: "🪙 1700 coins" },
  { label: "Roupa personalizada", value: "roupa", description: "🪙 1400 coins" },
];
  const produtoValue = interaction.values[0];
  const produtoSelecionado = produtos.find(p => p.value === produtoValue);

  if (!produtoSelecionado) return;

  const guild = interaction.guild;
const categoriaId = "1474366472326222013"; // 👈 Categoria fixa
const ticketName = `ticket-${interaction.user.username}`;
  
  // Evita ticket duplicado
  const existingChannel = guild.channels.cache.find(
    c => c.name === ticketName && c.parentId === categoriaId
  );

  if (existingChannel) {
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

  // Embed do ticket
  const ticketEmbed = new EmbedBuilder()
    .setTitle(`🛒 Ticket de Compra - ${produtoSelecionado.label}`)
    .setDescription(`${interaction.user} abriu um ticket para comprar **${produtoSelecionado.label}** (${produtoSelecionado.description}).\n\nAdmins responsáveis: <@&1472589662144040960> <@&1468017578747105390>`)
    .setColor("Green")
    .setTimestamp();

  const fecharButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("fechar_ticket")
      .setLabel("🔒 Fechar Ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@&1472589662144040960> <@&1468017578747105390>`, embeds: [ticketEmbed], components: [fecharButton] });

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
// =====================
// PAINEL FIXO RECRUTAMENTO
// =====================

const recrutamentoGuildId = "1476618436170748129";
const recrutamentoChannelId = "1476755481228738713";

let painelRecMensagemId = null;
const REC_MESSAGE_LIFETIME = 15000;
async function criarPainelRecrutamento(client) {
  try {
    const canal = await client.channels.fetch(recrutamentoChannelId);
    if (!canal) return console.log("Canal de recrutamento não encontrado.");

    // Verifica se já existe painel
    if (!painelRecMensagemId) {
      const mensagens = await canal.messages.fetch({ limit: 30 });
      const existente = mensagens.find(msg =>
        msg.components.some(row =>
          row.components.some(c =>
            ["rec_registro","rec_resetAll","rec_add","rec_remove"].includes(c.customId)
          )
        )
      );
      if (existente) painelRecMensagemId = existente.id;
    }

    const botoesRec = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("rec_registro")
        .setLabel("📋 Registro")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("rec_resetAll")
        .setLabel("🔄 Resetar Todos")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("rec_add")
        .setLabel("➕ Adicionar Rec")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("rec_remove")
        .setLabel("➖ Remover Rec")
        .setStyle(ButtonStyle.Danger)
    );

    const conteudo = "🎖 **Painel de Recrutamento**\nGerencie os recrutadores abaixo.";

    if (painelRecMensagemId) {
      const mensagem = await canal.messages.fetch(painelRecMensagemId).catch(() => null);
      if (mensagem) {
        await mensagem.edit({ content: conteudo, components: [botoesRec] });
        return;
      }
    }

    const novaMensagem = await canal.send({
      content: conteudo,
      components: [botoesRec]
    });

    painelRecMensagemId = novaMensagem.id;

  } catch (err) {
    console.log("Erro ao criar painel recrutamento:", err);
  }
}

// recria se apagar
client.on("messageDelete", async (message) => {
  if (message.channel.id !== recrutamentoChannelId) return;

  if (!message.components?.some(row =>
    row.components.some(c =>
      ["rec_registro","rec_resetAll","rec_add","rec_remove"].includes(c.customId)
    )
  )) return;

  await criarPainelRecrutamento(client);
});

// cria ao iniciar bot
client.once("clientReady", () => {
  criarPainelRecrutamento(client);
});

// =====================
// PAINEL DE ADMIN FIXO AVANÇADO
// =====================
const adminChannelId = "1474384292015640626"; // Canal fixo do painel
let painelMensagemId = null;
const MESSAGE_LIFETIME = 15000; // 15 segundos

async function criarPainelAdmin(client) {
try {
const canal = await client.channels.fetch(adminChannelId);
if (!canal) return console.log("Canal de administração não encontrado.");

// procura se já existe a mensagem do painel  
if (!painelMensagemId) {  
  const mensagens = await canal.messages.fetch({ limit: 50 });  
  const existente = mensagens.find(msg =>   
    msg.components.some(row =>   
      row.components.some(c => ["registro","resetUser","resetAll","addCoins","addTime","removeCoins","removeTime"].includes(c.customId))  
    )  
  );  
  if (existente) painelMensagemId = existente.id;  
}  

// agora cria ou atualiza  
const botoesAdminLinha1 = new ActionRowBuilder().addComponents(  
  new ButtonBuilder().setCustomId("registro").setLabel("📋 Registro").setStyle(ButtonStyle.Primary),  
  new ButtonBuilder().setCustomId("resetUser").setLabel("🔄 Reset Usuário").setStyle(ButtonStyle.Danger),  
  new ButtonBuilder().setCustomId("resetAll").setLabel("🗑 Reset Todos").setStyle(ButtonStyle.Danger),  
  new ButtonBuilder().setCustomId("addCoins").setLabel("💰 Adicionar Coins").setStyle(ButtonStyle.Success),  
  new ButtonBuilder().setCustomId("addTime").setLabel("⏱ Adicionar Tempo").setStyle(ButtonStyle.Success)  
);  

    const botoesAdminLinha2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("removeCoins").setLabel("➖ Remover Coins").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("removeTime").setLabel("➖ Remover Tempo").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("fecharTodos").setLabel("🔒 Fechar Todos Pontos").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("verStatusUser").setLabel("📊 Ver Status Usuário").setStyle(ButtonStyle.Primary)
    );

    const conteudo = "🎛 Painel de Administração\nUse os botões abaixo para gerenciar usuários e pontos.";

    if (painelMensagemId) {
      const mensagem = await canal.messages.fetch(painelMensagemId).catch(() => null);
      if (mensagem) {
        await mensagem.edit({ content: conteudo, components: [botoesAdminLinha1, botoesAdminLinha2] });
        return;
      }
    }

    const mensagemNova = await canal.send({ content: conteudo, components: [botoesAdminLinha1, botoesAdminLinha2] });
    painelMensagemId = mensagemNova.id;

  } catch (err) {
    console.log("Erro ao criar painel de admin:", err);
  }
}
client.on("messageDelete", async (message) => {
  if (message.channel.id !== adminChannelId) return;
  if (!message.components.some(row => 
        row.components.some(c => ["registro","resetUser","resetAll","addCoins","addTime","removeCoins","removeTime"].includes(c.customId))
      )) return;

  // recria o painel se a mensagem for apagada
  await criarPainelAdmin(client);
  console.log("Painel de admin reapareceu após exclusão!");
});

client.once("clientReady", () => criarPainelAdmin(client));
// =====================
// INTERAÇÃO COM BOTÕES
// =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  const userId = interaction.user.id;

  switch (interaction.customId) {

    case "registro": {

  const res = await pool.query(
    "SELECT user_id, ativo, total_geral, coins FROM pontos ORDER BY total_geral DESC"
  );

  if (!res.rows.length) {
    const msg = await interaction.reply({
      content: "Nenhum usuário encontrado.",
      ephemeral: false
    });
    setTimeout(() => msg.delete().catch(() => {}), MESSAGE_LIFETIME);
    return;
  }

  const chunkSize = 20;

  for (let i = 0; i < res.rows.length; i += chunkSize) {

    const chunk = res.rows.slice(i, i + chunkSize);

    const lista = chunk.map((u, index) => {

      const tempo = u.total_geral || 0;

      const horas = Math.floor(tempo / 3600000);
      const minutos = Math.floor((tempo % 3600000) / 60000);
      const segundos = Math.floor((tempo % 60000) / 1000);

      return `**${i + index + 1}** - <@${u.user_id}> - ${u.ativo ? "🟢 Ativo" : "🔴 Inativo"} - ⏱ ${horas}h ${minutos}m ${segundos}s - 💰 ${u.coins || 0} coins`;

    }).join("\n");

    let msg;

    if (i === 0)
      msg = await interaction.reply({ content: lista, ephemeral: false });
    else
      msg = await interaction.followUp({ content: lista, ephemeral: false });

    setTimeout(() => msg.delete().catch(() => {}), MESSAGE_LIFETIME);
  }

  break;
}

    case "resetUser": {
      const msgReset = await interaction.reply({ content: "Mencione o usuário que deseja resetar.", ephemeral: false });
      const filterReset = m => m.author.id === userId;
      const collectorReset = interaction.channel.createMessageCollector({ filter: filterReset, max: 1, time: 60000 });

      collectorReset.on("collect", async m => {
        const mention = m.mentions.users.first();
        if (!mention) {
          const erro = await interaction.followUp({ content: "❌ Você precisa mencionar um usuário válido.", ephemeral: false });
          setTimeout(() => erro.delete().catch(() => {}), MESSAGE_LIFETIME);
          m.delete().catch(() => {});
          return;
        }

        await pool.query(`
  UPDATE pontos 
  SET 
    ativo = false,
    saldo_horas = 0,
    total_geral = 0,
    entrada = NULL,
    canal = NULL,
    coins = 0
  WHERE user_id = $1
`, [mention.id]);
        const confirm = await interaction.followUp({ content: `✅ Usuário <@${mention.id}> resetado com sucesso!`, ephemeral: false });
        setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
        m.delete().catch(() => {});
      });

      setTimeout(() => msgReset.delete().catch(() => {}), MESSAGE_LIFETIME);
      break;
    }

    case "resetAll": {
      await pool.query("UPDATE pontos SET ativo = false, total = 0, canal = NULL, coins = 0");
      const msgAll = await interaction.reply({ content: "✅ Todos os usuários foram resetados!", ephemeral: false });
      setTimeout(() => msgAll.delete().catch(() => {}), MESSAGE_LIFETIME);
      break;
    }

    case "addCoins": {
      const msgCoins = await interaction.reply({ content: "Use: `@usuário quantidade` para adicionar coins.", ephemeral: false });
      const filterCoins = m => m.author.id === userId;
      const collectorCoins = interaction.channel.createMessageCollector({ filter: filterCoins, max: 1, time: 60000 });

      collectorCoins.on("collect", async m => {
        const [mention, amount] = m.content.split(" ");
        const id = mention.replace(/[<@!>]/g, "");
        const coins = parseInt(amount, 10);

        if (!id || isNaN(coins)) {
          const erro = await interaction.followUp({ content: "❌ Formato inválido. Use: `@usuário quantidade`", ephemeral: false });
          setTimeout(() => erro.delete().catch(() => {}), MESSAGE_LIFETIME);
          return;
        }

        await pool.query("UPDATE pontos SET coins = COALESCE(coins,0) + $1 WHERE user_id = $2", [coins, id]);
        const confirm = await interaction.followUp({ content: `✅ Adicionados ${coins} coins para <@${id}>`, ephemeral: false });
        setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
        m.delete().catch(() => {});
      });

      setTimeout(() => msgCoins.delete().catch(() => {}), MESSAGE_LIFETIME);
      break;
    }

    case "addTime": {

  const msgTime = await interaction.reply({
    content: "Use: `@usuário 3h 15m` ou `@usuário 2h` para adicionar tempo.",
    ephemeral: false
  });

  const filterTime = m => m.author.id === userId;
  const collectorTime = interaction.channel.createMessageCollector({
    filter: filterTime,
    max: 1,
    time: 60000
  });

  collectorTime.on("collect", async m => {

    const args = m.content.split(" ");
    const mention = args[0];
    if (!mention) return;

    const id = mention.replace(/[<@!>]/g, "");
    if (!id) return;

    const timeString = args.slice(1).join(" ").toLowerCase();
    if (!timeString) {
      const erro = await interaction.followUp({
        content: "❌ Você precisa informar o tempo. Ex: `3h 15m`",
        ephemeral: false
      });
      setTimeout(() => erro.delete().catch(() => {}), MESSAGE_LIFETIME);
      m.delete().catch(() => {});
      return;
    }

    // Converter "3h 15m" em ms
    function parseTime(str) {
      let total = 0;
      const regex = /(\d+)\s*(h|m|s)/g;
      let match;
      while ((match = regex.exec(str)) !== null) {
        const value = parseInt(match[1]);
        const unit = match[2];
        if (unit === "h") total += value * 3600000;
        else if (unit === "m") total += value * 60000;
        else if (unit === "s") total += value * 1000;
      }
      return total;
    }

    const timeMs = parseTime(timeString);

    if (timeMs <= 0) {
      const erro = await interaction.followUp({
        content: "❌ Tempo inválido.",
        ephemeral: false
      });
      setTimeout(() => erro.delete().catch(() => {}), MESSAGE_LIFETIME);
      m.delete().catch(() => {});
      return;
    }

    // ✅ UPDATE CORRIGIDO
    await pool.query(`
      UPDATE pontos 
      SET 
        saldo_horas = COALESCE(saldo_horas,0) + $1,
        total_geral = COALESCE(total_geral,0) + $1
      WHERE user_id = $2
    `, [timeMs, id]);

    const hours = Math.floor(timeMs / 3600000);
    const minutes = Math.floor((timeMs % 3600000) / 60000);
    const seconds = Math.floor((timeMs % 60000) / 1000);

    const confirm = await interaction.followUp({
      content: `✅ Adicionados ${hours}h ${minutes}m ${seconds}s para <@${id}>`,
      ephemeral: false
    });

    setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
    m.delete().catch(() => {});
  });

  setTimeout(() => msgTime.delete().catch(() => {}), MESSAGE_LIFETIME);

  break;
}
      case "removeCoins": {
  const msgCoins = await interaction.reply({ content: "Use: `@usuário quantidade` para remover coins.", ephemeral: false });
  const filterCoins = m => m.author.id === userId;
  const collectorCoins = interaction.channel.createMessageCollector({ filter: filterCoins, max: 1, time: 60000 });

  collectorCoins.on("collect", async m => {
    const [mention, amount] = m.content.split(" ");
    const id = mention.replace(/[<@!>]/g, "");
    const coins = parseInt(amount, 10);

    if (!id || isNaN(coins)) {
      const erro = await interaction.followUp({ content: "❌ Formato inválido. Use: `@usuário quantidade`", ephemeral: false });
      setTimeout(() => erro.delete().catch(() => {}), MESSAGE_LIFETIME);
      return;
    }

    await pool.query("UPDATE pontos SET coins = GREATEST(COALESCE(coins,0) - $1, 0) WHERE user_id = $2", [coins, id]);
    const confirm = await interaction.followUp({ content: `✅ Removidos ${coins} coins de <@${id}>`, ephemeral: false });
    setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
    m.delete().catch(() => {});
  });

  setTimeout(() => msgCoins.delete().catch(() => {}), MESSAGE_LIFETIME);
  break;
}

case "removeTime": {
  const msgTime = await interaction.reply({ content: "Use: `@usuário 3h 15m` para remover tempo.", ephemeral: false });
  const filterTime = m => m.author.id === userId;
  const collectorTime = interaction.channel.createMessageCollector({ filter: filterTime, max: 1, time: 60000 });

  collectorTime.on("collect", async m => {
    const args = m.content.split(" ");
    const mention = args[0];
    if (!mention) return;

    const id = mention.replace(/[<@!>]/g, "");
    if (!id) return;

    const timeString = args.slice(1).join(" ").toLowerCase();
    if (!timeString) {
      const erro = await interaction.followUp({ content: "❌ Você precisa informar o tempo. Ex: `3h 15m`", ephemeral: false });
      setTimeout(() => erro.delete().catch(() => {}), MESSAGE_LIFETIME);
      m.delete().catch(() => {});
      return;
    }

    function parseTime(str) {
      let total = 0;
      const regex = /(\d+)\s*(h|m|s)/g;
      let match;
      while ((match = regex.exec(str)) !== null) {
        const value = parseInt(match[1]);
        const unit = match[2];
        if (unit === "h") total += value * 3600000;
        else if (unit === "m") total += value * 60000;
        else if (unit === "s") total += value * 1000;
      }
      return total;
    }

    const timeMs = parseTime(timeString);
    if (timeMs <= 0) {
      const erro = await interaction.followUp({ content: "❌ Tempo inválido.", ephemeral: false });
      setTimeout(() => erro.delete().catch(() => {}), MESSAGE_LIFETIME);
      m.delete().catch(() => {});
      return;
    }

    await pool.query(`
  UPDATE pontos 
  SET 
    saldo_horas = GREATEST(COALESCE(saldo_horas,0) - $1, 0),
    total_geral = GREATEST(COALESCE(total_geral,0) - $1, 0)
  WHERE user_id = $2
`, [tempoEmMs, userId]);
    const hours = Math.floor(timeMs / 3600000);
    const minutes = Math.floor((timeMs % 3600000) / 60000);
    const seconds = Math.floor((timeMs % 60000) / 1000);

    const confirm = await interaction.followUp({ content: `✅ Removidos ${hours}h ${minutes}m ${seconds}s de <@${id}>`, ephemeral: false });
    setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
    m.delete().catch(() => {});
  });

  setTimeout(() => msgTime.delete().catch(() => {}), MESSAGE_LIFETIME);
  break;
    }
      case "fecharTodos": {
  const categoriaId = "1474413150441963615";

  // Busca todos ativos
  const res = await pool.query("SELECT user_id, entrada FROM pontos WHERE ativo = true");

  if (!res.rows.length) {
    return interaction.reply({
      content: "⚠ Nenhum ponto ativo encontrado.",
      flags: 64
    });
  }

  let fechados = 0;

  for (const user of res.rows) {
    const tempoTrabalhado = Date.now() - parseInt(user.entrada || 0);

  // Atualiza banco
await pool.query(`
  UPDATE pontos 
  SET 
    saldo_horas = COALESCE(saldo_horas,0) + $1,
    total_geral = COALESCE(total_geral,0) + $1,
    ativo = false,
    entrada = NULL
  WHERE user_id = $2
`, [tempoTrabalhado, user.user_id]);

fechados++;
  }

  // Agora deletar canais da categoria
  const guild = interaction.guild;
  const canais = guild.channels.cache.filter(
    c => c.parentId === categoriaId
  );

  for (const canal of canais.values()) {
    await canal.delete().catch(() => {});
  }

  await interaction.reply({
    content: `✅ ${fechados} pontos foram encerrados e canais fechados.`,
    flags: 64
  });

  break;
      }
     case "verStatusUser": {

  await interaction.deferReply({ ephemeral: false });

  const msgStatus = await interaction.editReply({
    content: "Mencione o usuário que deseja consultar."
  });

  const filterStatus = m => m.author.id === userId;
  const collectorStatus = interaction.channel.createMessageCollector({
    filter: filterStatus,
    max: 1,
    time: 60000
  });

  collectorStatus.on("collect", async m => {

    const mention = m.mentions.users.first();
    if (!mention) {
      const erro = await interaction.followUp({
        content: "❌ Você precisa mencionar um usuário válido.",
        ephemeral: false
      });
      setTimeout(() => erro.delete().catch(() => {}), MESSAGE_LIFETIME);
      m.delete().catch(() => {});
      return;
    }

    const res = await pool.query(
      "SELECT * FROM pontos WHERE user_id = $1",
      [mention.id]
    );

    if (!res.rows.length) {
      const erro = await interaction.followUp({
        content: "❌ Usuário não encontrado no banco.",
        ephemeral: false
      });
      setTimeout(() => erro.delete().catch(() => {}), MESSAGE_LIFETIME);
      m.delete().catch(() => {});
      return;
    }

    const userData = res.rows[0];

const totalGeral = userData.total_geral || 0;
const saldoHoras = userData.saldo_horas || 0;

// Histórico total
const horasTotal = Math.floor(totalGeral / 3600000);
const minutosTotal = Math.floor((totalGeral % 3600000) / 60000);
const segundosTotal = Math.floor((totalGeral % 60000) / 1000);

// Saldo disponível
const horasSaldo = Math.floor(saldoHoras / 3600000);
const minutosSaldo = Math.floor((saldoHoras % 3600000) / 60000);
const segundosSaldo = Math.floor((saldoHoras % 60000) / 1000);

const statusMsg =
  `📊 **Status de <@${mention.id}>**\n\n` +
  `🟢 Ativo: ${userData.ativo ? "Sim" : "Não"}\n\n` +
  `🔒 Histórico Total:\n` +
  `⏱ ${horasTotal}h ${minutosTotal}m ${segundosTotal}s\n\n` +
  `💼 Horas Disponíveis para Converter:\n` +
  `⏱ ${horasSaldo}h ${minutosSaldo}m ${segundosSaldo}s\n\n` +
  `💰 Coins: ${userData.coins || 0}\n` +
  `📂 Canal: ${userData.canal ? `<#${userData.canal}>` : "Nenhum"}`;
const confirm = await interaction.followUp({
  content: statusMsg,
  ephemeral: false
});

    setTimeout(() => confirm.delete().catch(() => {}), MESSAGE_LIFETIME);
    m.delete().catch(() => {});
  });

  setTimeout(() => msgStatus.delete().catch(() => {}), MESSAGE_LIFETIME);
  break;
      }
// =====================
// INTERAÇÕES RECRUTAMENTO
// =====================

case "rec_registro": {

  const res = await pool.query(
    "SELECT user_id, recrutamentos FROM recrutadores ORDER BY recrutamentos DESC"
  );

  if (!res.rows.length) {
    const msg = await interaction.reply({
      content: "Nenhum recrutador encontrado.",
      ephemeral: false
    });
    setTimeout(() => msg.delete().catch(()=>{}), REC_MESSAGE_LIFETIME);
    break;
  }

  const lista = res.rows.map((u, i) =>
    `**${i+1}°** - <@${u.user_id}> - 🎯 ${u.recrutamentos} recrutamentos`
  ).join("\n");

  const msg = await interaction.reply({ content: lista, ephemeral: false });
  setTimeout(() => msg.delete().catch(()=>{}), REC_MESSAGE_LIFETIME);
  break;
}

case "rec_resetAll": {

  await pool.query("UPDATE recrutadores SET recrutamentos = 0");

  const msg = await interaction.reply({
    content: "✅ Todos recrutamentos foram resetados!",
    ephemeral: false
  });

  setTimeout(() => msg.delete().catch(()=>{}), REC_MESSAGE_LIFETIME);
  break;
}

case "rec_add": {

  await interaction.reply({
    content: "Use: `@usuário quantidade`",
    ephemeral: false
  });

  const filter = m => m.author.id === interaction.user.id;

  const collector = interaction.channel.createMessageCollector({
    filter,
    max: 1,
    time: 60000
  });

  collector.on("collect", async m => {

    const [mention, amount] = m.content.split(" ");
    const id = mention?.replace(/[<@!>]/g, "");
    const quantidade = parseInt(amount) || 1;

    if (!id) return;

    await pool.query(`
      INSERT INTO recrutadores (user_id, recrutamentos)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET recrutamentos = recrutadores.recrutamentos + $2
    `, [id, quantidade]);

    const confirm = await interaction.followUp({
      content: `✅ Adicionado ${quantidade} recrutamento(s) para <@${id}>`,
      ephemeral: false
    });

    setTimeout(() => confirm.delete().catch(()=>{}), REC_MESSAGE_LIFETIME);
    m.delete().catch(()=>{});
  });

  break;
}

case "rec_remove": {

  await interaction.reply({
    content: "Use: `@usuário quantidade`",
    ephemeral: false
  });

  const filter = m => m.author.id === interaction.user.id;

  const collector = interaction.channel.createMessageCollector({
    filter,
    max: 1,
    time: 60000
  });

  collector.on("collect", async m => {

    const [mention, amount] = m.content.split(" ");
    const id = mention?.replace(/[<@!>]/g, "");
    const quantidade = parseInt(amount) || 1;

    if (!id) return;

    await pool.query(`
      UPDATE recrutadores
      SET recrutamentos = GREATEST(recrutamentos - $1, 0)
      WHERE user_id = $2
    `, [quantidade, id]);

    const confirm = await interaction.followUp({
      content: `✅ Removido ${quantidade} recrutamento(s) de <@${id}>`,
      ephemeral: false
    });

    setTimeout(() => confirm.delete().catch(()=>{}), REC_MESSAGE_LIFETIME);
    m.delete().catch(()=>{});
  });

  break;
}

  } // fim do switch
}); // fim do client.on

// =====================
// SELECT MENU FIXO PONTO + BOTÕES
// =====================
const entrarMenu = new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId("ponto_menu")
    .setPlaceholder("Selecione uma ação")
    .addOptions([{ label: "Entrar", value: "entrar", description: "Iniciar ponto" }])
);

const canalPainelId = "1474383177689731254";
const categoriaId = "1474413150441963615";

// =====================
// GARANTIR PAINEL
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

    const botoesPainel = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("converter_horas")
        .setLabel("💸 Converter Horas")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("consultar_saldo")
        .setLabel("💳 Consultar Saldo")
        .setStyle(ButtonStyle.Primary)
    );

    await canalPainel.send({
      content: "Selecione para iniciar o ponto 👇🏾",
      components: [entrarMenu, botoesPainel]
    });

    console.log("Painel criado!");
  }
}

// =====================
// SISTEMA DE PRESENÇA 20 MIN
// =====================
function iniciarCicloPresenca(userId) {

  setTimeout(async () => {

    const result = await pool.query(
      "SELECT ativo, canal, entrada FROM pontos WHERE user_id = $1",
      [userId]
    );

    if (!result.rows.length) return;
    const dados = result.rows[0];
    if (!dados.ativo) return;

    const guild = client.guilds.cache.first();
    const canal = guild.channels.cache.get(dados.canal);
    if (!canal) return;

    const botao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`presente_${userId}`)
        .setLabel("✅ Estou Presente")
        .setStyle(ButtonStyle.Success)
    );

    const mensagem = await canal.send({
      content: `<@${userId}> ⏰ Você está presente? Clique no botão em até 2 minutos.`,
      components: [botao]
    });

    const collector = mensagem.createMessageComponentCollector({
      time: 2 * 60 * 1000
    });

    collector.on("collect", async (interaction) => {

      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: "⚠ Esse botão não é para você.",
          flags: 64
        });
      }

      await interaction.update({
        content: "✅ Presença confirmada. Continuando ponto.",
        components: []
      });

      collector.stop();
      iniciarCicloPresenca(userId); // reinicia ciclo
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        await encerrarPonto(userId, dados, canal);
      }
    });

  }, 20 * 60 * 1000);
}

// =====================
// ENCERRAR PONTO
// =====================
async function encerrarPonto(userId, dados, canal) {

  const tempo = Date.now() - parseInt(dados.entrada, 10);

  await pool.query(
  `UPDATE pontos 
   SET 
     saldo_horas = COALESCE(saldo_horas,0) + $1,
     total_geral = COALESCE(total_geral,0) + $1,
     ativo = false,
     entrada = NULL,
     canal = NULL
   WHERE user_id = $2`,
  [tempo, userId]
);

  await canal.send("🔴 Ponto encerrado por inatividade.");
  setTimeout(() => canal.delete().catch(() => {}), 2000);
}

// =====================
// BOT LIGOU
// =====================
client.once("clientReady", async () => {

  console.log(`Bot logado como ${client.user.tag}`);
  await garantirPainel(client);

  // Recuperar ativos
const ativos = await pool.query("SELECT * FROM pontos WHERE ativo = true");

for (const user of ativos.rows) {
  const guild = client.guilds.cache.first();
  const canalExistente = guild.channels.cache.get(user.canal);

  if (!canalExistente && user.entrada) {
    const tempo = Date.now() - parseInt(user.entrada, 10);

    await pool.query(
      `UPDATE pontos 
       SET 
         saldo_horas = COALESCE(saldo_horas,0) + $1,
         total_geral = COALESCE(total_geral,0) + $1,
         ativo = false,
         entrada = NULL
       WHERE user_id = $2`,
      [tempo, user.user_id]
    );
  } else {
    iniciarCicloPresenca(user.user_id);
  }
}
});

// =====================
// RECRIAR PAINEL SE APAGAR
// =====================
client.on("messageDelete", async (message) => {
  if (message.channel.id !== canalPainelId) return;
  await garantirPainel(client);
});

// =====================
// INTERAÇÕES
// =====================
client.on("interactionCreate", async (interaction) => {

  const userId = interaction.user.id;

  // -------- SELECT MENU --------
if (interaction.isStringSelectMenu() && interaction.customId === "ponto_menu") {

  if (interaction.values[0] === "entrar") {

    let res = await pool.query("SELECT * FROM pontos WHERE user_id = $1", [userId]);
    let userData = res.rows[0];

   if (!userData) {
  await pool.query(
    "INSERT INTO pontos (user_id, ativo, saldo_horas, total_geral, entrada, canal, coins) VALUES ($1,false,0,0,NULL,NULL,0)",
    [userId]
  );
  userData = { ativo: false };
}

    if (userData.ativo)
      return interaction.reply({ content: "❌ Você já iniciou seu ponto.", flags: 64 });

    const now = Date.now();
    await pool.query(
      "UPDATE pontos SET ativo = true, entrada = $1 WHERE user_id = $2",
      [now, userId]
    );

    const canal = await interaction.guild.channels.create({
      name: `ponto-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: categoriaId,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });

    await pool.query(
      "UPDATE pontos SET canal = $1 WHERE user_id = $2",
      [canal.id, userId]
    );

    iniciarCicloPresenca(userId);

    const botoesPrivado = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("status")
        .setLabel("📊 Status")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("sair")
        .setLabel("🔴 Sair")
        .setStyle(ButtonStyle.Danger)
    );

    await canal.send({
      content: `🟢 Ponto iniciado! <@${userId}>`,
      components: [botoesPrivado]
    });

  // 🔥 Resetar o select menu (sem deixar marcado)
await interaction.update({
  content: "Selecione para iniciar o ponto 👇🏾",
  components: [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ponto_menu")
        .setPlaceholder("Selecione uma ação")
        .addOptions([
          { label: "Entrar", value: "entrar", description: "Iniciar ponto" }
        ])
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("converter_horas")
        .setLabel("💸 Converter Horas")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("consultar_saldo")
        .setLabel("💳 Consultar Saldo")
        .setStyle(ButtonStyle.Primary)
    )
  ]
});

await interaction.followUp({
  content: "✅ Ponto iniciado com sucesso!",
  ephemeral: true
});
  }
}

  // -------- BOTÃO STATUS --------
  if (interaction.isButton() && interaction.customId === "status") {

  const res = await pool.query("SELECT * FROM pontos WHERE user_id = $1", [userId]);
  const userData = res.rows[0];
  if (!userData) return interaction.reply({ content: "❌ Nenhum ponto.", flags: 64 });

  let totalGeral = parseInt(userData.total_geral || 0);
  let saldoHoras = parseInt(userData.saldo_horas || 0);

  // Se estiver ativo, soma o tempo atual temporariamente
  if (userData.ativo && userData.entrada) {
    const tempoAtual = Date.now() - parseInt(userData.entrada);
    totalGeral += tempoAtual;
    saldoHoras += tempoAtual;
  }

  // Histórico total
  const hTotal = Math.floor(totalGeral / 3600000);
  const mTotal = Math.floor((totalGeral % 3600000) / 60000);
  const sTotal = Math.floor((totalGeral % 60000) / 1000);

  // Saldo disponível
  const hSaldo = Math.floor(saldoHoras / 3600000);
  const mSaldo = Math.floor((saldoHoras % 3600000) / 60000);
  const sSaldo = Math.floor((saldoHoras % 60000) / 1000);

  return interaction.reply({
    content:
      `📊 **Seu Status**\n\n` +
      `🟢 Ativo: ${userData.ativo ? "Sim" : "Não"}\n\n` +
      `🔒 Histórico Total:\n⏱ ${hTotal}h ${mTotal}m ${sTotal}s\n\n` +
      `💼 Disponível para Converter:\n⏱ ${hSaldo}h ${mSaldo}m ${sSaldo}s\n\n` +
      `💰 Coins: ${userData.coins || 0}`,
    flags: 64
  });
}

  // -------- BOTÃO SAIR --------
  if (interaction.isButton() && interaction.customId === "sair") {

  const res = await pool.query(
    "SELECT ativo, entrada FROM pontos WHERE user_id = $1",
    [userId]
  );

  const userData = res.rows[0];

  if (!userData)
    return interaction.reply({ content: "❌ Nenhum ponto encontrado.", flags: 64 });

  if (!userData.ativo)
    return interaction.reply({ content: "❌ Você não está com ponto ativo.", flags: 64 });

  let tempo = 0;

  if (userData.entrada) {
    tempo = Date.now() - parseInt(userData.entrada);
  }

  await pool.query(
    `UPDATE pontos 
     SET 
       saldo_horas = COALESCE(saldo_horas,0) + $1,
       total_geral = COALESCE(total_geral,0) + $1,
       ativo = false,
       entrada = NULL,
       canal = NULL
     WHERE user_id = $2`,
    [tempo, userId]
  );

  const h = Math.floor(tempo / 3600000);
  const m = Math.floor((tempo % 3600000) / 60000);
  const s = Math.floor((tempo % 60000) / 1000);

  await interaction.reply({
    content: `🔴 Ponto finalizado!\n⏱ Tempo registrado: ${h}h ${m}m ${s}s`,
    flags: 64
  });

  interaction.channel.delete().catch(() => {});
}


  // ----------------- BOTÃO CONVERTER HORAS -----------------
if (interaction.isButton() && interaction.customId === "converter_horas") {

  const status = await pool.query(
    "SELECT ativo, saldo_horas, total_geral, entrada, coins FROM pontos WHERE user_id = $1",
    [userId]
  );

  const userData = status.rows[0];
  if (!userData)
    return interaction.reply({ content: "❌ Nenhum ponto encontrado.", ephemeral: true });

  if (userData.ativo)
    return interaction.reply({ content: "❌ Você precisa finalizar o ponto antes de converter horas.", ephemeral: true });

  let tempoDisponivel = parseInt(userData.saldo_horas || 0);

  if (tempoDisponivel < 1800000)
    return interaction.reply({ content: "❌ Você precisa ter pelo menos 30 minutos para converter.", ephemeral: true });

  await interaction.reply({
    content: "Quantas horas deseja converter? (Ex: 1 = 1h, 0.5 = 30m)",
    ephemeral: true
  });

  const collector = interaction.channel.createMessageCollector({
    filter: m => m.author.id === userId,
    max: 1,
    time: 60000
  });

  collector.on("collect", async m => {

    const horas = parseFloat(m.content.replace(",", "."));

    if (isNaN(horas) || horas < 0.5) {
      m.delete().catch(() => {});
      return interaction.followUp({ content: "❌ Valor inválido. Mínimo 0.5h (30m).", ephemeral: true });
    }

    const msParaConverter = Math.floor(horas * 3600000);

    if (msParaConverter > tempoDisponivel)
      return interaction.followUp({ content: "❌ Você não tem esse tempo disponível.", ephemeral: true });

    const coinsFinal = Math.floor(horas * 100); // 1h = 100 coins

    await pool.query(
      `UPDATE pontos 
       SET saldo_horas = saldo_horas - $1,
           coins = COALESCE(coins,0) + $2
       WHERE user_id = $3`,
      [msParaConverter, coinsFinal, userId]
    );

    const novoStatus = await pool.query(
      "SELECT saldo_horas, total_geral, coins FROM pontos WHERE user_id = $1",
      [userId]
    );

    const novoUser = novoStatus.rows[0];

    // Saldo restante
    const saldoH = Math.floor(novoUser.saldo_horas / 3600000);
    const saldoM = Math.floor((novoUser.saldo_horas % 3600000) / 60000);

    // Histórico total (não muda na conversão)
    const totalH = Math.floor(novoUser.total_geral / 3600000);
    const totalM = Math.floor((novoUser.total_geral % 3600000) / 60000);

    await interaction.followUp({
      content:
        `✅ **Conversão realizada!**\n\n` +
        `🕒 Convertido: ${horas}h\n` +
        `💰 Recebido: ${coinsFinal} coins\n\n` +
        `💼 Saldo restante: ${saldoH}h ${saldoM}m\n` +
        `🔒 Histórico total: ${totalH}h ${totalM}m\n` +
        `💎 Coins atuais: ${novoUser.coins}`,
      ephemeral: true
    });

    m.delete().catch(() => {});
  });
}
  // ----------------- BOTÃO CONSULTAR SALDO -----------------
if (interaction.isButton() && interaction.customId === "consultar_saldo") {

  const status = await pool.query(
    "SELECT ativo, entrada, saldo_horas, total_geral, coins FROM pontos WHERE user_id = $1",
    [userId]
  );

  const userData = status.rows[0];
  if (!userData)
    return interaction.reply({ content: "❌ Nenhum ponto encontrado.", ephemeral: true });

  let saldoAtual = parseInt(userData.saldo_horas || 0);
  let totalGeral = parseInt(userData.total_geral || 0);

  // Se estiver ativo, soma tempo atual temporariamente
  if (userData.ativo && userData.entrada) {
    const tempoAtual = Date.now() - parseInt(userData.entrada, 10);
    saldoAtual += tempoAtual;
    totalGeral += tempoAtual;
  }

  // 🔹 Converter saldo disponível
  const hSaldo = Math.floor(saldoAtual / 3600000);
  const mSaldo = Math.floor((saldoAtual % 3600000) / 60000);
  const sSaldo = Math.floor((saldoAtual % 60000) / 1000);

  // 🔹 Converter histórico
  const hTotal = Math.floor(totalGeral / 3600000);
  const mTotal = Math.floor((totalGeral % 3600000) / 60000);
  const sTotal = Math.floor((totalGeral % 60000) / 1000);

  await interaction.reply({
    content:
      `💳 **Seu saldo atual:**\n\n` +
      `🟢 Ativo: ${userData.ativo ? "Sim" : "Não"}\n\n` +
      `💼 Disponível para converter:\n` +
      `⏱ ${hSaldo}h ${mSaldo}m ${sSaldo}s\n\n` +
      `🔒 Histórico total trabalhado:\n` +
      `⏱ ${hTotal}h ${mTotal}m ${sTotal}s\n\n` +
      `💰 Coins: ${userData.coins || 0}`,
    ephemeral: true
  });
}
});
// =============================
// CONFIGURAÇÕES GERAIS
// =============================
const PREFIX = "thl!";

const IDS = {
  STAFF: ["1468069638935150635", "1468017578747105390"],
  LOG_CHANNEL: "1468722726247338115",
  TICKET_CATEGORY: "1468014890500489447",
  RECRUITMENT_ROLE: ["1468024687031484530",
                     "1470541063256277012"],

  SERVIDOR_PRINCIPAL: "1468007116936843359",
  SERVIDOR_RECRUTAMENTO: "1476618436170748129",
  CARGO_MEMBRO: "1468026315285205094"
};

// =============================
// CONFIGURAÇÕES DE PERMISSÕES
// =============================
const ADM_IDS = ["1468017578747105390", "1468069638935150635"]; // IDs que podem usar addcoins/addtempo
const ALLOWED_REC = [
  "1468017578747105390",
  "1468069638935150635",
  "1468066422490923081",
  "1476619364672475278",
  "1476619432838168668",
  "1476619502832713839"
];
// =============================
// VERIFICAÇÃO AUTOMÁTICA DE RECRUTADOS (SEM KICK)
// =============================
client.on("guildMemberAdd", async (member) => {
  try {
    if (member.guild.id !== IDS.SERVIDOR_PRINCIPAL) return;

    const resultado = await pool.query(
      "SELECT * FROM recrutamentos2 WHERE userid = $1",
      [member.id]
    );

    // ❌ Não está no banco → só ignora
    if (resultado.rows.length === 0) {
      console.log("Usuário não está no banco.");
      return;
    }

    const dados = resultado.rows[0];

    // ❌ Não está aprovado → só ignora
    if (!dados.recrutado || dados.status !== "aprovado") {
      console.log("Recrutamento não aprovado.");
      return;
    }

    // ❌ Expirado → atualiza banco e ignora
    if (new Date(dados.validade) < new Date()) {
      await pool.query(
        "UPDATE recrutamentos2 SET status = 'expirado', recrutado = false WHERE userid = $1",
        [member.id]
      );
      console.log("Recrutamento expirado.");
      return;
    }

    // ❌ Servidor de origem inválido → ignora
    if (dados.servidor_origem !== IDS.SERVIDOR_RECRUTAMENTO) {
      console.log("Servidor de origem inválido.");
      return;
    }

    // ✅ Dá o cargo
    const cargo = member.guild.roles.cache.get(IDS.CARGO_MEMBRO);
    if (cargo) await member.roles.add(cargo);

    // ✅ Log
    const logChannel = member.guild.channels.cache.get(IDS.LOG_CHANNEL);
    if (logChannel) {
      logChannel.send(`✅ ${member.user.tag} entrou no servidor principal.`);
    }

  } catch (err) {
    console.error("Erro na verificação de recrutamento:", err);
  }
});
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
  if (command === "kickcargo") {

  if (!message.member.permissions.has("KickMembers")) {
    return message.reply("❌ Você não tem permissão.");
  }

  if (!message.guild.members.me.permissions.has("KickMembers")) {
    return message.reply("❌ Eu não tenho permissão para expulsar membros.");
  }

  const role = message.mentions.roles.first();

  if (!role) {
    return message.reply("❌ Use assim:\nthl!kickcargo @Cargo");
  }

  // 🔥 FORÇA BUSCAR TODOS OS MEMBROS
  await message.guild.members.fetch();

  const members = message.guild.members.cache.filter(member =>
    member.roles.cache.has(role.id)
  );

  if (!members.size) {
    return message.reply("⚠ Nenhum membro encontrado com esse cargo.");
  }

  let expulsos = 0;

  for (const member of members.values()) {

    if (member.id === message.guild.ownerId) continue;
    if (!member.kickable) continue;

    try {
      await member.kick(`Expulsão em massa por ${message.author.tag}`);
      expulsos++;
    } catch (err) {
      console.log(`Erro ao expulsar ${member.user.tag}`);
    }
  }

  message.channel.send(
    `✅ ${expulsos} membros com o cargo ${role.name} foram expulsos.`
  );
}
  // =============================
// COMANDO !APROVAR
// =============================
if (message.content.startsWith(`${PREFIX}aprovar`)) {
  try {
    // Checa se o autor tem o cargo de recrutador
    const membroAutor = message.member;
    const cargosPermitidos = IDS.ALLOWED_REC; // array de cargos que podem aprovar
    const temCargo = membroAutor.roles.cache.some(r => cargosPermitidos.includes(r.id));

    if (!temCargo) {
      return message.reply("❌ Você não tem permissão para aprovar recrutas.");
    }

    // Pega o usuário mencionado
    const membro = message.mentions.members.first();
    if (!membro) return message.reply("⚠️ Mencione o usuário que deseja aprovar.");

    // Confirma que o comando está sendo usado no servidor de recrutamento
    if (message.guild.id !== IDS.SERVIDOR_RECRUTAMENTO) {
      return message.reply("⚠️ Este comando só pode ser usado no servidor de recrutamento.");
    }

    // Insere ou atualiza o usuário na tabela recrutamento
    await pool.query(
  `INSERT INTO recrutamentos2
     (userid, recrutado, status, data_aprovacao, validade, recrutador_id, servidor_origem)
   VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '7 days', $4, $5)
   ON CONFLICT (userid)
   DO UPDATE SET
     recrutado = $2,
     status = $3,
     data_aprovacao = NOW(),
     validade = NOW() + INTERVAL '7 days',
     recrutador_id = $4,
     servidor_origem = $5`,
  [membro.id, true, 'aprovado', message.author.id, message.guild.id]
);

    // Confirmação no canal
    message.reply(`✅ <@${membro.id}> foi aprovado com sucesso!`);

    // =============================
    // LOG NO CANAL
    // =============================
    const logChannel = message.guild.channels.cache.get(IDS.LOG_CHANNEL);
    if (logChannel) {
      logChannel.send(`✅ ${membro.user.tag} foi aprovado por ${message.author.tag}.`);
    }

  } catch (err) {
    console.error("Erro ao aprovar recrutado:", err);
    message.reply("❌ Ocorreu um erro ao aprovar o recrutado.");
  }
}

// =============================
// COMANDO !RECRUTADOS
// =============================
if (message.content === `${PREFIX}recrutados`) {
  try {
    const resultado = await pool.query(
      `SELECT * FROM recrutamentos2
       WHERE status = 'aprovado'
       ORDER BY data_aprovacao DESC`
    );

    if (resultado.rows.length === 0) {
      return message.reply("Nenhum recrutado aprovado no momento.");
    }

    let lista = resultado.rows.map((r, index) => {
      return `${index + 1}. <@${r.userid}> | Recrutador: <@${r.recrutador_id}>`;
    });

    const mensagemFinal = lista.join("\n").slice(0, 1900);

    message.channel.send({
      content: `📋 **Lista de Recrutados Aprovados**\n\n${mensagemFinal}`
    });

  } catch (err) {
    console.error("Erro ao listar recrutados:", err);
    message.reply("❌ Ocorreu um erro ao buscar os recrutados.");
  }
}
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
    await user.roles.add("1468026315285205094");
   
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
   

    return message.reply(`✅ Cargos aliados aplicados em ${user}`);
  } catch (err) {
    console.error(err);
  }
}
  // =============================
  // RECSTATUS
  // =============================
  if (command === "recstatus") {

  try {

    const res = await pool.query(
      "SELECT recrutamentos FROM recrutadores WHERE user_id = $1",
      [message.author.id]
    );

    if (res.rows.length === 0) {
      return message.reply("📊 Você ainda não possui recrutamentos.");
    }

    const quantidade = res.rows[0].recrutamentos;

    const msg = await message.reply(
  `📊 ${message.author.tag}, você possui **${quantidade} recrutamentos**.`
);

setTimeout(() => {
  msg.delete().catch(() => {});
}, MESSAGE_LIFETIME);

return;

  } catch (err) {
    console.error("Erro ao consultar recrutamentos:", err);
    return message.reply("❌ Ocorreu um erro ao consultar seus recrutamentos.");
  }
  }
  // =============================
  // RECAPROVADO
  // =============================
  
  if (command === "recaprovado") {

  const aprovado = message.mentions.members.first();
  if (!aprovado)
    return message.reply("❌ Mencione o usuário aprovado.");

  const ALLOWED_ROLES = ["1468017578747105390","1468069638935150635","1476619364672475278","1476619432838168668","1476619502832713839"];

  if (!message.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id)))
    return message.reply("❌ Sem permissão para usar esse comando.");

  try {

    // Verifica se quem executou já existe na tabela
    const res = await pool.query(
      "SELECT recrutamentos FROM recrutadores WHERE user_id = $1",
      [message.author.id]
    );

    let quantidade = 1;

    if (res.rows.length === 0) {

      await pool.query(
        "INSERT INTO recrutadores (user_id, recrutamentos) VALUES ($1, $2)",
        [message.author.id, quantidade]
      );

    } else {

      quantidade = Number(res.rows[0].recrutamentos) + 1;

      await pool.query(
        "UPDATE recrutadores SET recrutamentos = $1 WHERE user_id = $2",
        [quantidade, message.author.id]
      );
    }

    const msg = await message.reply(
  `✅ Recrutamento aprovado!\n👤 ${message.author.tag} agora tem **${quantidade} recrutamentos**.`
);

setTimeout(() => {
  msg.delete().catch(() => {});
}, MESSAGE_LIFETIME);

return;

  } catch (err) {
    console.error("Erro ao registrar recrutamento:", err);
    return message.reply("❌ Ocorreu um erro ao registrar o recrutamento.");
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
  if (channel.parentId === IDS.TICKET_CATEGORY && 
      Array.isArray(IDS.RECRUITMENT_ROLE)) {

    const mentions = IDS.RECRUITMENT_ROLE
      .map(id => `<@&${id}>`)
      .join(" ");

    await channel.send({ content: mentions });
  }
});

client.login(process.env.TOKEN);

