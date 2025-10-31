// ELO Dataset Management for Project Selection
// Loads and provides access to the 98 Ethereum ecosystem projects with ELO rankings

export const ELO_PROJECTS = [
  { rank: 1, repo: 'ethereum/go-ethereum', weight: 0.0622666997104518 },
  { rank: 2, repo: 'argotorg/solidity', weight: 0.059769266333321344 },
  { rank: 3, repo: 'foundry-rs/foundry', weight: 0.04931431978108216 },
  { rank: 4, repo: 'OpenZeppelin/openzeppelin-contracts', weight: 0.04604140630227226 },
  { rank: 5, repo: 'ethereum/consensus-specs', weight: 0.04034184448586202 },
  { rank: 6, repo: 'OffchainLabs/prysm', weight: 0.03693938304518865 },
  { rank: 7, repo: 'ethereum/EIPs', weight: 0.03585050119534499 },
  { rank: 8, repo: 'ethers-io/ethers.js', weight: 0.033179961031917456 },
  { rank: 9, repo: 'NomicFoundation/hardhat', weight: 0.029462276708553767 },
  { rank: 10, repo: 'sigp/lighthouse', weight: 0.02826273187958575 },
  { rank: 11, repo: 'flashbots/mev-boost', weight: 0.022337684874276825 },
  { rank: 12, repo: 'erigontech/erigon', weight: 0.02228313762021105 },
  { rank: 13, repo: 'remix-project-org/remix-project', weight: 0.021203467677178543 },
  { rank: 14, repo: 'wighawag/hardhat-deploy', weight: 0.018526305464036885 },
  { rank: 15, repo: 'Consensys/teku', weight: 0.017239237887076313 },
  { rank: 16, repo: 'ethereum/execution-apis', weight: 0.017061545071005938 },
  { rank: 17, repo: 'supranational/blst', weight: 0.015868733846135054 },
  { rank: 18, repo: 'NethermindEth/nethermind', weight: 0.01584590983580907 },
  { rank: 19, repo: 'hyperledger/besu', weight: 0.014430770421906462 },
  { rank: 20, repo: 'status-im/nimbus-eth1', weight: 0.013965633515816146 },
  { rank: 21, repo: 'ChainSafe/lodestar', weight: 0.013337475654976764 },
  { rank: 22, repo: 'paradigmxyz/reth', weight: 0.012933093936970173 },
  { rank: 23, repo: 'scaffold-eth/scaffold-eth-2', weight: 0.012316973322833635 },
  { rank: 24, repo: 'web3/web3.js', weight: 0.012261674457329925 },
  { rank: 25, repo: 'a16z/helios', weight: 0.011713623455002644 },
  { rank: 26, repo: 'ledgerwatch/akula', weight: 0.011329774151301598 },
  { rank: 27, repo: 'ethereum/evmone', weight: 0.010852536335951473 },
  { rank: 28, repo: 'apeworx/ape', weight: 0.010834513515152616 },
  { rank: 29, repo: 'safe-global/safe-smart-account', weight: 0.010737774151301599 },
  { rank: 30, repo: 'Uniswap/interface', weight: 0.010605674457329925 },
  { rank: 31, repo: 'vyperlang/vyper', weight: 0.010401674457329927 },
  { rank: 32, repo: 'alloy-rs/alloy', weight: 0.009874536335951474 },
  { rank: 33, repo: 'trufflesuite/truffle', weight: 0.00941940143016119 },
  { rank: 34, repo: 'eth-infinitism/account-abstraction', weight: 0.00941940143016119 },
  { rank: 35, repo: 'wevm/viem', weight: 0.009244043862813695 },
  { rank: 36, repo: 'status-im/nimbus-eth2', weight: 0.009111774151301599 },
  { rank: 37, repo: 'dappnode/DAppNode', weight: 0.00887440143016119 },
  { rank: 38, repo: 'SatoshiAndKin/hardhat-forking', weight: 0.008637028709021476 },
  { rank: 39, repo: 'argotorg/fe', weight: 0.008589305464036885 },
  { rank: 40, repo: 'ethereum/web3.py', weight: 0.008541582219052294 },
  { rank: 41, repo: 'Nethereum/Nethereum', weight: 0.008218444097673841 },
  { rank: 42, repo: 'ensdomains/ens-contracts', weight: 0.007765305464036886 },
  { rank: 43, repo: 'lambdaclass/lambda_ethereum_consensus', weight: 0.007717582219052295 },
  { rank: 44, repo: 'Rari-Capital/vaults', weight: 0.007485013766007135 },
  { rank: 45, repo: 'gnosis/zodiac', weight: 0.0072370137660071365 },
  { rank: 46, repo: 'graphprotocol/graph-node', weight: 0.006989013766007137 },
  { rank: 47, repo: 'grandinetech/grandine', weight: 0.006741013766007138 },
  { rank: 48, repo: 'compound-finance/compound-protocol', weight: 0.006493013766007138 },
  { rank: 49, repo: 'blocknative/web3-onboard', weight: 0.006347700902512604 },
  { rank: 50, repo: 'getsentry/sentry-ethereum', weight: 0.006245013766007139 },
  { rank: 51, repo: 'argotorg/hevm', weight: 0.006099700902512605 },
  { rank: 52, repo: 'hyperledger-web3j/web3j', weight: 0.00599701376600714 },
  { rank: 53, repo: 'vyperlang/titanoboa', weight: 0.00589432663015948 },
  { rank: 54, repo: 'Consensys/gnark', weight: 0.00574901376600714 },
  { rank: 55, repo: 'immutable/contracts', weight: 0.005646326630159482 },
  { rank: 56, repo: 'OpenZeppelin/cairo-contracts', weight: 0.005501013766007141 },
  { rank: 57, repo: 'dethcrypto/TypeChain', weight: 0.005398326630159483 },
  { rank: 58, repo: 'WalletConnect/walletconnect-monorepo', weight: 0.005253013766007141 },
  { rank: 59, repo: 'DefiLlama/DefiLlama-Adapters', weight: 0.005150326630159483 },
  { rank: 60, repo: 'ethereum/py-evm', weight: 0.005005013766007142 },
  { rank: 61, repo: 'crytic/slither', weight: 0.004902326630159484 },
  { rank: 62, repo: 'ethereum/pyethapp', weight: 0.004757013766007142 },
  { rank: 63, repo: 'matter-labs/zksync-era', weight: 0.004654326630159485 },
  { rank: 64, repo: 'gitcoinco/grants-stack', weight: 0.004509013766007143 },
  { rank: 65, repo: 'argotorg/act', weight: 0.004406326630159485 },
  { rank: 66, repo: 'MetaMask/metamask-extension', weight: 0.004261013766007143 },
  { rank: 67, repo: 'AztecProtocol/aztec-packages', weight: 0.004158326630159486 },
  { rank: 68, repo: 'ethdebug/format', weight: 0.004013013766007144 },
  { rank: 69, repo: 'ProjectOpenSea/operator-filter-registry', weight: 0.003910326630159486 },
  { rank: 70, repo: 'farcasterxyz/hub-monorepo', weight: 0.0037650137660071447 },
  { rank: 71, repo: 'Geth-EIP/1559-testnet', weight: 0.0036623266301594868 },
  { rank: 72, repo: 'cowprotocol/contracts', weight: 0.003517013766007145 },
  { rank: 73, repo: 'ethereum-lists/chains', weight: 0.003414326630159487 },
  { rank: 74, repo: 'SolidityLang/solidity-compiler-js', weight: 0.0032690137660071454 },
  { rank: 75, repo: 'erigontech/silkworm', weight: 0.003166326630159488 },
  { rank: 76, repo: 'ethpandaops/ethereum-package', weight: 0.0030210137660071456 },
  { rank: 77, repo: 'keep-network/keep-core', weight: 0.002918326630159488 },
  { rank: 78, repo: 'argentlabs/argent-x', weight: 0.002773013766007146 },
  { rank: 79, repo: 'zkSync-Community-Hub/zksync-developers', weight: 0.002670326630159489 },
  { rank: 80, repo: 'ensdomains/ensjs-v2', weight: 0.0025250137660071465 },
  { rank: 81, repo: 'connext/monorepo', weight: 0.002422326630159489 },
  { rank: 82, repo: 'across-protocol/contracts', weight: 0.0022770137660071468 },
  { rank: 83, repo: 'ethpandaops/checkpointz', weight: 0.00217432663015949 },
  { rank: 84, repo: 'l2beat/l2beat', weight: 0.002029013766007147 },
  { rank: 85, repo: 'lidofinance/lido-dao', weight: 0.0019263266301594902 },
  { rank: 86, repo: 'base-org/chains', weight: 0.0017810137660071477 },
  { rank: 87, repo: 'RocketPoolProtocol/rocketpool', weight: 0.001678326630159491 },
  { rank: 88, repo: 'privacy-scaling-explorations/zkevm-circuits', weight: 0.0015330137660071478 },
  { rank: 89, repo: 'gitcoinco/grants-round', weight: 0.001430326630159491 },
  { rank: 90, repo: 'Synthetixio/synthetix', weight: 0.0012850137660071483 },
  { rank: 91, repo: 'Layr-Labs/eigenlayer-contracts', weight: 0.0011823266301594914 },
  { rank: 92, repo: 'statechannels/statechannels', weight: 0.0010370137660071486 },
  { rank: 93, repo: 'golemfoundation/yagna', weight: 0.0009343266301594917 },
  { rank: 94, repo: 'gitcoinco/passport', weight: 0.0007890137660071489 },
  { rank: 95, repo: 'ethereum-optimism/optimism', weight: 0.000686326630159492 },
  { rank: 96, repo: 'arbitrumfoundation/governance', weight: 0.0005410137660071492 },
  { rank: 97, repo: 'ethereum-push-notification-service/push-sdk', weight: 0.00043832663015949216 },
  { rank: 98, repo: 'kleros/kleros', weight: 0.00029301376600714936 }
];

