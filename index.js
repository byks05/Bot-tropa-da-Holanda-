const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
require("dotenv").config();

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
// CONFIGURAÇÃO
// =============================
const PREFIX = "thl!";
const STAFF_ROLE_IDS = ["1468070328138858710","1468069942451507221","1468069638935150635","1468017578747105390"];
const CARGO_ESPECIAL = "1468066422490923081";

const CATEGORIAS = [
  { label: "Inicial", options: [{ label: "Equipe Tropa da Holanda", id: "1468026315285205094" },{ label: "Verificado", id: "1468283328510558208" }] },
  { label: "Aliados", options: [{ label: "Aliados", id: "1468279104624398509" }] }
];

const MAX_HOURS=999, SPAM_MESSAGE_LIMIT=5, SPAM_MESSAGE_INTERVAL=5000, BIG_TEXT_LIMIT=200, BIG_TEXT_COUNT=3, MUTE_DURATION=2*60*1000;
const LOG_CHANNEL_ID = "1468722726247338115";

// =============================
// UTILS
// =============================
const sendLog = (guild, embed) => guild.channels.cache.get(LOG_CHANNEL_ID)?.send({ embeds: [embed] });

const parseDuration = time => {
  const m = time?.match(/^(\d+)([mh])$/);
  if(!m) return null;
  const [_, v, u] = m;
  if(u==="m") return parseInt(v)*60000;
  if(u==="h") return parseInt(v)*3600000;
  return null;
};

const canUseCommand = (member, cmd) => {
  const isStaff = STAFF_ROLE_IDS.some(id => member.roles.cache.has(id));
  const isEspecial = member.roles.cache.has(CARGO_ESPECIAL);
  return isStaff || (isEspecial && ["setarcargo","removercargo"].includes(cmd));
};

// =============================
// SPAM
// =============================
const messageHistory = new Map(), bigMessageHistory = new Map();
async function handleSpam(message){
  if(!message.guild||message.author.bot) return;
  const isStaff = STAFF_ROLE_IDS.some(id=>message.member.roles.cache.has(id));
  const isEspecial = message.member.roles.cache.has(CARGO_ESPECIAL);
  if(isStaff||isEspecial) return;

  const now = Date.now(), userId = message.author.id;

  if(message.content.length>=BIG_TEXT_LIMIT){
    if(!bigMessageHistory.has(userId)) bigMessageHistory.set(userId, []);
    const arr=bigMessageHistory.get(userId); arr.push(now); while(arr.length>BIG_TEXT_COUNT) arr.shift(); bigMessageHistory.set(userId, arr);
    if(arr.length>=BIG_TEXT_COUNT){ await muteMember(message.member,"Spam de texto grande",message); bigMessageHistory.set(userId,[]); }
  }

  if(!messageHistory.has(userId)) messageHistory.set(userId,[]);
  const msgs=messageHistory.get(userId); msgs.push(now);
  const filtered=msgs.filter(t=>now-t<=SPAM_MESSAGE_INTERVAL);
  messageHistory.set(userId,filtered);
  if(filtered.length>=SPAM_MESSAGE_LIMIT){ await muteMember(message.member,"Spam de palavras rápidas",message); messageHistory.set(userId,[]); }
}

// =============================
// MUTE / UNMUTE
// =============================
async function muteMember(member,motivo,msg=null){
  let muteRole=member.guild.roles.cache.find(r=>r.name==="Muted");
  if(!muteRole) muteRole=await member.guild.roles.create({ name:"Muted", permissions:[] });
  await member.roles.add(muteRole);

  const embed=new EmbedBuilder().setColor("Red").setTitle("🔇 Usuário Mutado").setDescription(`${member} foi mutado automaticamente`).addFields(
    { name:"🆔 ID", value:member.id },
    { name:"⏳ Tempo", value:"2 minutos" },
    { name:"📄 Motivo", value:motivo },
    { name:"👮 Staff", value: msg?msg.client.user.tag:"Sistema" }
  ).setThumbnail(member.user.displayAvatarURL({dynamic:true})).setFooter({text:member.guild.name}).setTimestamp();

  if(msg) await msg.channel.send({embeds:[embed]});
  sendLog(member.guild,embed);

  setTimeout(()=>{ if(member.roles.cache.has(muteRole.id)) member.roles.remove(muteRole); }, MUTE_DURATION);
}

async function unmuteMember(member,msg=null){
  const muteRole=member.guild.roles.cache.find(r=>r.name==="Muted");
  if(!muteRole) return;
  if(member.roles.cache.has(muteRole.id)) {
    await member.roles.remove(muteRole);
    const embed=new EmbedBuilder().setColor("Green").setTitle("🔊 Usuário Desmutado").setDescription(`${member} foi desmutado`).addFields(
      {name:"🆔 ID", value:member.id}, {name:"👮 Staff", value: msg?msg.author.tag:"Sistema"}
    ).setThumbnail(member.user.displayAvatarURL({dynamic:true})).setFooter({text:member.guild.name}).setTimestamp();
    if(msg) await msg.channel.send({embeds:[embed]});
    sendLog(member.guild,embed);
  }
}

