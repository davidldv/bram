export interface Headline {
  title: string;
  source: string;
  url: string;
}

export interface NewsClient {
  fetchHeadlines(topics: string[]): Promise<Headline[]>;
}

interface ProviderArticle {
  title: string;
  source: { name: string };
  url: string;
}

export function createNewsClient(opts: {
  apiKey: string;
  fetchFn?: typeof fetch;
}): NewsClient {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    async fetchHeadlines(topics) {
      const query = topics.length ? topics.join(" OR ") : "top";
      const url =
        `https://newsapi.org/v2/top-headlines?q=${encodeURIComponent(query)}` +
        `&pageSize=5&apiKey=${opts.apiKey}`;
      const res = await fetchFn(url);
      if (!res.ok) throw new Error(`news provider error: ${res.status}`);
      const data = (await res.json()) as { articles?: ProviderArticle[] };
      const articles = Array.isArray(data.articles) ? data.articles : [];
      return articles.map((a) => ({
        title: a.title,
        source: a.source.name,
        url: a.url,
      }));
    },
  };
}
