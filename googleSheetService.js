import { google } from "googleapis";

export class GoogleSheetService {
  constructor() {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    this.sheets = google.sheets({ version: "v4", auth });
    this.sheetId = process.env.SHEET_ID;
  }

  async appendRow(sheetName, values) {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });
  }

  async getSheet(sheetName) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: sheetName,
    });
    return res.data.values || [];
  }

  async updateRow(sheetName, rowIndex, values) {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `${sheetName}!A${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });
  }

  async deleteRow(sheetName, rowIndex) {
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: await this._getSheetId(sheetName),
                dimension: "ROWS",
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });
  }

  async _getSheetId(sheetName) {
    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.sheetId,
    });

    const sheet = meta.data.sheets.find(
      (s) => s.properties.title === sheetName
    );

    return sheet.properties.sheetId;
  }
}
