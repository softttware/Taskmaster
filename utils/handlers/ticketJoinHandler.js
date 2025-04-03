const { EmbedBuilder, ChannelType } = require('discord.js');
require('dotenv').config();

module.exports = async (interaction, identifier, messageId) => {
    const ticketId = identifier;
    try {
      const user = interaction.user;
      const guild = interaction.guild;

      const thread = await guild.channels.fetch(ticketId);
      if (!thread || thread.type !== ChannelType.PrivateThread) {
        await interaction.reply({
          content: 'The specified thread does not exist or is not a valid private thread.',
          ephemeral: true,
        });
        return;
      }

      const mentionMessage = await thread.send(`<@!${user.id}>`);
      await mentionMessage.delete();

      const logChannel = await guild.channels.fetch(process.env.ticketLogChannelId);
      if (!logChannel) {
        console.error(`Log channel not found: ${process.env.ticketLogChannelId}`);
        await interaction.reply({
          content: 'Ticket log channel is not properly configured.',
          ephemeral: true,
        });
        return;
      }

      console.log(`Fetching log message with ID: ${messageId}`);

      const logMessage = await logChannel.messages.fetch(messageId); 
      if (!logMessage) {
        await interaction.reply({
          content: 'Could not find the log message for this ticket.',
          ephemeral: true,
        });
        return;
      }

      console.log('Fetched log message:', logMessage.content);
      console.log('Fetched embed fields:', logMessage.embeds[0]?.fields);
  
      const embed = logMessage.embeds[0];
      if (!embed || !embed.fields) {
        console.error('No embed fields found in the log message.');
        await interaction.reply({
          content: 'Error: The log message does not contain any embed fields.',
          ephemeral: true,
        });
        return;
      }

      const staffField = embed.fields.find((field) => field.name === 'Officers in ticket');

      let staffList = staffField ? staffField.value.split('\n') : [];
      if (staffList.includes('No officers yet')) {
        staffList = [];  
      }
  
      if (!staffList.includes(`<@!${user.id}>`)) {
        staffList.push(`<@!${user.id}>`); 
      }

      const updatedEmbed = EmbedBuilder.from(embed)
        .setFields(
          embed.fields.map((field) =>
            field.name === 'Officers in ticket'
              ? { name: 'Officers in ticket', value: staffList.length > 0 ? staffList.join('\n') : 'No officers yet', inline: true }
              : field
          )
        );
  
      console.log('Updated embed:', updatedEmbed);

      await logMessage.edit({ embeds: [updatedEmbed] });
  
      await interaction.reply({
        content: `You have been added to the ticket with ID: ${ticketId}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error handling ticket join:', error);
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        ephemeral: true,
      });
    }
  };