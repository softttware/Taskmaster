const { Events, EmbedBuilder } = require('discord.js');

/**
 * Initializes logging for message edits and deletions.
 * @param {Client} client - The Discord client instance.
 * @param {string} logChannelId - ID of the channel where logs will be sent.
 * @param {Array<string>} ignoredChannels - Array of channel IDs to ignore.
 * @param {Array<string>} ignoredUsers - Array of user IDs to ignore.
 */
module.exports = (client, logChannelId, ignoredChannels, ignoredUsers= []) => {
    client.on(Events.MessageDelete, async (message) => {
        if (message.partial || !message.guild) return;

        if (ignoredChannels.includes(message.channel.id)) return;
        if (ignoredUsers.includes(message.author.id)) return;   

        const logChannel = client.channels.cache.get(logChannelId);
        if (!logChannel) return console.warn("Log channel not found");

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('Message Deleted')
            .setDescription(message.content || '*No text content*')
            .addFields({ name: 'Channel', value: `<#${message.channel.id}>`, inline: true })
            .setTimestamp()
            .setFooter({
                text: `User: ${message.author?.tag || 'Unknown User'}`,
                iconURL: message.author?.displayAvatarURL() || null,
            });

        logChannel.send({ embeds: [embed] });
    });

    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
        if (oldMessage.partial || newMessage.partial || !oldMessage.guild || oldMessage.content === newMessage.content) return;

        if (ignoredChannels.includes(oldMessage.channel.id)) return;
        if (ignoredUsers.includes(oldMessage.author.id)) return; 

        const logChannel = client.channels.cache.get(logChannelId);
        if (!logChannel) return console.warn("Log channel not found");

        const embed = new EmbedBuilder()
            .setColor('Yellow')
            .setTitle('Message Edited')
            .addFields(
                { name: 'Before', value: oldMessage.content || '*No text content*', inline: false },
                { name: 'After', value: newMessage.content || '*No text content*', inline: false },
                { name: 'Channel', value: `<#${oldMessage.channel.id}>`, inline: false }
            )
            .setTimestamp()
            .setFooter({
                text: `User: ${oldMessage.author?.tag || 'Unknown User'}`,
                iconURL: oldMessage.author?.displayAvatarURL() || null,
            });

        logChannel.send({ embeds: [embed] });
    });
};
