// =============================
// IMPORTS
// =============================
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require("discord.js");
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
// CONFIG
// =============================
const PREFIX = "thl!";

const IDS = {
  STAFF: [
    "1468070328138858710",
    "1468069942451507221",
    "1468069638935150635",
    "1468017578747105390"
  ],
  CARGO_ESPECIAL: "1468066422490923081",
  LOG_CHANNEL: "1468722726247338115",
  RULES_CHANNEL: "1468011045166518427",
  TICKET_CATEGORY: "1468014890500489447",
  RECRUITMENT_ROLE: "1468024687031484530"
};

// =============================
// UTILS
// =============================
const parseDuration = (time) => {
  const match = time?.match(/^(\d+)([mh])$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  return unit === "m" ? value * 60_000 : unit === "h" ? value * 3_600_000 : null;
};

const sendLog = (guild, embed) => {
  const channel = guild.channels.cache.get(IDS.LOG_CHANNEL);
  if (channel) channel.send({ embeds: [embed] });
};

const canUseCommand = (member, command) => {
  const isStaff = IDS.STAFF.some(id => member.roles.cache.has(id));
  const hasSpecial = member.roles.cache.has(IDS.CARGO_ESPECIAL);
  const allowedSpecialCommands = ["setarcargo", "removercargo", "rec"];
  return isStaff || (hasSpecial && allowedSpecialCommands.includes(command));
};

// =============================
// SPAM / BIG MESSAGES
// =============================
const messageHistory = new Map();
const bigMessageHistory = new Map();

async function handleSpam(message) {
  if (!message.guild || message.author.bot) return;
  const { member, author, content } = message;
  const userId = author.id;
  const now = Date.now();
  const isStaff = IDS.STAFF.some(id => member.roles.cache.has(id));
  const isEspecial = member.roles.cache.has(IDS.CARGO_ESPECIAL);
  if (isStaff || isEspecial) return;

  // Texto grande
  if (content.length >= 200) {
    const history = bigMessageHistory.get(userId) ?? [];
    history.push(now);
    if (history.length > 3) history.shift();
    bigMessageHistory.set(userId, history);
    if (history.length >= 3) {
      await muteMember(member, "Spam de texto grande", message);
      bigMessageHistory.set(userId, []);
      return;
    }
  }

  // Spam rápido
  const history = messageHistory.get(userId) ?? [];
  const filtered = [...history, now].filter(t => now - t <= 5000);
  messageHistory.set(userId, filtered);
  if (filtered.length >= 5) {
    await muteMember(member, "Spam de palavras rápidas", message);
    messageHistory.set(userId, []);
  }
}

// =============================
// MUTE / UNMUTE
// =============================
const MUTE_DURATION = 2 * 60 * 1000;

async function getMuteRole(guild) {
  let role = guild.roles.cache.find(r => r.name === "Muted");
  if (!role) {
    role = await guild.roles.create({ name: "Muted", permissions: [] });
  }
  return role;
}

async function muteMember(member, motivo, msg = null) {
  const muteRole = await getMuteRole(member.guild);
  if (member.roles.cache.has(muteRole.id)) return;
  await member.roles.add(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🔇 Usuário Mutado")
    .setDescription(`${member} foi mutado automaticamente`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "⏳ Tempo", value: "2 minutos" },
      { name: "📄 Motivo", value: motivo },
      { name: "👮 Staff", value: msg ? msg.client.user.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);

  setTimeout(async () => {
    try {
      if (member.roles.cache.has(muteRole.id)) await member.roles.remove(muteRole);
    } catch {}
  }, MUTE_DURATION);
}

async function unmuteMember(member, msg = null) {
  const muteRole = member.guild.roles.cache.find(r => r.name === "Muted");
  if (!muteRole || !member.roles.cache.has(muteRole.id)) return;
  await member.roles.remove(muteRole);

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("🔊 Usuário Desmutado")
    .setDescription(`${member} foi desmutado`)
    .addFields({ name: "🆔 ID", value: member.id }, { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" })
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);
}

async function unmuteCall(member, msg = null) {
  if (!member.voice?.channel) return;
  try { await member.voice.setMute(false); } catch { return; }

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("🎙 Usuário Desmutado na Call")
    .setDescription(`${member} foi desmutado na call`)
    .addFields({ name: "🆔 ID", value: member.id }, { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" })
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });
  sendLog(member.guild, embed);
}

// =============================
// EVENTO MESSAGE CREATE UNIFICADO
// =============================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // --- SPAM ---
  handleSpam(message);

  // --- PALAVRAS-CHAVE ---
  const KEYWORDS = [
    { regex: /\bsetamento\b/i, reply: "Confira o canal <#1468020392005337161>", color: "Blue", deleteAfter: 30000 },
    { regex: /\bfaixas?\srosa\b/i, reply: "Servidor das Faixas Rosa da Tropa da Holanda. Somente meninas: https://discord.gg/seaaSXG5yJ", color: "Pink", deleteAfter: 15000 },
    { regex: /\bregras\b/i, reply: `<#${IDS.RULES_CHANNEL}>`, color: "Yellow", deleteAfter: 300000 },
    { regex: /\blink da tropa\b/i, reply: "Aqui está o link da Tropa da Holanda: https://discord.gg/tropadaholanda", color: "Purple", deleteAfter: 30000 }
  ];

  for (const k of KEYWORDS) {
    if (k.regex.test(message.content)) {
      try {
        const sent = await message.channel.send(k.reply);
        setTimeout(() => sent.delete().catch(() => {}), k.deleteAfter);
        const embed = new EmbedBuilder().setColor(k.color).setTitle("📌 Palavra Detectada").setDescription(`${message.author} digitou palavra-chave`).setTimestamp();
        sendLog(message.guild, embed);
        break;
      } catch (err) { console.error(err); }
    }
  }

  // --- COMANDOS ---
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  // --- MUTE / UNMUTE CHAT E CALL ---
  if (command === "thl!mutechat") {
    (async () => {
      if (!message.member.permissions.has("ManageMessages")) return message.reply("❌ Você não tem permissão para usar este comando.");
      const member = message.mentions.members.first() || message.guild.members.cache.get(args[1]);
      if (!member) return message.reply("❌ Usuário não encontrado.");
      const durationArg = args[2] || (args[1] && !message.mentions.members.first() ? args[1] : null);
      const duration = parseDuration(durationArg) ?? 2 * 60 * 1000;
      try {
        const muteRole = await getMuteRole(message.guild);
        await member.roles.add(muteRole);
        message.channel.send(`🔇 ${member} foi mutado no chat por ${durationArg ?? "2m"}.`);
        setTimeout(async () => { 
          if (member.roles.cache.has(muteRole.id)) { 
            await member.roles.remove(muteRole).catch(() => {}); 
            message.channel.send(`🔊 ${member} foi desmutado automaticamente.`); 
          } 
        }, duration);
        sendLog(message.guild, new EmbedBuilder().setColor("Red").setTitle("🔇 Usuário Mutado no Chat").setDescription(`${member} foi mutado por ${message.author}`).addFields({ name: "⏱ Duração", value: durationArg ?? "2 minutos" }).setTimestamp());
      } catch (err) { console.error(err); message.reply("❌ Não foi possível mutar o usuário."); }
    })();
  }

  if (command === "thl!unmutechat") {
    (async () => {
      const member = message.mentions.members.first() || message.guild.members.cache.get(args[1]);
      if (!member) return message.reply("❌ Usuário não encontrado.");
      try {
        const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
        if (muteRole && member.roles.cache.has(muteRole.id)) { 
          await member.roles.remove(muteRole); 
          message.channel.send(`🔊 ${member} foi desmutado no chat.`); 
          sendLog(message.guild, new EmbedBuilder().setColor("Green").setTitle("🔊 Usuário Desmutado no Chat").setDescription(`${member} foi desmutado por ${message.author}`).setTimestamp()); 
        }
      } catch (err) { console.error(err); message.reply("❌ Não foi possível desmutar o usuário."); }
    })();
  }

  if (command === "thl!mutecall") {
    (async () => {
      const member = message.mentions.members.first() || message.guild.members.cache.get(args[1]);
      if (!member) return message.reply("❌ Usuário não encontrado.");
      if (!member.voice.channel) return message.reply("❌ Usuário não está em uma call.");
      const durationArg = args[2] || (args[1] && !message.mentions.members.first() ? args[1] : null);
      const duration = parseDuration(durationArg) ?? 2 * 60 * 1000;
      try {
        await member.voice.setMute(true);
        message.channel.send(`🔇 ${member} foi mutado na call por ${durationArg ?? "2m"}.`);
        setTimeout(async () => { 
          if (member.voice.mute) { 
            await member.voice.setMute(false).catch(() => {}); 
            message.channel.send(`🔊 ${member} foi desmutado automaticamente da call.`); 
          } 
        }, duration);
        sendLog(message.guild, new EmbedBuilder().setColor("Red").setTitle("🔇 Usuário Mutado na Call").setDescription(`${member} foi mutado por ${message.author}`).addFields({ name: "⏱ Duração", value: durationArg ?? "2 minutos" }).setTimestamp());
      } catch (err) { console.error(err); message.reply("❌ Não foi possível mutar o usuário na call."); }
    })();
  }

  if (command === "thl!unmutecall") {
    (async () => {
      const member = message.mentions.members.first() || message.guild.members.cache.get(args[1]);
      if (!member) return message.reply("❌ Usuário não encontrado.");
      if (!member.voice.channel) return message.reply("❌ Usuário não está em uma call.");
      try { 
        await member.voice.setMute(false); 
        message.channel.send(`🔊 ${member} foi desmutado na call.`); 
        sendLog(message.guild, new EmbedBuilder().setColor("Green").setTitle("🔊 Usuário Desmutado na Call").setDescription(`${member} foi desmutado por ${message.author}`).setTimestamp()); 
      } catch (err) { console.error(err); message.reply("❌ Não foi possível desmutar o usuário na call."); }
    })();
  }

// ===== COMANDO THL!REC =====
if (command === "thl!rec") {
  (async () => {
    const argsRec = args.slice(1);
    if (!argsRec[0]) return message.reply("❌ Você precisa mencionar um usuário ou colocar o ID! Ex: thl!rec @user");

    const executor = message.member;
    const recMember = message.mentions.members.first() || message.guild.members.cache.get(argsRec[0]);
    if (!recMember) return message.reply("❌ Não consegui encontrar esse usuário no servidor!");

    const cargos = [
      { label: "Verificado ✔️", value: "1468283328510558208" },
      { label: "Equipe Tropa da Holanda 🇳🇱", value: "1468026315285205094" },
      { label: "Faixas Rosas 🎀", value: "1472223890821611714" }
    ];

    // Menu inicial: escolher ação
    const actionRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`rec_action_${recMember.id}_${executor.id}`)
        .setPlaceholder("Escolha uma ação")
        .addOptions([
          { label: "Adicionar Cargos", value: "add" },
          { label: "Remover Cargos", value: "remove" }
        ])
    );

    const embed = new EmbedBuilder()
      .setTitle("🎯 Recrutamento")
      .setDescription(`Selecione se deseja adicionar ou remover cargos para ${recMember}`)
      .setColor("Green");

    const menuMessage = await message.channel.send({ embeds: [embed], components: [actionRow] });

    // Coletor da primeira escolha (add ou remove)
    const filter = i => i.user.id === executor.id;
    const collector = menuMessage.createMessageComponentCollector({ filter, max: 1, time: 600000 });

    collector.on("collect", async interaction => {
      if (!interaction.isStringSelectMenu()) return;
      if (!interaction.customId.startsWith("rec_action")) return;

      const action = interaction.values[0]; // add ou remove

      // Menu de seleção de cargos
      const cargoRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`rec_roles_${recMember.id}_${executor.id}_${action}`)
          .setPlaceholder("Selecione os cargos")
          .setMinValues(1)
          .setMaxValues(cargos.length)
          .addOptions(cargos)
      );

      const cargoEmbed = new EmbedBuilder()
        .setTitle(`🎯 ${action === "add" ? "Adicionar" : "Remover"} Cargos`)
        .setDescription(`Selecione os cargos que deseja ${action === "add" ? "adicionar" : "remover"} para ${recMember}`)
        .setColor(action === "add" ? "Green" : "Red");

      await interaction.update({ embeds: [cargoEmbed], components: [cargoRow] });

      // Coletor do menu de cargos
      const roleCollector = menuMessage.createMessageComponentCollector({ filter, max: 1, time: 600000 });

      roleCollector.on("collect", async i => {
        if (!i.isStringSelectMenu()) return;
        if (!i.customId.startsWith("rec_roles")) return;

        const [_, memberId, executorId, actionType] = i.customId.split("_");
        if (i.user.id !== executor.id) return;

        const targetMember = message.guild.members.cache.get(memberId);
        if (!targetMember) return i.reply({ content: "❌ Usuário não encontrado.", ephemeral: true });

        if (actionType === "add") {
          await targetMember.roles.add(i.values).catch(() => {});
          await i.update({ content: `✅ Cargos adicionados em ${targetMember}`, embeds: [], components: [] });
        } else if (actionType === "remove") {
          await targetMember.roles.remove(i.values).catch(() => {});
          await i.update({ content: `✅ Cargos removidos de ${targetMember}`, embeds: [], components: [] });
        }
      });
    });
  })();
}
  
// =============================
// READY & LOGIN
// =============================
client.once("ready", () => {
  console.log(`✅ Bot online! ${client.user.tag}`);
  client.user.setActivity("byks05 | https://Discord.gg/TropaDaHolanda", { type: 3 });
});

client.login(process.env.TOKEN);
