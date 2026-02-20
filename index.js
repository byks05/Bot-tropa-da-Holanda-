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
  // PONTO
  // =============================
  if (command === "ponto") {

    const data = getData();
    const userId = message.author.id;

    if (!data[userId]) {
      data[userId] = {
        ativo: false,
        entrada: null,
        total: 0
      };
    }

    const sub = args[0]?.toLowerCase();

    if (sub === "entrar") {

      if (data[userId].ativo)
        return message.reply("Você já bateu ponto.");

      data[userId].ativo = true;
      data[userId].entrada = Date.now();
      saveData(data);

      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("🟢 Ponto Iniciado")
        .setDescription(`${message.author} iniciou o expediente.`)
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
      sendLog(message.guild, embed);
    }

    else if (sub === "sair") {

      if (!data[userId].ativo)
        return message.reply("Você não iniciou ponto.");

      const tempo = Date.now() - data[userId].entrada;
      data[userId].total += tempo;
      data[userId].ativo = false;
      data[userId].entrada = null;
      saveData(data);

      const horas = (tempo / 3600000).toFixed(2);

      const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("🔴 Ponto Finalizado")
        .setDescription(`${message.author} finalizou o expediente.`)
        .addFields({ name: "Tempo Trabalhado", value: `${horas} horas` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
      sendLog(message.guild, embed);
    }

    else if (sub === "status") {
      const totalHoras = (data[userId].total / 3600000).toFixed(2);
      message.reply(
        `📊 Total acumulado: ${totalHoras} horas\nStatus: ${data[userId].ativo ? "🟢 Em expediente" : "🔴 Fora"}`
      );
    }

    else {
      message.reply("Use: thl!ponto entrar | sair | status");
    }
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
// TICKET MENTION
// =============================
client.on("channelCreate", async (channel) => {
  if (channel.parentId === IDS.TICKET_CATEGORY) {
    channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
  }
});

client.login(process.env.TOKEN);
