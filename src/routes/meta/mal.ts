import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import { PROVIDERS_LIST } from '@consumet/extensions';
import { MyanimelistImpl } from '../../providers/meta/mal';

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  let mal = new MyanimelistImpl();

  fastify.get('/', (_, rp) => {
    rp.status(200).send({
      intro:
        "Welcome to the mal provider: check out the provider's website @ https://mal.co/",
      routes: ['/animelist/:username', '/:query', '/info/:id', '/watch/:episodeId'],
      documentation: 'https://docs.consumet.org/#tag/mal',
    });
  });

  fastify.get('/animelist/:username', async (request: FastifyRequest, reply: FastifyReply) => {
    const username = (request.params as { username: string }).username;

    const status = (request.query as { status: string }).status;

    const res = await mal.fetchUserAnimeList(username, status);

    reply.status(200).send(res);
  });

  fastify.get('/:query', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.params as { query: string }).query;

    const page = (request.query as { page: number }).page;
    const perPage = (request.query as { perPage: number }).perPage;

    const res = await mal.search(query, page);

    reply.status(200).send(res);
  });

  // mal info with episodes
  fastify.get('/info/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as { id: string }).id;

    const provider = (request.query as { provider?: string }).provider;
    let fetchFiller = (request.query as { fetchFiller?: string | boolean }).fetchFiller;
    let isDub = (request.query as { dub?: string | boolean }).dub;
    const locale = (request.query as { locale?: string }).locale;

    if (typeof provider !== 'undefined') {
      const possibleProvider = PROVIDERS_LIST.ANIME.find(
        (p) => p.name.toLowerCase() === provider.toLocaleLowerCase(),
      );

      mal = new MyanimelistImpl(possibleProvider);
    }

    if (isDub === 'true' || isDub === '1') isDub = true;
    else isDub = false;

    if (fetchFiller === 'true' || fetchFiller === '1') fetchFiller = true;
    else fetchFiller = false;

    try {
      const res = await mal.fetchAnimeInfo(id);

      mal = new MyanimelistImpl(undefined);
      reply.status(200).send(res);
    } catch (err: any) {
      reply.status(500).send({ message: err.message });
    }
  });

  fastify.get(
    '/watch/:episodeId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const episodeId = (request.params as { episodeId: string }).episodeId;
      const provider = (request.query as { provider?: string }).provider;

      if (typeof provider !== 'undefined') {
        const possibleProvider = PROVIDERS_LIST.ANIME.find(
          (p) => p.name.toLowerCase() === provider.toLocaleLowerCase(),
        );

        mal = new MyanimelistImpl(possibleProvider);
      }
      try {
        const res = await mal
          .fetchEpisodeSources(episodeId)
          .catch((err) => reply.status(404).send({ message: err }));

        mal = new MyanimelistImpl(undefined);
        reply.status(200).send(res);
      } catch (err) {
        reply
          .status(500)
          .send({ message: 'Something went wrong. Contact developer for help.' });
      }
    },
  );
};

export default routes;
