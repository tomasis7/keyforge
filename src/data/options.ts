import type { LayoutId } from './layouts';

export type CaseId = 'black' | 'silver' | 'navy' | 'burgundy' | 'forest';
export type ColorwayId = 'mono' | 'carbon' | 'botanical' | 'midnight' | 'retro';
export type SwitchId = 'redline' | 'brownfield' | 'bluejay';
export type PlateId = 'alu' | 'brass' | 'pc';
export type CableId = 'none' | 'ember' | 'sage' | 'ivory' | 'noir';
export type WristId = 'none' | 'walnut' | 'resin';

export interface CaseOption {
  id: CaseId;
  name: string;
  hex: string;
  price: number;
}

export interface ColorwayOption {
  id: ColorwayId;
  name: string;
  alpha: string;
  mod: string;
  accent: string;
  onAlpha: string;
  onMod: string;
  onAccent: string;
  price: number;
}

export interface SwitchOption {
  id: SwitchId;
  name: string;
  type: 'Linear' | 'Tactile' | 'Clicky';
  desc: string;
  sound: string;
  force: string;
  price: number;
}

export interface PlateOption {
  id: PlateId;
  name: string;
  desc: string;
  price: number;
}

export interface CableOption {
  id: CableId;
  name: string;
  hex: string | null;
  price: number;
}

export interface WristOption {
  id: WristId;
  name: string;
  price: number;
}

export interface Config {
  layout: LayoutId;
  case: CaseId;
  colorway: ColorwayId;
  switches: SwitchId;
  plate: PlateId;
  cable: CableId;
  wrist: WristId;
}

export const DEFAULT_CONFIG: Config = {
  layout: '75',
  case: 'black',
  colorway: 'carbon',
  switches: 'redline',
  plate: 'alu',
  cable: 'none',
  wrist: 'none',
};

export const CASE_OPTIONS: CaseOption[] = [
  { id: 'black', name: 'Anodized Black', hex: '#1C1C1E', price: 0 },
  { id: 'silver', name: 'Silver', hex: '#C9CCD1', price: 40 },
  { id: 'navy', name: 'Navy', hex: '#2B3A55', price: 40 },
  { id: 'burgundy', name: 'Burgundy', hex: '#5E2B35', price: 60 },
  { id: 'forest', name: 'Forest', hex: '#2E4235', price: 60 },
];

export const COLORWAYS: ColorwayOption[] = [
  {
    id: 'mono',
    name: 'Mono',
    alpha: '#E8E6E1',
    mod: '#B8B5AE',
    accent: '#2A2A2E',
    onAlpha: '#1A1A1E',
    onMod: '#1A1A1E',
    onAccent: '#F2F0EA',
    price: 40,
  },
  {
    id: 'carbon',
    name: 'Carbon',
    alpha: '#3A3D42',
    mod: '#232528',
    accent: '#E4572E',
    onAlpha: '#F2F0EA',
    onMod: '#F2F0EA',
    // Dark legend on the bright orange accent: light was 3.23:1, below AA.
    onAccent: '#1A1A1E',
    price: 55,
  },
  {
    id: 'botanical',
    name: 'Botanical',
    alpha: '#F2EDE4',
    mod: '#5B7A5E',
    accent: '#D9A441',
    onAlpha: '#1A1A1E',
    // The mid-tone green is the one cap no palette tone clears AA against:
    // the usual off-white managed 4.20:1. Pure white reaches 4.78:1, and at
    // 13px the difference from #F2F0EA is imperceptible — far less visible
    // than shifting the green itself, which is a large area of the board.
    onMod: '#FFFFFF',
    onAccent: '#1A1A1E',
    price: 65,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    alpha: '#4A5A7A',
    mod: '#1E2430',
    accent: '#8FB8DE',
    onAlpha: '#F2F0EA',
    onMod: '#F2F0EA',
    onAccent: '#1A1A1E',
    price: 65,
  },
  {
    id: 'retro',
    name: 'Retro',
    alpha: '#F4E9D8',
    mod: '#C97B5A',
    accent: '#4E6E58',
    onAlpha: '#1A1A1E',
    onMod: '#1A1A1E',
    // Light legend on the deep green accent: dark was 3.05:1. Reuses this
    // colorway's own alpha cream rather than introducing a tone.
    onAccent: '#F4E9D8',
    price: 80,
  },
];

export const SWITCH_OPTIONS: SwitchOption[] = [
  {
    id: 'redline',
    name: 'Redline',
    type: 'Linear',
    desc: 'Smooth, consistent press top to bottom',
    sound: 'Deep, muted thock',
    force: '45 gf',
    price: 35,
  },
  {
    id: 'brownfield',
    name: 'Brownfield',
    type: 'Tactile',
    desc: 'Noticeable bump at actuation, no click',
    sound: 'Soft, rounded thud',
    force: '55 gf',
    price: 45,
  },
  {
    id: 'bluejay',
    name: 'Bluejay',
    type: 'Clicky',
    desc: 'Sharp bump with audible click',
    sound: 'Crisp, bright snap',
    force: '60 gf',
    price: 55,
  },
];

export const PLATE_OPTIONS: PlateOption[] = [
  { id: 'alu', name: 'Aluminum', desc: 'Balanced flex, neutral sound', price: 0 },
  { id: 'brass', name: 'Brass', desc: 'Firm, higher-pitched, premium weight', price: 25 },
  { id: 'pc', name: 'Polycarbonate', desc: 'Softer, deeper, more flex', price: 15 },
];

export const CABLE_OPTIONS: CableOption[] = [
  { id: 'none', name: 'No cable', hex: null, price: 0 },
  { id: 'ember', name: 'Ember', hex: '#E4572E', price: 25 },
  { id: 'sage', name: 'Sage', hex: '#7A9E7E', price: 25 },
  { id: 'ivory', name: 'Ivory', hex: '#EFE9DC', price: 25 },
  { id: 'noir', name: 'Noir', hex: '#232528', price: 25 },
];

export const WRIST_OPTIONS: WristOption[] = [
  { id: 'none', name: 'No wrist rest', price: 0 },
  { id: 'walnut', name: 'Walnut', price: 45 },
  { id: 'resin', name: 'Resin', price: 45 },
];
