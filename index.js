require('dotenv').config();
const { 
  Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
  StringSelectMenuBuilder, EmbedBuilder, ChannelType, PermissionsBitField 
} = require('discord.js');
const { Pool } = require('pg');

// ==========================
// CONFIGURAÇÃO DO POSTGRESQL
// ==========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function query(sql, params) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// Cria tabela de pontos caso não exista
(async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS pontos (
      user_id TEXT PRIMARY KEY,
      ativo BOOLEAN DEFAULT FALSE,
      entrada BIGINT,
      total BIGINT DEFAULT 0,
      coins INTEGER DEFAULT 0,
      canal_id TEXT
    )
  `);
})();

// ==========================
// CONFIGURAÇÃO DO BOT
// ==========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
});

// ==========================
// VARIÁVEIS GLOBAIS
// ==========================
const PREFIX = 'thl!';
const ADMIN_IDS = ['1468017578747105390'];
const ALLOWED_PONTO = ['1468026315285205094'];
const MUTE_ROLE_ID = '1472191430071029841';
const LOG_CHANNEL = '1468722726247338115';
const CATEGORIA_PONTO = '1474413150441963615';
const CANAL_ENTRAR = '1474383177689731254';
const TICKET_CATEGORIA = '1474366472326222013';

// Armazena dados temporários de ponto (substituir por DB depois se quiser)
let data = {};

// ==========================
// FUNÇÕES AUXILIARES
// ==========================
function msFromString(str){
  if(str.endsWith('h')) return parseInt(str)*3600000;
  if(str.endsWith('m')) return parseInt(str)*60000;
  return null;
}

async function logAction(message) {
  const channel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
  if(channel) channel.send(message).catch(() => {});
}

function saveData(obj){
  // Aqui você poderia salvar no DB
  data = obj;
}

// ==========================
// BOT PRONTO
// ==========================
client.on('ready', async () => {
  console.log(`Bot online: ${client.user.tag}`);

  // Inicializa painel de loja
  const guild = client.guilds.cache.first();
  const canalEmbed = guild.channels.cache.get('1474885764990107790');
  if(!canalEmbed) return console.error('Canal do painel fixo não encontrado.');

  const produtos = [
    { label: 'Nitro 1 mês', value: 'nitro_1', description: '💰 3 R$' },
    { label: 'Nitro 3 meses', value: 'nitro_3', description: '💰 6 R$' },
    { label: 'Contas virgem +30 dias', value: 'conta_virgem', description: '💰 5 R$' },
    { label: 'Ativação Nitro', value: 'ativacao_nitro', description: '💰 1,50 R$' },
    { label: 'Spotify Premium', value: 'spotify', description: '💰 5 R$' },
    { label: 'Molduras com icon personalizado', value: 'moldura', description: '💰 2 R$' },
    { label: 'Youtube Premium', value: 'youtube', description: '💰 6 R$' }
  ];

  const row = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('loja_select')
        .setPlaceholder('Selecione um produto...')
        .addOptions(produtos)
    );

  // Deleta mensagens antigas
  const mensagens = await canalEmbed.messages.fetch({ limit: 10 });
  mensagens.forEach(msg => {
    if(msg.author.id === client.user.id) msg.delete().catch(() => {});
  });

  await canalEmbed.send({ content: '# Produtos | Tropa da Holanda 🇳🇱', components: [row] })
    .then(m => m.pin().catch(() => {}));
});

// ==========================
// COMANDOS DE TEXTO
// ==========================
client.on('messageCreate', async message => {
  if(!message.guild || message.author.bot) return;
  if(!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  const userId = message.author.id;
  const guild = message.guild;

  // ==============================
  // COMANDOS DE PONTO
  // ==============================
  if(command === 'ponto'){
    const sub = args[0]?.toLowerCase();

    // ----- ENTRAR -----
    if(sub === 'entrar'){
      if(!ALLOWED_PONTO.includes(userId)) return message.reply("❌ Você não tem permissão.");
      if(message.channel.id !== CANAL_ENTRAR) return message.reply("❌ Comandos de ponto só podem ser usados neste canal.");
      if(data[userId]?.ativo) return message.reply("❌ Você já iniciou seu ponto.");

      data[userId] = { ativo:true, entrada:Date.now(), total:data[userId]?.total || 0, canal:null, coins:data[userId]?.coins || 0 };
      saveData(data);

      const canal = await guild.channels.create({
        name: `ponto-${message.author.username}`,
        type: ChannelType.GuildText,
        parent: CATEGORIA_PONTO,
        permissionOverwrites:[
          {id:guild.id, deny:["ViewChannel"]},
          {id:userId, allow:["ViewChannel","SendMessages","ReadMessageHistory"]}
        ]
      });

      data[userId].canal = canal.id;
      saveData(data);

      await message.reply(`🟢 Ponto iniciado! Canal criado: <#${canal.id}>`);
      await canal.send(`🟢 Ponto iniciado! <@${userId}>`);

      // Verificação de presença
      const verificarPresenca = async () => {
        if(!data[userId]?.ativo) return;
        await canal.send(`<@${userId}> você está aí? Responda 'sim' em 30s.`);

        const filter = m => m.author.id === userId && m.content.toLowerCase() === 'sim';
        canal.awaitMessages({ filter, max:1, time:30000, errors:['time'] })
          .then(() => setTimeout(verificarPresenca, 30000))
          .catch(async () => {
            const tempo = Date.now() - data[userId].entrada;
            data[userId].total += tempo;
            data[userId].ativo = false;
            data[userId].entrada = null;
            const canalId = data[userId].canal;
            data[userId].canal = null;
            saveData(data);

            if(canalId){
              const c = guild.channels.cache.get(canalId);
              if(c){
                await c.send("🔴 Sem resposta. Ponto finalizado. Canal será fechado.");
                setTimeout(()=>c.delete().catch(()=>{}), 3000);
              }
            }
          });
      };

      setTimeout(verificarPresenca, 30000);
      return;
    }

    // ----- SAIR -----
    if(sub === 'sair'){
      if(!data[userId]?.ativo) return message.reply("❌ Você não iniciou ponto.");
      const tempo = Date.now() - data[userId].entrada;
      data[userId].total += tempo;
      data[userId].ativo = false;
      data[userId].entrada = null;
      const canalId = data[userId].canal;
      data[userId].canal = null;
      saveData(data);

      if(canalId){
        const canal = guild.channels.cache.get(canalId);
        if(canal){
          await canal.send("🔴 Ponto finalizado. Canal será fechado.");
          setTimeout(()=>canal.delete().catch(()=>{}), 3000);
        }
      }
      return message.reply("🔴 Ponto finalizado!");
    }

    // ----- STATUS -----
    if(sub === 'status'){
      const info = data[userId];
      if(!info) return message.reply("❌ Nenhum ponto registrado para você.");
      let total = info.total;
      if(info.ativo && info.entrada) total += Date.now() - info.entrada;
      const h = Math.floor(total/3600000);
      const m = Math.floor((total%3600000)/60000);
      const s = Math.floor((total%60000)/1000);
      return message.reply(`⏱ Tempo acumulado: ${h}h ${m}m ${s}s | Coins: ${info.coins || 0} 💰`);
    }

    // ----- ADDTEMPO ADMIN -----
    if(sub === 'addtempo'){
      if(!ADMIN_IDS.includes(userId)) return message.reply("❌ Apenas admins podem usar este comando.");
      const target = message.mentions.members.first();
      const valor = args[1];
      if(!target || !valor) return message.reply("❌ Use: thl!ponto addtempo <@usuário> <tempo ex: 3h/45m>");
      let ms = 0;
      if(valor.endsWith('h')) ms = parseInt(valor)*60*60*1000;
      else if(valor.endsWith('m')) ms = parseInt(valor)*60*1000;
      else return message.reply("❌ Formato inválido.");
      if(!data[target.id]) data[target.id]={ativo:false,total:0,entrada:null,coins:0};
      data[target.id].total += ms;
      saveData(data);
      return message.reply(`✅ Adicionados ${valor} de tempo para ${target}`);
    }

    // ----- ADDCOINS ADMIN -----
    if(sub === 'addcoins'){
      if(!ADMIN_IDS.includes(userId)) return message.reply("❌ Apenas admins podem usar este comando.");
      const target = message.mentions.members.first();
      const coins = parseInt(args[1]);
      if(!target || isNaN(coins)) return message.reply("❌ Use: thl!ponto addcoins <@usuário> <quantidade>");
      if(!data[target.id]) data[target.id]={ativo:false,total:0,entrada:null,coins:0};
      data[target.id].coins += coins;
      saveData(data);
      return message.reply(`✅ Adicionados ${coins} coins para ${target}`);
    }

    // ----- RESET ADMIN -----
    if(sub === 'reset'){
      if(!ADMIN_IDS.includes(userId)) return message.reply("❌ Apenas admins podem usar este comando.");
      for(const uid in data){
        data[uid].total = 0;
        data[uid].entrada = data[uid].ativo ? Date.now() : null;
      }
      saveData(data);
      return message.reply("✅ Todas as horas de todos os usuários foram resetadas.");
    }

    // ----- REGISTRO ADMIN -----
    if(sub === 'registro'){
      if(!ADMIN_IDS.includes(userId)) return message.reply("❌ Apenas admins podem usar este comando.");
      const allUsers = Object.entries(data).sort((a,b)=> (b[1].total || 0) - (a[1].total || 0));
      if(!allUsers.length) return message.reply("❌ Nenhum registro encontrado.");

      let texto = "";
      for(const [uid, info] of allUsers){
        let total = info.total || 0;
        if(info.ativo && info.entrada) total += Date.now() - info.entrada;
        const h = Math.floor(total/3600000);
        const m = Math.floor((total%3600000)/60000);
        const s = Math.floor((total%60000)/1000);
        texto += `<@${uid}> → ${h}h ${m}m ${s}s | Coins: ${info.coins || 0} 💰\n`;
      }

      // Envia em chunks de 2000 caracteres
      const chunks = [];
      let current = "";
      for(const line of texto.split("\n")){
        if((current+line+"\n").length>1900){ chunks.push(current); current=""; }
        current += line+"\n";
      }
      if(current) chunks.push(current);

      for(const chunk of chunks) await message.reply(chunk);
    }
  }

  // ==============================
  // COMANDOS DE MODERAÇÃO
  // ==============================
  if(['kick','ban','mutecall','unmutecall','mutechat','unmutechat'].includes(command)){
    if(!ADMIN_IDS.includes(userId)) return message.reply('❌ Sem permissão.');
    const target = message.mentions.members.first();
    if(!target) return message.reply('❌ Mencione um usuário válido.');
    let motivo = args.slice(1).join(' ') || 'Não especificado';

    switch(command){
      case 'kick': await target.kick(motivo); message.reply(`✅ ${target.user.tag} kickado.`); logAction(`⚠️ ${target.user.tag} kickado por ${message.author.tag} | Motivo: ${motivo}`); break;
      case 'ban': await target.ban({ reason: motivo }); message.reply(`✅ ${target.user.tag} banido.`); logAction(`⚠️ ${target.user.tag} banido por ${message.author.tag} | Motivo: ${motivo}`); break;
      case 'mutecall':
      case 'mutechat':
        const dur = args[1]? msFromString(args[1]): null;
        await target.roles.add(MUTE_ROLE_ID, motivo);
        message.reply(`✅ ${target.user.tag} mutado.`);
        logAction(`🔇 ${target.user.tag} mutado por ${message.author.tag} | Motivo: ${motivo} | Tempo: ${args[1] || 'indefinido'}`);
        if(dur) setTimeout(()=>{target.roles.remove(MUTE_ROLE_ID).catch(()=>{}); logAction(`🔊 ${target.user.tag} desmutado automático.`)}, dur);
        break;
      case 'unmutecall':
      case 'unmutechat':
        await target.roles.remove(MUTE_ROLE_ID, motivo);
        message.reply(`✅ ${target.user.tag} desmutado.`);
        logAction(`🔊 ${target.user.tag} desmutado por ${message.author.tag}`);
        break;
    }
  }
});

