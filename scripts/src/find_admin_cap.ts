
import arenaJson from "../../arena.json" with { type: "json" };

const ARENA_ID = "0xd7dd51e3c156a0c0152cad6bc94884db5302979e78f04d631a51ab107f9449e6";

async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

(async () => {
    console.log(`Scanning Arena: ${ARENA_ID}`);
    
    // 2. Get owned objects
    const owned = await rpc('suix_getOwnedObjects', [ARENA_ID]);
    console.log(`Found ${owned.data.length} owned objects.`);

    const ADMIN_CAP_ID = "0x08a31c97a7b533bd4e3cbdeeee0c7ab46ab3f26297aaf22a00db014d1ec4acb0";
    const adminObj = await rpc('sui_getObject', [ADMIN_CAP_ID, { showOwner: true, showType: true }]);
    console.log(`AdminCap ${ADMIN_CAP_ID} Owner: ${JSON.stringify(adminObj.data.owner)}`);
    console.log(`AdminCap ${ADMIN_CAP_ID} Type: ${adminObj.data.type}`);

})();
