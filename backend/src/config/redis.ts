import { createClient, type RedisClientType } from 'redis';

let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;

const createRedisClient = (): RedisClientType => {
    const client = createClient({ url: process.env.REDIS_URL }) as RedisClientType;

    client.on('error', (err: Error) => {
        console.error('[Redis] Client error:', err.message);
    });

    client.on('reconnecting', () => {
        console.warn('[Redis] Reconnecting...');
    });

    return client;
};

export const getRedisClients = async (): Promise<{ pub: RedisClientType; sub: RedisClientType }> => {
    if (pubClient && subClient) {
        return { pub: pubClient, sub: subClient };
    }

    pubClient = createRedisClient();
    subClient = pubClient.duplicate() as RedisClientType;

    await Promise.all([pubClient.connect(), subClient.connect()]);
    console.log('[Redis] pub/sub clients connected');

    return { pub: pubClient, sub: subClient };
};
