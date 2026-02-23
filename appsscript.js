/*
DO NOT MODIFY THIS SCRIPT IF USING IT FOR YOUR WADD ASSESSMENT!!!

ADD THIS SCRIPT TO A GOOGLE SHEET:
1. In your Google Sheet, click Extensions > Apps Script.
2. Delete any code in the script editor and replace it with this code.
3. Click the floppy disk icon to save.

TO MAKE THIS SHEET AVAILABLE AS A DATABASE: 
1. Click Deploy > New Deployment (button above)
2. In the wizard, under "select type" in the left column, choose "Web App".
3. In the wizard, check the following settings:
- Execute as: must be set to yourself
- Who as access: must be set to "Anyone"
4. In the wizard, click Deploy.
5. When deployment is complete, you will see multiple URLs. Copy the URL labelled "Web App URL" and use it in your web application—this is the API endpoint. The URL will end in "/exec".

Follow the instructions in Week 8 Practical 2 to learn how to use the database API in your project

Acknowledgements:
This dev.to article was used to learn how to handle basic get and post requests in Google Apps Script:
https://dev.to/sfsajid91/unleashing-the-power-of-spreadsheets-building-a-rest-api-with-google-sheet-google-apps-script-3mi1#dopost-function-for-retrieving-data-get-request

*/

function doGet(e) {
  try {
    // Check for specific table request
    const table = e.parameter.table;
    const sheet = getTable(table); 
    if (!sheet) {
      return createBadRequestResponse(`Unable to GET data. Table does not exist. ${table ? "Requested " + table : " Spreadsheet may be empty?"}`);
    }
    
    const data = getAllData(sheet);
    return createSuccessResponse("Data retrieved", data);
  }
  catch (error) {
    return createBadRequestResponse(`Something went wrong with your GET request: ${error.toString()}`);
  }
}

// function doOptions() {
//   return ContentService.createTextOutput("Preflight check")
//     .setMimeType(ContentService.MimeType.JSON)
// }


function doPost(e) {
  const ADD = "add";
  const UPDATE = "update";
  const DELETE = "delete";
  try {
    // Get the request payload (data)
    const data = JSON.parse(e.postData.contents);

    // Check for specific table request
    const table = e.parameter.table;
    const sheet = getTable(table);
    if (!sheet) {
      return createBadRequestResponse(`Unable to POST data. Table does not exist. ${table ? "Requested " + table : " Spreadsheet may be empty?"}`);
    }

    // Run requested action
    switch (data.action) {
      case ADD:
        return addNewData(data, sheet);
      case UPDATE:
        return updateData(data, sheet);
      case DELETE:
        return deleteData(data, sheet);
      default:
        return createBadRequestResponse(`Unable to complete request. Request body must include action field. The value of action must be one of: "${ADD}", "${UPDATE}", or "${DELETE}".`);
    }
  
  } catch (error) {
    return createBadRequestResponse(`Something went wrong with your POST request: ${error.toString()}`);
  }
}

/**
 * Adds a new row of data to the given sheet
 * @param {Object} data The data to add
 * @param {Sheet} sheet The tab to add the data to
 * @returns {*} A response object indicating the outcome of the request
 */
function addNewData(data, sheet) {
  if (!data.data) {
    return createBadRequestResponse(`Unable to add data. Request body must include a data field, which should store an object describing the data to add.`);
  }
  const dataToAdd = data.data;
  const headers = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0];
  let validationMsg = "";
  for (const col of headers) {
    if (!col) break;
    if (!dataToAdd[col]) {
      validationMsg += ` Missing column ${col}.`;
      return createBadRequestResponse(`All table fields are required.${validationMsg}`);
    }
    else validationMsg += ` Found column ${col}.`
  }

  // structure the request data to match the column order
  const structuredData = headers.map(col => dataToAdd[col]); 

  // Append the new data to the sheet
  sheet.appendRow(structuredData);

  return createSuccessResponse("Data added successfully");
}


/**
 * Identifies rows that match the criteria in dataToSelect
 * @param {Object} dataToSelect The data to match
 * @param {Object[]} currentData The full spreadsheet data
 * @returns {number[]} An array of spreadsheet row numbers (index as in the spreadsheet e.g. row 2 = first row of data)
 */
function selectMatchingRowsOLD(dataToSelect, currentData) {
  const matchingRows = []; // 2D array to store cell updates, inner arrays are row, col, newValue
  for (let i = 0; i < currentData.length; i++) {
    for (const [header, value] of Object.entries(dataToSelect)) {
      if (currentData[i][header] === value) {
        matchingRows.push(i + 2); // Push the spreadsheet row number       
      }
    }
  }
  return matchingRows;
}

/**
 * Identifies rows that match the criteria in dataToSelect
 * @param {Object} dataToSelect The data to match
 * @param {Sheet} sheet The tab to search
 * @returns {number[]} An array of spreadsheet row numbers (index as in the spreadsheet e.g. row 2 = first row of data)
 */
function selectMatchingRows(dataToSelect, sheet) {
  const data = sheet.getDataRange().getValues();
  const matchingRows = []; // array to store matching row ids (index starts from 1)
  for (let row = 1; row < data.length; row++) {
    let match = false;
    for (const [col, value] of Object.entries(dataToSelect)) {
      if (data[row][col] !== value) {
        break;
      } else {
        match = true;
      }
    }
    if (match) matchingRows.push(row + 1); // add 1 to convert array index to spreadshet row
  }
  return matchingRows;
}

