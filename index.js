// =============================
// IMPORTS
// =============================
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
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
// CLIENT
// =============================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
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
  // BATE PONTO
  // =============================
  if (command === "ponto") {
    const ALLOWED_PONTO = [
      "1468017578747105390",
      "1468069638935150635",
      "1468026315285205094"
    ];

    if (!message.member.roles.cache.some(r => ALLOWED_PONTO.includes(r.id)))
      return message.reply("❌ Você não tem permissão para usar este comando.");

    const categoriaId = "1474413150441963615";
    const CANAL_ENTRAR = "1474383177689731254";

    if (!data[userId]) data[userId] = { ativo: false, entrada: null, total: 0, canal: null, notificado: false };

    const sub = args[0]?.toLowerCase();

    // ENTRAR
    if (sub === "entrar") {
      if (message.channel.id !== CANAL_ENTRAR)
        return message.reply("❌ Comandos de ponto só podem ser usados neste canal.");
      if (data[userId].ativo) return message.reply("❌ Você já iniciou seu ponto.");

      data[userId].ativo = true;
      data[userId].entrada = Date.now();
      data[userId].notificado = false;
      saveData(data);

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

      await message.channel.send(`🟢 Ponto iniciado! Canal criado: <#${canal.id}>`);
      await canal.send(`🟢 Ponto iniciado! <@${userId}>`);

      // CONTADOR EM TEMPO REAL
      const intervaloTempo = setInterval(() => {
        if (!data[userId]?.ativo) return clearInterval(intervaloTempo);
        const tempoAtual = Date.now() - data[userId].entrada;
        const horas = Math.floor(tempoAtual / 3600000);
        const minutos = Math.floor((tempoAtual % 3600000) / 60000);
        const segundos = Math.floor((tempoAtual % 60000) / 1000);
        canal.setTopic(`⏱ Tempo ativo: ${horas}h ${minutos}m ${segundos}s`).catch(() => {});
      }, 1000);

      // LEMBRETE 20 MIN
      const intervaloLembrete = setInterval(() => {
        if (!data[userId]?.ativo) return clearInterval(intervaloLembrete);
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

  // ✅ Resposta no canal onde o comando foi usado
  return message.reply(`🔴 Ponto encerrado com sucesso! Tempo total deste ponto: ${Math.floor(tempo / 3600000)}h ${Math.floor((tempo % 3600000) / 60000)}m ${Math.floor((tempo % 60000) / 1000)}s`);
}

    // STATUS
    if (sub === "status") {
      const info = data[userId];
      if (!info) return message.reply("❌ Nenhum ponto registrado para você.");
      let total = info.total;
      if (info.ativo && info.entrada) total += Date.now() - info.entrada;
      const horas = Math.floor(total / 3600000);
      const minutos = Math.floor((total % 3600000) / 60000);
      const segundos = Math.floor((total % 60000) / 1000);
      let cargoAtual = getCargoAtual(message.member, total);
      const status = info.ativo ? "🟢 Ativo" : "🔴 Inativo";
      return message.reply(`📊 **Seu Status**\nTempo acumulado: ${horas}h ${minutos}m ${segundos}s\nStatus: ${status}\nCargo atual: ${cargoAtual}`);
    }

    // REGISTRO
    if (sub === "registro") {
      const ranking = Object.entries(data)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10);
      if (!ranking.length) return message.reply("Nenhum registro encontrado.");
      let texto = "";
      for (const [uid, info] of ranking) {
        let total = info.total;
        if (info.ativo && info.entrada) total += Date.now() - info.entrada;
        const horas = Math.floor(total / 3600000);
        const minutos = Math.floor((total % 3600000) / 60000);
        const segundos = Math.floor((total % 60000) / 1000);
        const member = await message.guild.members.fetch(uid).catch(() => null);
        const cargoAtual = member ? getCargoAtual(member, total) : "Nenhum";
        const status = info.ativo ? "🟢 Ativo" : "🔴 Inativo";
        texto += `<@${uid}> → ${horas}h ${minutos}m ${segundos}s | ${status} | ${cargoAtual}\n`;
      }
      return message.reply(`📊 **Ranking de Atividade – Top 10**\n\n${texto}`);
    }
  }
  // =============================
// RESETAR HORAS DE TODOS
// =============================
if (sub === "reset") {

  // Apenas staff pode usar
  if (!canUseCommand(message.member))
    return message.reply("❌ Você não tem permissão para usar este comando.");

  const data = getData();

  for (const userId in data) {
    data[userId].total = 0;       // reseta total
    data[userId].entrada = data[userId].ativo ? Date.now() : null; // se estiver ativo, começa novo ponto
  }

  saveData(data);

  return message.reply("✅ Todas as horas de todos os usuários foram resetadas com sucesso!");
              }

  // =============================
  // MUTE / UNMUTE
  // =============================
  if (command === "mutechat") {
    const ALLOWED_MUTE = IDS.STAFF; // cargos permitidos
    if (!message.member.roles.cache.some(r => ALLOWED_MUTE.includes(r.id))) return message.reply("❌ Sem permissão.");
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
    const ALLOWED_MUTE = IDS.STAFF;
    if (!message.member.roles.cache.some(r => ALLOWED_MUTE.includes(r.id))) return message.reply("❌ Sem permissão.");
    const user = message.mentions.members.first();
    if (!user) return message.reply("Mencione um usuário válido.");
    const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (muteRole) await user.roles.remove(muteRole);
    message.reply(`${user} foi desmutado.`);
  }

  if (command === "mutecall") {
    const ALLOWED_MUTE = IDS.STAFF;
    if (!message.member.roles.cache.some(r => ALLOWED_MUTE.includes(r.id))) return message.reply("❌ Sem permissão.");
    const user = message.mentions.members.first();
    const duration = parseDuration(args[1]) || 120000;
    if (!user) return message.reply("Mencione um usuário válido.");
    if (!user.voice?.channel) return message.reply("Usuário não está em call.");
    await user.voice.setMute(true);
    setTimeout(() => user.voice.setMute(false).catch(() => {}), duration);
    message.reply(`${user} foi mutado na call.`);
  }

  if (command === "unmutecall") {
    const ALLOWED_MUTE = IDS.STAFF;
    if (!message.member.roles.cache.some(r => ALLOWED_MUTE.includes(r.id))) return message.reply("❌ Sem permissão.");
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
    const ALLOWED_REC = [
      "1468017578747105390",
      "1468069638935150635",
      "1468026315285205094",
      "1468066422490923081"
    ];
    if (!message.member.roles.cache.some(r => ALLOWED_REC.includes(r.id)))
      return message.reply("❌ Sem permissão.");
    const user = message.mentions.members.first();
    if (!user) return message.reply("Mencione um usuário válido.");

    const filteredArgs = args.filter(arg => !arg.includes(user.id));
    const subCommand = filteredArgs[0]?.toLowerCase();
    const secondArg = filteredArgs[1]?.toLowerCase();

    try {
      if (subCommand === "add" && secondArg === "menina") {
        await user.roles.remove("1468024885354959142");
        await user.roles.add([
          "1472223890821611714",
          "1468283328510558208",
          "1468026315285205094"
        ]);
        return message.reply(`Cargos "menina" aplicados em ${user}`);
      }
      if (subCommand === "add") {
        await user.roles.remove("1468024885354959142");
        await user.roles.add([
          "1468283328510558208",
          "1468026315285205094"
        ]);
        return message.reply(`Cargos aplicados em ${user}`);
      }
      return message.reply("Use: thl!rec <@usuário> add ou add menina");
    } catch (err) {
      console.error(err);
      return message.reply("Erro ao executar comando.");
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
