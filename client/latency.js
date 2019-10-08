var fs = require("fs");
var path = require('path');
var client = require("socialmedia-client");

//Setup for SocialMedia, specify where to find keys, what key to use, channel, chaincode and peer/orderer addresses.
var keypath = path.join(__dirname, 'hfc-key-store');
client.ccInit('Peer2', keypath, 'mychannel', 'socialmedia', '114.local:7051', '113.local:7050');

//Initialize file store used for StoreDataFS and GetDataFS off-chain storage operators.
client.InitFileStore("ipfs://localhost:8080");

//Call the function to test sending 100 transactions
test();


//This function will send 100 transactions to SOcialMedia with 5s delay and record the response time of each
async function test(){
    var resultlist = [];

    //Do 100 transactions
    for (var i = 0; i < 100; i++){

    //Set some random data
    var requestarguments = ["2019-09-11 17:00:00","2019-09-11 18:00:00", "QmPcb8mG3uiyDNWEerA6QaH3Kp5op7dS5gRDbGHbfeN9Mm"]
    
    //Measure time at transaction sending
    var starttime = Date.now();

    //Send transaction
    client('http://localhost:3000/api/sensorData', requestarguments).then((r) => {

        //Push time for this transaction to resultlist and print
        var donetime = (Date.now() - starttime);
        resultlist.push(donetime);
        console.log(donetime)
    });

    //Wait 5 seconds between each transaction
    await sleep(5000)
    }

    //Write all transaction times in comma separated format for external handling.
    fs.writeFile(
        "writetimes"+".csv",
        JSON.stringify(resultlist),
        function (err) {
            if (err) {
                console.error('Something went wrong');
            }
        }
    );
}

//Subfunction used to await sleep in benchmarking function
function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}