/**
 * Converts an object using column headers as keys to an object using column indices instead.
 * @param {Sheet} sheet The tab to get the headers from
 * @param {Object} data An object with key: value pairs in the format columnName: value
 * @return {Object} An object with key: value pairs in the format columnIndex: value
 */
function headersToIndices(sheet, data) {
  const headers = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0];
  const converted = {};
  for (const [key, value] of Object.entries(data)) {
    const idx = headers.indexOf(key);
    if (idx < 0) {
      throw new Error(`Unable to find column ${key}`);
    }
    converted[idx] = value;
  }
  return converted;
}


/**
 * Replaces select values in the sheet with new data
 * @param {Object} data The data to update
 * @param {Sheet} sheet The tab to update the data in
 * @returns {*} A response object indicating the outcome of the request
 */
function updateData(data, sheet) {
  try {
    if (!data.data || !data.data.select || data.data.select.length === 0 || !data.data.update || data.data.update.length === 0) {
      return createBadRequestResponse(`Unable to update data. Request body must include a data field, which should store an object describing the data to update.`);
    }
    const dataToSelect = data.data.select;
    const dataToUpdate = data.data.update;

    const matchCriteria = headersToIndices(sheet, dataToSelect);
    const updateCriteria = headersToIndices(sheet, dataToUpdate);
    const sheetRowsToUpdate = selectMatchingRows(matchCriteria, sheet);

    // Combine sheetRowsToUpdate with updateCriteria -> flatten updateCriteria and merge
    const formattedData = sheetRowsToUpdate.flatMap(
      rowNum => Object.entries(updateCriteria).map((
        [colIdx, val]) => [rowNum, Number(colIdx) + 1, val]
      )
    );

    let resultMsg = "";

    // do the update
    for (const update of formattedData) { 
      sheet.getRange(update[0], update[1]).setValue(update[2]);
      resultMsg += `Set ${update[0]}, ${update[1]} to ${update[2]}. `;
    }
    // return
    return createSuccessResponse(`Data updated successfully. ${resultMsg}`);
  } catch (e) {
    return createBadRequestResponse(`Unable to update data. ${e.toString()}`);
  }
}


/**
 * Deletes selcted rows
 * @param {Object} data The data to select to be deleted
 * @param {Sheet} sheet The tab to delete the data from
 * @returns {*} A response object indicating the outcome of the request
 */
function deleteData(data, sheet) {
  try {
    if (!data.data || !data.data.select || data.data.select.length === 0) {
      return createBadRequestResponse(`Unable to delete data. Request body must include a data field, which should store an object describing the data to delete.`);
    }
    const dataToSelect = data.data.select;
    const matchCriteria = headersToIndices(sheet, dataToSelect);
    const sheetRowsToUpdate = selectMatchingRows(matchCriteria, sheet);

    sheetRowsToUpdate.reverse(); // iterate backwards to preserve row numbers

    // do the delete
    for (const row of sheetRowsToUpdate) { 
      sheet.deleteRow(row);
    }
    // return
    return createSuccessResponse(`Delete request complete. ${sheetRowsToUpdate.length} matching rows deleted`);
  } catch (e) {
    return createBadRequestResponse(`Unable to delete data. ${e.toString()}`);
  }
}

/**
 * Creates an error message response to send back to the client.
 * @param {String} message A short string that explains the error
 * @returns {*} The response object to send to the client
 */
function createBadRequestResponse(message) {
  const outputData = JSON.stringify({
        status: 400,
        data: {},
        message
      });

  return ContentService.createTextOutput(outputData).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Creates a success message response to send back to the client.
 * @param {String} message A short string that confirms the action taken
 * @param {Object} data Any data to send back to the client
 * @returns {*} The response object to send to the client
 */
function createSuccessResponse(message, data = {}) {
  const outputData = JSON.stringify({
    status: 200,
    data: JSON.stringify(data),
    message
  })

  return ContentService.createTextOutput(outputData).setMimeType(ContentService.MimeType.JSON);
}


/**
 * Gets the spreadsheet tab with the given name.
 * If no name is provided, gets the first tab.
 * @param {String} table The table name
 * @returns {Sheet | null} Returns the requested sheet or null if no match is found
 */
function getTable(table) {
  if (table) return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table);
  return SpreadsheetApp.getActiveSpreadsheet().getSheetById(0);
}


/**
 * Gets all the data on a tab of the spreadsheet.
 * Assumes the first row is the headers
 * @param {Sheet} sheet The tab to get data from
 * @returns {Object[]} The data as an array of objects
 */
function getAllData(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const dataAsObj = convertToObjectArray(data);
  return dataAsObj;
}


/**
 * Converts spreadsheet data to an array of objects
 * @param {Object} data The spreadsheet data
 * @returns {Object[]} An array of objects containing the spreadsheet data
 */
function convertToObjectArray(data) {
  const objArray = [];

  // Check if data is empty or doesn't contain enough rows for headers and at least one data row
  if (!data || data.length < 2) {
    // Return an empty array 
    return objArray; 
  }

  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record = {};

    // looping through each row
    for (let j = 0; j < row.length; j++) {
      record[headers[j]] = row[j];
    }

    objArray.push(record);
  }

  return objArray;
}
