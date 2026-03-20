import { Impit } from 'impit';

export interface HLTVConfig {
  loadPage: (url: string) => Promise<string>;
}

const impit = new Impit({ browser: 'chrome' });

export const defaultLoadPage = () => (url: string) =>
  impit.fetch(url).then((res) => res.text());

export const defaultConfig: HLTVConfig = {
  loadPage: defaultLoadPage(),
};
