import { FastifyInstance } from 'fastify';
import { configService } from '../configService';

export async function configRoutes(fastify: FastifyInstance) {
  fastify.get('/api/config', async (request, reply) => {
    const config = await configService.readConfig();
    return config;
  });

  fastify.post('/api/config', async (request, reply) => {
    const config = request.body as any;
    const result = await configService.writeConfig(config);
    return result;
  });

  fastify.post('/api/config/validate', async (request, reply) => {
    const config = request.body as any;
    const result = await configService.validateConfig(config);
    return result;
  });
}
