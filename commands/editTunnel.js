const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edittunnel')
        .setDescription('Edit the hourRate of an existing tunnel.')
        .addStringOption(option =>
            option.setName('tunnel')
                .setDescription('The tunnel to edit')
                .setRequired(true)
                .addChoices(
                    ...Object.keys(require('../utils/msupps/tunnels.json'))
                        .map(tunnelName => ({ name: tunnelName, value: tunnelName }))
                ))
        .addStringOption(option =>
            option.setName('newhourrate')
                .setDescription('The new hourly rate for the tunnel')
                .setRequired(true)),
    
    async execute(interaction) {
        const tunnelName = interaction.options.getString('tunnel');
        const newHourRate = interaction.options.getString('newhourrate');

        const filePath = path.join(__dirname, '../utils/msupps/tunnels.json');

        try {
            let tunnels = {};
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                tunnels = JSON.parse(data);
            }

            if (!tunnels[tunnelName]) {
                return await interaction.reply({ content: `Tunnel **${tunnelName}** does not exist!`, ephemeral: true });
            }
            tunnels[tunnelName].hourRate = newHourRate;
            fs.writeFileSync(filePath, JSON.stringify(tunnels, null, 4), 'utf8');

            delete require.cache[require.resolve('../utils/msupps/tunnels.json')];

            console.log(`Reloaded tunnels.json after updating the hourly rate for ${tunnelName}.`);

            await interaction.reply({ content: `The hourly rate of **${tunnelName}** has been updated to **${newHourRate}**.`, ephemeral: true });
        } catch (error) {
            console.error('Error updating tunnels.json:', error);
            await interaction.reply({ content: 'An error occurred while editing the tunnel. Please try again later.', ephemeral: true });
        }
    },
};
