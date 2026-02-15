const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ChannelType 
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

  return unit === "m"
    ? value * 60_000
    : unit === "h"
    ? value * 3_600_000
    : null;
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
// SPAM
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
    role = await guild.roles.create({
      name: "Muted",
      permissions: []
    });
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
      if (member.roles.cache.has(muteRole.id)) {
        await member.roles.remove(muteRole);
      }
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
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });

  sendLog(member.guild, embed);
}

async function unmuteCall(member, msg = null) {
  if (!member.voice?.channel) return;

  try {
    await member.voice.setMute(false);
  } catch {
    return;
  }

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("🎙 Usuário Desmutado na Call")
    .setDescription(`${member} foi desmutado na call`)
    .addFields(
      { name: "🆔 ID", value: member.id },
      { name: "👮 Staff", value: msg ? msg.author.tag : "Sistema" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();

  if (msg?.channel) await msg.channel.send({ embeds: [embed] });

  sendLog(member.guild, embed);
}


// =============================
// MENSAGENS
// =============================

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const KEYWORDS = [
    {
      regex: /\bsetamento\b/i,
      reply: "Confira o canal <#1468020392005337161>",
      color: "Blue",
      deleteAfter: 30000
    },
    {
      regex: /\bfaixas?\srosa\b/i,
      reply: "Servidor das Faixas Rosa da Tropa da Holanda. Somente meninas: https://discord.gg/seaaSXG5yJ",
      color: "Pink",
      deleteAfter: 15000
    },
    {
      regex: /\bregras\b/i,
      reply: `<#${IDS.RULES_CHANNEL}>`,
      color: "Yellow",
      deleteAfter: 300000
    },
    {
      regex: /\blink da tropa\b/i,
      reply: "Aqui está o link da Tropa da Holanda: https://discord.gg/tropadaholanda",
      color: "Purple",
      deleteAfter: 30000
    }
  ];

  for (const k of KEYWORDS) {
    if (!k.regex.test(message.content)) continue;

    try {
      const sent = await message.channel.send(k.reply);
      setTimeout(() => sent.delete().catch(() => {}), k.deleteAfter);

      const embed = new EmbedBuilder()
        .setColor(k.color)
        .setTitle("📌 Palavra Detectada")
        .setDescription(`${message.author} digitou palavra-chave`)
        .setTimestamp();

      sendLog(message.guild, embed);
      break;

    } catch (err) {
      console.error(err);
    }
  }

  await handleSpam(message);
});


client.on("interactionCreate", async (interaction) => {

  if (!interaction.isStringSelectMenu()) return;

  const parts = interaction.customId.split("_");
  const action = parts[0];
  const userId = parts[2];
  const executorId = parts[3];

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  const executor = await interaction.guild.members.fetch(executorId).catch(() => null);
  if (!member) return;

  // ===== SETAR CARGOS =====
  if (["setarcargo", "Membros", "TropaDaHolanda"].includes(action)) {

    const isStaff = IDS.STAFF.some(id => executor?.roles.cache.has(id));

    if (action === "TropaDaHolanda" && !isStaff) {
      return interaction.reply({
        content: "❌ Você não pode selecionar cargos nessa categoria.",
        ephemeral: true
      });
    }

    for (const roleId of interaction.values) {
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId).catch(() => {});
      }
    }

    await interaction.update({
      content: `✅ Cargos adicionados para ${member}`,
      embeds: [],
      components: []
    });

    if (executor) {
      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("📌 Comando Executado")
        .setDescription(`${executor} executou ${action} em ${member}`)
        .setTimestamp();

      sendLog(interaction.guild, embed);
    }
  }

  // ===== REMOVER CARGOS =====
  if (action === "removercargo") {

    for (const roleId of interaction.values) {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId).catch(() => {});
      }
    }

    await interaction.update({
      content: `🗑 Cargos removidos de ${member}`,
      embeds: [],
      components: []
    });

    if (executor) {
      const embed = new EmbedBuilder()
        .setColor("Orange")
        .setTitle("📌 Comando Executado")
        .setDescription(`${executor} executou removercargo em ${member}`)
        .setTimestamp();

      sendLog(interaction.guild, embed);
    }
  }

});

