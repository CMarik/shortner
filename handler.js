'use strict';

const shortid = require('shortid');
const aws = require('aws-sdk');
const dynamoDb = new aws.DynamoDB.DocumentClient();

//function to process incoming text with URL
// POST method
module.exports.shorten = async (event, context) => {

  //get payload
  const payload = event.body;
  console.log(payload);
  //generate id
  const rndId = shortid.generate();

  //URL regex
  const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  const fullURL = payload.match(urlRegex);

  const saveResult = await saveURLReference(fullURL, rndId);

  if (saveResult) {
    const newText = payload
    .split(urlRegex)
    .join( "https://skl.sh/" + rndId);

    console.log(newText);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: newText,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      }),
    };
  }
};

module.exports.redirect = async (event, context) => {
  console.log("redirect function called");
  console.log(event.params);
  const redirectURL = await lookupURL(id);
  const response = {
    statusCode: 301,
    headers: {
        Location: redirectURL
    }
  };

  return response;
}

//here we save the full URL and relevant id to lookup for redirect
const saveURLReference = async (url, id) => {
  //get current timestamp
  const timestamp = new Date().getTime();

  //set TTL
  const expiration = timestamp + (1 * 60 * 60 * 1000);

  //prep DynamoDB params
  const params = {
    TableName: process.env.DYNAMODB_TABLE_SHORT_URL,
    Item: {
      id: id.toString(), //conert to string in case we store non-numeric values
      fullURL: url.toString(),
      createdAt: timestamp,
      updatedAt: timestamp,
      expiryTime: expiration
    }
  };

  return new Promise (function(resolve, reject) {
    dynamoDb.put(params, error => {
      // handle potential errors
      if (error) {
        console.error(error);
        reject ({
          statusCode: error.statusCode || 501,
          headers: { 'Content-Type': 'text/plain' },
          body: "Couldn't create record for: " + id
        });
      }
      resolve(true);
    });
  });

}

//here we are looking up the full URL to redirect based on ID
const lookupURL = async (id) => {
  //disable nodejs event loop
  context.callbackWaitsForEmptyEventLoop = false;

  console.log(event.params);
  //define conditions
  const params = {
    TableName: process.env.DYNAMODB_TABLE_SHORT_URL,
    IndexName: process.env.DYNAMODB_INDEX,
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
        ':id': id,
    },
    ProjectionExpression: 'fullUrl'
  };

  //query table
  return new Promise (function(resolve, reject) {
    dynamoDb.query(params, function(err, data) {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        console.log(data);

        const response = {
          statusCode: 200,
          body: JSON.stringify(fullURL)
        };
        resolve(response);
      }
    });
  });
}
