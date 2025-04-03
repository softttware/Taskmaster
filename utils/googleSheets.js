const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
require('dotenv').config();

async function initializeSheets() {
    try {
        const privateKey = process.env.google_private_key.replace(/\\n/g, '\n');

        const auth = new GoogleAuth({
            credentials: {
                client_email: process.env.google_client_email,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        
        // Test authentication immediately
        const client = await auth.getClient();
        console.log('Successfully authenticated with Google Sheets API');
        
        return google.sheets({ version: 'v4', auth });
    } catch (error) {
        console.error('Error initializing Google Sheets API:', error);
        throw error;
    }
}

module.exports = { initializeSheets };