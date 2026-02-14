const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents:[
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
const LOG_CHANNEL_ID = "1468722726247338115";
const RULES_CHANNEL_ID = "1468011045166518427";
const TICKET_CATEGORY_ID = "1468014890500489447";
const RECRUITMENT_ROLE_ID = "1468024687031484530";

const CATEGORIAS = [
  {
    label:"Faixa Rosas (Somente Meninas)",
    options:[
      {label:"Equipe Tropa da Holanda", id:"1468026315285205094"},
      {label:"Verificado", id:"1468283328510558208"}
    ],
    maxSelect:null, 
    allowAll:true
  },
  {
    label:"TropaDaHolanda",
    options:[
      {label:"Membro Ativo", id:"1468022534686507028"},
      {label:"Dono do Paredão", id:"1468263594931130574"},
      {label:"Aliados", id:"1468279104624398509"}
    ],
    maxSelect:null,
    allowAll:false
  }
];

// =============================
// UTILS
// =============================
const parseDuration = t=>{
  const m=t?.match(/^(\d+)([mh])$/); if(!m) return null;
  const [_,v,u]=m;
  if(u==="m") return parseInt(v)*60000;
  if(u==="h") return parseInt(v)*3600000;
  return null;
};

const sendLog = (guild, embed) => guild.channels.cache.get(LOG_CHANNEL_ID)?.send({embeds:[embed]});
const canUseCommand=(m,c)=> STAFF_ROLE_IDS.some(id=>m.roles.cache.has(id))||(m.roles.cache.has(CARGO_ESPECIAL)&&["setarcargo","removercargo"].includes(c));

// =============================
// SPAM
// =============================
const messageHistory=new Map(), bigMessageHistory=new Map();
async function handleSpam(message){
  if(!message.guild||message.author.bot) return;
  const isStaff = STAFF_ROLE_IDS.some(id=>message.member.roles.cache.has(id));
  const isEspecial = message.member.roles.cache.has(CARGO_ESPECIAL);
  if(isStaff||isEspecial) return;

  const now=Date.now(), userId=message.author.id;

  if(message.content.length>=200){
    if(!bigMessageHistory.has(userId)) bigMessageHistory.set(userId,[]);
    const arr=bigMessageHistory.get(userId); arr.push(now); while(arr.length>3) arr.shift(); bigMessageHistory.set(userId,arr);
    if(arr.length>=3){ await muteMember(message.member,"Spam de texto grande",message); bigMessageHistory.set(userId,[]); }
  }

  if(!messageHistory.has(userId)) messageHistory.set(userId,[]);
  const msgs=messageHistory.get(userId); msgs.push(now);
  const filtered=msgs.filter(t=>now-t<=5000);
  messageHistory.set(userId,filtered);
  if(filtered.length>=5){ await muteMember(message.member,"Spam de palavras rápidas",message); messageHistory.set(userId,[]); }
}

// =============================
// MUTE / UNMUTE
// =============================
async function muteMember(member,motivo,msg=null){
  let muteRole=member.guild.roles.cache.find(r=>r.name==="Muted");
  if(!muteRole) muteRole=await member.guild.roles.create({name:"Muted",permissions:[]});
  await member.roles.add(muteRole);

  const embed=new EmbedBuilder().setColor("Red").setTitle("🔇 Usuário Mutado")
    .setDescription(`${member} foi mutado automaticamente`)
    .addFields(
      {name:"🆔 ID",value:member.id},
      {name:"⏳ Tempo",value:"2 minutos"},
      {name:"📄 Motivo",value:motivo},
      {name:"👮 Staff",value:msg?msg.client.user.tag:"Sistema"}
    ).setThumbnail(member.user.displayAvatarURL({dynamic:true})).setFooter({text:member.guild.name}).setTimestamp();

  if(msg) await msg.channel.send({embeds:[embed]});
  sendLog(member.guild,embed);

  setTimeout(()=>{if(member.roles.cache.has(muteRole.id)) member.roles.remove(muteRole);},2*60*1000);
}

async function unmuteMember(member,msg=null){
  const muteRole=member.guild.roles.cache.find(r=>r.name==="Muted");
  if(!muteRole) return;
  if(member.roles.cache.has(muteRole.id)){
    await member.roles.remove(muteRole);
    const embed=new EmbedBuilder().setColor("Green").setTitle("🔊 Usuário Desmutado")
      .setDescription(`${member} foi desmutado`)
      .addFields({name:"🆔 ID",value:member.id},{name:"👮 Staff",value:msg?msg.author.tag:"Sistema"})
      .setThumbnail(member.user.displayAvatarURL({dynamic:true})).setFooter({text:member.guild.name}).setTimestamp();
    if(msg) await msg.channel.send({embeds:[embed]});
    sendLog(member.guild,embed);
  }
}

async function unmuteCall(member,msg=null){
  if(!member.voice.channel) return; await member.voice.setMute(false);
  const embed=new EmbedBuilder().setColor("Green").setTitle("🎙 Usuário Desmutado na Call")
    .setDescription(`${member} foi desmutado na call`)
    .addFields({name:"🆔 ID",value:member.id},{name:"👮 Staff",value:msg?msg.author.tag:"Sistema"})
    .setThumbnail(member.user.displayAvatarURL({dynamic:true})).setFooter({text:member.guild.name}).setTimestamp();
  if(msg) await msg.channel.send({embeds:[embed]}); sendLog(member.guild,embed);
}

// =============================
// MENSAGENS
// =============================
client.on("messageCreate", async message=>{
  if(!message.guild||message.author.bot) return;

  // PALAVRAS-CHAVE
  const palavras=[
    {regex:/\bsetamento\b/i, msg:"Confira o canal <#1468020392005337161>", cor:"Blue", deleteTime:30000},
    {regex:/\bfaixa rosa\b/i, msg:"Servidor das Faixas Rosa da Tropa da Holanda. Somente meninas: https://discord.gg/seaaSXG5yJ", cor:"Pink", deleteTime:15000},
    {regex:/\bfaixas rosa\b/i, msg:"Servidor das Faixas Rosa da Tropa da Holanda. Somente meninas: https://discord.gg/seaaSXG5yJ", cor:"Pink", deleteTime:15000},
    {regex:/\bregras\b/i, msg:`<#${RULES_CHANNEL_ID}>`, cor:"Yellow", deleteTime:300000}
  ];

  for(const p of palavras){
    if(p.regex.test(message.content)){
      try{
        const msgSent=await message.channel.send(p.msg);
        setTimeout(async()=>await msgSent.delete().catch(()=>{}), p.deleteTime);
        sendLog(message.guild,new EmbedBuilder()
          .setColor(p.cor)
          .setTitle("📌 Palavra Detectada")
          .setDescription(`${message.author} digitou "${p.regex.source.replace(/\\b/g,"")}"`)
          .setTimestamp()
        );
      }catch(e){console.error(e);}
    }
  }

  // SPAM
  await handleSpam(message);

  // ===== COMANDOS SETAR / REMOVER CARGOS =====
  if(!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const member = message.mentions.members.first();
  if(!member) return;

  if(cmd === "setarcargo" || cmd === "removercargo"){
    if(!canUseCommand(message.member, cmd)){
      const m = await message.reply("Você não tem permissão para usar este comando.");
      return setTimeout(()=>m.delete().catch(()=>{}),5000);
    }

    if(cmd === "setarcargo"){
      const row = new ActionRowBuilder();
      for(const cat of CATEGORIAS){
        row.addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`select_${member.id}_${cat.label}_${message.author.id}`)
            .setPlaceholder(`Selecione cargos: ${cat.label}`)
            .setMinValues(1)
            .setMaxValues(cat.maxSelect||cat.options.length)
            .addOptions(cat.options.map(o=>({label:o.label, value:o.id})))
        );
      }

      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("✅ Setar Cargos")
        .setDescription(`Selecione os cargos que deseja adicionar para ${member}`);

      return message.reply({embeds:[embed], components:[row]});
    }

    if(cmd === "removercargo"){
      const userRoles = member.roles.cache.filter(r => r.id !== message.guild.id);
      if(!userRoles.size) return message.reply("Este usuário não possui cargos.").then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000));

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`removercargo_${member.id}_${message.author.id}`)
          .setPlaceholder("Selecione os cargos para remover")
          .setMinValues(1)
          .setMaxValues(userRoles.size)
          .addOptions(userRoles.map(r => ({label:r.name, value:r.id})))
      );

      const embed = new EmbedBuilder()
        .setColor("Orange")
        .setTitle("🗑 Remover Cargos")
        .setDescription(`Selecione os cargos que deseja remover de ${member}`);

      return message.reply({embeds:[embed], components:[row]});
    }
  }
});

