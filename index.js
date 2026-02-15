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

// ===== COMANDO THL!REC =====
const { Client, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

client.on("messageCreate", async (message) => {
  if (!message.guild) return;
  if (!message.content.toLowerCase().startsWith("thl!rec")) return;

  const args = message.content.split(" ").slice(1); // tudo depois do comando
  if (!args[0])
    return message.reply(
      "❌ Você precisa mencionar um usuário ou colocar o ID! Ex: `thl!rec @user` ou `thl!rec 1452004282688737515`"
    );

  const executor = message.member;

  // Tenta pegar pelo mention primeiro
  let recMember = message.mentions.members.first();

  // Se não houver mention, tenta pegar pelo ID
  if (!recMember) {
    recMember = message.guild.members.cache.get(args[0]);
  }

  if (!recMember)
    return message.reply("❌ Não consegui encontrar esse usuário no servidor!");

  // ===== CARGOS =====
  const cargosAdicionar = [
    "1468283328510558208", // verificado ✔️
    "1468026315285205094", // equipe tropa da Holanda 🇳🇱
    "1472223890821611714"  // faixas rosas 🎀
  ];

  // ===== FUNÇÃO MENU PRINCIPAL =====
  async function menuPrincipal(recMember, executor, interactionMessage) {
    const embed = new EmbedBuilder()
      .setTitle("🎯 Recrutamento")
      .setDescription(`Selecione uma ação para ${recMember}`)
      .setColor("Green");

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`rec_init_${recMember.id}_${executor.id}`)
        .setPlaceholder("Escolha uma ação")
        .addOptions([
          { label: "Adicionar", value: "adicionar", emoji: "➕" },
          { label: "Remover", value: "remover", emoji: "➖" },
          { label: "Concluído", value: "concluido", emoji: "✅" }
        ])
    );

    if (interactionMessage) {
      await interactionMessage.edit({ embeds: [embed], components: [row] });
    } else {
      return await message.channel.send({ embeds: [embed], components: [row] });
    }
  }

  // ===== EXECUTA MENU E COLETOR =====
  try {
    const menuMessage = await menuPrincipal(recMember, executor);

    const filter = (i) => i.user.id === executor.id;
    const collector = menuMessage.createMessageComponentCollector({ filter, time: 600000 });

    collector.on("collect", async (interaction) => {
      if (!interaction.isStringSelectMenu()) return;

      if (interaction.customId.startsWith("rec_init")) {
        const choice = interaction.values[0];

        if (choice === "adicionar") {
          // Adiciona todos os cargos
          await recMember.roles.add(cargosAdicionar).catch(console.log);
          await interaction.reply({
            content: `✅ Todos os cargos de adicionar foram aplicados em ${recMember}`,
            ephemeral: true
          });
          await menuPrincipal(recMember, executor, menuMessage);

        } else if (choice === "remover") {
          const userRoles = recMember.roles.cache.filter(r => r.id !== recMember.guild.id);
          const removerOptions = userRoles.map(r => ({ label: r.name, value: r.id }));

          if (removerOptions.length === 0) {
            await interaction.reply({ content: "❌ Este usuário não possui cargos para remover.", ephemeral: true });
            return menuPrincipal(recMember, executor, menuMessage);
          }

          const removeRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`rec_remove_${recMember.id}_${executor.id}`)
              .setPlaceholder("Selecione os cargos para remover")
              .setMinValues(1)
              .setMaxValues(removerOptions.length)
              .addOptions(removerOptions)
          );

          await interaction.update({ content: "Selecione os cargos para remover:", components: [removeRow], embeds: [] });

        } else if (choice === "concluido") {
          await interaction.update({ content: "🎉 Recrutamento concluído!", components: [], embeds: [] });
          collector.stop();
        }

      } else if (interaction.customId.startsWith("rec_remove")) {
        const rolesToRemove = interaction.values;
        await recMember.roles.remove(rolesToRemove).catch(console.log);
        await interaction.reply({ content: `✅ Os cargos foram removidos de ${recMember}`, ephemeral: true });
        await menuPrincipal(recMember, executor, menuMessage);
      }
    });

    collector.on("end", collected => {
      console.log(`Coletadas ${collected.size} interações.`);
    });

  } catch (err) {
    console.log("Erro no comando thl!rec:", err);
    message.reply("❌ Ocorreu um erro ao executar o comando.");
  }
});

client.once("ready", () => {
  console.log(`✅ Bot online! ${client.user.tag}`);

  client.user.setActivity(
    "byks05 | https://Discord.gg/TropaDaHolanda",
    { type: 3 }
  );
});

client.login(process.env.TOKEN);
