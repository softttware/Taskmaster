const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors, AttachmentBuilder } = require('discord.js');
require('dotenv').config();
const logChannelId = process.env.logChannelId;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Clears a specified number of messages in the current channel.')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Number of messages to delete (max 100)')
                .setRequired(true)
        ),
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');

        if (amount < 1 || amount > 100) {
            return interaction.reply({
                content: 'You can only delete between 1 and 100 messages.',
                ephemeral: true,
            });
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: 'You do not have permission to manage messages.',
                ephemeral: true,
            });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: 'I do not have permission to manage messages.',
                ephemeral: true,
            });
        }

        try {
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            const deletedMessages = await interaction.channel.bulkDelete(messages, true);
            const logContent = Array.from(messages.values())
                .reverse()
                .map(msg => {
                    const timestamp = msg.createdAt.toISOString();
                    const author = msg.author?.tag || 'Unknown User';
                    const content = msg.content || '[No text content]';
                    return `[${timestamp}] ${author}: ${content}`;
                }).join('\n');

            const logFileName = `deleted_messages_${Date.now()}.txt`;
            const logFilePath = path.join(__dirname, logFileName);
            fs.writeFileSync(logFilePath, logContent, 'utf-8');

            const firstMessage = messages.first();
            const messagePreview = firstMessage?.content || 'No text content (e.g., image, embed, or system message)';

            const logEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('Messages Deleted')
                .setDescription(`Deleted **${deletedMessages.size}** messages in <#${interaction.channel.id}>.`)
                .setTimestamp()
                .addFields(
                    {
                        name: 'Moderator',
                        value: `<@${interaction.user.id}>`,
                        inline: true,
                    },
                    {
                        name: 'Channel',
                        value: `<#${interaction.channel.id}>`,
                        inline: true,
                    },
                    {
                        name: 'First Message Deleted',
                        value: messagePreview,
                        inline: false,
                    }
                );

            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (!logChannel || !logChannel.isTextBased()) {
                console.error('Log channel is invalid or not a text channel.');
                return interaction.reply({
                    content: 'Messages deleted, but unable to log. Please check the log channel configuration.',
                    ephemeral: true,
                });
            }

            const logFileAttachment = new AttachmentBuilder(logFilePath, { name: logFileName });
            await logChannel.send({ embeds: [logEmbed], files: [logFileAttachment] });

            await interaction.reply({
                content: `Successfully deleted ${deletedMessages.size} messages.`,
                ephemeral: true,
            });

            fs.unlinkSync(logFilePath);
        } catch (error) {
            console.error('Error clearing messages:', error);
            await interaction.reply({
                content: 'There was an error trying to clear messages in this channel.',
                ephemeral: true,
            });
        }
    },
};