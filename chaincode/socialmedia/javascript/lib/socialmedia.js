/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class SocialMedia extends Contract {

    async initLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        console.info('============= END : Initialize Ledger ===========');
    }

    async createUser(ctx, userName, firstName,lastName) {
        console.log('============= START : Create User ===========');

        const info = {
            docType: 'info',
            userName: userName,
            firstName: firstName,
            lastName: lastName,
            data: [],
        };

        await ctx.stub.putState(userName, Buffer.from(JSON.stringify(info)));

        console.info('============= END : Create User ===========');

        return (Buffer.from (`${userName} successfully created.`).toString());
    }

    async queryUser(ctx, userName) {
        const userAsBytes = await ctx.stub.getState(userName);
        if (!userAsBytes || userAsBytes.length === 0) {
            throw new Error(`${userName} does not exist`);
        }
        console.log(userAsBytes.toString());
        return userAsBytes.toString();
    }

    async addFileLocation(ctx, key, ipfsHash) {
        console.log(`============= START : CREATE ${key} ===========`);

        await ctx.stub.putState(key, ipfsHash);
        return (Buffer.from (`record ${key} successfully inserted.`).toString());
    }

    async getFileLocation(ctx, key){
        console.log(`============= START : FETCH ${key} ===========`);
        const data = await ctx.stub.getState(key);
        if (!data || data.length === 0) {
            throw new Error(`${key} does not exist`);
        }
        return data.toString();
    }

    async addPrivateData(ctx,key, userName, location){

        const data = {
            docType: 'privateData',
            userName: userName,
            location: location
        };

        await ctx.stub.putPrivateData("privateCollection", key, Bufer.from(JSON.stringify(data)));

        return (Buffer.from (`private record ${key} successfully inserted.`).toString());
    }

    async addMetaData(ctx, userName, data) {
        const userAsBytes = await ctx.stub.getState(userName);
        if (!userAsBytes || userAsBytes.length === 0) {
            throw new Error(`${userName} does not exist`);
        }

        const userData  = JSON.parse(userAsBytes.toString('utf8'));
        userData.data.push(JSON.parse(data));

        await ctx.stub.putState(userName, Buffer.from(JSON.stringify(userData)));
        return (Buffer.from (`record ${userData} successfully inserted.`).toString());
    }

    async addPermission(ctx,userName, healthCareID){

        const key = userName + "_permissions"
        const permissionList = await  ctx.stub.getState(key);

        if (!permissionList || permissionList.length === 0) {
            const permissionArray = [];
            permissionArray.push(healthCareID);

            await ctx.stub.putState(key,Buffer.from(JSON.stringify(permissionArray)));

            return (Buffer.from (`enabled permission for ${healthCareID} in ${userName}.`).toString());
        }

        const permissionObject = JSON.parse(permissionList.toString());
        if(permissionObject.includes(healthCareID)){
            return (Buffer.from (`permission already exists for ${healthCareID} in ${userName}.`).toString());
        }else{
            permissionObject.push(hc);
        }

        await ctx.stub.putState(key, Buffer.from(JSON.stringify(permissionObject)));
        return (Buffer.from (`enabled permission for ${healthCareID} in ${userName}.`).toString());

    }

    async checkPermission(ctx, userName, healthCareID){
        const key = userName + "_permissions"
        const permissionList = await  ctx.stub.getState(key);

        if (!permissionList || permissionList.length === 0) {

            return (Buffer.from (`false`).toString());
        }

        const permissionObject = JSON.parse(permissionList.toString());

        if(permissionObject.includes(healthCareID)){
            return (Buffer.from (`true`).toString());
        }else{
            return (Buffer.from (`false`).toString());
        }
    }

    async getPrivateData(ctx,key){
        const data = await ctx.stub.getPrivateData("privateCollection",key);
        if (!data || data.length === 0) {
            throw new Error(`${key} does not exist`);
        }
        return data.toString();
    }

    async createHealthCare(ctx, userName, branch) {
        console.log('============= START : Create HealthCare ===========');

        const info = {
            docType: 'info',
            userName: userName,
            branch: branch,
        };

        await ctx.stub.putState(userName, Buffer.from(JSON.stringify(info)));
        console.info('============= END : Create HealthCare ===========');
        return (Buffer.from (`${userName} successfully created.`));
    }

    async getHealthCare(ctx, healthCare) {
        const healthCareData = await ctx.stub.getState(healthCare); // get the car from chaincode state
        if (!healthCareData || healthCareData.length === 0) {
            throw new Error(`${healthCare} does not exist`);
        }
        console.log(healthCareData.toString());
        return healthCareData.toString();
    }

    async queryAllUsers(ctx) {
        const startKey = '';
        const endKey = '';

        const iterator = await ctx.stub.getStateByRange(startKey, endKey);

        const allResults = [];
        while (true) {
            const res = await iterator.next();

            if (res.value && res.value.value.toString()) {
                console.log(res.value.value.toString('utf8'));

                const Key = res.value.key;
                let Record;
                try {
                    Record = JSON.parse(res.value.value.toString('utf8'));
                } catch (err) {
                    console.log(err);
                    Record = res.value.value.toString('utf8');
                }
                allResults.push({ Key, Record });
            }
            if (res.done) {
                console.log('end of data');
                await iterator.close();
                console.info(allResults);
                return JSON.stringify(allResults);
            }
        }
    }
}

module.exports = SocialMedia;