// =============================
// TICKET MENTION
// =============================
client.on("channelCreate", async channel=>{
  if(channel.type===0 && channel.parentId===TICKET_CATEGORY_ID && channel.name.toLowerCase().includes("ticket")){
    await channel.send(`<@&${RECRUITMENT_ROLE_ID}>`);
  }
});

// =============================
// INTERAÇÕES (BOTÕES E SELECT MENUS)
// =============================
client.on("interactionCreate", async interaction=>{
  if(!interaction.isStringSelectMenu()) return;

  const parts = interaction.customId.split("_"); 
  const userId = parts[1], menuName = parts[2], executorId = parts[3];
  const member = await interaction.guild.members.fetch(userId).catch(()=>null);
  if(!member) return;
  const executor = await interaction.guild.members.fetch(executorId).catch(()=>null);

  // ===== SETAR CARGOS =====
  if(menuName === "Membros" || menuName === "TropaDaHolanda"){
    if(menuName === "TropaDaHolanda" && !STAFF_ROLE_IDS.some(id => executor.roles.cache.has(id)))
      return interaction.reply({content:"Você não pode selecionar cargos nessa categoria.", ephemeral:true});

    for(const cid of interaction.values){
      const role = interaction.guild.roles.cache.get(cid);
      if(role && !member.roles.cache.has(cid)) await member.roles.add(role);
    }

    await interaction.update({content:`✅ Cargos adicionados para ${member}`, embeds:[], components:[]});

    if(executor) sendLog(interaction.guild, new EmbedBuilder()
      .setColor(menuName==="Membros"?"Blue":"Orange")
      .setTitle("📌 Comando Executado")
      .setDescription(`${executor} executou setarcargo em ${member}`)
      .setTimestamp()
    );
  }

  // ===== REMOVER CARGOS =====
  if(menuName === "removercargo"){
    for(const cid of interaction.values){
      if(member.roles.cache.has(cid)) await member.roles.remove(cid);
    }

    await interaction.update({content:`🗑 Cargos removidos de ${member}`, embeds:[], components:[]});

    if(executor) sendLog(interaction.guild, new EmbedBuilder()
      .setColor("Orange")
      .setTitle("📌 Comando Executado")
      .setDescription(`${executor} executou removercargo em ${member}`)
      .setTimestamp()
    );
  }
});

// =============================
// READY
// =============================
client.once("ready",()=>{console.log(`Bot online! ${client.user.tag}`); client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda",{type:"WATCHING"});});

// =============================
// LOGIN
// =============================
client.login(process.env.TOKEN);
