/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');
const path = require('path');

const ccpPath = path.resolve(__dirname, '..', '..', 'first-network', 'connection-org2.json');

async function main() {
    try {

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists('user2');
        if (userExists) {
            console.log('An identity for the user "user2" already exists in the wallet');
            return;
        }

        // Check to see if we've already enrolled the admin user.
        const adminExists = await wallet.exists('adminorg2');
        if (!adminExists) {
            console.log('An identity for the admin user "adminorg2" does not exist in the wallet');
            console.log('Run the enrollAdminorg2.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: 'adminorg2', discovery: { enabled: true, asLocalhost: true } });

        // Get the CA client object from the gateway for interacting with the CA.
        const ca = gateway.getClient().getCertificateAuthority();
        const adminIdentity = gateway.getCurrentIdentity();

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({ affiliation: 'org2.department1', enrollmentID: 'user2', role: 'client' }, adminIdentity);
        const enrollment = await ca.enroll({ enrollmentID: 'user2', enrollmentSecret: secret });
        const userIdentity = X509WalletMixin.createIdentity('Org2MSP', enrollment.certificate, enrollment.key.toBytes());
        await wallet.import('user2', userIdentity);
        console.log('Successfully registered and enrolled admin user "user2" and imported it into the wallet');

    } catch (error) {
        console.error(`Failed to register user "user2": ${error}`);
        process.exit(1);
    }
}

main();
