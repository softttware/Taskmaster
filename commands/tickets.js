const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Create a ticket')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Choose the ticket type')
        .setRequired(true)
        .addChoices(
          { name: 'Ally Verification', value: 'ally_verification' },
          { name: 'Begin Recruitment', value: 'begin_recruitment' }
        )),

  async execute(interaction) {
    const ticketType = interaction.options.getString('type');

    let embedData;
    let embed;
    let button;

    let embedPath;
    if (ticketType === 'ally_verification') {
      embedPath = path.join(__dirname, '../utils/Embeds', 'allyVerificationStart.json');
      console.log('Attempting to load Ally Verification JSON from:', embedPath);
    } else if (ticketType === 'begin_recruitment') {
      embedPath = path.join(__dirname, '../utils/Embeds', 'beginRecruitmentStart.json');
      console.log('Attempting to load Begin Recruitment JSON from:', embedPath);
    }


    try {
      embedData = JSON.parse(fs.readFileSync(embedPath));
      console.log('Loaded JSON:', embedData);
    } catch (error) {
      console.error('Error reading JSON:', error);
      return interaction.reply({
        content: 'There was an error reading the selected ticket type JSON file.',
        ephemeral: true
      });
    }

    const buttonLabel = embedData.buttonLabel || 'Default Button Label'; 

    const validButtonStyles = {
      Primary: ButtonStyle.Primary,
      Secondary: ButtonStyle.Secondary,
      Success: ButtonStyle.Success,
      Danger: ButtonStyle.Danger,
      Link: ButtonStyle.Link
    };

    const buttonStyle = validButtonStyles[embedData.buttonStyle] || ButtonStyle.Primary;

    const buttonCustomId = embedData.buttonCustomId || 'default_button_custom_id';

    embed = new EmbedBuilder()
      .setTitle(embedData.title)
      .setDescription(embedData.description)
      .setColor(embedData.color);

    if (embedData.thumbnail && embedData.thumbnail.url) {
      embed.setThumbnail(embedData.thumbnail.url);
    }

    button = new ButtonBuilder()
      .setCustomId(buttonCustomId)
      .setEmoji('📑')
      .setLabel(buttonLabel)
      .setStyle(buttonStyle);

    const actionRow = new ActionRowBuilder().addComponents(button);

    await interaction.reply({
      content: "Ticket created successfully!",  
      ephemeral: true
    })

    interaction.channel.send({
      embeds: [embed],
      components: [actionRow],
    });
  },
};
