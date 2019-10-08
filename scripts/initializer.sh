#!/bin/bash

echo
echo " ____    _____      _      ____    _____ "
echo "/ ___|  |_   _|    / \    |  _ \  |_   _|"
echo "\___ \    | |     / _ \   | |_) |   | |  "
echo " ___) |   | |    / ___ \  |  _ <    | |  "
echo "|____/    |_|   /_/   \_\ |_| \_\   |_|  "
echo
echo "Build your first network (BYFN) end-to-end test"
echo
CHANNEL_NAME="$1"
DELAY="$2"
LANGUAGE="$3"
TIMEOUT="$4"
VERBOSE="$5"
: ${CHANNEL_NAME:="mychannel"}
: ${DELAY:="3"}
: ${LANGUAGE:="node"}
: ${TIMEOUT:="1500"}
: ${VERBOSE:="false"}
LANGUAGE=`echo "$LANGUAGE" | tr [:upper:] [:lower:]`
COUNTER=1
MAX_RETRY=5
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/ptunstad.no/orderers/orderer.ptunstad.no/msp/tlscacerts/tlsca.ptunstad.no-cert.pem
PEER0_ORG1_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.ptunstad.no/peers/peer0.org1.ptunstad.no/tls/ca.crt

CC_SRC_PATH="github.com/hyperledger/fabric/core/chaincode/socialmedia/javascript/"

echo "Channel name : "$CHANNEL_NAME

#Custom config vars
#Prevents "Minimum memory limit allowed is 4MB" error on low RAM devices (like RasPi)
CORE_VM_DOCKER_HOSTCONFIG_MEMORY=536870912
# Sets the default images to use my build for the ARM architecture
CORE_CHAINCODE_BUILDER=ptunstad/fabric-ccenv:arm64-1.4.1
CORE_CHAINCODE_GOLANG=ptunstad/fabric-baseos:arm64-0.4.15
CORE_CHAINCODE_CAR=ptunstad/fabric-baseos:arm64-0.4.15

echo "Channel name : "$CHANNEL_NAME

# import utils
. scripts/utils.sh

createChannel() {
	setGlobals 0 1

	if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
                set -x
		peer channel create -o orderer.ptunstad.no:7050 -c $CHANNEL_NAME -f ./channel-artifacts/channel.tx >&log.txt
		res=$?
                set +x
	else
				set -x
		peer channel create -o orderer.ptunstad.no:7050 -c $CHANNEL_NAME -f ./channel-artifacts/channel.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA >&log.txt
		res=$?
				set +x
	fi

	cat log.txt
	verifyResult $res "Channel creation failed"
	echo "===================== Channel \"$CHANNEL_NAME\" is created successfully ===================== "
	echo
}

joinChannel () {
	for org in 1; do
	    for peer in 0 1 2 3; do
		joinChannelWithRetry $peer $org
		echo "===================== peer${peer}.org${org} joined on the channel \"$CHANNEL_NAME\" ===================== "
		sleep $DELAY
		echo
	    done
	done
}

chaincodeInvoke () {
	PEER=$1
	setGlobals $PEER
	# while 'peer chaincode' command can get the orderer endpoint from the peer (if join was successful),
	# lets supply it directly as we know it using the "-o" option
	if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
		peer chaincode invoke -o orderer.ptunstad.no:7050 -C $CHANNEL_NAME -n socialmedia -c '{"Args":["addMetaData","2019-09-11 17:00:00","2019-09-11 18:00:00","QmPcb8mG3uiyDNWEerA6QaH3Kp5op7dS5gRDbGHbfeN9Mm", "file:///home/ubuntu/datastore", "cfile"]}' >&log.txt
	else
		peer chaincode invoke -o orderer.ptunstad.no:7050 --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n socialmedia -c '{"Args":["addMetaData","2019-09-11 17:00:00","2019-09-11 18:00:00","QmPcb8mG3uiyDNWEerA6QaH3Kp5op7dS5gRDbGHbfeN9Mm"]}'
	fi
	res=$?
	cat log.txt
	verifyResult $res "Invoke2 execution on PEER$PEER failed "
	echo "===================== Invoke2 transaction on PEER$PEER on channel '$CHANNEL_NAME' is successful ===================== "
	echo
}

## Create channel
echo "Creating channel..."
createChannel

## Join all the peers to the channel
echo "Having all peers join the channel..."
joinChannel

## Set the anchor peers for each org in the channel
echo "Updating anchor peers for org1..."
sleep 10
updateAnchorPeers 0 1

## Install chaincode on Peer0/Org1 and Peer2/org1
echo "Installing chaincode on org1/peer0..."
sleep 10
installChaincode 0 1 1.2
echo "Install chaincode on org1/peer1..."
sleep 10
installChaincode 1 1 1.2
echo "Install chaincode on org1/peer2..."
sleep 10
installChaincode 2 1 1.2
echo "Install chaincode on org1/peer3..."
sleep 10
installChaincode 3 1 1.2
echo "Install chaincode on org1/peer4..."
sleep 10
installChaincode 4 1 1.2
echo "Install chaincode on org1/peer5..."
sleep 10
installChaincode 5 1 1.2
echo "Install chaincode on org1/peer6..."
sleep 10
installChaincode 6 1 1.2
echo "Install chaincode on org1/peer7..."
sleep 10
installChaincode 7 1 1.2
echo "Install chaincode on org2/peer0..."
sleep 10
installChaincode 0 2 1.2
echo "Install chaincode on org2/peer1..."
sleep 10
installChaincode 1 2 1.2


#Instantiate chaincode on Peer2/org1
echo "Instantiating chaincode on org1/peer2..."
sleep 10
instantiateChaincode 2 1 1.2

#Instantiate chaincode on Peer1/org2
echo "Instantiating chaincode on org2/peer1..."
sleep 10
instantiateChaincode 1 2 1.2

echo
echo "========= All GOOD, BYFN execution completed =========== "
echo

echo
echo " _____   _   _   ____   "
echo "| ____| | \ | | |  _ \  "
echo "|  _|   |  \| | | | | | "
echo "| |___  | |\  | | |_| | "
echo "|_____| |_| \_| |____/  "
echo

exit 0
