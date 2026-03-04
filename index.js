const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionsBitField, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;

const VIP_ROLES = {
  SOL: "1478567864175693865",
  BRISA: "1478567921243521266",
  FOGO: "1478567970711273675",
  IMPERIO: "1478568023358050425"
};

const CATEGORY_TEMP = "1478567017832251392";
const CATEGORY_FOGO = "1478695052015308800";
const CATEGORY_IMPERIO = "1478694889167257784";
const PANEL_CHANNEL_ID = "1478695189366177846";

const activeCalls = new Map();

client.once("ready", async () => {
  console.log(`Logado como ${client.user.tag}`);

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("criar_call")
      .setLabel("Criar Call VIP")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    content: "🎙 **Painel VIP - Criação de Call**",
    components: [row]
  });
});

client.on("interactionCreate", async (interaction) => {

  if (interaction.isButton()) {

    if (interaction.customId === "criar_call") {

      const member = interaction.member;

      if (activeCalls.has(member.id)) {
        return interaction.reply({ content: "❌ Você já possui uma call ativa.", ephemeral: true });
      }

      let tipo = null;

      if (member.roles.cache.has(VIP_ROLES.IMPERIO)) tipo = "imperio";
      else if (member.roles.cache.has(VIP_ROLES.FOGO)) tipo = "fogo";
      else if (member.roles.cache.has(VIP_ROLES.BRISA)) tipo = "brisa";
      else if (member.roles.cache.has(VIP_ROLES.SOL)) tipo = "sol";
      else return interaction.reply({ content: "❌ Você não é VIP.", ephemeral: true });

      if (tipo === "sol") {
        criarCall(interaction, member.user.username, tipo);
      } else {
        const modal = new ModalBuilder()
          .setCustomId(`modal_${tipo}`)
          .setTitle("Escolha o nome da sua Call");

        const input = new TextInputBuilder()
          .setCustomId("nome_call")
          .setLabel("Nome da Call")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        await interaction.showModal(modal);
      }
    }
  }

  if (interaction.isModalSubmit()) {

    const tipo = interaction.customId.replace("modal_", "");
    const nome = interaction.fields.getTextInputValue("nome_call");

    criarCall(interaction, nome, tipo);
  }
});

async function criarCall(interaction, nome, tipo) {

  let parentID;
  let temporaria = false;

  if (tipo === "sol" || tipo === "brisa") {
    parentID = CATEGORY_TEMP;
    temporaria = true;
  }

  if (tipo === "fogo") parentID = CATEGORY_FOGO;
  if (tipo === "imperio") parentID = CATEGORY_IMPERIO;

  const channel = await interaction.guild.channels.create({
    name: `🎙・${nome}`,
    type: ChannelType.GuildVoice,
    parent: parentID
  });

  activeCalls.set(interaction.member.id, channel.id);

  await interaction.reply({ content: `✅ Call criada: ${channel}`, ephemeral: true });

  if (temporaria) {
    const interval = setInterval(async () => {
      if (!channel.members.size) {
        await channel.delete().catch(() => {});
        activeCalls.delete(interaction.member.id);
        clearInterval(interval);
      }
    }, 300000);
  }
}

client.on("channelDelete", (channel) => {
  for (const [userId, channelId] of activeCalls.entries()) {
    if (channelId === channel.id) {
      activeCalls.delete(userId);
    }
  }
});

client.login(TOKEN);
