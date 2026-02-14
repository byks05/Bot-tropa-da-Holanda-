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
    label:"Membros",
    options:[
      {label:"Faixa Rosas (Somente Meninas)", id:"1472223890821611714"},
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

  if(!message.content.startsWith(PREFIX)) return;
  const args=message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd=args.shift().toLowerCase();
  const member=message.mentions.members.first();

  if(!canUseCommand(message.member,cmd)){
    try{const m=await message.reply("Você não tem permissão para usar este comando."); setTimeout(async()=>await m.delete().catch(()=>{}),5000);}catch(e){console.error(e);}
  }

  // MUTE / UNMUTE
  if(["mutechat","mutecall","unmutechat","unmutecall"].includes(cmd)&&member){
    const timeArg=args[0], motivo=args.slice(1).join(" ")||"Não informado", duration=parseDuration(timeArg);
    if(cmd==="mutechat") await muteMember(member,motivo,message);
    if(cmd==="mutecall"){
      if(!member.voice.channel) return (await message.reply("O usuário não está em call.")).delete();
      await member.voice.setMute(true);
      const embed=new EmbedBuilder().setColor("Orange").setTitle("🎙 Usuário Mutado na Call")
        .setDescription(`${member} foi silenciado na call`)
        .addFields({name:"🆔 ID",value:member.id},{name:"⏳ Tempo",value:timeArg},{name:"📄 Motivo",value:motivo},{name:"👮 Staff",value:message.author.tag})
        .setThumbnail(member.user.displayAvatarURL({dynamic:true})).setFooter({text:message.guild.name}).setTimestamp();
      const msgSent=await message.reply({embeds:[embed]}); sendLog(message.guild,embed);
      setTimeout(()=>msgSent.delete().catch(()=>{}),5000);
      setTimeout(async()=>{if(member.voice.serverMute) await member.voice.setMute(false);},duration);
    }
    if(cmd==="unmutechat") await unmuteMember(member,message);
    if(cmd==="unmutecall") await unmuteCall(member,message);
  }

  // =======================
  // COMANDO RECRUTAMENTO
  // =======================
  if(cmd === "rec" && member){
    if(!STAFF_ROLE_IDS.some(id => message.member.roles.cache.has(id))){
      return message.reply("❌ Você não tem permissão para usar esse comando.");
    }

    const embed = new EmbedBuilder()
      .setTitle("🎯 Recrutamento")
      .setDescription(`Selecione uma ação para ${member}:`)
      .setColor("Green");

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`rec_init_${member.id}_${message.author.id}`)
        .setPlaceholder("Escolha uma ação")
        .addOptions([
          { label: "Adicionar", value: "adicionar", description: "Adicionar cargos ao usuário", emoji: "➕" },
          { label: "Remover", value: "remover", description: "Remover cargos do usuário", emoji: "➖" },
          { label: "Concluído", value: "concluido", description: "Finalizar o recrutamento", emoji: "✅" }
        ])
    );

    await message.reply({embeds:[embed], components:[row]});
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

  const parts = interaction.customId.split("_"); // Ex.: rec_init_userId_executorId
  const action = parts[0], userId = parts[2], executorId = parts[3];
  const member = await interaction.guild.members.fetch(userId).catch(()=>null);
  if(!member) return;
  const executor = await interaction.guild.members.fetch(executorId).catch(()=>null);

  // ===== SETAR / REMOVER CARGOS EXISTENTE =====
  if(action === "setarcargo" || action === "removercargo"){
    if(parts[0]==="setarcargo"){
      for(const cid of interaction.values){
        const role = interaction.guild.roles.cache.get(cid);
        if(role && !member.roles.cache.has(cid)) await member.roles.add(role);
      }
      await interaction.update({content:`✅ Cargos adicionados para ${member}`, embeds:[], components:[]});
    }
    if(parts[0]==="removercargo"){
      for(const cid of interaction.values){
        if(member.roles.cache.has(cid)) await member.roles.remove(cid);
      }
      await interaction.update({content:`🗑 Cargos removidos de ${member}`, embeds:[], components:[]});
    }
    if(executor) sendLog(interaction.guild,new EmbedBuilder().setColor("Orange").setTitle("📌 Comando Executado").setDescription(`${executor} executou ${parts[0]} em ${member}`).setTimestamp());
  }

  // ===== RECRUTAMENTO MENU =====
  if(action === "rec"){
    const selected = interaction.values[0];

    // AÇÃO ADICIONAR
    if(selected === "adicionar"){
      const categoriasMembros = CATEGORIAS.find(c => c.label === "Membros");
      const options = categoriasMembros.options.map(o => ({label:o.label, value:o.id}));
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`rec_add_${member.id}_${executor.id}`)
          .setPlaceholder("Selecione cargos para adicionar")
          .setMinValues(1)
          .setMaxValues(options.length)
          .addOptions(options)
      );
      return interaction.update({content:`🎯 Adicionar cargos para ${member}`, embeds:[], components:[row]});
    }

    // AÇÃO REMOVER
    if(selected === "remover"){
      const userRoles = member.roles.cache.map(r => ({label:r.name, value:r.id})).filter(r => r.value !== member.guild.id);
      if(userRoles.length === 0) return interaction.update({content:`⚠️ ${member} não possui cargos para remover.`, embeds:[], components:[]});
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`rec_remove_${member.id}_${executor.id}`)
          .setPlaceholder("Selecione cargos para remover")
          .setMinValues(1)
          .setMaxValues(userRoles.length)
          .addOptions(userRoles)
      );
      return interaction.update({content:`🎯 Remover cargos de ${member}`, embeds:[], components:[row]});
    }

    // AÇÃO CONCLUÍDO
    if(selected === "concluido"){
      return interaction.update({content:`✅ Recrutamento finalizado para ${member}`, embeds:[], components:[]});
    }
  }

  // INTERAÇÃO ADICIONAR RECRUTAMENTO
  if(action === "rec" && parts[1]==="add"){
    for(const cid of interaction.values){
      const role = interaction.guild.roles.cache.get(cid);
      if(role && !member.roles.cache.has(cid)) await member.roles.add(role);
    }
    return interaction.update({content:`✅ Cargos adicionados para ${member}`, embeds:[], components:[]});
  }

  // INTERAÇÃO REMOVER RECRUTAMENTO
  if(action === "rec" && parts[1]==="remove"){
    for(const cid of interaction.values){
      if(member.roles.cache.has(cid)) await member.roles.remove(cid);
    }
    return interaction.update({content:`🗑 Cargos removidos de ${member}`, embeds:[], components:[]});
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
