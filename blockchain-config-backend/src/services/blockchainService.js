
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const fileUtils = require("../utils/fileUtils");

exports.createBlockchain = async (data) => {
    const blockchainDir = path.join(__dirname, "../../blockchain_data", `${data.chainName}_${data.chainId}`);
    fileUtils.createDirectory(blockchainDir);
    
    const qbftConfigPath = path.join(blockchainDir, "QBFTConfig.json");
    fileUtils.writeFile(qbftConfigPath, JSON.stringify(data.qbftConfig, null, 4));
    
    const besuCommand = `besu operator generate-blockchain-config --config-file="${qbftConfigPath}" --to="${blockchainDir}/networkFiles" --private-key-file-name="key"`;
    
    return new Promise((resolve, reject) => {
        exec(besuCommand, async (error, stdout, stderr) => {
            if (error) return reject(new Error(`Besu error: ${error.message}`));
            if (stderr) console.warn(`Besu warning: ${stderr}`);
            
            try {
                const networkFilesDir = path.join(blockchainDir, "networkFiles/keys");
                const qbftNetworkDir = path.join(blockchainDir, "QBFT-Network");
                fileUtils.createDirectory(qbftNetworkDir);

                const genesisFilePath = path.join(blockchainDir, "networkFiles", "genesis.json");
                const qbftGenesisFilePath = path.join(qbftNetworkDir, "genesis.json");
                fileUtils.copyFile(genesisFilePath, qbftGenesisFilePath);

                const nodeAddresses = fs.readdirSync(networkFilesDir);
                let nodeConfigs = [];
                
                let rpcPort = getAvailablePortRange();
                
                nodeAddresses.forEach((address, index) => {
                    const nodeDir = path.join(qbftNetworkDir, `Node-${index + 1}/data`);
                    fileUtils.createDirectory(nodeDir);
                    fileUtils.copyFile(path.join(networkFilesDir, address, "key"), path.join(nodeDir, "key"));
                    fileUtils.copyFile(path.join(networkFilesDir, address, "key.pub"), path.join(nodeDir, "key.pub"));
                    nodeConfigs.push({ name: `Node-${index + 1}`, address, rpcPort: rpcPort + index });
                });

                createDockerComposeFile(blockchainDir, data.chainName, nodeConfigs, "");
                console.log(`Docker Compose file created for ${data.chainName}`);
                
                exec(`docker-compose -f ${blockchainDir}/docker-compose.yml up -d besu-${data.chainName}-node1`, async (err) => {
                    if (err) return reject(new Error(`Docker error: ${err.message}`));
                    
                    let attempts = 0;
                    const maxAttempts = 20;
                    const checkEnode = async () => {
                        try {
                            const enode = await getEnodeFromLogs(data.chainName);
                            if (enode) {
                                createDockerComposeFile(blockchainDir, data.chainName, nodeConfigs, enode);
                                exec(`docker-compose -f ${blockchainDir}/docker-compose.yml up -d`, (err) => {
                                    if (err) return reject(new Error(`Docker error: ${err.message}`));
                                    resolve({ message: "Blockchain created and running in Docker", networkRPC: `http://localhost:${rpcPort}` });
                                });
                            } else {
                                if (attempts < maxAttempts) {
                                    attempts++;
                                    setTimeout(checkEnode, 3000);
                                } else {
                                    reject(new Error("Failed to extract enode after multiple attempts."));
                                }
                            }
                        } catch (error) {
                            reject(error);
                        }
                    };
                    checkEnode();
                });
            } catch (copyError) {
                reject(new Error(`Error copying node keys: ${copyError.message}`));
            }
        });
    });
};



async function getEnodeFromLogs(chainName) {
    return new Promise((resolve, reject) => {
        // Get the internal Docker IP of besu-node1
        exec(`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' besu-${chainName}-node1`, (err, ip) => {
            if (err) {
                return reject(new Error(`Failed to fetch container IP: ${err.message}`));
            }

            const nodeIp = ip.trim();
            console.log("Node IP:", nodeIp);
            console.log(`Fetching logs from besu-${chainName}-node1...`);
            // Fetch logs from besu-node1
            exec(`docker logs besu-${chainName}-node1`, (err, stdout) => {
                if (err) {
                    return reject(new Error(`Failed to fetch logs: ${err.message}`));
                }

                // Extract enode from logs
                const match = stdout.match(/enode:\/\/(.*)@/);

                if (match && match[1]) {
                    resolve(`enode://${match[1]}@${nodeIp}:30303`);
                } else {
                    resolve(null);
                }
            });
        });
    });
}


const createDockerComposeFile = async (blockchainDir, chainName, nodes, bootnode) => {
    const dockerCompose = { version: "3.8", services: {} };
    
    for (let index = 0; index < nodes.length; index++) {
        const isBootnode = index === 0;
        const rpcPort = nodes[index].rpcPort;
        const p2pPort = BASE_P2P_PORT + index;
        const metricsPort = BASE_METRICS_PORT + index;
        
        dockerCompose.services[`besu-${chainName}-node${index + 1}`] = {
            image: "hyperledger/besu:latest",
            container_name: `besu-${chainName}-node${index + 1}`,
            volumes: [
                `./QBFT-Network/Node-${index + 1}/data:/besu/data`,
                `./QBFT-Network/genesis.json:/besu/genesis.json`
            ],
            command: [
                "--data-path=/besu/data",
                "--genesis-file=/besu/genesis.json",
                ...(isBootnode ? [] : [`--bootnodes=${bootnode}`]),
                `--p2p-port=${p2pPort}`,
                "--rpc-http-enabled",
                "--rpc-http-api=ETH,NET,QBFT,WEB3",
                "--host-allowlist=*",
                "--rpc-http-cors-origins=all",
                `--rpc-http-port=${rpcPort}`,
                "--rpc-ws-enabled",
                "--graphql-http-enabled",
                "--profile=ENTERPRISE",
                "--min-gas-price=1000",
                "--metrics-enabled",
                "--metrics-host=0.0.0.0",
                `--metrics-port=${metricsPort}`
            ],
            ports: [`${rpcPort}:${rpcPort}`, `${p2pPort}:${p2pPort}`],
            restart: "always"
        };
    }
    
    fs.writeFileSync(path.join(blockchainDir, "docker-compose.yml"), JSON.stringify(dockerCompose, null, 4));
};


const usedPorts = new Set();
const BASE_RPC_PORT = 9000;
const BASE_P2P_PORT = 30303;
const BASE_METRICS_PORT = 9545;

const getAvailablePortRange = () => {
    let rpcPort = BASE_RPC_PORT;
    while (usedPorts.has(rpcPort)) {
        rpcPort += 4; 
    }
    usedPorts.add(rpcPort);
    return rpcPort;
};


// const findAvailablePort = async (startPort) => {
//     let port = startPort;
//     while (!(await isPortAvailable(port))) {
//         port++;
//     }
//     return port;
// };


// const isPortAvailable = (port) => {
//     return new Promise((resolve) => {
//         const server = net.createServer();
//         server.once("error", () => resolve(false));
//         server.once("listening", () => {
//             server.close();
//             resolve(true);
//         });
//         server.listen(port);
//     });
// };
