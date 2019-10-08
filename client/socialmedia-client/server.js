'use strict';

// ExpressJS Setup
const express = require('express');
const app = express();
var bodyParser = require('body-parser');
// Constants
const PORT = 5000;
const HOST = 'localhost';


// Hyperledger Bridge
var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');
var fs = require('fs');
var moment = require('moment');
var rdfstore = require('rdfstore')
var SparqlParser = require('sparqljs').Parser;
const N3 = require('n3');
const rdf = require('rdf');
const rdfjs = rdf.factory;

const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;

const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');

const ccpPath = path.resolve(__dirname, '..', '..', 'first-network', 'connection-org1.json');
const ccpPath2 = path.resolve(__dirname, '..', '..', 'first-network', 'connection-org2.json');

var fabric_client = new Fabric_Client();

var ipfsClient = require('ipfs-http-client');
var ipfs = ipfsClient('localhost', '5001', { protocol: 'http' })

// setup the fabric network
var channel = fabric_client.newChannel('mychannel');
var peer = fabric_client.newPeer('grpc://localhost:7051');
channel.addPeer(peer);

// console.log(channel);    s
//
var member_user = null;
var store_path = path.join(os.homedir(), '.hfc-key-store');
console.log('Store path:'+store_path);
var tx_id = null;

var permissionList = {};
var userData = {};

var sensorData = {
    startTime: "",
    endTime: "",
    data: []
};

//Attach the middleware
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use( bodyParser.json() );

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/api/query', function (req, res) {
    // create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
    Fabric_Client.newDefaultKeyValueStore({ path: store_path
    }).then((state_store) => {
        // assign the store to the fabric client
        fabric_client.setStateStore(state_store);
        var crypto_suite = Fabric_Client.newCryptoSuite();
        // use the same location for the state store (where the users' certificate are kept)
        // and the crypto store (where the users' keys are kept)
        var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        // get the enrolled user from persistence, this user will sign all requests
        return fabric_client.getUserContext('user1', true);
    }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded user1 from persistence');
            member_user = user_from_store;
        } else {
            throw new Error('Failed to get user1.... run registerUser.js');
        }

        // queryCar chaincode function - requires 1 argument, ex: args: ['CAR4'],
        // queryAllCars chaincode function - requires no arguments , ex: args: [''],
        const request = {
            //targets : --- letting this default to the peers assigned to the channel
            chaincodeId: 'fabcar',
            fcn: 'queryAllCars',
            args: ['']
        };
        // send the query proposal to the peer
        return channel.queryByChaincode(request);
    }).then((query_responses) => {
        console.log("Query has completed, checking results");
        console.log(query_responses);
        // query_responses could have more than one  results if there multiple peers were used as targets
        if (query_responses && query_responses.length == 1) {
            if (query_responses[0] instanceof Error) {
                console.error("error from query = ", query_responses[0]);
            } else {
                console.log("Response is ", query_responses[0].toString());
            }
        } else {
            console.log("No payloads were returned from query");
        }
        res.status(200).json({response: query_responses[0].toString()});
    }).catch(function(err) {
        res.status(500).json({error: err.toString()})
    })
});

app.post('/api/createUser', function (req, res) {
    const userName = req.body.userName;
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);

    // Check to see if we've already enrolled the user.
    wallet.exists(userName).then((userExists)=>{
        if (userExists) {
            console.log(wallet);
            console.log('An identity for the user '+userName+' already exists in the wallet');
            return;
        }

        return wallet.exists('adminorg1');
    }).then(async (adminExists) => {
        if (!adminExists) {
            console.log('An identity for the admin user "adminorg1" does not exist in the wallet');
            console.log('Run the enrollAdmin.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, {wallet, identity: 'adminorg1', discovery: {enabled: false}});

        // Get the CA client object from the gateway for interacting with the CA.
        const ca = gateway.getClient().getCertificateAuthority();
        const adminIdentity = gateway.getCurrentIdentity();

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: userName, role: 'client' }, adminIdentity);
        const enrollment = await ca.enroll({ enrollmentID: userName, enrollmentSecret: secret });
        const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
        await wallet.import(userName, userIdentity);

        const newUserGateway = new Gateway();
        // console.log("newGatewayMain",newUserGateway);
        await newUserGateway.connect(ccpPath, { wallet, identity: userName  , discovery: { enabled: true, asLocalhost: true } });

        // console.log("newGateway",newUserGateway);
        // Get the network (channel) our contract is deployed to.
        const network = await newUserGateway.getNetwork('mychannel');

        // console.log("network",network);
        // Get the contract from the network.
        const contract = network.getContract('fabcar');

        // console.log("network",contract);

        await contract.submitTransaction('createUser', userName, firstName, lastName);
        console.log('Transaction has been submitted');

        // Disconnect from the gateway.
        await newUserGateway.disconnect();

        console.log('Successfully registered and enrolled admin user '+userName+' and imported it into the wallet');

        res.status(200).send('Successfully registered and enrolled admin user '+userName+' and imported it into the wallet');
    }).catch((error) =>{
        res.status(500).send(error);
    });
});

