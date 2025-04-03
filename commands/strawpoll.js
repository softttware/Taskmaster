const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Config setup
const config = require('../utils/config.json');
const pollDataFile = path.join(__dirname, '../utils/polls.json');

// Initialize polls file if it doesn't exist
if (!fs.existsSync(pollDataFile)) {
    fs.writeFileSync(pollDataFile, '{}');
}

// Utility functions
function loadAllPolls() {
    try {
        if (!fs.existsSync(pollDataFile)) {
            fs.writeFileSync(pollDataFile, '{}');
            return {};
        }
        const data = fs.readFileSync(pollDataFile, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading polls:', error);
        return {};
    }
}

function savePollData(poll) {
    try {
        const polls = loadAllPolls();
        polls[poll.pollId] = poll;
        fs.writeFileSync(pollDataFile, JSON.stringify(polls, null, 2));
    } catch (error) {
        console.error('Error saving poll:', error);
    }
}

function loadPollData(pollId) {
    const polls = loadAllPolls();
    return polls[pollId] || null;
}

// Create or refresh results message
async function updateResultsMessage(client, pollData, isFinal = false) {
    try {
        const guild = client.guilds.cache.get(pollData.guildId);
        if (!guild) {
            console.error(`Guild ${pollData.guildId} not found in cache`);
            return;
        }

        const resultsChannel = guild.channels.cache.get(config.resultsChannelId);
        if (!resultsChannel) {
            console.error(`Results channel ${config.resultsChannelId} not found in guild ${guild.id}`);
            return;
        }

        const resultsDescription = pollData.options.map((option, index) => 
            `${option}: ${pollData.votes[index] || 0} votes`
        ).join('\n');

        const embed = new EmbedBuilder()
            .setColor(isFinal ? 0xaa0000 : 0x00aa00)
            .setTitle(`📊 ${isFinal ? 'Final ' : 'Live '}Results: ${pollData.question.substring(0, 256)}`)
            .setDescription(resultsDescription)
            .setFooter({ text: `${isFinal ? 'Final results' : 'Live updates'}` });

        if (pollData.resultsMessageId) {
            try {
                const resultsMessage = await resultsChannel.messages.fetch(pollData.resultsMessageId);
                await resultsMessage.edit({ embeds: [embed] });
                return resultsMessage;
            } catch (error) {
                if (error.code === 10008) { // Unknown message
                    console.log('Results message was deleted, creating new one');
                    const newResultsMessage = await resultsChannel.send({ embeds: [embed] });
                    pollData.resultsMessageId = newResultsMessage.id;
                    savePollData(pollData);
                    return newResultsMessage;
                }
                console.error('Error editing results message:', error);
            }
        }

        // Create new message if editing failed or no message exists
        const resultsMessage = await resultsChannel.send({ embeds: [embed] });
        pollData.resultsMessageId = resultsMessage.id;
        savePollData(pollData);
        return resultsMessage;

    } catch (error) {
        console.error('Error in updateResultsMessage:', error);
        return null;
    }
}

// Parse duration string
function parseDuration(durationString) {
    const match = durationString.match(/^(\d+)([hmd])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];
    const multipliers = { h: 3600000, m: 60000, d: 86400000 };
    return value * (multipliers[unit] || 0);
}

// Reattach to existing polls when bot starts
async function reattachPollCollectors(client) {
    const polls = loadAllPolls();
    const now = Date.now();
    
    for (const pollId in polls) {
        const poll = polls[pollId];
        if (poll.endTime > now) { // Only reattach active polls
            try {
                const guild = client.guilds.cache.get(poll.guildId);
                if (!guild) {
                    console.error(`Guild ${poll.guildId} not found in cache`);
                    continue;
                }

                const channel = guild.channels.cache.get(poll.channelId);
                if (!channel) {
                    console.error(`Channel ${poll.channelId} not found in guild ${guild.id}`);
                    continue;
                }

                try {
                    const message = await channel.messages.fetch(poll.messageId);
                    
                    // Recreate the collector
                    const remainingTime = poll.endTime - now;
                    const collector = message.createMessageComponentCollector({ 
                        componentType: ComponentType.Button, 
                        time: remainingTime 
                    });

                    collector.on('collect', async (buttonInteraction) => {
                        try {
                            const [prefix, optionIndex, ...pollIdParts] = buttonInteraction.customId.split('_');
                            const receivedPollId = pollIdParts.join('_');
                            
                            if (prefix !== 'vote') {
                                return buttonInteraction.reply({ 
                                    content: 'Invalid poll button.', 
                                    ephemeral: true 
                                });
                            }

                            const poll = loadPollData(receivedPollId);
                            if (!poll) {
                                console.error(`Poll not found: ${receivedPollId}`);
                                return buttonInteraction.reply({ 
                                    content: 'Poll not found! Please try again.', 
                                    ephemeral: true 
                                });
                            }

                            if (poll.voters.includes(buttonInteraction.user.id)) {
                                return buttonInteraction.reply({ 
                                    content: 'You have already voted in this poll!', 
                                    ephemeral: true 
                                });
                            }

                            poll.votes[optionIndex] = (poll.votes[optionIndex] || 0) + 1;
                            poll.voters.push(buttonInteraction.user.id);
                            savePollData(poll);

                            await updateResultsMessage(client, poll);
                            
                            await buttonInteraction.reply({ 
                                content: `Voted for: ${poll.options[optionIndex]}`, 
                                ephemeral: true 
                            });

                        } catch (error) {
                            console.error('Button interaction error:', error);
                            if (!buttonInteraction.replied) {
                                await buttonInteraction.reply({ 
                                    content: 'Error processing your vote. Please try again.', 
                                    ephemeral: true 
                                }).catch(console.error);
                            }
                        }
                    });

                    collector.on('end', async () => {
                        try {
                            const poll = loadPollData(pollId);
                            if (!poll) return;

                            const disabledButtons = poll.options.map((option, index) => 
                                new ButtonBuilder()
                                    .setCustomId(`vote_${index}_${poll.pollId}`)
                                    .setLabel(option.substring(0, 80))
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(true)
                            );

                            const disabledRow = new ActionRowBuilder().addComponents(disabledButtons);
                            await message.edit({ components: [disabledRow] });
                            await updateResultsMessage(client, poll, true);

                        } catch (error) {
                            console.error('Poll end error:', error);
                        }
                    });

                    // Refresh the results message immediately
                    await updateResultsMessage(client, poll);
                    console.log(`Successfully reattached to poll ${pollId}`);

                } catch (error) {
                    console.error(`Failed to fetch message for poll ${pollId}:`, error);
                }
            } catch (error) {
                console.error(`Error reattaching to poll ${pollId}:`, error);
            }
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('strawpoll')
        .setDescription('Creates a strawpoll with button voting')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('The poll question')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Poll duration (e.g., 1h, 30m, 2d)')
                .setRequired(true))        
        .addStringOption(option =>
            option.setName('option1')
                .setDescription('First option')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('option2')
                .setDescription('Second option')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('option3')
                .setDescription('Third option (optional)')
                .setRequired(false)),

    async execute(interaction) {
        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.SendMessages)) {
            return interaction.reply({ 
                content: 'I need the "Send Messages" permission to create polls!', 
                ephemeral: true 
            });
        }

        try {
            const question = interaction.options.getString('question');
            const options = [
                interaction.options.getString('option1'),
                interaction.options.getString('option2'),
                interaction.options.getString('option3')
            ].filter(Boolean);

            const durationString = interaction.options.getString('duration');
            const duration = parseDuration(durationString);
            if (!duration) {
                return interaction.reply({ 
                    content: 'Invalid duration format! Please use a format like 1h, 30m, or 2d.', 
                    ephemeral: true 
                });
            }

            const pollId = `${interaction.user.id}_${Date.now()}`;
            
            const pollData = {
                pollId,
                question,
                options,
                votes: {},
                voters: [],
                duration,
                endTime: Date.now() + duration,
                startedAt: Date.now(),
                messageId: null,
                resultsMessageId: null,
                channelId: interaction.channelId,
                guildId: interaction.guildId
            };

            // Initialize vote counts
            options.forEach((_, index) => {
                pollData.votes[index] = 0;
            });

            savePollData(pollData);

            const buttons = options.map((option, index) => 
                new ButtonBuilder()
                    .setCustomId(`vote_${index}_${pollId}`)
                    .setLabel(option.substring(0, 80))
                    .setStyle(ButtonStyle.Primary)
            );

            const pollEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(`📊 ${question.substring(0, 256)}`)
                .setDescription(`Vote by clicking a button below!\n\nEnds <t:${Math.floor((Date.now() + duration) / 1000)}:R>`)

            const row = new ActionRowBuilder().addComponents(buttons);
            
            const pollMessage = await interaction.reply({ 
                embeds: [pollEmbed], 
                components: [row], 
                fetchReply: true 
            });

            pollData.messageId = pollMessage.id;
            savePollData(pollData);

            // Create initial results message
            await updateResultsMessage(interaction.client, pollData);

            // Set up collector
            const collector = pollMessage.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: duration 
            });

            collector.on('collect', async (buttonInteraction) => {
                try {
                    const [prefix, optionIndex, ...pollIdParts] = buttonInteraction.customId.split('_');
                    const receivedPollId = pollIdParts.join('_');
                    
                    if (prefix !== 'vote') {
                        return buttonInteraction.reply({ 
                            content: 'Invalid poll button.', 
                            ephemeral: true 
                        });
                    }

                    const poll = loadPollData(receivedPollId);
                    if (!poll) {
                        console.error(`Poll not found: ${receivedPollId}`);
                        return buttonInteraction.reply({ 
                            content: 'Poll not found! Please try again.', 
                            ephemeral: true 
                        });
                    }

                    if (poll.voters.includes(buttonInteraction.user.id)) {
                        return buttonInteraction.reply({ 
                            content: 'You have already voted in this poll!', 
                            ephemeral: true 
                        });
                    }

                    poll.votes[optionIndex]++;
                    poll.voters.push(buttonInteraction.user.id);
                    savePollData(poll);

                    await updateResultsMessage(interaction.client, poll);
                    
                    await buttonInteraction.reply({ 
                        content: `Voted for: ${poll.options[optionIndex]}`, 
                        ephemeral: true 
                    });

                } catch (error) {
                    console.error('Button interaction error:', error);
                    if (!buttonInteraction.replied) {
                        await buttonInteraction.reply({ 
                            content: 'Error processing your vote. Please try again.', 
                            ephemeral: true 
                        }).catch(console.error);
                    }
                }
            });

            collector.on('end', async () => {
                try {
                    const poll = loadPollData(pollId);
                    if (!poll) return;

                    const disabledButtons = poll.options.map((option, index) => 
                        new ButtonBuilder()
                            .setCustomId(`vote_${index}_${poll.pollId}`)
                            .setLabel(option.substring(0, 80))
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true)
                    );

                    const disabledRow = new ActionRowBuilder().addComponents(disabledButtons);
                    await pollMessage.edit({ components: [disabledRow] });
                    await updateResultsMessage(interaction.client, poll, true);

                } catch (error) {
                    console.error('Poll end error:', error);
                }
            });

        } catch (error) {
            console.error('Poll creation error:', error);
            await interaction.reply({ 
                content: 'Failed to create poll. Please try again.', 
                ephemeral: true 
            }).catch(console.error);
        }
    },
    reattachPollCollectors
};