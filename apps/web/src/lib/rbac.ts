import type { AuthUserDto, SmartChainRole } from './types';

export interface RoleNavItem {
  href: string;
  label: string;
}

export interface DemoAccountPreset {
  email: string;
  name: string;
  role: SmartChainRole;
  roleLabel: string;
  entityCode?: string;
  workspaceSummary: string;
  homeRoute: string;
}

export const DEMO_ACCOUNT_PRESETS: DemoAccountPreset[] = [
  {
    email: 'direksi@nusantara-mfg.co.id',
    name: 'Dewi Kartika',
    role: 'DIREKSI',
    roleLabel: 'Direksi Perusahaan',
    workspaceSummary: 'Control Tower eksekutif, analitik WMA hibrida, dan audit log (hanya-baca).',
    homeRoute: '/',
  },
  {
    email: 'pengadaan@nusantara-mfg.co.id',
    name: 'Budi Santoso',
    role: 'PROCUREMENT_MANAGER',
    roleLabel: 'Manajer Pengadaan & Produksi',
    workspaceSummary: 'Kelola 15+ pemasok, RFQ cadangan Tier-2, buat & setujui PO berbasis ROP.',
    homeRoute: '/srm',
  },
  {
    email: 'gudang@nusantara-mfg.co.id',
    name: 'Rina Wijaya',
    role: 'WAREHOUSE_OPERATOR',
    roleLabel: 'Operator Gudang #04 (WMS)',
    workspaceSummary: 'Terminal RFID/Barcode, antrean offline IndexedDB 48 jam, dan karantina selisih.',
    homeRoute: '/wms',
  },
  {
    email: 'logistik@nusantara-mfg.co.id',
    name: 'Hendra Pratama',
    role: 'LOGISTICS_MANAGER',
    roleLabel: 'Manajer Distribusi & Logistik',
    workspaceSummary: 'Validasi Anomaly Guard, alokasi prioritas SLA, dan konsolidasi rute TMS.',
    homeRoute: '/tms',
  },
  {
    email: 'mitra@bajanusantara.co.id',
    name: 'PT Baja Nusantara',
    role: 'PARTNER',
    roleLabel: 'Mitra Pemasok (SUP-01)',
    entityCode: 'SUP-01',
    workspaceSummary: 'Portal eksternal pemasok: konfirmasi PO/RFQ dan status pengiriman bahan.',
    homeRoute: '/partner',
  },
  {
    email: 'order@distribusitimur.co.id',
    name: 'PT Distribusi Timur',
    role: 'PARTNER',
    roleLabel: 'Mitra Distributor (DIST-01)',
    entityCode: 'DIST-01',
    workspaceSummary: 'Portal eksternal distributor: pengajuan pesanan kuota dan pelacakan resi.',
    homeRoute: '/partner',
  },
  {
    email: 'admin@nusantara-mfg.co.id',
    name: 'Irwan Hakim',
    role: 'SYSTEM_ADMIN',
    roleLabel: 'Admin Sistem & Akses IT',
    workspaceSummary:
      'Kelola akun pengguna, penetapan peran RBAC, & audit keamanan (tanpa wewenang transaksi bisnis).',
    homeRoute: '/admin',
  },
];

export interface RoleLoginPortal {
  slug: 'direksi' | 'pengadaan' | 'gudang' | 'logistik' | 'mitra' | 'admin';
  role: SmartChainRole;
  title: string;
  badge: string;
  description: string;
  defaultEmail: string;
}