app.post('/api/createHealthCare', function (req, res) {
    const userName = req.body.userName;
    const branch = req.body.branch;

    console.log("userName :", userName);
    console.log("branch :", branch);

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);

    // Check to see if we've already enrolled the user.
    wallet.exists(userName).then((userExists)=>{
        if (userExists) {
            console.log(wallet);
            console.log('An identity for the user '+userName+' already exists in the wallet');
        }

        return wallet.exists('adminorg2');
    }).then(async (adminExists) => {
        if (!adminExists) {
            console.log('An identity for the admin user "adminorg2" does not exist in the wallet');
            console.log('Run the enrollAdmin.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath2, {wallet, identity: 'adminorg2', discovery: {enabled: false}});

        // Get the CA client object from the gateway for interacting with the CA.
        const ca = gateway.getClient().getCertificateAuthority();
        const adminIdentity = gateway.getCurrentIdentity();

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({ affiliation: 'org2.department1', enrollmentID: userName, role: 'client' }, adminIdentity);
        const enrollment = await ca.enroll({ enrollmentID: userName, enrollmentSecret: secret });
        const userIdentity = X509WalletMixin.createIdentity('Org2MSP', enrollment.certificate, enrollment.key.toBytes());
        await wallet.import(userName, userIdentity);

        const newUserGateway = new Gateway();
        await newUserGateway.connect(ccpPath2, { wallet, identity: userName  , discovery: { enabled: true, asLocalhost: true } });
        const network = await newUserGateway.getNetwork('mychannel');
        const contract = network.getContract('fabcar');

        await contract.submitTransaction('createHealthCare', userName, branch);
        console.log('Transaction has been submitted');

        await newUserGateway.disconnect();

        console.log('Successfully registered and enrolled health care for '+userName+' and imported it into the wallet');

        res.status(200).send('Successfully registered and enrolled health care for '+userName+' and imported it into the wallet');
    }).catch((error) =>{
        res.status(500).send(error);
    });
});


app.post('/api/:user/addData', async  function (req,res) {
    try{
        const userName = req.params.user;
        const key = req.body.key;
        const type = req.body.type;
        const hash = req.body.hash;

        if (userData.hasOwnProperty(key)) {
            res.status(200).send("Data already exists");
        } else {
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);

            const gateway = new Gateway();
            await gateway.connect(ccpPath, {
                wallet,
                identity: userName,
                discovery: {enabled: true, asLocalhost: true}
            });

            const network = await gateway.getNetwork('mychannel');
            const contract = network.getContract('fabcar');

            const result = await contract.submitTransaction('addFileLocation', key, hash);
            userData[key] = type;
            console.log(userData);

            res.status(200).send(result);
        }
    }catch (e) {
        res.status(400).send("something wrong");
    }
});

