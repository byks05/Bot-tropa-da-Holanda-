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

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildVoiceStates,
GatewayIntentBits.GuildMembers
]});

const pool = new Pool({
connectionString:process.env.DATABASE_URL,
ssl:{rejectUnauthorized:false}
});

const PREFIX = "ne!";

const IDS = {

STAFF_ROLE:"1468017578747105390",
LOG_VIP:"1478697992071549081",

CATEGORIA_SOL_BRISA:"1478567017832251392",
CATEGORIA_FOGO:"1478695052015308800",
CATEGORIA_IMPERIO:"1478694889167257784",

CARGOS:{
SOL:"1478567864175693865",
BRISA:"1478567921243521266",
FOGO:"1478567970711273675",
IMPERIO:"1478568023358050425"
}

};

let aguardando = {};

client.once("ready",async()=>{

console.log(`🔥 Bot online ${client.user.tag}`);

await pool.query(`
CREATE TABLE IF NOT EXISTS vip_users(
user_id TEXT PRIMARY KEY,
cargo_id TEXT,
tipo TEXT,
expira BIGINT
)
`);

await pool.query(`
CREATE TABLE IF NOT EXISTS vip_calls(
user_id TEXT PRIMARY KEY,
channel_id TEXT,
cargo_id TEXT,
tipo TEXT
)
`);

});

function categoriaVIP(tipo){

if(tipo==="sol"||tipo==="brisa") return IDS.CATEGORIA_SOL_BRISA;
if(tipo==="fogo") return IDS.CATEGORIA_FOGO;
if(tipo==="imperio") return IDS.CATEGORIA_IMPERIO;

}

async function logVIP(guild,msg){

const canal = guild.channels.cache.get(IDS.LOG_VIP);
if(canal) canal.send(msg);

}

client.on("messageCreate",async message=>{

if(message.author.bot) return;

if(message.content===`${PREFIX}vip`){

const member = message.member;

const vipRole = Object.entries(IDS.CARGOS).find(([k,id])=>
member.roles.cache.has(id)
);

if(!vipRole) return message.reply("❌ Você não possui VIP.");

const embed = new EmbedBuilder()
.setTitle("👑 Painel VIP")
.setColor("Orange")
.setDescription("Controle sua call VIP");

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("criar_call")
.setLabel("🎤 Criar Call")
.setStyle(ButtonStyle.Primary),

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
.setCustomId("renomear_cargo")
.setLabel("🏷 Renomear Cargo")
.setStyle(ButtonStyle.Secondary)

);

const row2 = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("cor_cargo")
.setLabel("🎨 Cor do Cargo")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("liberar")
.setLabel("👤 Liberar Amigo")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("deletar_call")
.setLabel("🗑 Excluir Call")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("fechar")
.setLabel("❌ Fechar")
.setStyle(ButtonStyle.Danger)

);

message.reply({
embeds:[embed],
components:[row,row2]
});

}
  // ================= PAINEL STAFF =================

if(message.content === `${PREFIX}vipstaff`){

if(!message.member.roles.cache.has(IDS.STAFF_ROLE))
return message.reply("❌ Apenas STAFF.");

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

message.reply({
embeds:[embed],
components:[row]
});

}

});

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

const member = interaction.member;

if(interaction.customId==="fechar")
return interaction.message.delete().catch(()=>{});

if(interaction.customId==="criar_call"){

aguardando[member.id]="criar_call";

return interaction.reply({
content:"Digite o nome da call.",
ephemeral:true
});

}

if(interaction.customId==="criar_cargo"){

aguardando[member.id]="criar_cargo";

return interaction.reply({
content:"Digite o nome do cargo.",
ephemeral:true
});

}

if(interaction.customId==="limite"){

aguardando[member.id]="limite";

return interaction.reply({
content:"Digite o limite da call.",
ephemeral:true
});

}

if(interaction.customId==="liberar"){

aguardando[member.id]="liberar";

return interaction.reply({
content:"Marque o amigo.",
ephemeral:true
});

}
  // ================= STAFF DAR VIP =================

if(interaction.customId === "staff_darvip"){

aguardando[interaction.user.id] = "staff_darvip";

return interaction.reply({
content:"Use no chat:\n`@user tipo dias`\nExemplo:\n`@kaique sol 30`",
ephemeral:true
});

}