// ==========================
// INTERAÇÕES DE LOJA E TICKETS
// ==========================
client.on('interactionCreate', async interaction => {
  const guild = interaction.guild;

  // LOJA
  if(interaction.isStringSelectMenu() && interaction.customId==='loja_select'){
    const produto = interaction.values[0];
    const ticketName = `ticket-${interaction.user.username}`;

    if(guild.channels.cache.find(c=>c.name===ticketName && c.parentId===TICKET_CATEGORIA)){
      return interaction.followUp({ content:'❌ Você já possui um ticket aberto', ephemeral:true });
    }

    const channel = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORIA,
      permissionOverwrites:[
        {id:guild.id, deny:[PermissionsBitField.Flags.ViewChannel]},
        {id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]}
      ]
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle(`🛒 Ticket de Compra - ${produto}`)
      .setDescription(`${interaction.user} abriu um ticket.`)
      .setColor('Green')
      .setTimestamp();

    const fecharButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('fechar_ticket')
        .setLabel('🔒 Fechar Ticket')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds:[ticketEmbed], components:[fecharButton] });
    await interaction.followUp({ content:`✅ Ticket criado! Verifique o canal ${channel}`, ephemeral:true });
  }

  // FECHAR TICKET
  if(interaction.isButton() && interaction.customId==='fechar_ticket'){
    if(!interaction.channel.name.startsWith('ticket-')) 
      return interaction.reply({ content:'❌ Este botão só pode ser usado dentro de um ticket.', ephemeral:true });

    const disabledButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('fechar_ticket')
        .setLabel('🔒 Fechar Ticket')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true)
    );

    await interaction.update({ components:[disabledButton] }).catch(()=>{});
    setTimeout(()=>interaction.channel.delete().catch(()=>{}), 500);
  }
});

// ==========================
// LOGIN DO BOT
// ==========================
client.login(process.env.TOKEN);
