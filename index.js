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
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildVoiceStates,
GatewayIntentBits.GuildMembers
]
});

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false }
});

const PREFIX = "ne!";

const aguardandoCargo = new Map();
const aguardandoCall = new Map();

// IDS
const IDS = {

CATEGORIA_VIP: "1478567017832251392",
CATEGORIA_FOGO: "1478695052015308800",
CATEGORIA_IMPERIO: "1478694889167257784",

CARGOS: {
SOL: "1478567864175693865",
BRISA: "1478567921243521266",
FOGO: "1478567970711273675",
IMPERIO: "1478568023358050425"
}

};

client.once("ready", async () => {

console.log(`🔥 Bot online ${client.user.tag}`);

await pool.query(`
CREATE TABLE IF NOT EXISTS calls_ativas (
id SERIAL PRIMARY KEY,
user_id TEXT NOT NULL,
channel_id TEXT,
cargo_id TEXT,
tipo TEXT NOT NULL,
criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

await pool.query(`
CREATE TABLE IF NOT EXISTS vip_sistema (
user_id TEXT PRIMARY KEY,
cargo_id TEXT NOT NULL,
expira BIGINT
)
`);

});

// PAINEL VIP
client.on("messageCreate", async (message) => {

if(message.author.bot) return;

if(message.content === `${PREFIX}vip`){

const member = message.member;

const vipRole = Object.entries(IDS.CARGOS).find(([k,id]) =>
member.roles.cache.has(id)
);

if(!vipRole)
return message.reply("❌ Você não possui VIP.");

const tipo = vipRole[0].toLowerCase();

const data = await pool.query(
"SELECT * FROM calls_ativas WHERE user_id = $1",
[member.id]
);

const embed = new EmbedBuilder()
.setTitle("🎛 Painel VIP")
.setDescription(`👤 Usuário: ${member.user.username}\nVIP: ${tipo.toUpperCase()}`)
.setColor("Orange");

const row = new ActionRowBuilder();

if(!data.rows.length){

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

}else{

row.addComponents(

new ButtonBuilder()
.setCustomId("deletar")
.setLabel("🗑 Deletar Call")
.setStyle(ButtonStyle.Danger)

);

}

message.reply({
embeds:[embed],
components:[row]
});

}

// NOME DO CARGO
if(aguardandoCargo.has(message.author.id)){

const nome = message.content;

aguardandoCargo.delete(message.author.id);

try{

const cargo = await message.guild.roles.create({
name:nome
});

await message.member.roles.add(cargo);

await pool.query(
"UPDATE calls_ativas SET cargo_id=$1 WHERE user_id=$2",
[cargo.id,message.author.id]
);

message.reply(`✅ Cargo **${nome}** criado.`);

}catch{
message.reply("❌ Erro ao criar cargo.");
}

}

// NOME DA CALL
if(aguardandoCall.has(message.author.id)){

const nome = message.content;

aguardandoCall.delete(message.author.id);

const vipRole = Object.entries(IDS.CARGOS).find(([k,id]) =>
message.member.roles.cache.has(id)
);

const tipo = vipRole[0].toLowerCase();

let categoria = IDS.CATEGORIA_VIP;

if(tipo === "fogo") categoria = IDS.CATEGORIA_FOGO;
if(tipo === "imperio") categoria = IDS.CATEGORIA_IMPERIO;

try{

const canal = await message.guild.channels.create({
name:nome,
type:2,
parent:categoria
});

await pool.query(
"INSERT INTO calls_ativas (user_id,channel_id,tipo) VALUES ($1,$2,$3)",
[message.author.id,canal.id,tipo]
);

message.reply(`✅ Call **${nome}** criada.`);

}catch{

message.reply("❌ Erro ao criar call.");

}

}

});

// BOTÕES
client.on("interactionCreate", async interaction => {

if(!interaction.isButton()) return;

const user = interaction.user;

if(interaction.customId === "fechar"){
return interaction.message.delete().catch(()=>{});
}

// CRIAR CARGO
if(interaction.customId === "criar_cargo"){

aguardandoCargo.set(user.id,true);

return interaction.reply({
content:"💬 Digite no chat o nome do cargo.",
ephemeral:true
});

}

// CRIAR CALL
if(interaction.customId === "criar_call"){

aguardandoCall.set(user.id,true);

return interaction.reply({
content:"💬 Digite no chat o nome da call.",
ephemeral:true
});

}

// DELETAR CALL
if(interaction.customId === "deletar"){

const call = await pool.query(
"SELECT * FROM calls_ativas WHERE user_id=$1",
[user.id]
);

if(!call.rows.length)
return interaction.reply({content:"❌ Nenhuma call.",ephemeral:true});

const canal = interaction.guild.channels.cache.get(call.rows[0].channel_id);

if(canal) await canal.delete();

await pool.query(
"DELETE FROM calls_ativas WHERE user_id=$1",
[user.id]
);

interaction.reply({content:"🗑 Call deletada.",ephemeral:true});

}

});

// AUTO DELETE CALL
client.on("voiceStateUpdate", async oldState => {

if(!oldState.channelId) return;

const canal = oldState.guild.channels.cache.get(oldState.channelId);

if(!canal) return;

if(canal.members.size !== 0) return;

const call = await pool.query(
"SELECT * FROM calls_ativas WHERE channel_id=$1",
[canal.id]
);

if(!call.rows.length) return;

const tipo = call.rows[0].tipo;

if(tipo === "sol" || tipo === "brisa"){

setTimeout(async ()=>{

const canalCheck = oldState.guild.channels.cache.get(canal.id);

if(canalCheck && canalCheck.members.size === 0){

await canalCheck.delete();

await pool.query(
"DELETE FROM calls_ativas WHERE channel_id=$1",
[canal.id]
);

}

},300000);

}

});

// ================= VIP STAFF =================

// DAR VIP
client.on("messageCreate", async message => {

if(message.author.bot) return;

if(message.content.startsWith(`${PREFIX}vipdar`)){

if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.reply("❌ Sem permissão.");

const args = message.content.split(" ");

const user = message.mentions.members.first();
const tipo = args[2]?.toLowerCase();
const tempo = args[3];

if(!user || !tipo || !tempo)
return message.reply("Use: ne!vipdar @user sol/brisa/fogo/imperio 30d");

const cargo = IDS.CARGOS[tipo.toUpperCase()];

if(!cargo)
return message.reply("VIP inválido.");

let tempoMs = parseInt(tempo) * 86400000;

const expira = Date.now() + tempoMs;

await pool.query(`
INSERT INTO vip_sistema (user_id,cargo_id,expira)
VALUES ($1,$2,$3)
ON CONFLICT (user_id)
DO UPDATE SET cargo_id=$2,expira=$3
`,[user.id,cargo,expira]);

await user.roles.add(cargo);

message.reply(`👑 VIP ${tipo.toUpperCase()} ativado.`);

}

// REMOVER VIP
if(message.content.startsWith(`${PREFIX}vipremover`)){

const user = message.mentions.members.first();

if(!user) return;

const vip = await pool.query(
"SELECT * FROM vip_sistema WHERE user_id=$1",
[user.id]
);

if(!vip.rows.length)
return message.reply("Usuário não possui VIP.");

await user.roles.remove(vip.rows[0].cargo_id);

await pool.query(
"DELETE FROM vip_sistema WHERE user_id=$1",
[user.id]
);

message.reply("🗑 VIP removido.");

}

// LISTAR VIPS
if(message.content === `${PREFIX}vips`){

const vips = await pool.query("SELECT * FROM vip_sistema");

let lista = "";

for(const vip of vips.rows){

const user = await message.guild.members.fetch(vip.user_id).catch(()=>null);

if(!user) continue;

const dias = Math.floor((vip.expira - Date.now())/86400000);

lista += `👑 ${user.user.username} • ${dias} dias\n`;

}

const embed = new EmbedBuilder()
.setTitle("📊 VIPs Ativos")
.setDescription(lista || "Nenhum VIP ativo.")
.setColor("Gold");

message.reply({embeds:[embed]});

}

});

// EXPIRAÇÃO
setInterval(async ()=>{

const vips = await pool.query("SELECT * FROM vip_sistema");

for(const vip of vips.rows){

if(Date.now() >= vip.expira){

const guild = client.guilds.cache.first();

const member = await guild.members.fetch(vip.user_id).catch(()=>null);

if(member){
await member.roles.remove(vip.cargo_id).catch(()=>{});
}

await pool.query(
"DELETE FROM vip_sistema WHERE user_id=$1",
[vip.user_id]
);

}

}

},60000);

client.login(process.env.TOKEN);
  
