require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const { Pool } = require("pg");

// ================== CRIAR CLIENT ==================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

// ================== CONEXÃO POSTGRES ==================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ================== PREFIXO E IDS ==================
const PREFIX = "ne!";
const IDS = {
  STAFF_ROLE: "1468017578747105390",
  LOG_VIP: "1478697992071549081",

  CATEGORIA_SOL_BRISA: "1478567017832251392",
  CATEGORIA_FOGO: "1478695052015308800",
  CATEGORIA_IMPERIO: "1478694889167257784",

  CARGOS: {
    SOL: "1478567864175693865",
    BRISA: "1478567921243521266",
    FOGO: "1478567970711273675",
    IMPERIO: "1478568023358050425"
  }
};

// ================== SISTEMA DE ESTADOS ==================
let aguardando = {};
let paineisVIP = {};

// ================== BANCO DE DADOS ==================
client.once("ready", async () => {
  console.log(`🔥 Bot online ${client.user.tag}`);

  // Cria a tabela vip_users se não existir
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vip_users(
      user_id TEXT PRIMARY KEY,
      cargo_id TEXT,
      tipo TEXT,
      expira BIGINT
    );
  `);

  // Cria a tabela vip_calls se não existir
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vip_calls(
      user_id TEXT PRIMARY KEY,
      channel_id TEXT,
      cargo_id TEXT,
      tipo TEXT
    );
  `);

  console.log("✅ Banco de dados pronto");
});

// ================== FUNÇÕES AUXILIARES ==================
function categoriaVIP(tipo) {
  if(tipo === "sol" || tipo === "brisa") return IDS.CATEGORIA_SOL_BRISA;
  if(tipo === "fogo") return IDS.CATEGORIA_FOGO;
  if(tipo === "imperio") return IDS.CATEGORIA_IMPERIO;
}

async function logVIP(guild, msg) {
  const canal = guild.channels.cache.get(IDS.LOG_VIP);
  if(canal) canal.send(msg);
}

// ================== A PARTIR DAQUI VÃO OS COMANDOS E INTERAÇÕES ==================

// ================= COMANDOS =================

