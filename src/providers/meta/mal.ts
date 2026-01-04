import { IAnimeEpisode, IAnimeInfo, IAnimeResult, ISearch, MediaFormat, MediaStatus, META } from "@consumet/extensions";
import { load } from "cheerio";
import { substringAfter, substringBefore } from "../../utils/utils";

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
          animeInfo.episodes = providerAnimeInfo.episodes;
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

    const { data } = await this.client.request({
      method: 'GET',
      url: `https://myanimelist.net/anime/${id}`,
      headers: {
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.35',
      },
    });

    const $ = load(data);
    const desc = $('[itemprop="description"]').first().text();
    const imageElem = $('[itemprop="image"]').first();
    const image = imageElem.attr('src') || imageElem.attr('data-image') || imageElem.attr('data-src');
    const genres: string[] = [];
    const genreDOM = $('[itemprop="genre"]').get();

    genreDOM.forEach(elem => genres.push($(elem).text()));

    animeInfo.genres = genres;
    animeInfo.image = image;
    animeInfo.description = desc;
    animeInfo.title = {
      english: $('.js-alternative-titles.hide').children().eq(0).text().replace('English: ', '').trim(),
      romaji: $('.title-name').text(),
      native: $('.js-alternative-titles.hide').parent().children().eq(9).text().trim(),
      userPreferred: $('.js-alternative-titles.hide').children().eq(0).text().replace('English: ', '').trim(),
    };

    animeInfo.synonyms = $('.js-alternative-titles.hide')
      .parent()
      .children()
      .eq(8)
      .text()
      .replace('Synonyms:', '')
      .trim()
      .split(',');
    animeInfo.studios = [];
    animeInfo.popularity = parseInt(
      $('.numbers.popularity').text().trim().replace('Popularity #', '').trim()
    );

    const producers: string[] = [];
    $('a').each(function (i: number, link: any) {
      if (
        $(link).attr('href')?.includes('producer') &&
        $(link).parent().children().eq(0).text() == 'Producers:'
      ) {
        producers.push($(link).text());
      }
    });
    animeInfo.producers = producers;

    const teaserDOM = $('.video-promotion > a');
    if (teaserDOM.length > 0) {
      const teaserURL = $(teaserDOM).attr('href');
      const style = $(teaserDOM).attr('style');
      if (teaserURL) {
        animeInfo.trailer = {
          id: substringAfter(teaserURL, 'embed/').split('?')[0],
          site: 'https://youtube.com/watch?v=',
          thumbnail: style ? substringBefore(substringAfter(style, "url('"), "'") : '',
        };
      }
    }
    const ops = $('.theme-songs.js-theme-songs.opnening').find('tr').get();

    const ignoreList = ['Apple Music', 'Youtube Music', 'Amazon Music', 'Spotify'];
    animeInfo.openings = ops.map((element: any) => {
      //console.log($(element).text().trim());
      const name = $(element).children().eq(1).children().first().text().trim();
      if (!ignoreList.includes(name)) {
        if ($(element).find('.theme-song-index').length != 0) {
          const index = $(element).find('.theme-song-index').text().trim();
          const band = $(element).find('.theme-song-artist').text().trim();
          const episodes = $(element).find('.theme-song-episode').text().trim();
          //console.log($(element).children().eq(1).text().trim().split(index)[1]);

          return {
            name: $(element).children().eq(1).text().trim().split(index)[1].split(band)[0].trim(),
            band: band.replace('by ', ''),
            episodes: episodes,
          };
        } else {
          const band = $(element).find('.theme-song-artist').text().trim();
          const episodes = $(element).find('.theme-song-episode').text().trim();
          return {
            name: $(element).children().eq(1).text().trim().split(band)[0]?.trim(),
            band: band.replace('by ', ''),
            episodes: episodes,
          };
        }
      }
    });
    animeInfo.openings = (animeInfo.openings as any[]).filter(function (element: any) {
      return element !== undefined;
    });

    const eds = $('.theme-songs.js-theme-songs.ending').find('tr').get();
    animeInfo.endings = eds.map((element: any) => {
      //console.log($(element).text().trim());
      const name = $(element).children().eq(1).children().first().text().trim();
      if (!ignoreList.includes(name)) {
        if ($(element).find('.theme-song-index').length != 0) {
          const index = $(element).find('.theme-song-index').text().trim();
          const band = $(element).find('.theme-song-artist').text().trim();
          const episodes = $(element).find('.theme-song-episode').text().trim();
          //console.log($(element).children().eq(1).text().trim().split(index)[1]);

          return {
            name: $(element).children().eq(1).text().trim().split(index)[1].split(band)[0].trim(),
            band: band.replace('by ', ''),
            episodes: episodes,
          };
        } else {
          const band = $(element).find('.theme-song-artist').text().trim();
          const episodes = $(element).find('.theme-song-episode').text().trim();
          return {
            name: $(element).children().eq(1).text().trim().split(band)[0].trim(),
            band: band.replace('by ', ''),
            episodes: episodes,
          };
        }
      }
    });
    animeInfo.endings = (animeInfo.endings as any[]).filter(function (element: any) {
      return element !== undefined;
    });

    const description = $('.spaceit_pad').get();

    description.forEach((elem: any) => {
      const text = $(elem).text().toLowerCase().trim();
      const key = text.split(':')[0];
      const value = substringAfter(text, `${key}:`).trim();
      switch (key) {
        case 'status':
          animeInfo.status = this.malStatusToMediaStatusOverride(value);
          break;
        case 'episodes':
          animeInfo.totalEpisodes = parseInt(value);
          if (isNaN(animeInfo.totalEpisodes)) animeInfo.totalEpisodes = 0;
          break;
        case 'premiered':
          animeInfo.season = value.split(' ')[0].toUpperCase();
          break;
        case 'aired':
          const dates = value.split('to');
          if (dates.length >= 2) {
            const start = dates[0].trim();
            const end = dates[1].trim();
            const startDate = new Date(start);
            const endDate = new Date(end);

            if (startDate.toString() !== 'Invalid Date') {
              animeInfo.startDate = {
                day: startDate.getDate(),
                month: startDate.getMonth(),
                year: startDate.getFullYear(),
              };
            }

            if (endDate.toString() != 'Invalid Date') {
              animeInfo.endDate = {
                day: endDate.getDate(),
                month: endDate.getMonth(),
                year: endDate.getFullYear(),
              };
            }
          }

          break;

        case 'score':
          animeInfo.rating = parseFloat(value);
          break;
        case 'studios':
          for (const studio of $(elem).find('a')) animeInfo.studios?.push($(studio).text());
          break;
        case 'rating':
          animeInfo.ageRating = value;
      }
    });

    return animeInfo;
  };

  private malStatusToMediaStatusOverride(status: string): MediaStatus {
    if (status == 'currently airing') return MediaStatus.ONGOING;
    else if (status == 'finished airing') return MediaStatus.COMPLETED;
    else if (status == 'not yet aired') return MediaStatus.NOT_YET_AIRED;
    return MediaStatus.UNKNOWN;
  }

  fetchUserAnimeList = async (username: string, status = 1): Promise<IAnimeResult[]> => {
    const { data } = await this.client.request({
      method: 'get',
      url: `https://myanimelist.net/animelist/${username}?status=${status}`,
      headers: {
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.35',
      },
    });

    const $ = load(data);
    const table = $('table.list-table').get()[0]

    if (!table) {
      return [];
    }

    const dataItems = table.attributes.find(({ name, value }) => name === 'data-items')?.value;

    if (!dataItems) {
      return [];
    }

    const parsedDataItems: any[] = JSON.parse(dataItems);
    return parsedDataItems.map((item) => ({
      id: `${item.anime_id}`,
      title: item.anime_title_eng ?? item.anime_title,
      image: item.anime_image_path,
      rating: item.anime_score_val,
      totalEpisodes: item.anime_num_episodes,
      type: item.anime_media_type_string == 'TV'
              ? MediaFormat.TV
              : item.anime_media_type_string == 'TV_SHORT'
              ? MediaFormat.TV_SHORT
              : item.anime_media_type_string == 'Movie'
              ? MediaFormat.MOVIE
              : item.anime_media_type_string == 'SPECIAL'
              ? MediaFormat.SPECIAL
              : item.anime_media_type_string == 'OVA'
              ? MediaFormat.OVA
              : item.anime_media_type_string == 'ONA'
              ? MediaFormat.ONA
              : item.anime_media_type_string == 'MUSIC'
              ? MediaFormat.MUSIC
              : item.anime_media_type_string == 'MANGA'
              ? MediaFormat.MANGA
              : item.anime_media_type_string == 'NOVEL'
              ? MediaFormat.NOVEL
              : item.anime_media_type_string == 'ONE_SHOT'
              ? MediaFormat.ONE_SHOT
              : undefined,
    }));
  };
}
