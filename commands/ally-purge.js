const { SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ally-purge')
        .setDescription('Removes all members from a specified role.'),
    async execute(interaction) {
        const roleId = process.env.allyId;
        const guild = interaction.guild;

        if (!guild) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        const role = guild.roles.cache.get(roleId);

        if (!role) {
            return interaction.reply({ content: 'Role not found.', ephemeral: true });
        }

        try {
            await interaction.deferReply({ ephemeral: true }); // Defer to avoid timeouts

            // Filter cached members first to handle smaller subsets
            const cachedMembersWithRole = role.members;

            if (cachedMembersWithRole.size > 0) {
                const removalPromises = cachedMembersWithRole.map((member) =>
                    member.roles.remove(role).catch((err) => {
                        console.error(`Failed to remove role from ${member.user.tag}:`, err);
                    })
                );

                await Promise.all(removalPromises);
            }

            // If the cache misses members, fallback to fetch in batches
            const allMembers = await guild.members.fetch(); // Fetch members slowly
            const membersWithRole = allMembers.filter((member) => member.roles.cache.has(roleId));

            if (membersWithRole.size === 0 && cachedMembersWithRole.size === 0) {
                return interaction.editReply({ content: 'No members have this role.' });
            }

            const removalPromises = membersWithRole.map((member) =>
                member.roles.remove(role).catch((err) => {
                    console.error(`Failed to remove role from ${member.user.tag}:`, err);
                })
            );

            await Promise.all(removalPromises);

            await interaction.editReply({
                content: `${role.name} has been purged successfully. Total affected members: ${
                    cachedMembersWithRole.size + membersWithRole.size
                }`,
            });
        } catch (error) {
            console.error('Error removing members from role:', error);
            await interaction.editReply({ content: 'An error occurred while purging the role.' });
        }
    },
};
