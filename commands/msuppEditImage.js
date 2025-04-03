const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit-msupp-image')
        .setDescription('Edit the image link in the ImageLink.json file.')
        .addStringOption(option =>
            option.setName('newlink')
                .setDescription('The new image URL to set as the imageLink.')
                .setRequired(true)),

    async execute(interaction) {
        const filePath = path.join(__dirname, '../utils/msupps/imageLink.json');
        const newLink = interaction.options.getString('newlink');

        try {
            if (!fs.existsSync(filePath)) {
                return await interaction.reply({ content: 'The ImageLink.json file does not exist!', ephemeral: true });
            }

            const fileData = fs.readFileSync(filePath, 'utf8');
            const imageLinkData = JSON.parse(fileData);

            imageLinkData.imageLink = newLink;

            fs.writeFileSync(filePath, JSON.stringify(imageLinkData, null, 4));

            await interaction.reply({ content: `Successfully updated the imageLink to: ${newLink}`, ephemeral: true });
        } catch (error) {
            console.error('Error editing ImageLink.json:', error);
            await interaction.reply({ content: 'An error occurred while updating the image link. Please try again later.', ephemeral: true });
        }
    },
};