// ===== RECRUTAMENTO CICLICO (thl!rec) =====
if (action === "rec") {

  const recMember = member;
  const recExecutor = executor;

  const menuPrincipal = async () => {
    const embed = new EmbedBuilder()
      .setTitle("🎯 Recrutamento")
      .setDescription(`Selecione uma ação para ${recMember}:`)
      .setColor("Green");

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`rec_init_${recMember.id}_${recExecutor.id}`)
        .setPlaceholder("Escolha uma ação")
        .addOptions([
          { label: "Adicionar", value: "adicionar", emoji: "➕" },
          { label: "Remover", value: "remover", emoji: "➖" },
          { label: "Concluído", value: "concluido", emoji: "✅" }
        ])
    );

    await interaction.update({ embeds: [embed], components: [row] });
  };

// ================= INIT =================
if (subAction === "init") {

  const choice = interaction.values[0];

  // ===== ADICIONAR =====
  if (choice === "adicionar") {

    const categoria = CATEGORIAS.find(c =>
      c.label === "Faixa Rosas (Somente Meninas)"
    );

    if (!categoria) {
      return interaction.update({
        content: "❌ Categoria não encontrada.",
        embeds: [],
        components: []
      });
    }

    const options = categoria.options.map(o => ({
      label: o.label,
      value: o.id
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`rec_add_${recMember.id}_${recExecutor.id}`)
        .setPlaceholder("Selecione cargos para adicionar")
        .setMinValues(1)
        .setMaxValues(options.length)
        .addOptions(options)
    );

    return interaction.update({
      content: `🎯 Adicionar cargos para ${recMember}`,
      embeds: [],
      components: [row]
    });
  }
  
    // ===== REMOVER =====
    if (choice === "remover") {

  const userRoles = recMember.roles.cache
    .filter(r => r.id !== recMember.guild.id)
    .map(r => ({ label: r.name, value: r.id }));

  if (!userRoles.length) {
    return interaction.update({
      content: `⚠️ ${recMember} não possui cargos para remover.`,
      embeds: [],
      components: []
    });
  }

  const limitedRoles = userRoles.slice(0, 25);

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`rec_remove_${recMember.id}_${recExecutor?.id || interaction.user.id}`)
      .setPlaceholder("Selecione cargos para remover")
      .setMinValues(1)
      .setMaxValues(limitedRoles.length)
      .addOptions(limitedRoles)
  );

  return interaction.update({
    content: `🎯 Remover cargos de ${recMember}`,
    embeds: [],
    components: [row]
  });
    }
  
    // ===== CONCLUIDO =====
    if (choice === "concluido") {
      return interaction.update({
        content: `✅ Recrutamento finalizado para ${recMember}`,
        embeds: [],
        components: []
      });
    }
  }
  
  // ===== CONCLUÍDO =====
if (choice === "concluido") {
  return interaction.update({
    content: `✅ Recrutamento finalizado para ${recMember}`,
    embeds: [],
    components: []
  });
}
    if (recExecutor) {
      const embed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("📌 Cargos Adicionados")
        .setDescription(`${recExecutor} adicionou cargos a ${recMember}`)
        .setTimestamp();

      sendLog(interaction.guild, embed);
    }

    return menuPrincipal();
}

 // ================= REMOVE =================
// Exemplo dentro do listener de interações
client.on("interactionCreate", async (interaction) => {
  const recMember = interaction.guild.members.cache.get("ID_DO_MEMBER");
  const subAction = "remove"; // ou onde você define isso

  if (subAction === "remove") {
    for (const roleId of interaction.values) {
      if (recMember.roles.cache.has(roleId)) {
        await recMember.roles.remove(roleId).catch(() => {});
      }
    }
  }
});

  if (recExecutor) {
    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("📌 Cargos Removidos")
      .setDescription(`${recExecutor} removeu cargos de ${recMember}`)
      .setTimestamp();

    sendLog(interaction.guild, embed);
  }

  return menuPrincipal();
}

} // fecha if(action === "rec")

}); // ← FECHA interactionCreate

client.once("ready", () => {
  console.log(`✅ Bot online! ${client.user.tag}`);

  client.user.setActivity(
    "byks05 | https://Discord.gg/TropaDaHolanda",
    { type: 3 }
  );
});

client.login(process.env.TOKEN);
