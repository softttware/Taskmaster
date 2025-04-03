const { EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
require('dotenv').config();

module.exports = async (interaction, identifier, messageId, threadId, reason) => {
    const requiredRoles = process.env.requiredRoles; 
    const memberRoles = interaction.member.roles.cache;
    const logChannel = await interaction.guild.channels.fetch(process.env.ticketLogChannelId);

    const hasPermission = requiredRoles.some(roleId => memberRoles.has(roleId));

    const logMessage = await logChannel.messages.fetch(identifier); 
    if (!logMessage) {
      await interaction.reply({
        content: 'Could not find the log message for this ticket.',
        ephemeral: true,
      });
      return;
    }

    if (!hasPermission) {
        return interaction.reply({
            content: '❌ You do not have permission to execute this command.',
            ephemeral: true,
        });
    }

    const embed = logMessage.embeds[0];
    if (!embed || !embed.fields) {
      console.error('No embed fields found in the log message.');
      await interaction.reply({
        content: 'Error: The log message does not contain any embed fields.',
        ephemeral: true,
      });
      return;
    }

    const createdByField = embed.fields.find(field => field.name === 'Created by');
    const ticketTypeField = embed.fields.find(field => field.name === 'Type');
    const ticketType = ticketTypeField ? ticketTypeField.value : 'Unknown Type';
    const createdBy = createdByField ? createdByField.value : 'Unknown User';

    // Construct updated fields
    const updatedFields = embed.fields
      .filter(field => field.name !== 'Officers in ticket')
      .concat({
          name: 'Closed by',
          value: `<@!${interaction.user.id}>`,
          inline: true
      })
      .concat({
          name: 'Reason',
          value: reason || 'No reason provided',
          inline: false
      });

    const updatedEmbed = EmbedBuilder.from(embed)
      .setTitle('Ticket Closed')
      .setColor(0x7e7e7e)
      .setFields(updatedFields);

    const viewButton = new ButtonBuilder()
      .setLabel('View Transcripts')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${interaction.guild.id}/${threadId}`);

    if (ticketType === 'Recruitment') { 

      const logText = `Created by: ${createdBy} <t:${Math.floor(Date.now() / 1000)}:R>`;
      await logMessage.edit({
        content: logText,
        embeds: [updatedEmbed],
        components: [{ type: 1, components: [viewButton] }]
      });
      
    } else {

      await logMessage.edit({
        embeds: [updatedEmbed],
        components: [{ type: 1, components: [viewButton] }]
      });
      
    }

    try {
      const thread = await interaction.guild.channels.fetch(threadId);
      if (thread.archived) {
        await thread.setArchived(false);
        console.log('Thread unarchived temporarily.');
      }
      await thread.setLocked(true);
      await thread.setArchived(true);
    } catch (error) {
      console.error('Error modifying thread state:', error);
      return interaction.reply({
          content: `❌ Failed to update thread state: ${error.message}`,
          ephemeral: true,
      });
    }
};
