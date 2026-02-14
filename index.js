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

// =============================
// CATEGORIAS COM EMOJIS
// =============================
const CATEGORIAS = [
  {
    label:"🌸 Faixa Rosas (Somente Meninas)",
    options:[
      {label:"🎖️ Equipe Tropa da Holanda", id:"1468026315285205094"},
      {label:"✔️ Verificado", id:"1468283328510558208"}
    ],
    allowAll:true
  },
  {
    label:"🇳🇱 TropaDaHolanda",
    options:[
      {label:"🟢 Membro Ativo", id:"1468022534686507028"},
      {label:"👑 Dono do Paredão", id:"1468263594931130574"},
      {label:"🤝 Aliados", id:"1468279104624398509"}
    ],
    allowAll:false // SOMENTE STAFF
  }
];

// =============================
// UTILS
// =============================
const sendLog = (guild, embed) => guild.channels.cache.get(LOG_CHANNEL_ID)?.send({embeds:[embed]});
const isStaff = (member) => STAFF_ROLE_IDS.some(id=>member.roles.cache.has(id));

// =============================
// PALAVRAS-CHAVE
// =============================
client.on("messageCreate", async message=>{
  if(!message.guild||message.author.bot) return;

  if(/\blink da tropa\b/i.test(message.content)){
    const msg = await message.channel.send("🇳🇱 Aqui está o link da Tropa da Holanda:\nhttps://discord.gg/tropadaholanda");
    setTimeout(()=>msg.delete().catch(()=>{}),30000);
  }
});

// =============================
// INTERAÇÕES
// =============================
client.on("interactionCreate", async interaction=>{
  if(!interaction.isStringSelectMenu()) return;

  const parts = interaction.customId.split("_"); 
  const action = parts[0], subAction = parts[1], userId = parts[2], executorId = parts[3];

  if(interaction.user.id !== executorId) 
    return interaction.reply({content:"❌ Apenas quem iniciou o comando pode usar este menu.", ephemeral:true});

  const member = await interaction.guild.members.fetch(userId).catch(()=>null);
  if(!member) return;
  const executor = await interaction.guild.members.fetch(executorId).catch(()=>null);

  // =============================
  // SETAR CARGOS
  // =============================
  if(action === "setarcargo"){
    const categoria = CATEGORIAS.find(c=>c.label.includes(subAction));
    if(!categoria) return;

    if(!categoria.allowAll && !isStaff(executor))
      return interaction.reply({content:"❌ Apenas administradores podem usar essa categoria.", ephemeral:true});

    for(const cid of interaction.values){
      if(!member.roles.cache.has(cid)) await member.roles.add(cid);
    }

    await interaction.update({content:`✅ Cargos adicionados para ${member}`, embeds:[], components:[]});
  }

  // =============================
  // REMOVER CARGOS
  // =============================
  if(action === "removercargo"){
    for(const cid of interaction.values){
      if(member.roles.cache.has(cid)) await member.roles.remove(cid);
    }
    await interaction.update({content:`🗑 Cargos removidos de ${member}`, embeds:[], components:[]});
  }

  // =============================
  // RECRUTAMENTO CICLICO
  // =============================
  if(action === "rec"){

    const menuPrincipal = async ()=>{
      const embed = new EmbedBuilder()
        .setTitle("🎯 Sistema de Recrutamento")
        .setDescription(`Selecione uma ação para ${member}`)
        .setColor("Green");

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`rec_init_${member.id}_${executor.id}`)
          .setPlaceholder("Escolha uma ação")
          .addOptions([
            {label:"➕ Adicionar Cargos", value:"adicionar"},
            {label:"➖ Remover Cargos", value:"remover"},
            {label:"✅ Finalizar", value:"concluir"}
          ])
      );

      await interaction.update({embeds:[embed], components:[row]});
    };

    if(subAction === "init"){
      const escolha = interaction.values[0];

      if(escolha === "adicionar"){

        let options = [];

        for(const categoria of CATEGORIAS){

          if(!categoria.allowAll && !isStaff(executor)) continue;

          categoria.options.forEach(o=>{
            options.push({label:o.label, value:o.id});
          });
        }

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`rec_add_${member.id}_${executor.id}`)
            .setPlaceholder("Selecione cargos para adicionar")
            .setMinValues(1)
            .setMaxValues(options.length)
            .addOptions(options)
        );

        return interaction.update({content:`➕ Adicionar cargos para ${member}`, embeds:[], components:[row]});
      }

      if(escolha === "remover"){
        const userRoles = member.roles.cache
          .filter(r=>r.id!==member.guild.id)
          .map(r=>({label:`🗑 ${r.name}`, value:r.id}));

        if(userRoles.length===0)
          return interaction.update({content:"⚠️ Este usuário não possui cargos removíveis.", components:[]});

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`rec_remove_${member.id}_${executor.id}`)
            .setPlaceholder("Selecione cargos para remover")
            .setMinValues(1)
            .setMaxValues(userRoles.length)
            .addOptions(userRoles)
        );

        return interaction.update({content:`➖ Remover cargos de ${member}`, embeds:[], components:[row]});
      }

      if(escolha === "concluir"){
        return interaction.update({content:`✅ Recrutamento finalizado para ${member}`, components:[]});
      }
    }

    if(subAction === "add"){
      for(const cid of interaction.values){
        if(!member.roles.cache.has(cid)) await member.roles.add(cid);
      }
      return menuPrincipal();
    }

    if(subAction === "remove"){
      for(const cid of interaction.values){
        if(member.roles.cache.has(cid)) await member.roles.remove(cid);
      }
      return menuPrincipal();
    }
  }
});

// =============================
client.once("ready",()=>{
  console.log(`Bot online! ${client.user.tag}`);
  client.user.setActivity("🇳🇱 Tropa da Holanda",{type:"WATCHING"});
});

client.login(process.env.TOKEN);
