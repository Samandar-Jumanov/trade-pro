import {  Scenes, Context } from 'telegraf';

export interface IWizardState {
  categories: ICategory[];
  categoryId: string;
  title: string;
}

export interface ICategory {
  id: string;
  name: string;
  type: string;
  _count?: {
    products: number;
  };
}

export interface IProduct {
  id: string;
  title: string;
  wanted_trades: string;
  userId: string;
  categoryId: string;
  isTraded: boolean;
  category: ICategory;
  created_at?: Date;
}

export interface IUser {
  id: string;
  tgId: string;
  tg_username?: string;
  products: IProduct[];
}

// Custom context type with wizard state
export interface ICustomContext extends Context {
  scene: Scenes.SceneContextScene<ICustomContext>;
  wizard: Scenes.WizardContext<Scenes.WizardSessionData & { state: IWizardState }>;
}