export const ROLE_LOGIN_PORTALS: RoleLoginPortal[] = [
  {
    slug: 'direksi',
    role: 'DIREKSI',
    title: 'Portal Eksekutif Direksi',
    badge: 'Hanya-Baca Strategis',
    description: 'Control Tower 3 pabrik, analitik Hybrid WMA, dan Immutable Audit Log.',
    defaultEmail: 'direksi@nusantara-mfg.co.id',
  },
  {
    slug: 'pengadaan',
    role: 'PROCUREMENT_MANAGER',
    title: 'Portal Pengadaan & SRM',
    badge: 'SRM, PO & Multi-Sourcing',
    description: 'Kelola 15 pemasok utama + 5 cadangan, Auto-RFQ 14 hari, dan PO berbasis ROP.',
    defaultEmail: 'pengadaan@nusantara-mfg.co.id',
  },
  {
    slug: 'gudang',
    role: 'WAREHOUSE_OPERATOR',
    title: 'Portal Terminal Gudang & WMS',
    badge: 'Barcode/RFID & Offline 48 Jam',
    description: 'Pemindaian tag Barcode/RFID, antrean IndexedDB, dan karantina selisih stok.',
    defaultEmail: 'gudang@nusantara-mfg.co.id',
  },
  {
    slug: 'logistik',
    role: 'LOGISTICS_MANAGER',
    title: 'Portal Distribusi & TMS',
    badge: 'Anomaly Guard & Rute TMS',
    description: 'Filter pesanan fiktif, alokasi prioritas SLA, dan konsolidasi rute 25 distributor.',
    defaultEmail: 'logistik@nusantara-mfg.co.id',
  },
  {
    slug: 'mitra',
    role: 'PARTNER',
    title: 'Portal Mitra Eksternal',
    badge: '20 Pemasok & 25 Distributor',
    description: 'Akses terisolasi per entityCode untuk konfirmasi PO/RFQ atau pengajuan order.',
    defaultEmail: 'sup-04@mitra.nusantara-mfg.co.id',
  },
  {
    slug: 'admin',
    role: 'SYSTEM_ADMIN',
    title: 'Portal Admin Sistem IT',
    badge: 'Keamanan & RBAC',
    description: 'Kelola akun pengguna, penetapan peran, reset sandi, & audit keamanan.',
    defaultEmail: 'admin@nusantara-mfg.co.id',
  },
];

export function getLoginRouteForRole(role: SmartChainRole): string {
  return `/login/${ROLE_LOGIN_PORTALS.find((p) => p.role === role)?.slug ?? 'direksi'}`;
}

export function getHomeRouteForRole(role: SmartChainRole): string {
  switch (role) {
    case 'DIREKSI':
      return '/';
    case 'PROCUREMENT_MANAGER':
      return '/srm';
    case 'WAREHOUSE_OPERATOR':
      return '/wms';
    case 'LOGISTICS_MANAGER':
      return '/tms';
    case 'PARTNER':
      return '/partner';
    case 'SYSTEM_ADMIN':
      return '/admin';
  }
}

export function getRoleLabel(user: AuthUserDto): string {
  if (user.role === 'PARTNER') {
    return user.entityCode?.startsWith('SUP-')
      ? `Mitra Pemasok (${user.entityCode})`
      : `Mitra Distributor (${user.entityCode ?? 'Eksternal'})`;
  }
  const map: Record<Exclude<SmartChainRole, 'PARTNER'>, string> = {
    DIREKSI: 'Direksi Perusahaan',
    PROCUREMENT_MANAGER: 'Manajer Pengadaan',
    WAREHOUSE_OPERATOR: 'Operator Gudang',
    LOGISTICS_MANAGER: 'Manajer Logistik',
    SYSTEM_ADMIN: 'Admin Sistem IT',
  };
  return map[user.role];
}

export function getNavItemsForRole(role: SmartChainRole): RoleNavItem[] {
  switch (role) {
    case 'DIREKSI':
      return [
        { href: '/', label: 'Control Tower' },
        { href: '/inventory', label: 'Inventory & Relasi' },
        { href: '/analytics', label: 'Analitik & Kinerja' },
      ];
    case 'PROCUREMENT_MANAGER':
      return [
        { href: '/srm', label: 'SRM Pemasok' },
        { href: '/po', label: 'Procurement & PO' },
        { href: '/inventory', label: 'Inventory & Relasi' },
        { href: '/analytics', label: 'Analitik & Kinerja' },
      ];
    case 'WAREHOUSE_OPERATOR':
      return [
        { href: '/wms', label: 'WMS & Scanner RFID' },
        { href: '/inventory', label: 'Inventory & Relasi' },
        { href: '/', label: 'Ringkasan Gangguan' },
      ];
    case 'LOGISTICS_MANAGER':
      return [
        { href: '/tms', label: 'Order Guard & TMS' },
        { href: '/inventory', label: 'Inventory & Relasi' },
        { href: '/analytics', label: 'Analitik & Kinerja' },
      ];
    case 'PARTNER':
      return [{ href: '/partner', label: 'Portal Mitra Eksternal' }];
    case 'SYSTEM_ADMIN':
      return [{ href: '/admin', label: 'Manajemen Akses & RBAC' }];
  }
}

