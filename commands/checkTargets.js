const { initializeSheets } = require('../utils/googleSheets');
const overviewData = require('../utils/categoryDataOverview.json');
require('dotenv').config();

module.exports = (client) => {
    const triggerChannelId = '1255987440825401479';
    const foxholeUpdatesId = '1255994696749158473';
    const logisticsWorkshopId = '1248863778301546556';

    async function checkAndSendTrainNotification(channel) {
        try {
            const googleSheets = await initializeSheets();
            const spreadsheetId = process.env.spreadsheetId;

            // First verify the sheet exists
            const spreadsheet = await googleSheets.spreadsheets.get({
                spreadsheetId,
                fields: 'sheets.properties.title'
            }).catch(err => {
                console.error('Error fetching spreadsheet metadata:', err);
                throw new Error('Failed to access spreadsheet');
            });

            const sheetExists = spreadsheet.data.sheets.some(
                sheet => sheet.properties.title === 'Shipment Tracker'
            );

            if (!sheetExists) {
                console.error('"Shipment Tracker" sheet not found in spreadsheet');
                await channel.send('Error: "Shipment Tracker" sheet not found in spreadsheet');
                return false;
            }

            // Fetch Row 6 (Qty) and Row 5 data
            const range = "'Shipment Tracker'!I6:AD6";
            const auxRange = "'Shipment Tracker'!I5:AD5";
            
            const [row6Response, row5Response] = await Promise.all([
                googleSheets.spreadsheets.values.get({
                    spreadsheetId,
                    range,
                }).catch(err => {
                    console.error('Error fetching row 6:', err);
                    throw new Error(`Failed to fetch row 6 data: ${err.message}`);
                }),
                googleSheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: auxRange,
                }).catch(err => {
                    console.error('Error fetching row 5:', err);
                    throw new Error(`Failed to fetch row 5 data: ${err.message}`);
                }),
            ]);

            // Handle empty responses
            const row6Values = row6Response.data.values ? row6Response.data.values[0] || [] : [];
            const row5Values = row5Response.data.values ? row5Response.data.values[0] || [] : [];

            // Check if there are any values above zero in Row 6, excluding those where Row 5 is zero
            const hasValuesAboveZero = row6Values.some((value, i) => {
                const row5Value = parseFloat(row5Values[i] || 0);
                const row6Value = parseFloat(value || 0);
                return row5Value !== 0 && row6Value > 0;
            });

            if (!hasValuesAboveZero) {
                console.log('No trains available for shipping.');
                return false;
            }

            // Fetch Row 1 and Row 2 data
            const rows1And2Range = "'Shipment Tracker'!I1:AD2";
            const rows1And2Response = await googleSheets.spreadsheets.values.get({
                spreadsheetId,
                range: rows1And2Range,
            }).catch(err => {
                console.error('Error fetching rows 1-2:', err);
                throw new Error(`Failed to fetch location data: ${err.message}`);
            });

            const [row1Values = [], row2Values = []] = rows1And2Response.data.values || [[], []];

            let stockpileValues = [];
            let locationValues = [];
            let trainValues = [];

            for (let i = 0; i < row6Values.length; i++) {
                const row5Value = parseFloat(row5Values[i] || 0);
                const row6Value = parseFloat(row6Values[i] || 0);

                // Only include values where Row 5 is not zero and Row 6 has a valid value
                if (row5Value !== 0 && row6Value > 0) {
                    stockpileValues.push(row2Values[i] || 'Unknown');
                    locationValues.push(row1Values[i] || 'Unknown');
                    trainValues.push(row6Value);
                }
            }

            if (stockpileValues.length === 0) {
                console.log('No valid train shipments found after filtering');
                return false;
            }

            const embed = {
                title: 'Shipping Notification',
                description: 'There is a trains worth of equipment in these backline stockpiles able to be shipped forward.',
                color: 0x9a2d2d,
                fields: [
                    {
                        name: 'Stockpile',
                        value: stockpileValues.join('\n') || 'No data',
                        inline: true,
                    },
                    {
                        name: 'Location',
                        value: locationValues.join('\n') || 'No data',
                        inline: true,
                    },
                    {
                        name: 'Qty <:Train:1348710261585875038>',
                        value: trainValues.join('\n') || 'No data',
                        inline: true,
                    },
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: '',
                },
            };

            await channel.send({ embeds: [embed] });
            console.log('Train shipping data fetched and posted successfully.');
            return true;
        } catch (error) {
            console.error('Error in checkAndSendTrainNotification:', error);
            await channel.send(`An error occurred while processing train shipments: ${error.message}`);
            return false;
        }
    }

    client.on('messageCreate', async (message) => {
        if (message.channelId === triggerChannelId && message.content === '!update-triggered-12h') {
            const responseChannel = client.channels.cache.get(foxholeUpdatesId);

            if (!responseChannel) {
                console.error('Response channel not found.');
                return;
            }

            try {
                const googleSheets = await initializeSheets();
                const spreadsheetId = process.env.spreadsheetId;

                // First verify the Overview sheet exists
                const spreadsheet = await googleSheets.spreadsheets.get({
                    spreadsheetId,
                    fields: 'sheets.properties.title'
                }).catch(err => {
                    console.error('Error fetching spreadsheet metadata:', err);
                    throw new Error('Failed to access spreadsheet');
                });

                const sheetExists = spreadsheet.data.sheets.some(
                    sheet => sheet.properties.title === 'Overview'
                );

                if (!sheetExists) {
                    console.error('"Overview" sheet not found in spreadsheet');
                    await responseChannel.send('Error: "Overview" sheet not found in spreadsheet');
                    return;
                }

                // Get faction data
                const range = "'Overview'!B6";
                const response = await googleSheets.spreadsheets.values.get({
                    spreadsheetId,
                    range,
                }).catch(err => {
                    console.error('Error fetching faction data:', err);
                    throw new Error(`Failed to fetch faction data: ${err.message}`);
                });

                const [[faction]] = response.data.values || [[]];

                if (!overviewData[faction]) {
                    await responseChannel.send(`Faction "${faction}" not found in category data.`);
                    return;
                }

                const fullRange = "'Overview'!C:G";
                const fullResponse = await googleSheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: fullRange,
                }).catch(err => {
                    console.error('Error fetching overview data:', err);
                    throw new Error(`Failed to fetch overview data: ${err.message}`);
                });

                const rows = fullResponse.data.values || [];

                console.log('Fetched rows:', rows);
                
                let hasContentToSend = false;
                const categoryMessages = [];

                for (const [category, { start, end }] of Object.entries(overviewData[faction].Categories)) {
                    let messageContent = `**${category}**\n\`\`\``;
                    let tableRows = [];

                    let calculationLabel = 'MPF Queues Needed';
                    let divisor = 9;

                    if (category === 'Vehicles (Totals)' || category === 'Structures (Totals)') {
                        divisor = 15;
                    } else if (category === 'Utility') {
                        divisor = 4;
                        calculationLabel = 'Factory Queues Needed';
                    } else if (category === 'Facility Vehicles' || category === 'Materials') {
                        divisor = null;
                    }

                    // Add table header
                    tableRows.push('Item'.padEnd(30) + 'Totals'.padEnd(15) + 'Target'.padEnd(15) + (divisor !== null ? calculationLabel.padEnd(15) : ''));
                    tableRows.push('-'.repeat(78));

                    for (let row = start - 1; row < end; row++) {
                        if (rows[row]) {
                            const [c = '', d = '', e = '', f = '', g = ''] = rows[row];

                            console.log(`Row ${row + 1}:`, { c, d, e, f, g });

                            if (f && !isNaN(parseFloat(f))) {
                                const gValue = parseFloat(g.replace('%', '')) || 0;
                                if (gValue <= 70) {
                                    const eValue = parseFloat(e) || 0;
                                    const fValue = parseFloat(f);
                                    let calculation = '';

                                    if (divisor !== null) {
                                        calculation = Math.ceil((fValue - eValue) / divisor);
                                    }

                                    const tableRow = `${c.padEnd(30)}${e.toString().padEnd(15)}${f.toString().padEnd(15)}${calculation.toString().padEnd(15)}`;
                                    tableRows.push(tableRow);
                                }
                            }
                        }
                    }

                    if (tableRows.length > 2) {
                        messageContent += tableRows.join('\n');
                        messageContent += '```';
                        categoryMessages.push(messageContent);
                        hasContentToSend = true;
                    }
                }

                // Check for train shipments
                const hasTrainShipments = await checkAndSendTrainNotification(responseChannel);

                if (hasContentToSend || hasTrainShipments) {
                    const announceMsg = "# <:HM1:1290670807508455434> Production update and requirements <:mpf:1256002991715258413>";
                    await responseChannel.send(announceMsg);
                    
                    // Only send category messages if we have them
                    if (hasContentToSend) {
                        for (const msg of categoryMessages) {
                            await responseChannel.send(msg);
                        }
                    }
                    
                    console.log('Data fetched and posted successfully.');
                } else {
                    console.log('No content to send - all categories empty and no trains available.');
                }
            } catch (error) {
                console.error('Error in update-triggered-12h:', error);
                await responseChannel.send(`An error occurred while processing the update: ${error.message}`);
            }
        }
    });
    
    client.on('messageCreate', async (message) => {
        if (message.channelId === triggerChannelId && message.content === '!update-triggered') {
            const responseChannel = client.channels.cache.get(logisticsWorkshopId);
    
            if (responseChannel) {
                await checkAndSendTrainNotification(responseChannel);
            } else {
                console.error('Response channel not found.');
            }
        }
    });
};