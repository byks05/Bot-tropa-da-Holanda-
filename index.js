const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const prefix = "thl!";

client.on('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

function parseTime(time) {
  const unit = time.slice(-1);
  const value = parseInt(time.slice(0, -1));

  if (unit === "m") return value * 60000;
  if (unit === "h") return value * 3600000;
  if (unit === "s") return value * 1000;

  return null;
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "mutechat") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply("Você não tem permissão.");

    const member = message.mentions.members.first();
    const timeArg = args[1];

    if (!member || !timeArg)
      return message.reply("Uso correto: thl!mutechat @user 2m");

    const duration = parseTime(timeArg);
    if (!duration) return message.reply("Tempo inválido. Use: 10s, 5m, 1h");

    let mutedRole = message.guild.roles.cache.find(r => r.name === "Muted");

    if (!mutedRole) {
      mutedRole = await message.guild.roles.create({
        name: "Muted",
        permissions: []
      });

      message.guild.channels.cache.forEach(async channel => {
        await channel.permissionOverwrites.create(mutedRole, {
          SendMessages: false,
          Speak: false
        });
      });
    }

    await member.roles.add(mutedRole);
    message.reply(`${member.user.tag} foi mutado por ${timeArg} 🔇`);

    setTimeout(async () => {
      if (member.roles.cache.has(mutedRole.id)) {
        await member.roles.remove(mutedRole);
      }
    }, duration);
  }
});

client.login(process.env.TOKEN);
