
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const fileUtils = require("../utils/fileUtils");

exports.createBlockchain = async (data) => {
    const blockchainDir = path.join(__dirname, "../../blockchain_data", `${data.chainName}_${data.chainId}`);
    fileUtils.createDirectory(blockchainDir);

    // Save Config Files
    const qbftConfigPath = path.join(blockchainDir, "QBFTConfig.json");
    fileUtils.writeFile(qbftConfigPath, JSON.stringify(data.qbftConfig, null, 4));

    // Generate Blockchain Config
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

                nodeAddresses.forEach((address, index) => {
                    const nodeDir = path.join(qbftNetworkDir, `Node-${index + 1}/data`);
                    fileUtils.createDirectory(nodeDir);
                    fileUtils.copyFile(path.join(networkFilesDir, address, "key"), path.join(nodeDir, "key"));
                    fileUtils.copyFile(path.join(networkFilesDir, address, "key.pub"), path.join(nodeDir, "key.pub"));
                    nodeConfigs.push({ name: `Node-${index + 1}`, address: address });
                });
                await createDockerfile(blockchainDir);
                // Start Node-1 in Docker
                createDockerComposeFile(blockchainDir, nodeConfigs, "");
                exec(`docker-compose -f ${blockchainDir}/docker-compose.yml up -d node1`, async (err) => {
                    if (err) return reject(new Error(`Docker error: ${err.message}`));

                    console.log("Waiting for Node-1 to start...");

                    let attempts = 0;
                    const maxAttempts = 20;  // Retry up to 60 seconds (3 sec x 20)

                    const checkEnode = async () => {
                        try {
                            const enode = await getEnodeFromLogs();
                            if (enode) {
                                console.log("Extracted Enode:", enode);
                                createDockerComposeFile(blockchainDir, nodeConfigs, enode);

                                exec(`docker-compose -f ${blockchainDir}/docker-compose.yml up -d`, (err) => {
                                    if (err) return reject(new Error(`Docker error: ${err.message}`));
                                    resolve({ message: "Blockchain created and running in Docker", directory: blockchainDir });
                                });
                            } else {
                                if (attempts < maxAttempts) {
                                    attempts++;
                                    console.log(`Enode not found, retrying in 3 seconds... (${attempts}/${maxAttempts})`);
                                    setTimeout(checkEnode, 3000);  // Retry every 3 sec
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


async function getEnodeFromLogs() {
    return new Promise((resolve, reject) => {
        // Get the internal Docker IP of besu-node1
        exec("docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' besu-node1", (err, ip) => {
            if (err) {
                return reject(new Error(`Failed to fetch container IP: ${err.message}`));
            }

            const nodeIp = ip.trim();
            console.log("Node IP:", nodeIp);

            // Fetch logs from besu-node1
            exec("docker logs besu-node1", (err, stdout) => {
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


const net = require("net");
const createDockerComposeFile = async (blockchainDir, nodes, bootnode) => {
    const dockerCompose = {
        version: "3.8",
        services: {}
    };

    const BASE_RPC_PORT = 9000;
    const BASE_P2P_PORT = 30303;
    const BASE_METRICS_PORT = 9545;

    for (let index = 0; index < nodes.length; index++) {
        const isBootnode = index === 0;
        
        let rpcPort = BASE_RPC_PORT + index;
        let p2pPort = BASE_P2P_PORT + index;
        let metricsPort = BASE_METRICS_PORT + index;

        dockerCompose.services[`node${index + 1}`] = {
            image: "hyperledger/besu:latest",
            container_name: `besu-node${index + 1}`,
            volumes: [
                `./QBFT-Network/Node-${index + 1}/data:/besu/data`,
                `./QBFT-Network/genesis.json:/besu/genesis.json`
            ],
            command: [
                "--data-path=/besu/data",
                "--genesis-file=/besu/genesis.json",
                ...(isBootnode
                    ? []
                    : [`--bootnodes=${bootnode}`]),
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
            ports: [
                `${rpcPort}:${rpcPort}`,
                `${p2pPort}:${p2pPort}`
            ],
            restart: "always"
        };
    }
    

    fs.writeFileSync(path.join(blockchainDir, "docker-compose.yml"), JSON.stringify(dockerCompose, null, 4));
};

const createDockerfile = async (blockchainDir) => {
    const dockerfileContent = `
    FROM hyperledger/besu:latest
    
    WORKDIR /besu
    
    COPY QBFT-Network /besu/QBFT-Network
    
    EXPOSE 30303 30304 30305 30306 9000 9001 9002 9003 9545 9546 9547 9548
    
    ENTRYPOINT ["besu"]
    `;
    
    fs.writeFileSync(path.join(blockchainDir, "Dockerfile"), dockerfileContent);
};

const findAvailablePort = async (startPort) => {
    let port = startPort;
    while (!(await isPortAvailable(port))) {
        port++;
    }
    return port;
};


const isPortAvailable = (port) => {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
};
