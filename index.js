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
    "1468017578747105390",
    "1468069638935150635",
    "1468066422490923081"
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
}

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

// =============================
// BATE PONTO COMPLETO FINAL
// =============================
if (command === "ponto") {

  const AUTORIZED_ROLES = [
    "1468021327129743483","1468021411720335432","1468021554993561661",
    "1468021724598501376","1468021924943888455","1468652058973569078",
    "1474353689723535572","1474353834485612687","1474353946205098097",
    "1474364575297175694","1474364617756250132","1474354117362188350",
    "1474354176816451710","1474354212350726225","1474354265240899727",
    "1474364646629838970","1468026315285205094"
  ];

  const STAFF_ROLES = [
    "1468017578747105390",
    "1468069638935150635",
    "1468066422490923081"
  ];

  const COMMAND_CHANNEL = "1474383177689731254"; // canal onde os comandos podem ser usados
  const UP_CHANNEL = "1474366517096218758"; // canal de notificação de apto
  const CATEGORIA_ID = "1474366472326222013"; // categoria dos canais de ponto

  const guild = message.guild;
  const userId = message.author.id;

  if (message.channel.id !== COMMAND_CHANNEL) {
    return message.reply("❌ Comandos de ponto só podem ser usados neste canal.")
                  .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
  }

  // checagem de permissão para entrar/sair/status
  if (!message.member.roles.cache.some(r => AUTORIZED_ROLES.includes(r.id))) {
    return message.reply("❌ Você não tem permissão para usar este comando.")
                  .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
  }

  const data = getData();
  if (!data[userId]) {
    data[userId] = { ativo: false, entrada: null, total: 0, canal: null, notificado: false };
  }

  const sub = args[0]?.toLowerCase();

  // =============================
  // ENTRAR
  // =============================
  if (sub === "entrar") {

    if (data[userId].ativo)
      return message.reply("❌ Você já iniciou seu ponto.")
                    .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));

    data[userId].ativo = true;
    data[userId].entrada = Date.now();
    saveData(data);

    // cria canal privado
    const canal = await guild.channels.create({
      name: `ponto-${message.author.username}`,
      type: 0,
      parent: CATEGORIA_ID,
      permissionOverwrites: [
        { id: guild.id, deny: ["ViewChannel"] },
        { id: userId, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }
      ]
    });

    data[userId].canal = canal.id;
    saveData(data);

    // menciona o canal no chat
    const aviso = await message.reply(`🟢 Ponto iniciado! Canal privado: <#${canal.id}>`);
    setTimeout(() => aviso.delete().catch(() => {}), 30000);
    setTimeout(() => message.delete().catch(() => {}), 30000);

    // CONTADOR EM TEMPO REAL + notificação de apto
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

      const totalAcumulado = data[userId].total + tempoAtual;
      if (!data[userId].notificado && totalAcumulado >= 1.5 * 3600000) { // 1h30m
        const upChannel = guild.channels.cache.get(UP_CHANNEL);
        if (upChannel) {
          upChannel.send(`@everyone <@${userId}> bateu 1h30m e já pode receber o próximo cargo!`);
          data[userId].notificado = true;
          saveData(data);
        }
      }

    }, 1000);

    // LEMBRETE 20 EM 20 MIN
    const intervaloLembrete = setInterval(() => {
      if (!data[userId]?.ativo) {
        clearInterval(intervaloLembrete);
        return;
      }
      canal.send(`⏰ <@${userId}> lembrete: use **thl!ponto status** para verificar seu tempo acumulado.`)
           .catch(() => {});
    }, 20 * 60 * 1000);

    return;
  }

  // =============================
  // SAIR
  // =============================
  if (sub === "fechar") {
    if (!data[userId].ativo)
      return message.reply("❌ Você não iniciou ponto.")
                    .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));

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
    let total = data[userId].total;
    if (data[userId].ativo && data[userId].entrada) {
      total += Date.now() - data[userId].entrada;
    }
    const horas = Math.floor(total / 3600000);
    const minutos = Math.floor((total % 3600000) / 60000);
    const segundos = Math.floor((total % 60000) / 1000);
    return message.reply(`📊 Tempo acumulado: ${horas}h ${minutos}m ${segundos}s`)
                  .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
  }

  // =============================
  // REGISTRO (RANKING) – somente staff
  // =============================
  if (sub === "registro") {

    if (!message.member.roles.cache.some(r => STAFF_ROLES.includes(r.id))) {
      return message.reply("❌ Apenas staff pode ver o registro.")
                    .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
    }

    const ranking = Object.entries(data).sort((a, b) => b[1].total - a[1].total);
    if (ranking.length === 0) return message.reply("Nenhum registro encontrado.");

    let texto = "";
    for (const [uid, info] of ranking) {
      let total = info.total;
      if (info.ativo && info.entrada) total += Date.now() - info.entrada;
      const horas = Math.floor(total / 3600000);
      const minutos = Math.floor((total % 3600000) / 60000);
      const segundos = Math.floor((total % 60000) / 1000);
      texto += `<@${uid}> → ${horas}h ${minutos}m ${segundos}s\n`;
    }

    return message.reply(`📊 **Ranking de Atividade**\n\n${texto}`)
                  .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
  }

}  

  // =============================
// RESET GERAL – somente staff
// =============================
if (sub === "resetartodos") {

  // checagem de permissão por cargo
  const STAFF_ROLES = [
    "1468017578747105390",
    "1468069638935150635",
    "1468066422490923081"
  ];

  if (!message.member.roles.cache.some(r => STAFF_ROLES.includes(r.id))) {
    return message.reply("❌ Apenas staff pode resetar todos os pontos.")
                  .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
  }

  for (const uid in data) {
    data[uid] = { ativo: false, entrada: null, total: 0, canal: null, notificado: false };
  }
  saveData(data);

  return message.reply("✅ Todos os pontos foram resetados com sucesso.")
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
}
  
  
  // =============================
  // MUTECHAT
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
      if (user.roles.cache.has(muteRole.id)) {
        await user.roles.remove(muteRole);
      }
    }, duration);
  }

  // =============================
  // UNMUTECHAT
  // =============================
  if (command === "unmutechat") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("Mencione um usuário válido.");

    const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (muteRole) await user.roles.remove(muteRole);

    message.reply(`${user} foi desmutado.`);
  }

  // =============================
  // MUTECALL
  // =============================
  if (command === "mutecall") {

    const user = message.mentions.members.first();
    const duration = parseDuration(args[1]) || 120000;

    if (!user) return message.reply("Mencione um usuário válido.");
    if (!user.voice?.channel) return message.reply("Usuário não está em call.");

    await user.voice.setMute(true);

    setTimeout(() => {
      user.voice.setMute(false).catch(() => {});
    }, duration);

    message.reply(`${user} foi mutado na call.`);
  }

  // =============================
  // UNMUTECALL
  // =============================
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
            {
              id: guild.id,
              deny: ["ViewChannel"]
            },
            {
              id: userId,
              allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
            }
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