// ================= STAFF RENOVAR =================

if(interaction.customId === "staff_renovarvip"){

aguardando[interaction.user.id] = "staff_renovar";

return interaction.reply({
content:"Use no chat:\n`@user dias`\nExemplo:\n`@kaique 30`",
ephemeral:true
});

}

// ================= STAFF REMOVER =================

if(interaction.customId === "staff_removervip"){

aguardando[interaction.user.id] = "staff_remover";

return interaction.reply({
content:"Marque o usuário para remover VIP.",
ephemeral:true
});

}

// ================= VER VIPS =================

if(interaction.customId === "staff_vervips"){

const vips = await pool.query("SELECT * FROM vip_users");

let lista="";

for(const v of vips.rows){

let dias = Math.floor((v.expira-Date.now())/86400000);

lista+=`<@${v.user_id}> • ${dias} dias\n`;

}

interaction.reply({
content:lista || "Nenhum VIP.",
ephemeral:true
});

}

// ================= LOGS =================

if(interaction.customId === "staff_logs"){

interaction.reply({
content:`Canal de logs: <#${IDS.LOG_VIP}>`,
ephemeral:true
});

}

});

client.on("messageCreate",async message=>{

if(message.author.bot) return;

const estado = aguardando[message.author.id];
if(!estado) return;

delete aguardando[message.author.id];

const member = message.member;

// ================= CRIAR CALL =================

if(estado==="criar_call"){

const vipRole = Object.entries(IDS.CARGOS).find(([k,id]) =>
member.roles.cache.has(id)
);

if(!vipRole) return message.reply("❌ Você não possui VIP.");

const tipo = vipRole[0].toLowerCase();

const canal = await message.guild.channels.create({
name:message.content,
type:2,
parent:categoriaVIP(tipo)
}).catch(()=>null);

if(!canal) return message.reply("❌ Erro ao criar call.");

await pool.query(`
INSERT INTO vip_calls(user_id,channel_id,tipo)
VALUES($1,$2,$3)
ON CONFLICT(user_id)
DO UPDATE SET channel_id=$2,tipo=$3
`,[member.id,canal.id,tipo]);

message.reply("✅ Call criada.");

}

// ================= CRIAR CARGO =================

if(estado === "criar_cargo"){

const call = await pool.query(
"SELECT * FROM calls_ativas WHERE user_id=$1",
[member.id]
);

// limite de 1 cargo
if(call.rows.length && call.rows[0].cargo_id)
return message.reply("❌ Você já possui um cargo VIP.");

const cargo = await message.guild.roles.create({
name: message.content
}).catch(()=>null);

if(!cargo) return message.reply("❌ Erro ao criar cargo.");

await member.roles.add(cargo).catch(()=>{});

await pool.query(`
UPDATE calls_ativas
SET cargo_id=$1
WHERE user_id=$2
`, [cargo.id, member.id]);

message.reply("✅ Cargo criado.");

}


// ================= LIMITE CALL =================

if(estado === "limite"){

const limite = parseInt(message.content);

if(isNaN(limite) || limite < 0)
return message.reply("❌ Número inválido.");

const call = await pool.query(
"SELECT * FROM calls_ativas WHERE user_id=$1",
[member.id]
);

// precisa existir call
if(!call.rows.length)
return message.reply("❌ Você não possui uma call.");

const canal = message.guild.channels.cache.get(call.rows[0].channel_id);

if(!canal)
return message.reply("❌ Call não encontrada.");

await canal.setUserLimit(limite).catch(()=>{});

message.reply("✅ Limite atualizado.");

}
// ================= LIBERAR AMIGO =================

if(estado==="liberar"){

const amigo = message.mentions.members.first();

if(!amigo) return message.reply("❌ Marque um amigo.");

const call = await pool.query(
"SELECT * FROM vip_calls WHERE user_id=$1",
[member.id]
);

if(!call.rows.length)
return message.reply("❌ Você não possui call.");

const cargo = message.guild.roles.cache.get(call.rows[0].cargo_id);

if(!cargo) return;

await amigo.roles.add(cargo).catch(()=>{});

message.reply(`✅ ${amigo.user.username} liberado na call.`);

}
  // ================= STAFF DAR VIP CHAT =================

if(estado === "staff_darvip"){

if(!message.member.roles.cache.has(IDS.STAFF_ROLE)) return;

const user = message.mentions.members.first();
const tipo = message.content.split(" ")[1];
const dias = message.content.split(" ")[2];

if(!user || !tipo || !dias)
return message.reply("❌ Formato inválido.");

const cargo = IDS.CARGOS[tipo.toUpperCase()];

let expira = Date.now() + (parseInt(dias)*86400000);

await pool.query(`
INSERT INTO vip_users(user_id,cargo_id,tipo,expira)
VALUES($1,$2,$3,$4)
ON CONFLICT(user_id)
DO UPDATE SET cargo_id=$2,tipo=$3,expira=$4
`,[user.id,cargo,tipo,expira]);

await user.roles.add(cargo);

message.reply("👑 VIP ativado.");

logVIP(message.guild,`👑 VIP ${tipo} dado a ${user}`);

}

// ================= STAFF REMOVER =================

if(estado === "staff_remover"){

const user = message.mentions.members.first();
if(!user) return;

await pool.query("DELETE FROM vip_users WHERE user_id=$1",[user.id]);

Object.values(IDS.CARGOS).forEach(async cargo=>{
if(user.roles.cache.has(cargo))
await user.roles.remove(cargo).catch(()=>{});
});

message.reply("🗑 VIP removido.");

logVIP(message.guild,`🗑 VIP removido de ${user}`);

}

// ================= STAFF RENOVAR =================

if(estado === "staff_renovar"){

const user = message.mentions.members.first();
const dias = message.content.split(" ")[1];

if(!user || !dias) return;

const vip = await pool.query(
"SELECT * FROM vip_users WHERE user_id=$1",
[user.id]
);

if(!vip.rows.length)
return message.reply("Usuário não tem VIP.");

let novo = Date.now() + (parseInt(dias) * 86400000);
  
await pool.query(
"UPDATE vip_users SET expira=$1 WHERE user_id=$2",
[novo,user.id]
);

message.reply("🔁 VIP renovado.");

logVIP(message.guild,`🔁 VIP renovado ${user}`);

}

});

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

