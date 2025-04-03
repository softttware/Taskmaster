const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder, time } = require('discord.js');
const imagePath = require ('../utils/msupps/imageLink.json')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('msupps')
        .setDescription('Get the current status of all tunnels from the tunnels.json file.'),

    async execute(interaction) {
        const filePath = path.join(__dirname, '../utils/msupps/tunnels.json');

        try {

            if (!fs.existsSync(filePath)) {
                return await interaction.reply({ content: 'The tunnels.json file does not exist!', ephemeral: true });
            }

            const data = fs.readFileSync(filePath, 'utf8');
            const tunnels = JSON.parse(data);

            if (Object.keys(tunnels).length === 0) {
                return await interaction.reply({ content: 'No tunnels data available!', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('Tunnel Supplies Status')
                .setColor(0x8c2b2b)
                .setTimestamp()
                .setImage(imagePath.imageLink);

            for (const [tunnelName, tunnelData] of Object.entries(tunnels)) {
                const { currentAmount, hourRate } = tunnelData;

                if (!currentAmount || !hourRate || hourRate <= 0) {
                    embed.addFields({
                        name: tunnelName,
                        value: 'Tunnel is out of Msupps or has not been set up yet.',
                    });
                    continue;
                }

                const durationHours = currentAmount / hourRate;
                const durationMillis = durationHours * 60 * 60 * 1000;
                const endTime = new Date(Date.now() + durationMillis);

                const hammertime = time(endTime, 'R');

                embed.addFields({
                    name: tunnelName,
                    value: `Current Amount: **${currentAmount}**\nHourly Rate: **${hourRate}**\nSupplies deplete: ${hammertime}`,
                });
            }

            await interaction.reply({ embeds: [embed], ephemeral: false });
        } catch (error) {
            console.error('Error reading tunnels.json:', error);
            await interaction.reply({ content: 'An error occurred while retrieving tunnel data. Please try again later.', ephemeral: true });
        }
    },
};
