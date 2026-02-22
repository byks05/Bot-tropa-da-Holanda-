// index.js - Parte 1
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
      entrada BIGINT,
      canal TEXT,
      coins BIGINT DEFAULT 0
    );
  `);
}

createTables().catch(console.error);

// -------------------
// IDs e permissões
// -------------------
const ADM_IDS = ["1468017578747105390", "1468069638935150635"];
const ALLOWED_REC = ["1468017578747105390","1468069638935150635","1468066422490923081"];
const ALLOWED_PONTO = ["1468017578747105390","1468069638935150635","1468026315285205094"];
const CANAL_PROIBIDO = "1474383177689731254";
const CATEGORIA_PONTO = "1474413150441963615";

// -------------------
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
  { id: "1468716461773164739", meta: 48 * 3600000 }
];

// IDs extras
const IDS = {
  TICKET_CATEGORY: "1474366472326222013",
  RECRUITMENT_ROLE: "1472589662144040960",
  LOG_CHANNEL: "1474380000000000000", // exemplo
  STAFF: ["1468017578747105390", "1468069638935150635"]
};

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

// Retorna o cargo atual baseado no tempo acumulado
function getCargoAtual(member) {
  const cargosPossiveis = CARGOS.filter(c => member.roles.cache.has(c.id));
  if (!cargosPossiveis.length) return "Nenhum cargo";
  cargosPossiveis.sort((a, b) => b.meta - a.meta);
  return `<@&${cargosPossiveis[0].id}>`;
}

module.exports = { client, pool, CATEGORIA_PONTO, canUseCommand, parseDuration, getCargoAtual, IDS, CARGOS };
// -------------------
// Evento ready
// -------------------
client.once("ready", async () => {
  console.log(`Bot logado como ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) return console.error("Servidor não encontrado.");

  // Recupera sessões ativas
  const result = await pool.query("SELECT * FROM pontos WHERE ativo = true");
  for (const user of result.rows) {
    try {
      // Verifica se já existe um canal para este usuário na categoria
      let canalExistente = guild.channels.cache.find(
        c => c.parentId === CATEGORIA_PONTO && c.name === `ponto-${user.user_id}`
      );

      if (!canalExistente) {
        // Cria canal único por usuário
        canalExistente = await guild.channels.create({
          name: `ponto-${user.user_id}`,
          type: ChannelType.GuildText,
          parent: CATEGORIA_PONTO,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            {
              id: user.user_id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ]
            }
          ]
        });

        // Atualiza canal_id no banco
        await pool.query("UPDATE pontos SET canal_id = $1 WHERE user_id = $2", [canalExistente.id, user.user_id]);
      }

      // Mensagem de aviso no canal do usuário
      await canalExistente.send("⚠️ Sessão recuperada após reinício do bot.");

      // Opcional: enviar log em canal de logs
      const canalLogs = guild.channels.cache.get(IDS.LOG_CHANNEL);
      if (canalLogs) canalLogs.send(`Sessão do usuário <@${user.user_id}> recuperada após reinício do bot.`);
    } catch (err) {
      console.error("Erro ao recriar canal:", err);
    }
  }
});