const member = interaction.member;

// ================= RENOMEAR CALL =================

if(interaction.customId==="renomear_call"){

aguardando[member.id]="renomear_call";

return interaction.reply({
content:"Digite o novo nome da call.",
ephemeral:true
});

}

// ================= RENOMEAR CARGO =================

if(interaction.customId==="renomear_cargo"){

aguardando[member.id]="renomear_cargo";

return interaction.reply({
content:"Digite o novo nome do cargo.",
ephemeral:true
});

}

// ================= DELETAR CALL =================

if(interaction.customId==="deletar_call"){

const call = await pool.query(
"SELECT * FROM vip_calls WHERE user_id=$1",
[member.id]
);

if(!call.rows.length)
return interaction.reply({content:"❌ Sem call.",ephemeral:true});

const canal = interaction.guild.channels.cache.get(call.rows[0].channel_id);

if(canal) await canal.delete().catch(()=>{});

await pool.query(
"DELETE FROM vip_calls WHERE user_id=$1",
[member.id]
);

interaction.reply({
content:"🗑 Call deletada.",
ephemeral:true
});

}

// ================= DELETAR CARGO =================

if(interaction.customId==="deletar_cargo"){

const call = await pool.query(
"SELECT * FROM vip_calls WHERE user_id=$1",
[member.id]
);

if(!call.rows.length)
return interaction.reply({content:"❌ Sem cargo.",ephemeral:true});

const cargo = interaction.guild.roles.cache.get(call.rows[0].cargo_id);

if(cargo) await cargo.delete().catch(()=>{});

interaction.reply({
content:"🗑 Cargo deletado.",
ephemeral:true
});

}

});

setInterval(async()=>{

const vips = await pool.query("SELECT * FROM vip_users");

for(const vip of vips.rows){

if(Date.now()>=vip.expira){

const guild = client.guilds.cache.first();

const member = await guild.members.fetch(vip.user_id).catch(()=>null);

if(member){
await member.roles.remove(vip.cargo_id).catch(()=>{});
}

await pool.query("DELETE FROM vip_users WHERE user_id=$1",[vip.user_id]);

logVIP(guild,`⌛ VIP expirou <@${vip.user_id}>`);

}

}

},60000);

client.login(process.env.TOKEN);