// Get all projects as an array of repo names
export function getAllProjects() {
  return ELO_PROJECTS.map(p => p.repo);
}

// Get project by repo name
export function getProjectByRepo(repo) {
  return ELO_PROJECTS.find(p => p.repo === repo);
}

// Get projects sorted by weight (highest first)
export function getProjectsByWeight() {
  return [...ELO_PROJECTS].sort((a, b) => b.weight - a.weight);
}

// Get top N projects by weight
export function getTopProjects(n = 10) {
  return getProjectsByWeight().slice(0, n);
}

// Get bottom N projects by weight
export function getBottomProjects(n = 10) {
  return getProjectsByWeight().slice(-n).reverse();
}

// Get projects similar in weight to a given project
export function getSimilarProjects(repo, maxRatio = 2.0, count = 5) {
  const targetProject = getProjectByRepo(repo);
  if (!targetProject) return [];
  
  const targetWeight = targetProject.weight;
  
  return ELO_PROJECTS
    .filter(p => p.repo !== repo)
    .map(p => ({
      ...p,
      ratio: Math.max(p.weight / targetWeight, targetWeight / p.weight)
    }))
    .filter(p => p.ratio <= maxRatio)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, count);
}

// Get random project
export function getRandomProject() {
  const index = Math.floor(Math.random() * ELO_PROJECTS.length);
  return ELO_PROJECTS[index];
}

// Get random pair of projects for comparison
export function getRandomPair() {
  const shuffled = [...ELO_PROJECTS].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

// Get a diverse pair (different weight ranges) for comparison
export function getDiversePair() {
  const sorted = getProjectsByWeight();
  const topHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const bottomHalf = sorted.slice(Math.floor(sorted.length / 2));
  
  const project1 = topHalf[Math.floor(Math.random() * topHalf.length)];
  const project2 = bottomHalf[Math.floor(Math.random() * bottomHalf.length)];
  
  return [project1, project2];
}

// Calculate expected funding percentage for a project
export function getFundingPercentage(repo) {
  const project = getProjectByRepo(repo);
  if (!project) return 0;
  return (project.weight * 100).toFixed(2);
}

// Format repo name for display
export function formatRepoName(repo) {
  return repo.split('/')[1] || repo;
}

// Get project display name with org
export function getProjectDisplayName(repo) {
  return repo;
}