// index.js - Parte 2
// =============================
// PAINEL FIXO DE LOJA
// =============================
client.on("ready", async () => {
  console.log(`${client.user.tag} está online!`);

  const canalEmbed = client.channels.cache.get("1474885764990107790"); // Canal do painel fixo
  if (!canalEmbed) return console.error("Canal do painel fixo não encontrado.");

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
-# Compre Apenas com vendedor oficial <@1209478510847197216>, <@910351624189411408> ou atendentes.

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

-# Compre Apenas com o vendedor oficial <@1209478510847197216> , <@910351624189411408> e os atendentes 🚨
`;

  // Apaga mensagens antigas do bot
  const mensagens = await canalEmbed.messages.fetch({ limit: 10 });
  mensagens.forEach(msg => {
    if (msg.author.id === client.user.id) msg.delete().catch(() => {});
  });

  const mensagem = await canalEmbed.send({ content: textoPainel, components: [row] });
  await mensagem.pin().catch(() => {});
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

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const prefix = "thl!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift()?.toLowerCase();

  const userId = message.author.id;
  const guild = message.guild;

  // =============================
  // COMANDO PONTO
  // =============================
  if (command === "ponto") {
    const sub = args[0]?.toLowerCase();

    if (!sub) return message.reply("❌ Use: thl!ponto start/sair/status/registro/reset/loja");

    // -----------------------------
    // START
    // -----------------------------
    if (sub === "entrar") {
      const result = await pool.query("SELECT * FROM pontos WHERE user_id = $1", [userId]);
      let data = result.rows[0];

      if (!data) {
        await pool.query("INSERT INTO pontos (user_id, ativo, entrada) VALUES ($1, true, $2)", [userId, Date.now()]);
        data = { ativo: true };
      }

      if (data.ativo) return message.reply("❌ Você já iniciou ponto.");

      // cria canal temporário
      const canal = await guild.channels.create({
        name: `ponto-${message.author.username}`,
        type: ChannelType.GuildText,
        parent: CATEGORIA_PONTO,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: message.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      await pool.query("UPDATE pontos SET ativo=true, entrada=$1, canal=$2 WHERE user_id=$3", [Date.now(), canal.id, userId]);
      await canal.send(`${message.author} iniciou ponto!`);
      return message.reply(`✅ Ponto iniciado! Canal criado: ${canal}`);
    }

    // -----------------------------
    // SAIR
    // -----------------------------
    if (sub === "sair") {
      const result = await pool.query("SELECT * FROM pontos WHERE user_id=$1", [userId]);
      const data = result.rows[0];
      if (!data || !data.ativo) return message.reply("❌ Você não iniciou ponto.");

      const total = Number(data.total) + (data.entrada ? Date.now() - Number(data.entrada) : 0);
      await pool.query("UPDATE pontos SET total=$1, ativo=false, entrada=NULL, canal=NULL WHERE user_id=$2", [total, userId]);

      if (data.canal) {
        const canal = guild.channels.cache.get(data.canal);
        if (canal) {
          await canal.send("🔴 Ponto finalizado. Canal será fechado.");
          setTimeout(() => canal.delete().catch(() => {}), 3000);
        }
      }

      return message.reply("🔴 Ponto finalizado! Tempo registrado com sucesso.");
    }

    // -----------------------------
    // STATUS
    // -----------------------------
    if (sub === "status") {
      const result = await pool.query("SELECT * FROM pontos WHERE user_id=$1", [userId]);
      const info = result.rows[0];
      if (!info) return message.reply("❌ Nenhum ponto registrado.");

      let total = Number(info.total);
      if (info.ativo && info.entrada) total += Date.now() - Number(info.entrada);

      const horas = Math.floor(total / 3600000);
      const minutos = Math.floor((total % 3600000) / 60000);
      const segundos = Math.floor((total % 60000) / 1000);

      const coins = info.coins || 0;

      const encontrado = CARGOS.find(c => message.member.roles.cache.has(c.id));
      const cargoAtual = encontrado ? `<@&${encontrado.id}>` : "Nenhum";
      const status = info.ativo ? "🟢 Ativo" : "🔴 Inativo";

      return message.reply(`📊 **Seu Status**\nTempo acumulado: ${horas}h ${minutos}m ${segundos}s\nCoins: ${coins} 💰\nStatus: ${status}\nCargo atual: ${cargoAtual}`);
    }

    // -----------------------------
    // REGISTRO
    // -----------------------------
    if (sub === "registro") {
      const ranking = await pool.query("SELECT * FROM pontos ORDER BY total DESC");
      if (ranking.rows.length === 0) return message.reply("❌ Nenhum registro encontrado.");

      let descricao = "";
      let posicao = 1;
      for (const info of ranking.rows) {
        let total = Number(info.total);
        if (info.ativo && info.entrada) total += Date.now() - Number(info.entrada);

        const member = await guild.members.fetch(info.user_id).catch(() => null);
        const encontrado = member ? CARGOS.find(c => member.roles.cache.has(c.id)) : null;
        const cargoAtual = encontrado ? `<@&${encontrado.id}>` : "Nenhum";
        const status = info.ativo ? "🟢" : "🔴";

        const horas = Math.floor(total / 3600000);
        const minutos = Math.floor((total % 3600000) / 60000);

        let medalha = "";
        if (posicao === 1) medalha = "🥇 ";
        else if (posicao === 2) medalha = "🥈 ";
        else if (posicao === 3) medalha = "🥉 ";

        descricao += `**${medalha}${posicao}º** <@${info.user_id}> → ${horas}h ${minutos}m | ${status} | ${cargoAtual}\n`;
        posicao++;
      }

      while (descricao.length > 0) {
        const enviar = descricao.slice(0, 2000);
        descricao = descricao.slice(2000);
        await message.channel.send(enviar);
      }
    }

    // -----------------------------
    // RESET
    // -----------------------------
    if (sub === "reset") {
      if (!canUseCommand(message.member)) return message.reply("❌ Você não tem permissão.");
      await pool.query("UPDATE pontos SET total=0, entrada=CASE WHEN ativo=true THEN $1 ELSE NULL END", [Date.now()]);
      return message.reply("✅ Todas as horas foram resetadas com sucesso!");
    }

    // -----------------------------
    // LOJA
    // -----------------------------
    if (sub === "loja") {
      const embed = new EmbedBuilder()
        .setTitle("🛒 Loja de Produtos")
        .setDescription(
          "**Selecione o produto que deseja comprar digitando `thl!comprar <produto>`:**\n\n" +
          "💎 Robux → 4000 coins\n⚡ Nitro → 2500 coins\n🔨 Ripa → 1700 coins\n👑 Vip → 6000 coins\n👕 Roupa Personalizada → 1400 coins"
        )
        .setColor("Blue");
      const msg = await message.reply({ embeds: [embed] });
      return setTimeout(() => msg.delete().catch(() => {}), 15000);
    }
  }

  // =============================
  // COMANDOS ADDCOINS / ADDTEMPO / CONVERTER / COMPRAR
  // =============================
  if (sub === "addcoins") {
    if (!message.member.roles.cache.some(r => ADM_IDS.includes(r.id))) return message.reply("❌ Sem permissão.");
    const user = message.mentions.members.first();
    const coins = parseInt(args[1]);
    if (!user || isNaN(coins)) return message.reply("❌ Use: thl!addcoins <@usuário> <quantidade>");

    await pool.query("INSERT INTO pontos (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [user.id]);
    await pool.query("UPDATE pontos SET coins=COALESCE(coins,0)+$1 WHERE user_id=$2", [coins, user.id]);
    return message.reply(`✅ Adicionados ${coins} coins para ${user}`);
  }

  if (sub === "addtempo") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("❌ Mencione um usuário válido.");
    const valor = args[1];
    if (!valor) return message.reply("❌ Informe o tempo (ex: 3h ou 45m).");

    let ms = 0;
    if (valor.endsWith("h")) ms = parseInt(valor) * 60 * 60 * 1000;
    else if (valor.endsWith("m")) ms = parseInt(valor) * 60 * 1000;
    else return message.reply("❌ Formato inválido. Use h ou m.");

    await pool.query("INSERT INTO pontos (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [user.id]);
    await pool.query("UPDATE pontos SET total=COALESCE(total,0)+$1 WHERE user_id=$2", [ms, user.id]);
    return message.reply(`✅ ${user} recebeu ${valor} de tempo.`);
  }
  //========
  // Converter
  //========
  if (sub === "converter") {
  const result = await pool.query("SELECT * FROM pontos WHERE user_id=$1", [userId]);
  const info = result.rows[0];
  if (!info) return message.reply("❌ Você não tem tempo registrado para converter.");

  const input = args[0]?.toLowerCase();
  if (!input) return message.reply("❌ Use: thl!converter <quantidade>h/m (ex: 2h ou 30m)");

  let minutos = 0;
  if (input.endsWith("h")) minutos = parseFloat(input.replace("h", "")) * 60;
  else if (input.endsWith("m")) minutos = parseFloat(input.replace("m", ""));
  else return message.reply("❌ Formato inválido. Use h ou m.");

  let total = Number(info.total || 0);
  if (info.ativo && info.entrada) total += Date.now() - Number(info.entrada);
  const totalMin = Math.floor(total / 60000);
  if (minutos > totalMin) return message.reply(`❌ Você só tem ${totalMin} minutos disponíveis.`);

  const ms = minutos * 60000;
  const coins = Math.floor(minutos * (100 / 60));

  // Atualiza total e coins no banco
  await pool.query(
    "UPDATE pontos SET total=total-$1, coins=COALESCE(coins,0)+$2 WHERE user_id=$3",
    [ms, coins, userId]
  );

  // Pega o saldo atualizado direto do banco
  const resultAtualizado = await pool.query("SELECT coins FROM pontos WHERE user_id=$1", [userId]);
  const novoSaldo = Number(resultAtualizado.rows[0].coins);

  return message.reply(`✅ Conversão realizada!
Tempo convertido: ${Math.floor(minutos/60)}h ${Math.floor(minutos%60)}m
Coins recebidos: ${coins} 💰
Novo saldo: ${novoSaldo} 💰`);
}
  //========
  // Removercoins
  //========
  if (sub === "removercoins") {
  // Extrai o ID puro da menção
  const target = args[0];
  const targetId = target?.match(/\d+/)?.[0]; // pega apenas os números
  const quantidade = parseInt(args[1]);

  if (!targetId || isNaN(quantidade))
    return message.reply("❌ Use: thl!removercoins <@user> <quantidade>");

  // Pega o saldo atual do usuário
  const result = await pool.query("SELECT coins FROM pontos WHERE user_id=$1", [targetId]);
  const info = result.rows[0];
  if (!info) return message.reply("❌ Usuário não encontrado ou sem saldo.");

  const saldoAtual = Number(info.coins || 0);
  const novoSaldo = Math.max(saldoAtual - quantidade, 0); // nunca fica negativo

  // Atualiza no banco
  await pool.query("UPDATE pontos SET coins=$1 WHERE user_id=$2", [novoSaldo, targetId]);

  return message.reply(`✅ Foram removidos ${quantidade} 💰 do usuário. Novo saldo: ${novoSaldo} 💰`);
  }
  //========
  // Removertempo
  //========
  if (sub === "removertempo") {
  // Extrai o ID puro da menção
  const target = args[0];
  const targetId = target?.match(/\d+/)?.[0]; // pega apenas os números
  const input = args[1]?.toLowerCase(); // tempo a remover ex: 2h ou 30m

  if (!targetId || !input) 
    return message.reply("❌ Use: thl!removertempo <@user> <quantidade>h/m");

  // Converte para minutos
  let minutos = 0;
  if (input.endsWith("h")) minutos = parseFloat(input.replace("h", "")) * 60;
  else if (input.endsWith("m")) minutos = parseFloat(input.replace("m", ""));
  else return message.reply("❌ Formato inválido. Use h ou m.");

  const msRemover = minutos * 60000; // converte para ms

  // Pega o total atual do usuário
  const result = await pool.query("SELECT total FROM pontos WHERE user_id=$1", [targetId]);
  const info = result.rows[0];
  if (!info) return message.reply("❌ Usuário não encontrado ou sem tempo registrado.");

  const totalAtual = Number(info.total || 0);
  const novoTotal = Math.max(totalAtual - msRemover, 0); // nunca negativo

  // Atualiza no banco
  await pool.query("UPDATE pontos SET total=$1 WHERE user_id=$2", [novoTotal, targetId]);

  const horas = Math.floor(novoTotal / 3600000);
  const minutosRestantes = Math.floor((novoTotal % 3600000) / 60000);

  return message.reply(`✅ Tempo removido: ${Math.floor(minutos/60)}h ${Math.floor(minutos%60)}m\nNovo total de tempo: ${horas}h ${minutosRestantes}m`);
  }
  //========
  // Resetuser
  //========
  if (sub === "resetuser") {
  // Extrai ID puro da menção
  const target = args[0];
  const targetId = target?.match(/\d+/)?.[0];

  if (!targetId) return message.reply("❌ Use: thl!resetuser <@user>");

  // Verifica se o usuário existe no banco
  const result = await pool.query("SELECT * FROM pontos WHERE user_id=$1", [targetId]);
  const info = result.rows[0];
  if (!info) return message.reply("❌ Usuário não encontrado.");

  // Reseta coins e tempo
  await pool.query("UPDATE pontos SET coins=0, total=0, ativo=false, entrada=NULL WHERE user_id=$1", [targetId]);

  return message.reply(`✅ Usuário <@${targetId}> teve todos os dados resetados! Coins e tempo zerados.`);
  }
  //============
  // Fechartodos
  //=============
  if (sub === "fechartodos") {
  // Seleciona todos os usuários ativos
  const result = await pool.query("SELECT user_id, entrada, total, canal_id FROM pontos WHERE ativo=true");
  if (result.rows.length === 0) return message.channel.send("❌ Nenhum usuário com pontos ativos.");

  for (const user of result.rows) {
    const tempoAtual = Number(user.total || 0);
    const tempoSessao = Date.now() - Number(user.entrada || 0);
    const novoTotal = tempoAtual + tempoSessao;

    // Atualiza banco e remove canal_id
    await pool.query(
      "UPDATE pontos SET total=$1, ativo=false, entrada=NULL, canal_id=NULL WHERE user_id=$2",
      [novoTotal, user.user_id]
    );

    // Deleta o canal do usuário
    if (user.canal_id) {
      const canal = message.guild.channels.cache.get(user.canal_id);
      if (canal) {
        try { await canal.delete("Sessão encerrada pelo bot"); } 
        catch (err) { console.error("Erro ao deletar canal:", err); }
      }
    }
  }

  return message.channel.send(`✅ Todas as sessões ativas foram fechadas e os canais correspondentes deletados.`);
  }
  
  //============
  // fechar
  //==========
  if (command === "fechar") {
  const target = args[0];
  const targetId = target?.match(/\d+/)?.[0];
  if (!targetId) return message.channel.send("❌ Use: thl!fechar <@user>");

  // Pega os dados do usuário
  const result = await pool.query("SELECT total, entrada, ativo, canal_id FROM pontos WHERE user_id=$1", [targetId]);
  const info = result.rows[0];
  if (!info) return message.channel.send("❌ Usuário não encontrado.");
  if (!info.ativo || !info.entrada) return message.channel.send("❌ Este usuário não tem sessão ativa.");

  // Calcula o tempo da sessão e atualiza no banco
  const tempoSessao = Date.now() - Number(info.entrada);
  const novoTotal = Number(info.total || 0) + tempoSessao;
  await pool.query(
    "UPDATE pontos SET total=$1, ativo=false, entrada=NULL, canal_id=NULL WHERE user_id=$2",
    [novoTotal, targetId]
  );

  // Deleta o canal do usuário
  if (info.canal_id) {
    const canal = message.guild.channels.cache.get(info.canal_id);
    if (canal) {
      try { await canal.delete("Sessão encerrada pelo bot"); } 
      catch (err) { console.error("Erro ao deletar canal:", err); }
    }
  }

  const minutos = Math.floor(novoTotal / 60000);
  await message.channel.send(`✅ Sessão do usuário <@${targetId}> fechada!\nTempo total acumulado: ${Math.floor(minutos/60)}h ${minutos%60}m`);
  }
  //========
  // Comprar
  //========
  if (command === "comprar") {
    const produtoArg = args[0]?.toLowerCase();
    if (!produtoArg) return message.reply("❌ Use: thl!comprar <produto>");

    const produtos = { robux:{nome:"Robux",preco:4000}, nitro:{nome:"Nitro",preco:2500}, ripa:{nome:"Ripa",preco:1700}, vip:{nome:"Vip",preco:6000}, roupa:{nome:"Roupa Personalizada",preco:1400} };
    const produto = produtos[produtoArg];
    if (!produto) return message.reply("❌ Produto inválido.");

    await pool.query("INSERT INTO pontos (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [userId]);
    const result = await pool.query("SELECT coins FROM pontos WHERE user_id=$1", [userId]);
    const saldo = Number(result.rows[0].coins);
    if (saldo < produto.preco) return message.reply(`❌ Você não tem coins suficientes para ${produto.nome}.`);

    const categoriaId = IDS.TICKET_CATEGORY;
    const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${message.author.username}` && c.parentId === categoriaId);
    if (existingChannel) return message.reply(`❌ Você já possui um ticket aberto: ${existingChannel}`);

    await pool.query("UPDATE pontos SET coins=coins-$1 WHERE user_id=$2", [produto.preco, userId]);

    const channel = await guild.channels.create({
      name: `ticket-${message.author.username}`,
      type: ChannelType.GuildText,
      parent: categoriaId,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: message.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle(`🛒 Ticket de Compra - ${produto.nome}`)
      .setDescription(`${message.author} abriu um ticket para comprar **${produto.nome}**.\nAdmins: <@&${IDS.RECRUITMENT_ROLE}>`)
      .setColor("Green")
      .setTimestamp();

    const fecharButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("fechar_ticket").setLabel("🔒 Fechar Ticket").setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content:`<@&${IDS.RECRUITMENT_ROLE}>`, embeds:[ticketEmbed], components:[fecharButton] });
    return message.reply(`✅ Ticket criado! Confira o canal ${channel}`);
  }
});

