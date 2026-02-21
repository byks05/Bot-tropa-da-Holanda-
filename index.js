// =============================
// IMPORTS
// =============================
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder 
} = require("discord.js");

require("dotenv").config();
const fs = require("fs");

// 🔥 NOVO - PostgreSQL
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =============================
// CONFIG
// =============================
const PREFIX = "thl!";

const IDS = {
  STAFF: [
    "1468069638935150635","1468017578747105390"
  ],
  LOG_CHANNEL: "1468722726247338115",
  TICKET_CATEGORY: "1468014890500489447",
  RECRUITMENT_ROLE: "1468024687031484530"
};

// =============================
// SISTEMA BATE PONTO
// =============================
const DATA_FILE = "./pontos.json";

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

function getData() {
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// =============================
// UTILS
// =============================
const parseDuration = (time) => {
  const match = time?.match(/^(\d+)([mh])$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  return unit === "m" ? value * 60000 : value * 3600000;
};

const sendLog = (guild, embed) => {
  const channel = guild.channels.cache.get(IDS.LOG_CHANNEL);
  if (channel) channel.send({ embeds: [embed] });
};

const canUseCommand = (member) => {
  return IDS.STAFF.some(id => member.roles.cache.has(id));
};

async function getMuteRole(guild) {
  let role = guild.roles.cache.find(r => r.name === "Muted");
  if (!role) {
    role = await guild.roles.create({
      name: "Muted",
      permissions: []
    });
  }
  return role;
};

// Lista de cargos e metas
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

// Função para pegar cargo atual com base no tempo
const getCargoAtual = (member, tempoTotal) => {
  const cargosPossiveis = CARGOS.filter(c => member.roles.cache.has(c.id));
  if (!cargosPossiveis.length) return "Nenhum cargo";
  // Pega o cargo com maior meta que o usuário tenha
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

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (!canUseCommand(message.member)) return;

  const data = getData();
  const userId = message.author.id;
  const guild = message.guild;

// =============================
// BATE PONTO COMPLETO
// =============================
if (command === "ponto") {

  const categoriaId = "1474413150441963615"; // categoria dos canais de ponto
  const CANAL_ENTRAR = "1474383177689731254"; // canal onde entrar pode ser usado
  const UP_CHANNEL = "1474366517096218758"; // canal de notificação de apto
  const userId = message.author.id;
  const guild = message.guild;

  // 🔹 Apenas esses cargos podem usar o comando PONTO
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
  // ENTRAR (somente no canal definido)
  // =============================
  if (sub === "entrar") {

    if (message.channel.id !== CANAL_ENTRAR)
      return message.reply("❌ Comandos de ponto só podem ser usados neste canal.");

    if (data[userId].ativo)
      return message.reply("❌ Você já iniciou seu ponto.");

    data[userId].ativo = true;
    data[userId].entrada = Date.now();
    data[userId].notificado = false; // reseta notificação
    saveData(data);

    // cria canal privado
    const canal = await guild.channels.create({
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

    // mensagem no canal de comando mencionando o canal criado
    await message.channel.send(`🟢 Ponto iniciado! Canal criado: <#${canal.id}>`);

    // mensagem no canal privado mencionando o usuário
    await canal.send(`🟢 Ponto iniciado! <@${userId}>`);

    // =============================
    // CONTADOR EM TEMPO REAL
    // =============================
    const intervaloTempo = setInterval(() => {
      if (!data[userId]?.ativo) {
        clearInterval(intervaloTempo);
        clearInterval(intervaloLembrete);
        return;
      }

      const tempoAtual = Date.now() - data[userId].entrada;
      const horas = Math.floor(tempoAtual / 3600000);
      const minutos = Math.floor((tempoAtual % 3600000) / 60000);
      const segundos = Math.floor((tempoAtual % 60000) / 1000);

      canal.setTopic(`⏱ Tempo ativo: ${horas}h ${minutos}m ${segundos}s`).catch(() => {});

    }, 1000);

    // =============================
    // LEMBRETE 20 EM 20 MIN
    // =============================
    const intervaloLembrete = setInterval(() => {
      if (!data[userId]?.ativo) {
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

    return;
  }

 // =============================
// STATUS
// =============================
if (sub === "status") {

  const info = data[userId];
  if (!info) return message.reply("❌ Nenhum ponto registrado para você.");

  let total = info.total;
  if (info.ativo && info.entrada) total += Date.now() - info.entrada;

  const horas = Math.floor(total / 3600000);
  const minutos = Math.floor((total % 3600000) / 60000);
  const segundos = Math.floor((total % 60000) / 1000);

  const member = message.member;

  // lista de cargos de meta
  const cargosMeta = [
    { id: "1468021327129743483", nome: "Cargo 24h #1" },
    { id: "1468021411720335432", nome: "Cargo 24h #2" },
    { id: "1468021554993561661", nome: "Cargo 24h #3" },
    { id: "1468021724598501376", nome: "Cargo 24h #4" },
    { id: "1468021924943888455", nome: "Cargo 24h #5" },
    { id: "1468652058973569078", nome: "Cargo 24h #6" },
    { id: "1474353689723535572", nome: "Cargo 24h #7" },
    { id: "1474353834485612687", nome: "Cargo 24h #8" },
    { id: "1474353946205098097", nome: "Cargo 24h #9" },
    { id: "1474364575297175694", nome: "Cargo 24h #10" },
    { id: "1474364617756250132", nome: "Cargo 24h #11" },
    { id: "1474354117362188350", nome: "Cargo 24h #12" },
    { id: "1474354176816451710", nome: "Cargo 24h #13" },
    { id: "1474354212350726225", nome: "Cargo 24h #14" },
    { id: "1474354265240899727", nome: "Cargo 24h #15" },
    { id: "1474364646629838970", nome: "Cargo 24h #16" },
    { id: "1468026315285205094", nome: "Cargo 24h #17" }
  ];

  let cargoAtual = "Nenhum";
  const encontrado = cargosMeta.find(c => member.roles.cache.has(c.id));
  if (encontrado) cargoAtual = `<@&${encontrado.id}>`;

  const status = info.ativo ? "🟢 Ativo" : "🔴 Inativo";

  return message.reply(`📊 **Seu Status**\nTempo acumulado: ${horas}h ${minutos}m ${segundos}s\nStatus: ${status}\nCargo atual: ${cargoAtual}`);
}
  
  // =============================
// REGISTRO (RANKING) – top 10
// =============================
if (sub === "registro") {

  const data = getData();
  const ranking = Object.entries(data)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10); // top 10

  if (ranking.length === 0) return message.reply("Nenhum registro encontrado.");

  // lista de cargos de meta
  const cargosMeta = [
    { id: "1468021327129743483", nome: "Cargo 24h #1" },
    { id: "1468021411720335432", nome: "Cargo 24h #2" },
    { id: "1468021554993561661", nome: "Cargo 24h #3" },
    { id: "1468021724598501376", nome: "Cargo 24h #4" },
    { id: "1468021924943888455", nome: "Cargo 24h #5" },
    { id: "1468652058973569078", nome: "Cargo 24h #6" },
    { id: "1474353689723535572", nome: "Cargo 24h #7" },
    { id: "1474353834485612687", nome: "Cargo 24h #8" },
    { id: "1474353946205098097", nome: "Cargo 24h #9" },
    { id: "1474364575297175694", nome: "Cargo 24h #10" },
    { id: "1474364617756250132", nome: "Cargo 24h #11" },
    { id: "1474354117362188350", nome: "Cargo 24h #12" },
    { id: "1474354176816451710", nome: "Cargo 24h #13" },
    { id: "1474354212350726225", nome: "Cargo 24h #14" },
    { id: "1474354265240899727", nome: "Cargo 24h #15" },
    { id: "1474364646629838970", nome: "Cargo 24h #16" },
    { id: "1468026315285205094", nome: "Cargo 24h #17" }
  ];

  let texto = "";

  for (const [uid, info] of ranking) {
    let total = info.total;
    if (info.ativo && info.entrada) total += Date.now() - info.entrada;
    const horas = Math.floor(total / 3600000);
    const minutos = Math.floor((total % 3600000) / 60000);
    const segundos = Math.floor((total % 60000) / 1000);

    const member = await message.guild.members.fetch(uid).catch(() => null);
    let cargoAtual = "Nenhum";
    if (member) {
      const encontrado = cargosMeta.find(c => member.roles.cache.has(c.id));
      if (encontrado) cargoAtual = `<@&${encontrado.id}>`;
    }

    const status = info.ativo ? "🟢 Ativo" : "🔴 Inativo";

    texto += `<@${uid}> → ${horas}h ${minutos}m ${segundos}s | ${status} | ${cargoAtual}\n`;
  }

  return message.reply(`📊 **Ranking de Atividade – Top 10**\n\n${texto}`);
}
  
// =============================
// MUTE / UNMUTE
// =============================
if (command === "mutechat") {
  const user = message.mentions.members.first();
  const duration = parseDuration(args[1]) || 120000;
  const motivo = args.slice(2).join(" ") || "Sem motivo";
  if (!user) return message.reply("Mencione um usuário válido.");
  const muteRole = await getMuteRole(message.guild);
  await user.roles.add(muteRole);
  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado (Chat)")
    .setDescription(`${user} foi mutado`)
    .addFields(
      { name: "Motivo", value: motivo },
      { name: "Tempo", value: `${duration / 60000} minutos` }
    )
    .setTimestamp();
  message.channel.send({ embeds: [embed] });
  sendLog(message.guild, embed);
  setTimeout(async () => {
    if (user.roles.cache.has(muteRole.id)) await user.roles.remove(muteRole);
  }, duration);
}

if (command === "unmutechat") {
  const user = message.mentions.members.first();
  if (!user) return message.reply("Mencione um usuário válido.");
  const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
  if (muteRole) await user.roles.remove(muteRole);
  message.reply(`${user} foi desmutado.`);
}

if (command === "mutecall") {
  const user = message.mentions.members.first();
  const duration = parseDuration(args[1]) || 120000;
  if (!user) return message.reply("Mencione um usuário válido.");
  if (!user.voice?.channel) return message.reply("Usuário não está em call.");
  await user.voice.setMute(true);
  setTimeout(() => user.voice.setMute(false).catch(() => {}), duration);
  message.reply(`${user} foi mutado na call.`);
}

if (command === "unmutecall") {
  const user = message.mentions.members.first();
  if (!user) return message.reply("Mencione um usuário válido.");
  if (!user.voice?.channel) return message.reply("Usuário não está em call.");
  await user.voice.setMute(false);
  message.reply(`${user} foi desmutado na call.`);
}

// =============================
// REC
// =============================
if (command === "rec") {
  const user = message.mentions.members.first();
  if (!user) return message.reply("Mencione um usuário válido.");

  const ALLOWED_REC = [
    "1468017578747105390",
    "1468069638935150635",
    "1468026315285205094",
    "1468066422490923081" // cargo que só pode usar rec
  ];

  if (!message.member.roles.cache.some(r => ALLOWED_REC.includes(r.id))) {
    return message.reply("❌ Você não tem permissão para usar este comando.");
  }

  const filteredArgs = args.filter(arg => !arg.includes(user.id));
  const subCommand = filteredArgs[0]?.toLowerCase();
  const secondArg = filteredArgs[1]?.toLowerCase();

  try {
    // REC ADD MENINA
    if (subCommand === "add" && secondArg === "menina") {
      await user.roles.remove("1468024885354959142");

      await user.roles.add([
        "1472223890821611714",
        "1468283328510558208",
        "1468026315285205094"
      ]);

      return message.reply(`Cargos "menina" aplicados em ${user}`);
    }

    // REC ADD NORMAL
    if (subCommand === "add") {
      await user.roles.remove("1468024885354959142");

      await user.roles.add([
        "1468283328510558208",
        "1468026315285205094"
      ]);

      return message.reply(`Cargos aplicados em ${user}`);
    }

    return message.reply("Use: thl!rec <@usuário> add ou add menina");

  } catch (error) {
    console.error(error);
    return message.reply("Erro ao executar comando.");
  }
}
  
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
