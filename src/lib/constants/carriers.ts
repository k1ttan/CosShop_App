export interface CarrierConfig {
  id: string
  name: string
  getUrl: (trackingCode: string) => string
}

export const POPULAR_CARRIERS: CarrierConfig[] = [
  {
    id: 'ghn',
    name: 'Giao Hàng Nhanh (GHN)',
    getUrl: (code) => `https://donhang.ghn.vn/?order_code=${code.trim()}`,
  },
  {
    id: 'ghtk',
    name: 'Giao Hàng Tiết Kiệm (GHTK)',
    getUrl: (code) => `https://i.ghtk.vn/${code.trim()}`,
  },
  {
    id: 'viettel_post',
    name: 'Viettel Post',
    getUrl: (code) => `https://viettelpost.vn/tra-cuu-hanh-trinh-don/?tracking_code=${code.trim()}`,
  },
  {
    id: 'jt',
    name: 'J&T Express',
    getUrl: (code) => `https://jtexpress.vn/vi/tracking?billcode=${code.trim()}`,
  },
  {
    id: 'vnpost',
    name: 'VNPost / Bưu điện',
    getUrl: (code) => `https://mabuudien.net/tra-cuu-buu-gui/?tracking_code=${code.trim()}`,
  },
  {
    id: 'express',
    name: 'Hoả tốc (Grab / Be / Ahamove)',
    getUrl: () => '',
  },
  {
    id: 'other',
    name: 'Đơn vị vận chuyển khác',
    getUrl: () => '',
  },
]