client.on("messageCreate",async message=>{

if(message.author.bot) return;

// ================= PAINEL VIP =================

if(message.content === `${PREFIX}vip`){

const member = message.member;

// verificar se tem VIP
const vipRole = Object.entries(IDS.CARGOS).find(([k,id]) =>
member.roles.cache.has(id)
);

if(!vipRole) return message.reply("❌ Você não possui VIP.");

// buscar no banco
const call = await pool.query(
"SELECT * FROM vip_calls WHERE user_id=$1",
[member.id]
);

let temCall = false;
let temCargo = false;

if(call.rows.length){

const canal = message.guild.channels.cache.get(call.rows[0].channel_id);
const cargo = message.guild.roles.cache.get(call.rows[0].cargo_id);

if(canal) temCall = true;
if(cargo) temCargo = true;

}
  
// embed
const embed = new EmbedBuilder()
.setTitle("👑 Painel VIP")
.setColor("Orange")
.setDescription("Gerencie sua call e cargo VIP");

// botões
const row = new ActionRowBuilder();

// ================= SEM CALL E SEM CARGO =================
if(!temCall && !temCargo){

row.addComponents(

new ButtonBuilder()
.setCustomId("criar_call")
.setLabel("🎤 Criar Call")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("criar_cargo")
.setLabel("🏷 Criar Cargo")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("fechar")
.setLabel("❌ Fechar")
.setStyle(ButtonStyle.Danger)

);

}

// ================= TEM CALL MAS NÃO CARGO =================
else if(temCall && !temCargo){

row.addComponents(

new ButtonBuilder()
.setCustomId("criar_cargo")
.setLabel("🏷 Criar Cargo")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("limite")
.setLabel("👥 Limitar Call")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("renomear_call")
.setLabel("✏ Renomear Call")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("deletar_call")
.setLabel("🗑 Deletar Call")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("fechar")
.setLabel("❌ Fechar")
.setStyle(ButtonStyle.Danger)

);

}

// ================= TEM CARGO MAS NÃO CALL =================
else if(!temCall && temCargo){

row.addComponents(

new ButtonBuilder()
.setCustomId("criar_call")
.setLabel("🎤 Criar Call")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("renomear_cargo")
.setLabel("🏷 Renomear Cargo")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("deletar_cargo")
.setLabel("🗑 Deletar Cargo")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("fechar")
.setLabel("❌ Fechar")
.setStyle(ButtonStyle.Danger)

);

}

// ================= TEM CALL E CARGO =================
else if(temCall && temCargo){

row.addComponents(

new ButtonBuilder()
.setCustomId("limite")
.setLabel("👥 Limitar Call")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("renomear_call")
.setLabel("✏ Renomear Call")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("renomear_cargo")
.setLabel("🏷 Renomear Cargo")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("liberar")
.setLabel("👤 Liberar Amigo")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("deletar_call")
.setLabel("🗑 Deletar Call")
.setStyle(ButtonStyle.Danger)

);

const row2 = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("deletar_cargo")
.setLabel("🗑 Deletar Cargo")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("fechar")
.setLabel("❌ Fechar")
.setStyle(ButtonStyle.Danger)

);

const painel = await message.reply({
embeds:[embed],
components:[row,row2]
});

paineisVIP[message.author.id] = painel;
}

const painel = await message.reply({
embeds:[embed],
components:[row]
});

paineisVIP[message.author.id] = painel;
}
// ================= PAINEL STAFF =================

if(message.content === `${PREFIX}vipstaff`){

if(!message.member.roles.cache.has(IDS.STAFF_ROLE))
return message.reply("❌ Apenas STAFF pode usar.");

const embed = new EmbedBuilder()
.setTitle("👑 Painel STAFF VIP")
.setDescription("Gerenciamento do sistema VIP")
.setColor("Gold");

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("staff_darvip")
.setLabel("👑 Dar VIP")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("staff_renovarvip")
.setLabel("🔁 Renovar VIP")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("staff_removervip")
.setLabel("🗑 Remover VIP")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("staff_vervips")
.setLabel("📊 Ver VIPs")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("staff_logs")
.setLabel("📜 Logs VIP")
.setStyle(ButtonStyle.Secondary)

);

const row2 = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("fechar")
.setLabel("❌ Fechar Painel")
.setStyle(ButtonStyle.Secondary)

);