export function canAccessRoute(role: SmartChainRole, pathname: string): boolean {
  if (pathname === '/login' || pathname.startsWith('/login/')) return true;
  if (role === 'PARTNER') {
    return pathname === '/partner';
  }
  if (role === 'SYSTEM_ADMIN') {
    return pathname === '/admin';
  }
  if (role === 'DIREKSI') {
    return pathname === '/' || pathname === '/inventory' || pathname === '/analytics';
  }
  if (role === 'PROCUREMENT_MANAGER') {
    return (
      pathname === '/' ||
      pathname === '/srm' ||
      pathname === '/po' ||
      pathname === '/inventory' ||
      pathname === '/analytics'
    );
  }
  if (role === 'WAREHOUSE_OPERATOR') {
    return pathname === '/' || pathname === '/wms' || pathname === '/inventory';
  }
  if (role === 'LOGISTICS_MANAGER') {
    return (
      pathname === '/' ||
      pathname === '/tms' ||
      pathname === '/inventory' ||
      pathname === '/analytics'
    );
  }
  return false;
}

export function getHeroCopyForUser(user: AuthUserDto): { title: string; subtitle: string } {
  switch (user.role) {
    case 'DIREKSI':
      return {
        title: 'Control Tower Eksekutif PT Nusantara Manufacturing',
        subtitle:
          'Pemantauan strategis lintas 3 pabrik, 15 pemasok, 8 gudang, dan 25 distributor dengan analitik WMA hibrida dan jejak audit permanen (akses hanya-baca).',
      };
    case 'PROCUREMENT_MANAGER':
      return {
        title: 'Meja Kerja Pengadaan, SRM & Multi-Sourcing',
        subtitle:
          'Kelola pasokan 3 pabrik, awasi pemasok utama vs cadangan Tier-2, terbitkan Purchase Order berbasis ROP, dan picu RFQ otomatis saat pasokan terhenti.',
      };
    case 'WAREHOUSE_OPERATOR':
      return {
        title: 'Terminal Edge WMS & Antrean Offline Gudang',
        subtitle:
          'Catat pemindaian Barcode/RFID di 8 gudang dengan ketahanan offline IndexedDB 48 jam, sinkronisasi idempoten, dan rekonsiliasi karantina selisih.',
      };
    case 'LOGISTICS_MANAGER':
      return {
        title: 'Kendali Validasi Order, Alokasi SLA & TMS',
        subtitle:
          'Saring pesanan fiktif lewat Anomaly Guard, jalankan prioritas alokasi 25 distributor saat lonjakan permintaan, dan konsolidasikan rute pengiriman.',
      };
    case 'SYSTEM_ADMIN':
      return {
        title: 'Konsol Administrasi Akun & Keamanan RBAC',
        subtitle:
          'Kelola akun pengguna, penetapan peran, aktivasi/penonaktifan akun, dan audit akses berdasarkan prinsip Separation of Duties (tanpa akses transaksi bisnis).',
      };
    case 'PARTNER':
      return user.entityCode?.startsWith('SUP-')
        ? {
            title: `Portal Mitra Pemasok — ${user.name}`,
            subtitle:
              'Tinjau dan konfirmasi Purchase Order atau RFQ cadangan yang ditujukan khusus untuk entitas pemasok Anda.',
          }
        : {
            title: `Portal Mitra Distributor — ${user.name}`,
            subtitle:
              'Ajukan pesanan pengisian stok sesuai kuota historis dan lacak status alokasi serta jadwal pengiriman TMS Anda.',
          };
  }
}