app.get('/api/:hc/getData', async  function (req,res) {
    try{
        const healthCareID = req.params.hc;
        const key = req.query.key;
        const dataOwner = req.query.user;

        if(permissionList[dataOwner] !== undefined) {
            if (permissionList[dataOwner].includes(healthCareID)) {
                if (userData.hasOwnProperty(key)) {
                    const walletPath = path.join(process.cwd(), 'wallet');
                    const wallet = new FileSystemWallet(walletPath);

                    const gateway = new Gateway();
                    await gateway.connect(ccpPath2, {
                        wallet,
                        identity: healthCareID,
                        discovery: {enabled: true, asLocalhost: true}
                    });

                    const network = await gateway.getNetwork('mychannel');
                    const contract = network.getContract('fabcar');

                    const result = await contract.evaluateTransaction('getFileLocation', key);

                    const data = result.toString();
                    const ipfsHash = "/ipfs/" + data;
                    ipfs.cat(ipfsHash, function (err, file) {
                        if (err) {
                            throw err
                        }
                        res.status(200).send(file.toString('utf8'));
                    });
                } else {
                    res.status(400).send("data not available");
                }
            }
            else{
                res.status(400).send(`${healthCareID} does not have permissions to access ${dataOwner} data.`);
            }
        }else{
            res.status(400).send(`Please add permissions to ${dataOwner}`);
        }
    }catch (e) {
        res.status(400).send("something wrong");
    }
});

app.get('/api/getAllUsers', async function (req, res) {

    try {

        // const user = req.params.user;
        // console.log("User ", user);
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: 'adminorg1', discovery: {  enabled: true, asLocalhost: true } });
        // await gateway.connect(ccpPath2, { wallet, identity: 'HC1', discovery: { enabled: true, asLocalhost: true } });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('fabcar');

        const result = await contract.evaluateTransaction('queryAllUsers');

        console.log(JSON.parse(result.toString()));
        const finalresult = JSON.parse(JSON.parse(result.toString()));
        res.status(200).send(finalresult);

        console.log('Transaction has been evaluated, result is: ', finalresult);

    }catch (e) {
        console.log("Within catch",e);
    }
});

app.post('/api/:user/getUser', async function (req, res) {

    try {

        const user = req.params.user;
        const queryUser = req.body.user;
        console.log("User ", user);
        console.log("queryUser ", queryUser);

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccpPath2, { wallet, identity: user, discovery: {  enabled: true, asLocalhost: true } });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('fabcar');

        const result = await contract.evaluateTransaction('queryUser',queryUser);

        console.log(`Transaction has been evaluated, result is: ${result.toString()}`);

        res.status(200).send(result);

    }catch (e) {
        console.log("Within catch",e);
    }
});

app.post('/api/:user/permissionAccess', async function (req, res) {

    const userName = req.params.user;
    const hc = req.body.healthcare;

    if(permissionList[userName] !== undefined){
        if(permissionList[userName].includes(hc)){
            res.status(200).send("HC already exists");
        }else{
            permissionList[userName].push(hc);
        }
    }else{
        const list = [];
        list.push(hc);
        permissionList[userName] = list;
    }

    res.status(200).send(permissionList);

});

app.post('/api/query', async function (req, res) {

    const query = req.body.query;
    try {
        rdfstore.create(async function(err,store){
            const ipfsHash = "/ipfs/QmSoncXycXwir1CaUm6oVvUwptCPvvbPXaD8y241TgUt69";
            const triples = await ipfs.cat(ipfsHash);

            var data = triples.toString();
            store.load("text/n3",data, function(err,result){
                if(err)
                    console.log(err);

                store.execute('PREFIX sosa: <http://www.w3.org/ns/sosa/> ' +
                    'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
                    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> ' +
                    'PREFIX xml: <http://www.w3.org/XML/1998/namespace> ' +
                    'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> ' +
                    'SELECT ?s ?o' +
                    'WHERE { ?s sosa:hasFeatureOfInterest ?o}', function(error, results){
                    if(error)
                        console.log(error);

                    console.log(results);
                });
            });
        });
    }catch (e){
        console.log(e);
        res.status(400).send("something wrong");
    }


    var parser = new SparqlParser();
    var parsedQuery = parser.parse(
        'PREFIX sosa: <http://www.w3.org/ns/sosa/#> ' +
        'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ' +
        'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> ' +
        'PREFIX xml: <http://www.w3.org/XML/1998/namespace> ' +
        'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> ' +
        'SELECT ?sensor ?platform ' +
        'WHERE { ?sensor sosa:isHostedby ?platform . FILTER ( ?date >= "19450101"^^xsd:date && ?date <= "19451231"^^xsd:date )}');


    res.status(200).send(parsedQuery);

});

