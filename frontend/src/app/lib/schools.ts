export interface SchoolOption {
  id: string;
  name: string;
  shortName: string;
  city: string;
  logoUrl: string;
  hot?: boolean;
}

export const openedSchools: SchoolOption[] = [
  { id: 'zju', name: '浙江大学', shortName: '浙大', city: '杭州', logoUrl: '/school-logos/zju.png', hot: true },
  { id: 'caa', name: '中国美术学院', shortName: '国美', city: '杭州', logoUrl: '/school-logos/caa.png', hot: true },
  { id: 'jingzhou', name: '荆州学院', shortName: '荆州', city: '荆州', logoUrl: '/school-logos/jingzhou.png', hot: true },
  { id: 'fudan', name: '复旦大学', shortName: '复旦', city: '上海', logoUrl: '/school-logos/fudan.png', hot: true },
  { id: 'zucc', name: '浙大城市学院', shortName: '城院', city: '杭州', logoUrl: '/school-logos/zucc.png', hot: true },
  { id: 'hebau', name: '河北农业大学', shortName: '河北农大', city: '保定', logoUrl: '/school-logos/hebau.png', hot: true },
  { id: 'aust', name: '安徽理工大学', shortName: '安理', city: '淮南', logoUrl: '/school-logos/aust.png', hot: true },
  {
    id: 'zkc',
    name: '浙江理工大学科技与艺术学院',
    shortName: '科艺',
    city: '绍兴',
    logoUrl: '/school-logos/zkc.png',
    hot: true,
  },
  { id: 'zjut', name: '浙江工业大学', shortName: '浙工大', city: '杭州', logoUrl: '/school-logos/zjut.png' },
  { id: 'hdu', name: '杭州电子科技大学', shortName: '杭电', city: '杭州', logoUrl: '/school-logos/hdu.png' },
  { id: 'zust', name: '浙江科技大学', shortName: '浙科', city: '杭州', logoUrl: '/school-logos/zust.png' },
  { id: 'zstu', name: '浙江理工大学', shortName: '浙理工', city: '杭州', logoUrl: '/school-logos/zstu.png' },
  { id: 'nbu', name: '宁波大学', shortName: '宁大', city: '宁波', logoUrl: '/school-logos/nbu.png' },
  { id: 'wzu', name: '温州大学', shortName: '温大', city: '温州', logoUrl: '/school-logos/wzu.png' },
  { id: 'zjgsu', name: '浙江工商大学', shortName: '浙商大', city: '杭州', logoUrl: '/school-logos/zjgsu.png' },
  { id: 'zufe', name: '浙江财经大学', shortName: '浙财', city: '杭州', logoUrl: '/school-logos/zufe.png' },
  { id: 'zjnu', name: '浙江师范大学', shortName: '浙师大', city: '金华', logoUrl: '/school-logos/zjnu.png' },
  { id: 'zafu', name: '浙江农林大学', shortName: '浙农林', city: '杭州', logoUrl: '/school-logos/zafu.png' },
  { id: 'cjlu', name: '中国计量大学', shortName: '中量大', city: '杭州', logoUrl: '/school-logos/cjlu.png' },
  { id: 'zcmu', name: '浙江中医药大学', shortName: '浙中医', city: '杭州', logoUrl: '/school-logos/zcmu.png' },
];

export const hotSchools = openedSchools.filter((school) => school.hot);

export function findSchoolByName(name?: string) {
  const value = name?.trim();
  if (!value) {
    return undefined;
  }

  return openedSchools.find((school) => school.name === value);
}

export function filterSchools(keyword: string) {
  const value = keyword.trim().toLowerCase();
  if (!value) {
    return openedSchools;
  }

  return openedSchools.filter((school) => {
    const text = `${school.name} ${school.shortName} ${school.city}`.toLowerCase();
    return text.includes(value);
  });
}