async function unmuteCall(member,msg=null){
  if(!member.voice.channel) return; await member.voice.setMute(false);
  const embed=new EmbedBuilder().setColor("Green").setTitle("🎙 Usuário Desmutado na Call").setDescription(`${member} foi desmutado na call`).addFields(
    {name:"🆔 ID", value:member.id}, {name:"👮 Staff", value: msg?msg.author.tag:"Sistema"}
  ).setThumbnail(member.user.displayAvatarURL({dynamic:true})).setFooter({text:member.guild.name}).setTimestamp();
  if(msg) await msg.channel.send({embeds:[embed]}); sendLog(member.guild,embed);
}

// =============================
// EVENTO DE MENSAGEM
// =============================
client.on("messageCreate", async message=>{
  if(!message.guild||message.author.bot) return;

  // PALAVRAS-CHAVE
  const palavras = [
    {regex:/\bsetamento\b/i, msg:"Confira o canal <#1468020392005337161>", cor:"Blue"},
    {regex:/\bfaixa rosa\b/i, msg:"Servidor das Faixas Rosa da Tropa da Holanda. Somente meninas: https://discord.gg/seaaSXG5yJ", cor:"Pink"},
    {regex:/\bfaixas rosa\b/i, msg:"Servidor das Faixas Rosa da Tropa da Holanda. Somente meninas: https://discord.gg/seaaSXG5yJ", cor:"Pink"}
  ];

  for(const p of palavras){
    if(p.regex.test(message.content)){
      try{
        const msgSent = await message.channel.send(p.msg);
        setTimeout(async()=>await msgSent.delete().catch(()=>{}),15000);
        sendLog(message.guild,new EmbedBuilder().setColor(p.cor).setTitle("📌 Palavra Detectada").setDescription(`${message.author} digitou "${p.regex.source.replace(/\\b/g,"")}"`).setTimestamp());
      }catch(e){console.error(e);}
    }
  }

  await handleSpam(message);

  if(!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const member = message.mentions.members.first();

  if(!canUseCommand(message.member,cmd))
    return message.reply("Você não tem permissão para usar este comando.").then(m=>setTimeout(async()=>await m.delete().catch(()=>{}),5000));

  // MUTE / UNMUTE
  if(["mutechat","mutecall","unmutechat","unmutecall"].includes(cmd) && member){
    const timeArg=args[0], motivo=args.slice(1).join(" ")||"Não informado", duration=parseDuration(timeArg);
    if(cmd==="mutechat") await muteMember(member,motivo,message);
    if(cmd==="mutecall"){
      if(!member.voice.channel) return message.reply("O usuário não está em call.").then(m=>setTimeout(async()=>await m.delete().catch(()=>{}),5000));
      await member.voice.setMute(true);
      const embed=new EmbedBuilder().setColor("Orange").setTitle("🎙 Usuário Mutado na Call").setDescription(`${member} foi silenciado na call`).addFields(
        {name:"🆔 ID", value:member.id},{name:"⏳ Tempo", value:timeArg},{name:"📄 Motivo", value:motivo},{name:"👮 Staff", value:message.author.tag}
      ).setThumbnail(member.user.displayAvatarURL({dynamic:true})).setFooter({text:message.guild.name}).setTimestamp();
      const msgSent=await message.reply({embeds:[embed]});
      sendLog(message.guild,embed);
      setTimeout(async()=>await msgSent.delete().catch(()=>{}),5000);
      setTimeout(async()=>{ if(member.voice.serverMute) await member.voice.setMute(false); },duration);
    }
    if(cmd==="unmutechat") await unmuteMember(member,message);
    if(cmd==="unmutecall") await unmuteCall(member,message);
  }
});

// =============================
// MENÇÃO AUTOMÁTICA EM TICKETS
// =============================
const TICKET_CATEGORY_ID = "1468014890500489447"; // Categoria de recrutamento
const RECRUITMENT_ROLE_ID = "1468024687031484530"; // Cargo a ser mencionado

client.on("channelCreate", async channel => {
  if(channel.type === 0 && channel.parentId === TICKET_CATEGORY_ID){
    if(channel.name.toLowerCase().includes("ticket")){
      try{
        await channel.send(`<@&${RECRUITMENT_ROLE_ID}> Um recrutador entrou no seu ticket!`);
        sendLog(channel.guild,new EmbedBuilder().setColor("Purple").setTitle("📌 Ticket Criado").setDescription(`O canal ${channel} foi criado e o cargo <@&${RECRUITMENT_ROLE_ID}> foi mencionado.`).setTimestamp());
      }catch(e){console.error(e);}
    }
  }
});

// =============================
// READY
// =============================
client.once("ready",()=>{ console.log(`Bot online! ${client.user.tag}`); client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda",{type:"WATCHING"}); });

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);
