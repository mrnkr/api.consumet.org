import { IAnimeInfo, IAnimeResult, ISearch, MediaFormat, MediaStatus, META } from "@consumet/extensions";

export class MyanimelistImpl extends META.Myanimelist {
  override fetchAnimeInfo = async (animeId: string): Promise<IAnimeInfo> => {
    const animeInfo = await this.fetchMalInfoById(animeId);

    if (this.provider) {
      const query = typeof animeInfo.title === 'string' ? animeInfo.title : animeInfo.title.english;

      if (query) {
        const providerSearchResults = await this.provider.search(query) as ISearch<IAnimeResult>;
        const firstCandidate = providerSearchResults.results[0];

        if (firstCandidate) {
          const providerAnimeInfo = await this.provider.fetchAnimeInfo(firstCandidate.id);
          return {
            ...providerAnimeInfo,
            title: animeInfo.title,
            id: animeId,
          };
        }
      }
    }

    return animeInfo;
  };

  fetchMalInfoById = async (id: string): Promise<IAnimeInfo> => {
    const animeInfo: IAnimeInfo = {
      id: id,
      title: '',
    };

    const params = new URLSearchParams({
      fields:
        'id,title,alternative_titles',
    });

    const { data } = await this.client.request({
      method: 'GET',
      url: `https://api.myanimelist.net/v2/anime/${id}?${params.toString()}`,
      headers: {
        'X-MAL-CLIENT-ID': process.env.MAL_CLIENT_ID,
      },
    });
    animeInfo.title = {
      english: data.alternative_titles.en ?? data.title,
      native: data.alternative_titles.ja,
    };

    return animeInfo;
  };

  private malStatusToMediaStatusOverride(status: string): MediaStatus {
    if (status == 'currently_airing') return MediaStatus.ONGOING;
    else if (status == 'finished_airing') return MediaStatus.COMPLETED;
    else if (status == 'not_yet_aired') return MediaStatus.NOT_YET_AIRED;
    return MediaStatus.UNKNOWN;
  }

  fetchUserAnimeList = async (username: string, status = 'watching'): Promise<IAnimeResult[]> => {
    const params = new URLSearchParams({
      limit: '75',
      offset: '0',
      fields:
        'id,title,main_picture,status,mean,num_episodes,media_type',
      nsfw: 'true',
      status: status,
    });

    const { data } = await this.client.request({
      method: 'get',
      url: `https://api.myanimelist.net/v2/users/${username}/animelist?${params.toString()}`,
      headers: {
        'X-MAL-CLIENT-ID': process.env.MAL_CLIENT_ID,
      },
    });

    return data.data.map(({ node }: any) => ({
      id: `${node.id}`,
      title: node.title,
      image: node.main_picture.large,
      rating: node.mean,
      totalEpisodes: node.num_episodes,
      status: this.malStatusToMediaStatusOverride(node.status),
      type: node.media_type === 'tv'
              ? MediaFormat.TV
              : node.media_type === 'movie'
              ? MediaFormat.MOVIE
              : node.media_type === 'special'
              ? MediaFormat.SPECIAL
              : node.media_type === 'ova'
              ? MediaFormat.OVA
              : node.media_type === 'ona'
              ? MediaFormat.ONA
              : node.media_type === 'music'
              ? MediaFormat.MUSIC
              : undefined,
    }));
  };
}
