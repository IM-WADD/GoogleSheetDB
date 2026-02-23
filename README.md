# Google Sheet as Database

Turn any Google Sheet into a relational database using appscript.js.

## Quick Start
Add the contents of appsscript.js to your Google Sheet:
1. In the Google Sheet, go to Extensions > Apps Script.
2. Copy-paste the contents of appsscript.js into the Apps Script window.
3. Save.

Deploy the script as a web app:
1. From the Apps Script window, click Deploy > New Deployment.
2. In the wizard, under "select type" in the left column, choose "Web App".
3. In the wizard, check the following settings:
    - Execute as: must be set to yourself
    - Who as access: must be set to "Anyone"
4. In the wizard, click Deploy.
5. When deployment is complete, you will see multiple URLs. Copy the URL labelled "Web App URL" and use it in your web application—this is the API endpoint. The URL will end in "/exec".

## Setting Up Your Database
Each tab in the Google Sheet acts as a table in a your database. Change the name of a tab to name a database table. When naming:
- Avoid spaces and special characters other than _ or - 
- Ensure each table name is unique 

Row 1 in each table defines the column headers. When naming columns:
- Avoid spaces and special characters other than_ or -
- Ensure each column name is unique within the table

## Database API
Jump to:
- [The API endpoint](#the-api-endpoint)
- [Read](#read-data)
- [Add](#add-data)
- [Update](#update-existing-data)
- [Delete](#delete-data)
### The API endpoint
All database requests are made using the same endpoint: the Web App URL specified in the deployment wizard the Apps Script. Add the URL parameter `table` to Web App URL. This parameter should be set to the name of the table you want to make requests about. If this parameter is omitted, the request will go to the first tab in your Google Sheet.

Example: the fetch request below selects the table (tab) named "Table1".

```
const dbAPI = "https://your-web-app-url/exec";
const response = await fetch(`${dbAPI}?table=Table1`);
```

### Read data
**Method:** GET

A fetch request to the API endpoint will return all data stored in the specified table as a JSON array.

Response object properties:

| Property | Description |
| --- | --- |
| status | An HTTP status code. Code 200 indicates a successful request. |
| message | A string summarising the request outcome.|
| data | An array of JSON objects. Each object represents one row of data. Table column headings are used as property keys. |

Example:
```
const dbAPI = "https://your-web-app-url/exec";
const response = await fetch(`${dbAPI}?table=Table1`);
const content = await response.json();
const data = content.data;
console.log(data); // prints all rows of data in Table1
```
### Add data
**Method:** POST

Add one row of data to the specified table. 

Your fetch request to the API endpoint must specify the request type and set the content type to plain text (see method and headers below). 

The request body must be a JSON object with the following properties:

| Property | Value |
| --- | --- |
| action | "add" |
| data | An object where each key matches a column heading in the table, and the value to add to that column. All table columns must be present in the data object. |

Response object properties:

| Property | Description |
| --- | --- |
| status | An HTTP status code. Code 200 indicates a successful request. |
| message | A string summarising the request outcome.|
| data | An empty JSON object. |

Possible errors:
- Either of the expected request body properties are missing or contain a typo.
- The column names in the data object don't match those in the table.

Example (assumes Table 1 has two columns named "Column1" and "Column2"):
```
const dbAPI = "https://your-web-app-url/exec";
const response = await fetch(`${dbAPI}?table=Table1`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: {
        action: "add",
        data: {
            Column1: "ABC",
            Column2: 123
        }
    }
});
const content = await response.json();
console.log(content.message); // prints the message returned from the DB
```

### Update existing data
**Method:** POST

Update existing data in the specified table. The database will identify all rows that match the selection criteria in the request body and update all matching rows as specified.

Your fetch request to the API endpoint must specify the request type and set the content type to plain text (see method and headers below). 

The request body must be a JSON object with the following properties:

| Property | Value |
| --- | --- |
| action | "update" |
| data | An object with two properties, select and update. |
| data.select | An object describing the selection criteria. Include the columns to search (keys) and the values to match (values). All selection criteria must be met for a row to be selected. |
| data.update | An object describing the new values. Include the names of columns to update (keys) and the new values. Different columns can appear in select and update. |

Response object properties:

| Property | Description |
| --- | --- |
| status | An HTTP status code. Code 200 indicates a successful request. |
| message | A string summarising the request outcome.|
| data | An empty JSON object. |

Possible errors:
- Either of the expected request body properties are missing or contain a typo.
- The data object is not formatted as expected. The select and update properties cannot be empty.

Example (assumes Table 1 has two columns named "Column1" and "Column2"):
```
const dbAPI = "https://your-web-app-url/exec";
const response = await fetch(`${dbAPI}?table=Table1`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: {
        action: "update",
        data: {
            select: {
                Column1: "ABC",
                Column2: 123
            }
            update: {
                Column2: 456
            }
        }
    }
});
const content = await response.json();
console.log(content.message); // prints the message returned from the DB
```
The code above selects rows where the value in Column1 is "ABC" AND Column2 is 123. In the matching rows, Column2 will be updated to 456.

### Delete data
**Method:** POST

Delete rows of data from the specified table. The database will identify all rows that match the selection criteria in the request body and remove them.

Your fetch request to the API endpoint must specify the request type and set the content type to plain text (see method and headers below). 

The request body must be a JSON object with the following properties:

| Property | Value |
| --- | --- |
| action | "delete" |
| data | An object with one property, select. |
| data.select | An object describing the selection criteria. Include the columns to search (keys) and the values to match (values). All selection criteria must be met for a row to be selected. |

Response object properties:

| Property | Description |
| --- | --- |
| status | An HTTP status code. Code 200 indicates a successful request. |
| message | A string summarising the request outcome.|
| data | An empty JSON object. |

Possible errors:
- Either of the expected request body properties are missing or contain a typo.
- The data object is not formatted as expected. The select properties cannot be empty.

Example (assumes Table 1 has two columns named "Column1" and "Column2"):
```
const dbAPI = "https://your-web-app-url/exec";
const response = await fetch(`${dbAPI}?table=Table1`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: {
        action: "delete",
        data: {
            select: {
                Column1: "ABC",
                Column2: 123
            }
        }
    }
});
const content = await response.json();
console.log(content.message); // prints the message returned from the DB
```
The code above selects and deletes all rows where the value in Column1 is "ABC" AND Column2 is 123.