const path = require('path');
const dbConfig = require('./config/db-config.json');

module.exports = {
    contracts_directory: "./ethereum/contracts",
    migrations_directory: "./ethereum/migrations",
    contracts_build_directory: path.join(__dirname, "./ethereum/build/contracts"),
    test_directory: "./ethereum/test",
    networks: {
        development: {
            host: dbConfig.ganache.state === 'remote' ? dbConfig.remoteUrl : dbConfig.localUrl,
            port: dbConfig.ganache.port,
            network_id: dbConfig.ganache.networkId
        }
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 500
        }
    }
};