// =============================
// FECHAR TICKET
// =============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "fechar_ticket") return;
  if (!interaction.channel.name.startsWith("ticket-")) return interaction.reply({ content:"❌ Este botão só pode ser usado dentro de um ticket.", ephemeral:true });
  await interaction.channel.delete().catch(() => {});
});

// =============================
// MUTE / UNMUTE CHAT
// =============================
async function getMuteRole(guild) {
  let role = guild.roles.cache.find(r => r.name === "Muted");
  if (!role) role = await guild.roles.create({ name:"Muted", permissions:[] });
  return role;
}

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  const prefix = "thl!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift()?.toLowerCase();

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
});

// =============================
// COMANDO REC
// =============================
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

// =============================
// RECUPERA SESSÕES APÓS RESTART
// =============================
client.on("ready", async () => {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const categoriaId = "1468715109722357782"; // ID da categoria para canais de ponto recuperados

  // Garante tabela
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pontos (
      user_id TEXT PRIMARY KEY,
      total BIGINT DEFAULT 0,
      ativo BOOLEAN DEFAULT false,
      entrada BIGINT,
      canal TEXT,
      coins BIGINT DEFAULT 0
    );
  `);

  // Busca todos ativos no banco
  const result = await pool.query("SELECT * FROM pontos WHERE ativo = true");

  for (const user of result.rows) {
    try {
      const canal = await guild.channels.create({
        name: `ponto-recuperado-${user.user_id}`,
        type: ChannelType.GuildText,
        parent: categoriaId,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: user.user_id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ]
      });

      await pool.query("UPDATE pontos SET canal = $1 WHERE user_id = $2", [canal.id, user.user_id]);
      await canal.send("⚠️ Sessão recuperada após reinício do bot.");
    } catch (err) {
      console.log("Erro ao recriar canal:", err);
    }
  }

  console.log(`Bot online como ${client.user.tag}`);
});

// =============================
// Criação da tabela PostgreSQL (garantia extra, sem sobrescrever a anterior)
// =============================
async function criarTabelaPontos() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pontos (
        user_id TEXT PRIMARY KEY,
        total BIGINT DEFAULT 0,
        ativo BOOLEAN DEFAULT false,
        entrada BIGINT,
        canal TEXT,
        coins BIGINT DEFAULT 0
      );
    `);
    console.log("Tabela 'pontos' garantida!");
  } catch (err) {
    console.error("Erro ao criar tabela 'pontos':", err);
  }
}

// Chama a função no start do bot
criarTabelaPontos();
// =============================
// TICKET MENTION AUTOMÁTICO
// =============================
client.on("channelCreate", async (channel) => {
  if (channel.parentId === IDS.TICKET_CATEGORY) {
    channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
  }
});

// =============================
// LOGIN DO BOT
// =============================
client.login(process.env.TOKEN);