message.reply({
embeds:[embed],
components:[row,row2]
});

}

});     

 client.on("interactionCreate", async interaction => {

if(!interaction.isButton()) return;

// ================= FECHAR =================
if (interaction.customId === "fechar") {
  return interaction.message.delete().catch(()=>{});
}

// ================= DAR VIP =================
if(interaction.customId === "staff_darvip"){

  aguardando[interaction.user.id] = "staff_darvip";

  return interaction.reply({
    content:"Use no chat:\n@user tipo dias\nExemplo:\n@kaique sol 30",
    ephemeral:true
  });

}

// ================= RENOVAR VIP =================
if (interaction.customId === "staff_renovarvip") {

  aguardando[interaction.user.id] = "staff_renovar";

  return interaction.reply({
    content: "Use no chat:\n@user dias\nExemplo:\n@kaique 30",
    ephemeral: true
  });

}

// ================= REMOVER VIP =================
if (interaction.customId === "staff_removervip") {

  aguardando[interaction.user.id] = "staff_remover";

  return interaction.reply({
    content: "Marque o usuário para remover VIP.",
    ephemeral: true
  });

}

// ================= VER VIPS =================
if (interaction.customId === "staff_vervips") {

  const vips = await pool.query("SELECT * FROM vip_users");

  let lista = "";

  for (const v of vips.rows) {

    const dias = Math.floor((v.expira - Date.now()) / 86400000);

    lista += `<@${v.user_id}> • ${dias} dias\n`;

  }

  return interaction.reply({
    content: lista || "Nenhum VIP.",
    ephemeral: true
  });

}

// ================= LOGS =================
if (interaction.customId === "staff_logs") {

  return interaction.reply({
    content: `Canal de logs: <#${IDS.LOG_VIP}>`,
    ephemeral: true
  });

}
   // ================= CRIAR CALL =================
if(interaction.customId === "criar_call"){

  aguardando[interaction.user.id] = "criar_call";

  return interaction.reply({
    content:"Digite o nome da call.",
    ephemeral:true
  });

}

// ================= CRIAR CARGO =================
if(interaction.customId === "criar_cargo"){

  aguardando[interaction.user.id] = "criar_cargo";

  return interaction.reply({
    content:"Digite o nome do cargo VIP.",
    ephemeral:true
  });

}

// ================= LIMITE =================
if(interaction.customId === "limite"){

  aguardando[interaction.user.id] = "limite";

  return interaction.reply({
    content:"Digite o limite de usuários da call.",
    ephemeral:true
  });

}

// ================= RENOMEAR CALL =================
if(interaction.customId === "renomear_call"){

  aguardando[interaction.user.id] = "renomear_call";

  return interaction.reply({
    content:"Digite o novo nome da call.",
    ephemeral:true
  });

}

// ================= RENOMEAR CARGO =================
if(interaction.customId === "renomear_cargo"){

  aguardando[interaction.user.id] = "renomear_cargo";

  return interaction.reply({
    content:"Digite o novo nome do cargo.",
    ephemeral:true
  });

}

// ================= LIBERAR AMIGO =================
if(interaction.customId === "liberar"){

  aguardando[interaction.user.id] = "liberar";

  return interaction.reply({
    content:"Marque o amigo que deseja liberar.",
    ephemeral:true
  });

}

});
client.on("messageCreate", async message => {

if(message.author.bot) return;

const estado = aguardando[message.author.id];
if(!estado) return;

delete aguardando[message.author.id];

const member = message.member;
 // ================= DAR VIP =================
if (estado === "staff_darvip") {

  try {

    const user = message.mentions.members.first();
    const args = message.content.split(" ");

    const tipo = args[1];
    const dias = parseInt(args[2]);

    if (!user || !tipo || !dias) {
      return message.channel.send(
        "❌ Use:\n@user tipo dias\nExemplo:\n@kaique sol 30"
      );
    }

    const cargo = IDS.CARGOS[tipo.toUpperCase()];

    if (!cargo) {
      return message.channel.send("❌ Tipo de VIP inválido.");
    }

    const expira = Date.now() + dias * 86400000;

    await user.roles.add(cargo);

    await pool.query(
`
INSERT INTO vip_users(user_id,cargo_id,tipo,expira)
VALUES($1,$2,$3,$4)
ON CONFLICT(user_id)
DO UPDATE SET cargo_id=$2, tipo=$3, expira=$4
`,
[user.id, cargo, tipo, expira]
);

    delete aguardando[message.author.id];

    return message.channel.send(
      `✅ VIP **${tipo.toUpperCase()}** setado em ${user} por **${dias} dias**`
    );

  } catch (err) {

    console.log("Erro ao dar VIP:", err);

    return message.channel.send("❌ Ocorreu um erro ao setar o VIP.");

  }

}
// ================= RENOVAR VIP =================
if (estado === "staff_renovar") {

  try {

    const user = message.mentions.members.first();
    const args = message.content.split(" ");
    const dias = parseInt(args[1]);

    if (!user || !dias) {
      return message.channel.send(
        "❌ Use:\n@user dias\nExemplo:\n@kaique 30"
      );
    }

    const resultado = await pool.query(
      "SELECT * FROM vip_users WHERE user_id=$1",
      [user.id]
    );

    if (resultado.rows.length === 0) {
      return message.channel.send("❌ Usuário não possui VIP.");
    }

    let expiraAtual = Number(resultado.rows[0].expira);

    if (expiraAtual < Date.now()) {
      expiraAtual = Date.now();
    }

    const novoExpira = expiraAtual + dias * 86400000;

    await pool.query(
      "UPDATE vip_users SET expira=$1 WHERE user_id=$2",
      [novoExpira, user.id]
    );

    delete aguardando[message.author.id];

    return message.channel.send(
      `🔄 VIP de ${user} renovado por **${dias} dias**`
    );

  } catch (err) {

    console.log("Erro renovar VIP:", err);

    return message.channel.send("❌ Erro ao renovar VIP.");

  }

}
 // ================= REMOVER VIP =================
if (estado === "staff_remover") {

  const user = message.mentions.members.first();

  if (!user) {
    return message.channel.send("❌ Marque o usuário.");
  }

  const vip = await pool.query(
    "SELECT * FROM vip_users WHERE user_id=$1",
    [user.id]
  );

  if (vip.rows.length === 0) {
    return message.channel.send("❌ Usuário não possui VIP.");
  }

  const cargoVip = vip.rows[0].cargo_id;

  // remover cargo VIP principal
  try {
    await user.roles.remove(cargoVip);
  } catch {}

  // buscar call e cargo VIP personalizados
  const callData = await pool.query(
    "SELECT * FROM vip_calls WHERE user_id=$1",
    [user.id]
  );

  if (callData.rows.length) {

    const canal = message.guild.channels.cache.get(callData.rows[0].channel_id);
    const cargo = message.guild.roles.cache.get(callData.rows[0].cargo_id);

    if (canal) {
      await canal.delete().catch(()=>{});
    }

    if (cargo) {
      await cargo.delete().catch(()=>{});
    }

    await pool.query(
      "DELETE FROM vip_calls WHERE user_id=$1",
      [user.id]
    );

  }

  // apagar VIP do banco
  await pool.query(
    "DELETE FROM vip_users WHERE user_id=$1",
    [user.id]
  );

  return message.channel.send(`❌ VIP removido de ${user}`);

}
// ================= CRIAR CALL =================
if(estado === "criar_call") {

  const vipRole = Object.entries(IDS.CARGOS).find(([k,id]) =>
    member.roles.cache.has(id)
  );

  if(!vipRole) return message.reply("❌ Você não possui VIP.");

  const tipo = vipRole[0].toLowerCase();

  const callExist = await pool.query(
    "SELECT * FROM vip_calls WHERE user_id=$1",
    [member.id]
  );

  // Limite de 1 call
  if(callExist.rows.length){

    const canal = message.guild.channels.cache.get(callExist.rows[0].channel_id);

    if(canal)
    return message.reply("❌ Você já possui uma call.");

  }
  
  const canal = await message.guild.channels.create({
    name: message.content,
    type: 2,
    parent: categoriaVIP(tipo)
  }).catch(()=>null);

  if(!canal) return message.reply("❌ Erro ao criar call.");

  await pool.query(`
INSERT INTO vip_calls(user_id,channel_id,tipo)
VALUES($1,$2,$3)
ON CONFLICT(user_id)
DO UPDATE SET channel_id=$2, tipo=$3
`,[member.id, canal.id, tipo]);
  
  message.reply("✅ Call criada.");

 const painel = paineisVIP[member.id];

if(painel){

const dados = await pool.query(
"SELECT * FROM vip_calls WHERE user_id=$1",
[member.id]
);

const canalVIP = message.guild.channels.cache.get(dados.rows[0]?.channel_id);
const cargo = message.guild.roles.cache.get(dados.rows[0]?.cargo_id);

let row;

if(canalVIP && cargo){

row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("limite")
.setLabel("👥 Limitar Call")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("renomear_call")
.setLabel("✏ Renomear Call")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("renomear_cargo")
.setLabel("🏷 Renomear Cargo")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("liberar")
.setLabel("👤 Liberar Amigo")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("deletar_call")
.setLabel("🗑 Deletar Call")
.setStyle(ButtonStyle.Danger)

);

}

else{

row = new ActionRowBuilder();

row.addComponents(

new ButtonBuilder()
.setCustomId("criar_cargo")
.setLabel("🏷 Criar Cargo")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("limite")
.setLabel("👥 Limitar Call")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("renomear_call")
.setLabel("✏ Renomear Call")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("deletar_call")
.setLabel("🗑 Deletar Call")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("fechar")
.setLabel("❌ Fechar")
.setStyle(ButtonStyle.Danger)

);

}

await painel.edit({
embeds:[
new EmbedBuilder()
.setTitle("👑 Painel VIP")
.setColor("Orange")
.setDescription("Gerencie sua call e cargo VIP")
],
components:[row]
}).catch(()=>{});

}
}
  // ================= CRIAR CARGO =================
if(estado === "criar_cargo") {

const callData = await pool.query(
"SELECT * FROM vip_calls WHERE user_id=$1",
[member.id]
);

// Limite de 1 cargo
if(callData.rows.length){

const cargoExist = message.guild.roles.cache.get(callData.rows[0].cargo_id);

if(cargoExist)
return message.reply("❌ Você já possui um cargo VIP.");

}

const cargo = await message.guild.roles.create({
name: message.content
}).catch(()=>null);

if(!cargo) return message.reply("❌ Erro ao criar cargo.");

await member.roles.add(cargo).catch(()=>{});

await pool.query(`
INSERT INTO vip_calls(user_id,cargo_id)
VALUES($1,$2)
ON CONFLICT(user_id)
DO UPDATE SET cargo_id=$2
`, [member.id, cargo.id]);

message.reply("✅ Cargo criado.");

const painel = paineisVIP[member.id];

if(painel){

const dados = await pool.query(
"SELECT * FROM vip_calls WHERE user_id=$1",
[member.id]
);

const canal = message.guild.channels.cache.get(dados.rows[0]?.channel_id);
const cargoExist = message.guild.roles.cache.get(dados.rows[0]?.cargo_id);

let row;

if(canal && cargoExist){

row = new ActionRowBuilder();

row.addComponents(

new ButtonBuilder()
.setCustomId("limite")
.setLabel("👥 Limitar Call")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("renomear_call")
.setLabel("✏ Renomear Call")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("renomear_cargo")
.setLabel("🏷 Renomear Cargo")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("liberar")
.setLabel("👤 Liberar Amigo")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("deletar_call")
.setLabel("🗑 Deletar Call")
.setStyle(ButtonStyle.Danger)

);

}

else{

row = new ActionRowBuilder();

row.addComponents(

new ButtonBuilder()
.setCustomId("criar_call")
.setLabel("🎤 Criar Call")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("renomear_cargo")
.setLabel("🏷 Renomear Cargo")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("deletar_cargo")
.setLabel("🗑 Deletar Cargo")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("fechar")
.setLabel("❌ Fechar")
.setStyle(ButtonStyle.Danger)

);

}

await painel.edit({
embeds:[
new EmbedBuilder()
.setTitle("👑 Painel VIP")
.setColor("Orange")
.setDescription("Gerencie sua call e cargo VIP")
],
components:[row]
}).catch(()=>{});

}
}
  // ================= LIMITE CALL =================
if(estado === "limite") {

  const limite = parseInt(message.content);

  if(isNaN(limite) || limite < 0)
    return message.reply("❌ Número inválido.");

  const callData = await pool.query(
    "SELECT * FROM vip_calls WHERE user_id=$1",
    [member.id]
  );

  if(!callData.rows.length || !callData.rows[0].channel_id)
    return message.reply("❌ Você não possui uma call.");

  const canal = message.guild.channels.cache.get(callData.rows[0].channel_id);
  if(!canal) return message.reply("❌ Call não encontrada.");

  await canal.setUserLimit(limite).catch(()=>{});

  message.reply("✅ Limite atualizado.");
}

// ================= LIBERAR AMIGO =================
if(estado === "liberar") {

  const amigo = message.mentions.members.first();
  if(!amigo) return message.reply("❌ Marque um amigo.");

  const callData = await pool.query(
    "SELECT * FROM vip_calls WHERE user_id=$1",
    [member.id]
  );

  if(!callData.rows.length || !callData.rows[0].cargo_id)
    return message.reply("❌ Você não possui call ou cargo VIP.");

  const cargo = message.guild.roles.cache.get(callData.rows[0].cargo_id);
  if(!cargo) return;

  await amigo.roles.add(cargo).catch(()=>{});

  message.reply(`✅ ${amigo.user.username} liberado na call.`);
}

// ================= RENOMEAR CALL =================
if(estado === "renomear_call") {

  const callData = await pool.query(
    "SELECT * FROM vip_calls WHERE user_id=$1",
    [member.id]
  );

  if(!callData.rows.length || !callData.rows[0].channel_id)
    return message.reply("❌ Você não possui call.");

  const canal = message.guild.channels.cache.get(callData.rows[0].channel_id);
  if(!canal) return message.reply("❌ Call não encontrada.");

  await canal.setName(message.content).catch(()=>{});

  message.reply("✅ Call renomeada.");
}

// ================= RENOMEAR CARGO =================
if(estado === "renomear_cargo") {

  const callData = await pool.query(
    "SELECT * FROM vip_calls WHERE user_id=$1",
    [member.id]
  );

  if(!callData.rows.length || !callData.rows[0].cargo_id)
    return message.reply("❌ Você não possui cargo.");

  const cargo = message.guild.roles.cache.get(callData.rows[0].cargo_id);
  if(!cargo) return message.reply("❌ Cargo não encontrado.");

  await cargo.setName(message.content).catch(()=>{});

  message.reply("✅ Cargo renomeado.");
}
});

