export interface Link {
  id: number;
  url: string;
  title: string;
  note: string;
  tags: string[];
  lastUpdated: string;
}

export interface Collection {
  id: number;
  title: string;
  note: string;
  links: number[];
  lastUpdated: string;
}

export interface Data {
  idCounter: number;
  collections: Collection[];
  links: Link[];
}

export const EMPTY_DATA: Data = {
  idCounter: 0,
  collections: [],
  links: [],
};
