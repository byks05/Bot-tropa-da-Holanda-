const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = "thl!";

client.on('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on('messageCreate', message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "ping") {
    message.reply("Pong 🏓");
  }

  if (command === "oi") {
    message.reply("Salve tropa da Holanda 🔥");
  }
});

client.login(process.env.TOKEN);
