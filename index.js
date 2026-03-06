require("dotenv").config();

const {
Client,
GatewayIntentBits,
PermissionsBitField,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
ModalBuilder,
TextInputBuilder,
TextInputStyle,
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

// COMANDO VIP
client.on("messageCreate", async (message) => {

if(message.author.bot) return;
if(message.content.toLowerCase() !== `${PREFIX}vip`) return;

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
.setCustomId("limite")
.setLabel("👥 Alterar Limite")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("nome_call")
.setLabel("✏ Nome da Call")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("nome_cargo")
.setLabel("🏷 Nome do Cargo")
.setStyle(ButtonStyle.Secondary),

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

});

// BOTÕES
client.on("interactionCreate", async interaction => {

if(!interaction.isButton()) return;

const member = interaction.member;

if(interaction.customId === "fechar"){
return interaction.message.delete().catch(()=>{});
}

// CRIAR CARGO
if(interaction.customId === "criar_cargo"){

const modal = new ModalBuilder()
.setCustomId("modal_cargo")
.setTitle("Criar Cargo");

const input = new TextInputBuilder()
.setCustomId("nome")
.setLabel("Nome do cargo")
.setStyle(TextInputStyle.Short);

modal.addComponents(new ActionRowBuilder().addComponents(input));

return interaction.showModal(modal);

}

// CRIAR CALL
if(interaction.customId === "criar_call"){

const vipRole = Object.entries(IDS.CARGOS).find(([k,id]) =>
member.roles.cache.has(id)
);

const tipo = vipRole[0].toLowerCase();

let categoria = IDS.CATEGORIA_VIP;

if(tipo === "fogo") categoria = IDS.CATEGORIA_FOGO;
if(tipo === "imperio") categoria = IDS.CATEGORIA_IMPERIO;

let nome = `call-${member.user.username}`;

if(tipo === "fogo" || tipo === "imperio"){

const modal = new ModalBuilder()
.setCustomId("modal_nomecall")
.setTitle("Nome da Call");

const input = new TextInputBuilder()
.setCustomId("nome")
.setLabel("Digite o nome da call")
.setStyle(TextInputStyle.Short);

modal.addComponents(new ActionRowBuilder().addComponents(input));

return interaction.showModal(modal);

}

const canal = await interaction.guild.channels.create({
name: nome,
type: 2,
parent: categoria
});

await pool.query(
"INSERT INTO calls_ativas (user_id,channel_id,tipo) VALUES ($1,$2,$3)",
[member.id, canal.id, tipo]
);

return interaction.reply({content:"✅ Call criada!",ephemeral:true});

}

// DELETAR CALL
if(interaction.customId === "deletar"){

const call = await pool.query(
"SELECT * FROM calls_ativas WHERE user_id = $1",
[member.id]
);

if(!call.rows.length)
return interaction.reply({content:"❌ Nenhuma call.",ephemeral:true});

const canal = interaction.guild.channels.cache.get(call.rows[0].channel_id);

if(canal) await canal.delete();

await pool.query(
"DELETE FROM calls_ativas WHERE user_id = $1",
[member.id]
);

interaction.reply({content:"🗑 Call deletada.",ephemeral:true});

}

});

// AUTO DELETE
client.on("voiceStateUpdate", async oldState => {

if(!oldState.channelId) return;

const canal = oldState.guild.channels.cache.get(oldState.channelId);

if(!canal) return;

if(canal.members.size !== 0) return;

const call = await pool.query(
"SELECT * FROM calls_ativas WHERE channel_id = $1",
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
"DELETE FROM calls_ativas WHERE channel_id = $1",
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

const args = message.content.split(" ");

if(message.content.startsWith(`${PREFIX}vipdar`)){

if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.reply("❌ Sem permissão.");

const user = message.mentions.members.first();

const args = message.content.split(" ").slice(1);

const tipo = args[1]?.toLowerCase();
const tempo = args[2];

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

message.reply(`👑 VIP ${tipo.toUpperCase()} ativado em ${user.user.username}.`);

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

// RENOVAR
if(message.content.startsWith(`${PREFIX}viprenovar`)){

const user = message.mentions.members.first();
const tempo = args[2];

if(!user || !tempo)
return message.reply("Use: ne!viprenovar @user 30d");

let tempoMs = parseInt(tempo) * 86400000;

const vip = await pool.query(
"SELECT * FROM vip_sistema WHERE user_id=$1",
[user.id]
);

if(!vip.rows.length)
return message.reply("Usuário não possui VIP.");

const novo = vip.rows[0].expira + tempoMs;

await pool.query(
"UPDATE vip_sistema SET expira=$1 WHERE user_id=$2",
[novo,user.id]
);

message.reply("🔁 VIP renovado.");

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

// EXPIRAÇÃO AUTOMÁTICA
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
