/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { FileSystemWallet, Gateway } = require('fabric-network');
const path = require('path');
var Fabric_Client = require('fabric-client');
var util = require('util');
var os = require('os');
var fs = require('fs');

const ccpPath = path.resolve(__dirname, '..', '..', 'first-network', 'connection-org1.json');
const ccpPath2 = path.resolve(__dirname, '..', '..', 'first-network', 'connection-org2.json');
var fabric_client = new Fabric_Client();

async function main() {
    try {

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        // const userExists = await wallet.exists('anki1');
        // if (!userExists) {
        //     console.log('An identity for the user "HC2" does not exist in the wallet');
        //     console.log('Run the registerUser.js application before retrying');
        //     return;
        // }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: 'adminorg1', discovery: {  enabled: true, asLocalhost: true } });
        // await gateway.connect(ccpPath2, { wallet, identity: 'HC2', discovery: { enabled: true, asLocalhost: true } });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork('mychannel');

        // Get the contract from the network.
        const contract = network.getContract('fabcar');

        // Evaluate the specified transaction.
        // queryCar transaction - requires 1 argument, ex: ('queryCar', 'CAR4')
        // queryAllCars transaction - requires no arguments, ex: ('queryAllCars')
        const result = await contract.evaluateTransaction('queryAllUsers');
        console.log(`Transaction has been evaluated, result is: ${result.toString()}`);

    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        process.exit(1);
    }
}

main();
