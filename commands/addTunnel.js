const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addtunnel')
        .setDescription('Adds a new tunnel with a name and hourly rate.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the tunnel')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('hourrate')
                .setDescription('The hourly rate for the tunnel')
                .setRequired(true)),

    async execute(interaction) {
        const name = interaction.options.getString('name');
        const hourRate = interaction.options.getString('hourrate');
        
        const filePath = path.join(__dirname, '../utils/msupps/tunnels.json');

        try {
            let tunnels = {};
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                tunnels = JSON.parse(data);
            }

            if (tunnels[name]) {
                return await interaction.reply({ content: `Tunnel **${name}** already exists!`, ephemeral: true });
            }

            tunnels[name] = {
                hourRate,
                currentAmount: "0" 
            };

            fs.writeFileSync(filePath, JSON.stringify(tunnels, null, 4), 'utf8');

            delete require.cache[require.resolve('../utils/msupps/tunnels.json')];

            console.log(`Reloaded tunnels.json after adding new tunnel ${name}.`);

            await interaction.reply({ content: `Tunnel **${name}** with hourly rate **${hourRate}** has been added successfully.`, ephemeral: true });
        } catch (error) {
            console.error('Error writing to tunnels.json:', error);
            await interaction.reply({ content: 'An error occurred while adding the tunnel. Please try again later.', ephemeral: true });
        }
    },
};
