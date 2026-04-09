import Fastify from 'fastify';
import { configRoutes } from './routes/configRoutes';
import { worldBookRoutes } from './routes/worldBookRoutes';
import { characterRoutes } from './routes/characterRoutes';

const fastify = Fastify({
  logger: false
});

export async function startServer() {
  try {
    await fastify.register(configRoutes);
    await fastify.register(worldBookRoutes);
    await fastify.register(characterRoutes);

    await fastify.listen({ port: 3000, host: '127.0.0.1' });
    console.log('Server running on http://127.0.0.1:3000');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

export { fastify };
