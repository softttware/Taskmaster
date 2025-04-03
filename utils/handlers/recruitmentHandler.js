const fs = require('fs');
const path = require('path'); 
const { ChannelType, ThreadAutoArchiveDuration, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { title } = require('process');
const config = require('../config.json');
const { ticketLogChannelId } = config;

module.exports = async (interaction, user, channel) => {
    try {
      const ticketDataPath = path.join(__dirname, '../ticketCount.json');
      const ticketData = JSON.parse(fs.readFileSync(ticketDataPath, 'utf8'));
      
      ticketData.ticketId += 1;
      
      fs.writeFileSync(ticketDataPath, JSON.stringify(ticketData));

      const embedPath = path.join(__dirname, '../Embeds', 'beginRecruitment.json');
      const embedData = JSON.parse(fs.readFileSync(embedPath, 'utf8'));

      const embed = {
        title: embedData.title,
        description: embedData.description,
        color: parseInt(embedData.color.replace("#", ""), 16),
        fields: embedData.fields,
        image: {
          url: embedData.image?.url || null
        }
      };

      const thread = await channel.threads.create({
        name: 'recruitment-' + user.username + '-'  +ticketData.ticketId,  
        type: ChannelType.PrivateThread,
        reason: 'Needed a separate thread for moderation',
      });

      const ticketDetailsEmbed = {
        title: `Recruitment Ticket Opened`,
        color: 0x8c2b2b,
        fields: [
          { name: 'ID', value: ticketData.ticketId.toString(), inline: true },
          { name: 'Type', value: 'Recruitment', inline: true },
          { name: 'Created by', value: '<@!'+ user.id + '>', inline: true },
          { name: 'Created on', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
          { name: 'Officers in ticket', value: 'No officers yet', inline: true },
        ],
      };

      const joinActionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_join_${thread.id}`)
          .setLabel('Join Ticket')
          .setStyle(ButtonStyle.Primary)
      );

      const logChannel = await thread.guild.channels.fetch(ticketLogChannelId);

      const logMessage = await logChannel.send({
        embeds: [ticketDetailsEmbed],
        components: [joinActionRow],
      })

      const messageId = logMessage.id

      const actionRow = new ActionRowBuilder()
      .addComponents(
          new ButtonBuilder()
              .setCustomId(`ticket_close_` + messageId)
              .setLabel('Close')
              .setEmoji('🔒')
              .setStyle(ButtonStyle.Danger)
      );

      const member = await thread.guild.members.fetch(user.id);
      await thread.members.add(member);

      await thread.send({
        embeds: [embed],
        components: [actionRow],
      });
      
      await interaction.reply({
        content: 'Starting Recruitment application process...',
        ephemeral: true,
      });

    } catch (error) {
      console.error('Error handling Recruitment application:', error);
      await interaction.reply({
        content: 'There was an error while starting the Recruitment application process.',
        ephemeral: true,
      });
    }
  };