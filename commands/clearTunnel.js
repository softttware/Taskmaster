const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../utils/msupps/tunnels.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-tunnels')
        .setDescription('Clears tunnels.json, consequently stopping tunnel update messages.'),
    async execute(interaction) {
        try {
            fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
            
            await interaction.reply('The contents of tunnels.json have been cleared successfully.');
        } catch (error) {
            console.error('Error clearing tunnels.json:', error);
            await interaction.reply('Failed to clear the tunnels.json file. Check the logs for more details.');
        }
    }
};