// ================= VERIFICAR VIPS EXPIRADOS =================

setInterval(async () => {
  try {

    const vips = await pool.query("SELECT * FROM vip_users");

    for (const vip of vips.rows) {

      if (!vip.expira) continue;

      if (Date.now() > vip.expira) {

        const guild = client.guilds.cache.first();
        if(!guild) continue;

        const member = await guild.members.fetch(vip.user_id).catch(() => null);

        // remover cargo VIP principal
        if (member) {
          await member.roles.remove(vip.cargo_id).catch(()=>{});
        }

        // buscar call e cargo VIP personalizados
        const callData = await pool.query(
          "SELECT * FROM vip_calls WHERE user_id=$1",
          [vip.user_id]
        );

        if(callData.rows.length){

          const canal = guild.channels.cache.get(callData.rows[0].channel_id);
          const cargo = guild.roles.cache.get(callData.rows[0].cargo_id);

          if(canal){
            await canal.delete().catch(()=>{});
          }

          if(cargo){
            await cargo.delete().catch(()=>{});
          }

          await pool.query(
            "DELETE FROM vip_calls WHERE user_id=$1",
            [vip.user_id]
          );

        }

        // remover VIP do banco
        await pool.query(
          "DELETE FROM vip_users WHERE user_id=$1",
          [vip.user_id]
        );

      }

    }

  } catch (err) {
    console.log("Erro verificando VIP:", err);
  }

}, 60000);
// ================= LOGIN =================
client.login(process.env.TOKEN)
  .then(() => console.log(`✅ Bot iniciado com sucesso!`))
  .catch(err => console.error(`❌ Erro ao iniciar o bot: ${err}`));

// ================= TRATAMENTO DE ERROS =================
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});


  
