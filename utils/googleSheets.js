const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
require('dotenv').config();

async function initializeSheets() {
    try {
        const auth = new GoogleAuth({
            credentials: {
                client_email: process.env.google.client_email,
                private_key: process.env.google.private_key.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        return google.sheets({ version: 'v4', auth });
    } catch (error) {
        console.error('Error initializing Google Sheets API:', error);
        throw error;
    }
}

module.exports = { initializeSheets };
