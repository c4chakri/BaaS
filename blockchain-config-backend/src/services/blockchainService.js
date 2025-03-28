
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const fileUtils = require("../utils/fileUtils");

exports.createBlockchain = async (data) => {
    const chainId = data.qbftConfig.genesis.config.chainId;
    const consensus = data.consensus;
    const network = data.network;
    const chainName = data.chainName;
    console.log("Chain ID:", chainId);
    console.log("Consensus:", consensus);
    console.log("Network:", network);
    console.log("Chain Name:", chainName);


    getAvailablePorts();
    const blockchainDir = path.join(__dirname, "../../blockchain_data", `${chainName}_${chainId}`);
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

                let rpcPort = {
                    rpcPort: BASE_RPC_PORT,
                    p2pPort: BASE_P2P_PORT,
                    metricsPort: BASE_METRICS_PORT

                };

                nodeAddresses.forEach((address, index) => {
                    const nodeDir = path.join(qbftNetworkDir, `Node-${index + 1}/data`);
                    fileUtils.createDirectory(nodeDir);
                    fileUtils.copyFile(path.join(networkFilesDir, address, "key"), path.join(nodeDir, "key"));
                    fileUtils.copyFile(path.join(networkFilesDir, address, "key.pub"), path.join(nodeDir, "key.pub"));
                    nodeConfigs.push({ name: `Node-${index + 1}`, address, rpcPort: rpcPort.rpcPort + index });
                });

                createDockerComposeFile(blockchainDir, data.chainName, nodeConfigs, "");
                console.log(`Docker Compose file created for ${data.chainName}`);

                exec(`docker-compose -f ${blockchainDir}/docker-compose.yml up -d besu-${data.chainName}-node1`, async (err) => {
                    if (err) return reject(new Error(`Docker error: ${err.message}`));

                    let attempts = 0;
                    const maxAttempts = 20;
                    const checkEnode = async () => {
                        try {
                            const enode = await getEnodeFromLogs(data.chainName, rpcPort.p2pPort);
                            if (enode) {
                                createDockerComposeFile(blockchainDir, data.chainName, nodeConfigs, enode);
                                exec(`docker-compose -f ${blockchainDir}/docker-compose.yml up -d`, (err) => {
                                    if (err) return reject(new Error(`Docker error: ${err.message}`));
                                    resolve({ message: "Blockchain created and running in Docker", chainName: data.chainName, networkRPC: `http://localhost:${rpcPort.rpcPort}`, chainId: chainId, consensus: consensus, network: network });
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



async function getEnodeFromLogs(chainName, p2pPort) {
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
                    resolve(`enode://${match[1]}@${nodeIp}:${p2pPort}`);
                } else {
                    resolve(null);
                }
            });
        });
    });
}


const createDockerComposeFile = async (blockchainDir, chainName, nodes, bootnode) => {
    const dockerCompose = { version: "3.8", services: {} };
    const ports = {
        rpcPort: BASE_RPC_PORT,
        p2pPort: BASE_P2P_PORT,
        metricsPort: BASE_METRICS_PORT,
    };
    console.log("ports", ports);

    for (let index = 0; index < nodes.length; index++) {
        const isBootnode = index === 0;

        const rpcPort = ports.rpcPort + index;
        const p2pPort = ports.p2pPort + index;
        const metricsPort = ports.metricsPort + index;

        // const rpcPort = nodes[index].rpcPort;
        // const p2pPort = BASE_P2P_PORT + index;
        // const metricsPort = BASE_METRICS_PORT + index;

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
let BASE_RPC_PORT = 9000;
let BASE_P2P_PORT = 30303;
let BASE_METRICS_PORT = 9545;

const getAvailablePorts = () => {
    // Find the first available RPC port
    let rpcPort = BASE_RPC_PORT;
    while (usedPorts.has(rpcPort)) {
        rpcPort += 4;
    }

    // Find the first available P2P port
    let p2pPort = BASE_P2P_PORT;
    while (usedPorts.has(p2pPort)) {
        p2pPort += 4;
    }

    // Find the first available Metrics port
    let metricsPort = BASE_METRICS_PORT;
    while (usedPorts.has(metricsPort)) {
        metricsPort += 4;
    }

    // Add all ports to the used ports set
    usedPorts.add(rpcPort);
    usedPorts.add(p2pPort);
    usedPorts.add(metricsPort);

    BASE_RPC_PORT = rpcPort;
    BASE_P2P_PORT = p2pPort;
    BASE_METRICS_PORT = metricsPort;

    console.log("rpcPort", BASE_RPC_PORT, "p2pPort", BASE_RPC_PORT, "metricsPort", BASE_RPC_PORT);

    // Return an object with all ports
    return {
        rpcPort,
        p2pPort,
        metricsPort
    };
};




