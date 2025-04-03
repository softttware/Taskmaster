// bot.js
const { Client, GatewayIntentBits, Events, Collection, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const initializeLogger = require('./utils/logger.js');
const buttonHandler = require('./utils/handlers/buttonHandler.js');
const updateHandler = require('./utils/handlers/hourlyUpdateHandler.js');
const msuppsPath = path.resolve(__dirname, './utils/msupps/tunnels.json');
const updateListener = require('./commands/checkTargets.js');
const { reattachPollCollectors } = require('./commands/strawpoll.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
});
const logChannelId = process.env.logChannelId;
const ignoredChannels = ['1304879126720548905', '1255987440825401479'];
const ignoredUsers = ['1255599706621612174', '1295467917445697649'];

initializeLogger(client, logChannelId, ignoredChannels, ignoredUsers);
buttonHandler(client);

try {
    const tunnelsData = fs.readFileSync(msuppsPath, 'utf-8');
    const tunnels = JSON.parse(tunnelsData);

    if (tunnelsData.trim() && Object.keys(tunnels).length > 0) {
        console.log('Starting updateHandler as tunnels.json is not empty.');
        updateHandler(client);
    } else {
        console.log('tunnels.json is empty. updateHandler will not be started.');
    }
} catch (error) {
    console.error(`Error reading or parsing tunnels.json: ${error.message}`);
}

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command.data || !command.data.name) {
        console.error(`Command in ${filePath} is missing a 'name' property.`);
        continue;
    }

    client.commands.set(command.data.name, command);
}

updateListener(client);

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const { REST } = require('@discordjs/rest');
    const { Routes } = require('discord-api-types/v9');
    const rest = new REST({ version: '9' }).setToken(process.env.token);

    const commands = client.commands.map(command => command.data.toJSON());

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.clientId, process.env.guildId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error reloading commands:', error);
    }

    // Cache all members of the guild at startup
    try {
        const guild = await client.guilds.fetch(process.env.guildId);
        await guild.members.fetch();
        console.log('All guild members have been fetched and cached.');
    } catch (error) {
        console.error('Error fetching guild members:', error);
    }
    
});

client.on('ready', async () => {
    setTimeout(async () => {
        console.log('Starting poll reattachment...');
        await reattachPollCollectors(client);
    }, 5000);
});

client.login(process.env.token);
