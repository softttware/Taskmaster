const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { time } = require('@discordjs/builders');
const filePath = path.join(__dirname, '../msupps/tunnels.json');

module.exports = (client) => {
    const alertChannelId = '1248863778301546556';

    const updateTunnelsData = () => {
        try {
            if (!fs.existsSync(filePath)) {
                console.log('Tunnels file does not exist.');
                return;
            }
    
            const data = fs.readFileSync(filePath, 'utf8');
            let tunnels = JSON.parse(data);
    
            Object.keys(tunnels).forEach(tunnelName => {
                const tunnel = tunnels[tunnelName];
                const hourRate = parseInt(tunnel.hourRate);
                const currentAmount = parseInt(tunnel.currentAmount);
    
                console.log(`Before update - Tunnel: ${tunnelName}, Current Amount: ${currentAmount}, Hour Rate: ${hourRate}`);
    
                if (!isNaN(hourRate) && !isNaN(currentAmount)) {
                    tunnel.currentAmount = Math.max(0, currentAmount - hourRate);
                } else {
                    console.error(`Invalid data for tunnel ${tunnelName}: hourRate or currentAmount is not a number.`);
                }
    
                console.log(`After update - Tunnel: ${tunnelName}, Current Amount: ${tunnel.currentAmount}`);
            });
    
            fs.writeFileSync(filePath, JSON.stringify(tunnels, null, 4), 'utf8');
            console.log('Tunnels data has been updated successfully.');
    
            client.tunnels = tunnels;
    
        } catch (error) {
            console.error('Error updating tunnels data:', error);
        }
    };

    const postTunnelsEmbed = async () => {
        try {
            if (!fs.existsSync(filePath)) {
                console.log('Tunnels file does not exist.');
                return;
            }

            const data = fs.readFileSync(filePath, 'utf8');
            let tunnels = JSON.parse(data);

            if (Object.keys(tunnels).length === 0) {
                console.log('Tunnels file is empty. No message will be sent.');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('Tunnel Supplies Status')
                .setColor(0x8c2b2b)
                .setTimestamp()
                .setImage("https://i.postimg.cc/mrNZS6ZL/Tunnel-Numbers.png");

            Object.entries(tunnels).forEach(([tunnelName, tunnelData]) => {
                const { currentAmount, hourRate } = tunnelData;

                if (!currentAmount || !hourRate || hourRate <= 0) {
                    embed.addFields({
                        name: tunnelName,
                        value: 'Tunnel is out of Msupps or has not been set up yet.',
                    });
                    return;
                }

                const durationHours = currentAmount / hourRate;
                const durationMillis = durationHours * 60 * 60 * 1000;
                const endTime = new Date(Date.now() + durationMillis);

                const hammertime = time(endTime, 'R');

                embed.addFields({
                    name: tunnelName,
                    value: `Current Amount: **${currentAmount}**\nHourly Rate: **${hourRate}**\nSupplies deplete: ${hammertime}`,
                });
            });

            const channel = await client.channels.fetch(alertChannelId);  
            if (channel) {
                channel.send({ embeds: [embed] });
            } else {
                console.error(`Alert channel with ID ${alertChannelId} not found.`);
            }

        } catch (error) {
            console.error('Error posting tunnels embed:', error);
        }
    };

    setInterval(updateTunnelsData, 60 * 60 * 1000);
    setInterval(postTunnelsEmbed, 12 * 60 * 60 * 1000);
    updateTunnelsData();
};
