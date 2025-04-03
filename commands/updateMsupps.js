const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, time } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('updatemsupps')
        .setDescription('Update the currentAmount of an existing tunnel.')
        .addStringOption(option =>
            option.setName('tunnel')
                .setDescription('The tunnel to update')
                .setRequired(true)
                .addChoices(
                    ...Object.keys(require('../utils/msupps/tunnels.json'))
                        .map(tunnelName => ({ name: tunnelName, value: tunnelName }))
                ))
        .addStringOption(option =>
            option.setName('newcurrentamount')
                .setDescription('The new current amount for the tunnel')
                .setRequired(true)),

    async execute(interaction) {
        const tunnelName = interaction.options.getString('tunnel');
        const newCurrentAmount = parseInt(interaction.options.getString('newcurrentamount'), 10);

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

            const hourRate = tunnels[tunnelName].hourRate;
            if (!hourRate || hourRate <= 0) {
                return await interaction.reply({ content: `Tunnel **${tunnelName}** does not have a valid hour rate defined!`, ephemeral: true });
            }

            tunnels[tunnelName].currentAmount = newCurrentAmount;

            const durationHours = newCurrentAmount / hourRate;
            const durationMillis = durationHours * 60 * 60 * 1000;
            const endTime = new Date(Date.now() + durationMillis);

            fs.writeFileSync(filePath, JSON.stringify(tunnels, null, 4), 'utf8');
            const data = fs.readFileSync(filePath, 'utf8');
            tunnels = JSON.parse(data);
            const hammertime = time(endTime, 'R');

            await interaction.reply({
                content: `**${tunnelName}** has been updated to **${newCurrentAmount}**.\n\nWith a rate of **${hourRate}**, the supplies will deplete ${hammertime}.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error updating tunnels.json:', error);
            await interaction.reply({ content: 'An error occurred while updating the tunnel. Please try again later.', ephemeral: true });
        }
    },
};
