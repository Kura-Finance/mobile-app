// Checks that the mobile app and the web client derive the same Safe address
// for the same owner key. Run it once per repo and compare the output.
//
// Usage: node scripts/safe-address-parity.cjs <repoDir> [baseRpcUrl]
//   node scripts/safe-address-parity.cjs . https://mainnet.base.org
//   node scripts/safe-address-parity.cjs ../WebClients https://mainnet.base.org
//
// With an RPC URL the real SafeProxyFactory bytecode is read from Base, so the
// printed Safe address is the real one. Without it a fixed stand-in is used and
// only equality between runs is meaningful.
// Runs the Safe address derivation with THAT repo's installed viem + permissionless,
// against a mocked Base RPC, for the BIP-39 reference key.
const { createRequire } = require('module');
const path = require('path');
const repo = path.resolve(process.argv[2]);
const req = createRequire(path.join(repo, 'package.json'));
const viem = req('viem');
const { privateKeyToAccount, mnemonicToAccount } = req('viem/accounts');
const { base } = req('viem/chains');
const { entryPoint07Address } = req('viem/account-abstraction');
const { toSafeSmartAccount } = req('permissionless/accounts');

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const hd = mnemonicToAccount(PHRASE);
const privKey = viem.bytesToHex(hd.getHdKey().privateKey);
const owner = privateKeyToAccount(privKey);

// Stand-in for SafeProxyFactory.proxyCreationCode(): the same bytes for every run.
const DUMMY_CREATION_CODE = '0x' + '60806040'.repeat(40);
const calls = [];
const rpc = async ({ method, params }) => {
  calls.push({ method, to: params?.[0]?.to, data: params?.[0]?.data?.slice(0, 10) });
  if (method === 'eth_chainId') return viem.numberToHex(base.id);
  if (method === 'eth_call' && params[0].data.startsWith('0x53e5d935')) {
    return viem.encodeAbiParameters([{ type: 'bytes' }], [DUMMY_CREATION_CODE]);
  }
  if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [owner.address];
  throw new Error('unexpected RPC ' + method + ' ' + JSON.stringify(params).slice(0, 120));
};
const RPC_URL = process.argv[3];
const publicClient = viem.createPublicClient({
  chain: base,
  transport: RPC_URL ? viem.http(RPC_URL) : viem.custom({ request: rpc }),
});
const entryPoint = { address: entryPoint07Address, version: '0.7' };

(async () => {
  const out = {};
  // mobile, on-device key:  owners:[privateKeyToAccount], no saltNonce
  out.mobileLocalKey = (await toSafeSmartAccount({ client: publicClient, owners: [owner], entryPoint, version: '1.4.1' })).address;
  // mobile, Privy provider: owners:[walletClient(json-rpc account)], no saltNonce
  const walletClient = viem.createWalletClient({ account: owner.address, chain: base, transport: viem.custom({ request: rpc }) });
  out.mobilePrivyProvider = (await toSafeSmartAccount({ client: publicClient, owners: [walletClient], entryPoint, version: '1.4.1' })).address;
  // web (personalSafe.ts): owners:[walletClient], saltNonce 0n
  out.webPersonalSafe = (await toSafeSmartAccount({ client: publicClient, owners: [walletClient], entryPoint, version: '1.4.1', saltNonce: 0n })).address;
  const factoryCalls = [...new Set(calls.filter((c) => c.method === 'eth_call').map((c) => c.to))];
  console.log(JSON.stringify({
    repo: path.basename(repo),
    permissionless: JSON.parse(require('fs').readFileSync(path.join(repo,'node_modules/permissionless/package.json'))).version,
    viem: JSON.parse(require('fs').readFileSync(path.join(repo,'node_modules/viem/package.json'))).version,
    rpc: RPC_URL ?? 'mock (address is NOT the real one)',
    ownerEoa: owner.address,
    proxyFactoryQueried: factoryCalls,
    ...out,
  }, null, 2));
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