async function getDataFromChain(key, healthCareID){

    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);

    const gateway = new Gateway();
    await gateway.connect(ccpPath2, {
        wallet,
        identity: healthCareID,
        discovery: {enabled: true, asLocalhost: true}
    });

    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('fabcar');

    const result = await contract.evaluateTransaction('getFileLocation', key);

    return result.toString();
}

function insertPermission(user, hc){
    const obj = permissionList.filter(x=>!!x[user])[0];
    console.log(obj);
    obj ? obj[user].push(hc) : permissionList.push({user: [hc] });
}

async function raw2rdfmapping(sensorData) {

    const PREFIX = "http://ods.tu-berlin.de/thesis/ankita";
    const writer = new N3.Writer({ format:'ttl' });

    sensorData['data'].forEach(function (item) {
        writer.addQuad(
            N3.DataFactory.namedNode(PREFIX+'/observation/' + item.id + '/HeartRate/'),
            N3.DataFactory.namedNode('http://www.w3.org/ns/sosa/madebySensor'),
            N3.DataFactory.namedNode(PREFIX + '/sensor/' + item.sensor_id + '/'+item.type+ '/'),
        );
        writer.addQuad(
            N3.DataFactory.namedNode(PREFIX+'/observation/' + item.id + '/HeartRate/'),
            N3.DataFactory.namedNode('http://www.w3.org/ns/sosa/resultTime'),
            rdfjs.literal(item.timestamp, rdf.xsdns('datetime'))
        );
        writer.addQuad(
            N3.DataFactory.namedNode(PREFIX+'/observation/' + item.id + '/HeartRate/'),
            N3.DataFactory.namedNode('http://www.w3.org/ns/sosa/hasSimpleResult'),
            N3.DataFactory.literal(item.heartRate),
        );

        writer.addQuad(
            N3.DataFactory.namedNode(PREFIX + '/sensor/' + item.sensor_id + '/'+item.type+ '/'),
            N3.DataFactory.namedNode('http://www.w3.org/ns/sosa/isHostedBy'),
            N3.DataFactory.namedNode(PREFIX + '/platform/'+ item.user + "/" + item.type + "/"),
        );

        writer.addQuad(
            N3.DataFactory.namedNode(PREFIX + '/platform/'+ item.user + "/" + item.type + "/"),
            N3.DataFactory.namedNode('http://www.w3.org/ns/sosa/hosts'),
            N3.DataFactory.namedNode(PREFIX + '/sensor/' + item.sensor_id + '/'+item.type+ '/'),
        );

        writer.addQuad(
            N3.DataFactory.namedNode(PREFIX + '/platform/'+ item.user + "/" + item.type + "/"),
            N3.DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            N3.DataFactory.namedNode('http://www.w3.org/ns/sosa/platform'),
        );
    });

    try {
        writer.end(async (error, result) => {
            let ipfsData = await ipfs.add(new Buffer(result));
            let metaData = {
                "start": sensorData.startTime,
                "end": sensorData.endTime,
                "hash": ipfsData[0].hash
            };

            console.log(metaData);
            const userName = "anki2";
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);

            const gateway = new Gateway();
            await gateway.connect(ccpPath, {
                wallet,
                identity: userName,
                discovery: {enabled: true, asLocalhost: true}
            });

            const network = await gateway.getNetwork('mychannel');
            const contract = network.getContract('fabcar');

            const chainData = await contract.submitTransaction('addMetaData', "anki2", JSON.stringify(metaData));
        });
    }catch (e) {
        console.log(e);
    }
}

app.post('/api/sensorData', async function (req, res) {

    const data = req.body;
    const type = data.type;
    const timestamp = moment(data.timestamp);
    const user = data.user;

    if(sensorData.startTime){
        const metaStart = moment(sensorData.startTime);
        if(sensorData.startTime.diff(timestamp,'minutes')){
            sensorData.endTime = timestamp;
            sensorData['data'].push(data);
            raw2rdfmapping(sensorData);
            sensorData = {
                startTime: "",
                endTime: "",
                data: []
            };
        }else{
            sensorData.data.push(data);
        }
    }else{
        sensorData.startTime = timestamp;
        sensorData.data.push(data);
    }

    res.status(200).send(data);

});

app.listen(PORT, HOST);


console.log(`Running on http://${HOST}:${PORT}`);
