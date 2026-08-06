import { normalizeHost } from './domain.mjs';

export class RobotsCache {
  constructor({ fetcher = fetch, userAgent = 'WeBuildCo-PublicationCrawler/1.0 (+https://webuildco.com.au)' } = {}) {
    this.fetcher = fetcher;
    this.userAgent = userAgent;
    this.cache = new Map();
  }

  async canFetch(url) {
    const parsed = new URL(url);
    const origin = parsed.origin;
    let rules = this.cache.get(origin);
    if (!rules) {
      rules = await this.fetchRules(origin);
      this.cache.set(origin, rules);
    }
    return rules.canAccess(`${parsed.pathname}${parsed.search}`);
  }

  async fetchRules(origin) {
    try {
      const response = await this.fetcher(`${origin}/robots.txt`, {
        headers: { 'user-agent': this.userAgent },
        redirect: 'follow',
      });
      if (response.status === 404) return new RobotsRules([]);
      if (!response.ok) return new RobotsRules([]);
      return RobotsRules.parse(await response.text(), this.userAgent);
    } catch {
      return new RobotsRules([]);
    }
  }
}

export class RobotsRules {
  constructor(rules) {
    this.rules = rules;
  }

  static parse(text, userAgent) {
    const target = normalizeHost(userAgent.split('/')[0]);
    const groups = [];
    let agents = [];
    let rules = [];

    const flush = () => {
      if (agents.length > 0) groups.push({ agents, rules });
      agents = [];
      rules = [];
    };

    for (const rawLine of String(text ?? '').split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, '').trim();
      if (!line) continue;
      const [rawKey, ...rawValue] = line.split(':');
      const key = rawKey.trim().toLowerCase();
      const value = rawValue.join(':').trim();

      if (key === 'user-agent') {
        if (rules.length > 0) flush();
        agents.push(value.toLowerCase());
      } else if ((key === 'allow' || key === 'disallow') && agents.length > 0) {
        rules.push({ type: key, path: value || '/' });
      }
    }
    flush();

    const applicable = groups
      .filter((group) => group.agents.some((agent) => agent === '*' || target.includes(agent)))
      .flatMap((group) => group.rules);

    return new RobotsRules(applicable);
  }

  canAccess(path) {
    let winner = null;
    for (const rule of this.rules) {
      if (!rule.path) continue;
      if (path.startsWith(rule.path) && (!winner || rule.path.length > winner.path.length)) {
        winner = rule;
      }
    }
    return !winner || winner.type !== 'disallow';
  }
}
