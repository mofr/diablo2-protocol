const Client = require('./client');

const fs = require('fs');

const getHash = require('./getHash');

const getMpq = require('./getMpq');

const Client3 = require('./client3');



function createClient({username, password, host, port}) {
  const client = new Client({host, port});
  const key1 = fs.readFileSync('./key1');
  const key2 = fs.readFileSync('./key2');
  client.clientToken = 18226750;
  client.username = username;
  client.password = password;

  client.on('connect', () => {
    //'connect' listener
    console.log('connected to server!');
    //client.write('world!\r\n');

    client.socket.write(Buffer.from("01","hex")); // Initialises a normal logon conversation

    client.platformId = 1230518326;
    client.productId = 1144150096;

    client.write('SID_AUTH_INFO', {
      protocolId: 0,
      platformCode: client.platformId,
      productCode: client.productId,
      versionByte: 13,
      languageCode: 1701729619,
      localIp: 587311296,
      timeZoneBias: 4294967236,
      mpqLocaleId: 1036,
      userLanguageId: 1033,
      countryAbreviation: 'FRA',
      country: 'France'
    }); // http://www.bnetdocs.org/?op=packet&pid=279 SID_AUTH_INFO
  });


  client.on('SID_PING',({pingValue}) => {
    console.log("I received a ping of ping",pingValue);
    client.write('SID_PING',{
      pingValue
    })
  });


  function writeAuthCheck() {
    client.write("SID_AUTH_CHECK",{
      "clientToken": client.clientToken,
      "exeVersion": 16780544,
      "exeHash": 1666909528,
      "numberOfCDKeys": 2,
      "spawnKey": 0,
      "cdKeys": [
        {
          "keyLength": 26,
          "keyProductValue": 24,
          "keyPublicValue": 10916470,
          "unknown": 0,
          "hashedKeyData": key1
        },
        {
          "keyLength": 26,
          "keyProductValue": 25,
          "keyPublicValue": 6187878,
          "unknown": 0,
          "hashedKeyData": key2
        }
      ],
      "exeInformation": "Game.exe 10/18/11 20:48:14 65536",
      "keyOwnerName": "sonlight"
    });
  }


  client.on("SID_AUTH_INFO",({logonType,serverToken,udpValue,mpqFiletime,mpqFilename,valuestring}) => {
    client.serverToken = serverToken;
    getMpq(host, port, mpqFiletime, mpqFilename, client.platformId, client.productId, writeAuthCheck);
  });



  client.on('SID_AUTH_CHECK',({result,additionalInformation}) => {
    if(0 === result) {
      console.log("Correct keys");
      client.write('SID_GETFILETIME',{
        requestId:2147483652,
        unknown:0,
        filename:"bnserver-D2DV.ini"
      });
    }
  });

  client.on('SID_GETFILETIME', () => {
    client.write('SID_LOGONRESPONSE2',{
      clientToken:client.clientToken,
      serverToken:client.serverToken,
      passwordHash: getHash(client.clientToken, client.serverToken, client.password),
      username:client.username
    });
  });


  client.on('SID_LOGONRESPONSE2',({status}) => {
    console.log(status === 0 ? "Success" : status === 1 ? "Account doesn't exist" : status === 2 ? "Invalid password" : "Account closed");
    if(status === 0) {
      client.write('SID_QUERYREALMS2',{});
    }
  });

  client.on('SID_QUERYREALMS2', ({realms}) => {
    client.write('SID_LOGONREALMEX', {
        clientToken: client.clientToken,
        hashedRealmPassword:getHash(client.clientToken, client.serverToken, client.password),
        realmTitle: realms[0].realmTitle
    });
  });

  client.on('SID_LOGONREALMEX', ({MCPCookie,MCPStatus,MCPChunk1,IP,port,MCPChunk2,battleNetUniqueName}) =>{
    host = IP[0]+"."+IP[1]+"."+IP[2]+"."+IP[3];
    const client3 = new Client3({host, port});



    client3.on('connect', () => {
      //'connect' listener
      console.log('connected to MCP server!');

      client3.socket.write(Buffer.from("01","hex")); // This Initialise conversation

      client3.write('MCP_STARTUP', {
        MCPCookie:MCPCookie,
        MCPStatus:MCPStatus,
        MCPChunk1:MCPChunk1,
        MCPChunk2:MCPChunk2,
        battleNetUniqueName:battleNetUniqueName
      });
    });

    client3.on('MCP_STARTUP', ({result}) => {
      if(result === 0x02 || (result>= 0x0A && result <= 0x0D)) {
        console.log("Realm Unavailable: No Battle.net connection detected.");
      }
      else if(result === 0x7E) {
        console.log("CDKey banned from realm play.");
      }
      else if(result === 0x7F) {
        console.log("Temporary IP ban \"Your connection has been temporarily restricted from this realm. Please try to log in at another time.\"");
      }
      else {
        console.log("Success!");
        client3.write('MCP_CHARLIST2', {
          numberOfCharacterToList: 8
        });
      }
    });


    client3.connect();
  });


  client.connect();

  return client;
}

module.exports = createClient;