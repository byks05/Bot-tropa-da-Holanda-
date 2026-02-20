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

// =============================
// MUTE ROLE
// =============================
async function getMuteRole(guild) {
  let role = guild.roles.cache.find(r => r.name === "Muted");
  if (!role) {
    role = await guild.roles.create({ name: "Muted", permissions: [] });
  }
  return role;
}

// =============================
// MESSAGE CREATE
// =============================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const content = message.content.toLowerCase();

  // RESPOSTAS AUTOMÁTICAS
  if (content.includes("setamento")) {
    const botMsg = await message.reply(
      "Todas as informações sobre o Setamento estão aqui <#1468020392005337161>"
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
  // BATE PONTO
  // =============================
  if (command === "ponto") {

    const data = getData();
    const userId = message.author.id;

    if (!data[userId]) {
      data[userId] = { ativo: false, entrada: null, total: 0 };
    }

    const sub = args[0]?.toLowerCase();

    if (sub === "entrar") {
      if (data[userId].ativo)
        return message.reply("Você já bateu ponto.");

      data[userId].ativo = true;
      data[userId].entrada = Date.now();
      saveData(data);

      message.reply("🟢 Ponto iniciado.");
    }

    else if (sub === "sair") {
      if (!data[userId].ativo)
        return message.reply("Você não iniciou ponto.");

      const tempo = Date.now() - data[userId].entrada;
      data[userId].total += tempo;
      data[userId].ativo = false;
      data[userId].entrada = null;
      saveData(data);

      message.reply("🔴 Ponto finalizado.");
    }

    else if (sub === "status") {
      const totalHoras = (data[userId].total / 3600000).toFixed(2);
      message.reply(`📊 Total acumulado: ${totalHoras} horas`);
    }

    return;
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

} catch (error) {  
  console.error(error);  
  return message.reply("Erro ao executar comando.");  
}

}

});

  // =============================
  // MUTECHAT
  // =============================
  if (command === "mutechat") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("Mencione um usuário válido.");

    const duration = parseDuration(args[1]) || 120000;
    const muteRole = await getMuteRole(message.guild);

    await user.roles.add(muteRole);
    message.reply(`${user} mutado por ${duration/60000} minutos.`);

    setTimeout(async () => {
      if (user.roles.cache.has(muteRole.id)) {
        await user.roles.remove(muteRole);
      }
    }, duration);
  }

  if (command === "unmutechat") {
    const user = message.mentions.members.first();
    if (!user) return message.reply("Mencione um usuário válido.");

    const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (muteRole) await user.roles.remove(muteRole);

    message.reply(`${user} foi desmutado.`);
  }

});

// =============================
// TICKET
// =============================
client.on("channelCreate", async (channel) => {
  if (channel.type === 0 && channel.parentId === IDS.TICKET_CATEGORY) {
    channel.send(`<@&${IDS.RECRUITMENT_ROLE}>`);
  }
});

client.login(process.env.TOKEN);
