const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { initializeSheets } = require('../utils/googleSheets');
require('dotenv').config();
const categories = require('../utils/categories.json');
const categoryData = require('../utils/categoryData.json');
const catalogue = require('../utils/catalogue.json');
const sheetId = process.env.spreadsheetId

module.exports = {
    data: new SlashCommandBuilder()
        .setName('searchstocks')
        .setDescription('Search for stock items by category or item')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The specific item to search for'))
        .addStringOption(option =>
            option.setName('category')
                .setDescription('The category to search in')
                .addChoices(
                    ...Object.keys(categories).map(cat => ({ name: cat, value: cat }))
                )),
        
    async execute(interaction) {
        
        const categoryInput = interaction.options.getString('category');
        const itemInput = interaction.options.getString('item')?.trim().toLowerCase();
        
        await interaction.deferReply({ ephemeral: !!categoryInput});

        try {
            const sheets = await initializeSheets();
            const layoutResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: 'Totals!B5',
            });
            const layout = layoutResponse.data.values[0][0];

            if (!categoryInput && !itemInput) {
                await interaction.editReply("Please provide either a category or an item to search for.");
                return;
            }

            if (!categoryData[layout]) {
                await interaction.editReply(`Unknown layout: ${layout}. Please check the spreadsheet.`);
                return;
            }

            if (categoryInput) {
                const layoutCategories = categoryData[layout].Categories;
                const categoryRange = layoutCategories[categoryInput];

                if (!categoryRange) {
                    console.error(`Category "${categoryInput}" not found in ${layout} layout within categoryData.json.`);
                    await interaction.editReply(`No data found for category "${categoryInput}" in the ${layout} layout.`);
                    return;
                }

                const columnResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId: sheetId,
                    range: 'Totals!F1:Z2',
                });

                const [locationRow, stockpileRow] = columnResponse.data.values;
                const validColumns = locationRow
                    .map((location, index) => location ? { location, stockpileName: stockpileRow[index], colIndex: index + 6 } : null)
                    .filter(entry => entry);

                if (!validColumns.length) {
                    await interaction.editReply(`No locations found for category "${categoryInput}" in the ${layout} layout.`);
                    return;
                }

                const categoryRangeResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId: sheetId,
                    range: `Totals!B${categoryRange.start}:B${categoryRange.end}`,
                });

                const categoryItems = categoryRangeResponse.data.values.map(row => row[0]).filter(Boolean);
                const stockData = {};

                for (const { colIndex, location } of validColumns) {
                    const valuesResponse = await sheets.spreadsheets.values.get({
                        spreadsheetId: sheetId,
                        range: `Totals!${categoryRange.start}:${categoryRange.end}`,
                    });

                    const categoryRows = valuesResponse.data.values;
                    categoryRows.forEach((row, rowIndex) => {
                        const itemName = categoryItems[rowIndex];
                        if (itemName) {
                            const value = row[colIndex - 1];
                            if (value && parseFloat(value) > 0) {
                                if (!stockData[location]) {
                                    stockData[location] = [];
                                }
                                stockData[location].push({ item: itemName, value });
                            }
                        }
                    });
                }

                if (Object.keys(stockData).length > 0) {
                    for (const [location, items] of Object.entries(stockData)) {
                        const stockpileName = validColumns.find(col => col.location === location).stockpileName;
                        const categoryIcon = categories[categoryInput]?.icon || 'https://example.com/default-icon.png';

                        const embed = new EmbedBuilder()
                            .setColor(0x6e0000)
                            .setTitle(`${stockpileName} - ${location}`)
                            .setThumbnail(categoryIcon)
                            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.avatarURL() });

                        const itemField = items.map(({ item }) => item).join('\n') || 'No items available';
                        const qtyField = items.map(({ value }) => value).join('\n') || 'No quantities available';

                        embed.addFields(
                            { name: 'Items', value: itemField, inline: true },
                            { name: 'Qty', value: qtyField, inline: true }
                        );

                        await interaction.followUp({ embeds: [embed], ephemeral: true });
                    }
                } else {
                    await interaction.editReply(`No stock data found for "${categoryInput}" in the ${layout} layout.`);
                }
            } else if (itemInput) {
                const itemEntry = Object.entries(catalogue[layout]).find(([itemName, entry]) => {
                    return itemName.toLowerCase() === itemInput || 
                        (entry.nicknames && entry.nicknames.map(nick => nick.toLowerCase()).includes(itemInput));
                });

                if (!itemEntry) {
                    await interaction.editReply(`Item "${itemInput}" not found in the catalogue.`);
                    return;
                }

                const [catalogueItemName, itemData] = itemEntry;
                const targetRows = itemData.rows || [itemData.row];
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: sheetId,
                    range: 'Totals!B:Z',
                });
                const rows = response.data.values;
                const stockData = {};

                for (const targetRowIndex in targetRows) {
                    const targetRow = targetRows[targetRowIndex];
                    const isCratesRow = targetRows.length > 1 && targetRowIndex === '0';
                    const isUncratedRow = targetRows.length > 1 && targetRowIndex === '1';

                    if (rows[targetRow - 1]) {
                        const row = rows[targetRow - 1];
                        for (let colIndex = 4; colIndex < row.length; colIndex++) {
                            const cellValue = row[colIndex];
                            if (cellValue && parseFloat(cellValue) > 0) {
                                const location = rows[0][colIndex];
                                const stockpileName = rows[1][colIndex];
                                if (!stockData[location]) {
                                    stockData[location] = [];
                                }
                                const entryType = targetRows.length > 1 ? (isCratesRow ? 'Crates' : 'Uncrated') : '';
                                stockData[location].push(`${stockpileName}: ${cellValue} ${entryType}`.trim());
                            }
                        }
                    }
                }

                if (Object.keys(stockData).length > 0) {
                    const embed = new EmbedBuilder()
                        .setColor(0x6e0000)
                        .setTitle(`${catalogueItemName} in Stocks`)
                        .setDescription(`Here’s the latest stock info for **${catalogueItemName}**`)
                        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.avatarURL() });
                
                    const thumbnailUrl = itemData.thumbnail || 'https://example.com/default-thumbnail.png';
                    embed.setThumbnail(thumbnailUrl);
                
                    for (const [location, entries] of Object.entries(stockData)) {
                        embed.addFields({
                            name: location,
                            value: entries.join('\n'),
                            inline: false,
                        });
                    }
                
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply(`No stocks found for "${catalogueItemName}".`);
                }
            }
        } catch (error) {
            console.error('Error retrieving data:', error);
            await interaction.editReply('An error occurred while retrieving stock data.');
        }
    },
};
