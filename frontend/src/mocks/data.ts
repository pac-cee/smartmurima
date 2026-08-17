import type {
  Alert,
  ChatMessage,
  ChatSession,
  Crop,
  DiseaseReport,
  Farm,
  Field,
  KnowledgeDoc,
  Location,
  Recommendation,
  SensorNode,
  User,
} from '@/lib/schemas';

export const mockLocations: Location[] = [
  // provinces
  { id: 'p-east', name: 'Eastern Province', level: 'province', parent: null },
  { id: 'p-kigali', name: 'Kigali City', level: 'province', parent: null },
  // districts
  { id: 'd-bugesera', name: 'Bugesera', level: 'district', parent: 'p-east', parent_name: 'Eastern Province' },
  { id: 'd-rwamagana', name: 'Rwamagana', level: 'district', parent: 'p-east', parent_name: 'Eastern Province' },
  { id: 'd-gasabo', name: 'Gasabo', level: 'district', parent: 'p-kigali', parent_name: 'Kigali City' },
  // sectors
  { id: 's-rweru', name: 'Rweru', level: 'sector', parent: 'd-bugesera', parent_name: 'Bugesera' },
  { id: 's-nyamata', name: 'Nyamata', level: 'sector', parent: 'd-bugesera', parent_name: 'Bugesera' },
  { id: 's-gashora', name: 'Gashora', level: 'sector', parent: 'd-bugesera', parent_name: 'Bugesera' },
  { id: 's-fumbwe', name: 'Fumbwe', level: 'sector', parent: 'd-rwamagana', parent_name: 'Rwamagana' },
  { id: 's-remera', name: 'Remera', level: 'sector', parent: 'd-gasabo', parent_name: 'Gasabo' },
];

export const mockUser: User = {
  id: 'u1',
  full_name: 'Mireille Uwimana',
  email: 'mireille.26828@auca.ac.rw',
  phone_number: '+250788123456',
  role: 'farmer',
  language: 'rw',
  is_active: true,
  location: 's-rweru',
  location_path: 'Eastern Province / Bugesera / Rweru',
  created_at: '2025-01-12T08:00:00Z',
};

export const mockUsers: User[] = [
  mockUser,
  {
    id: 'u2',
    full_name: 'Jean Baptiste Habimana',
    email: 'jb@coop.rw',
    phone_number: '+250788222333',
    role: 'coop_admin',
    language: 'rw',
    is_active: true,
  },
  {
    id: 'u3',
    full_name: 'Alice Mukamana',
    email: 'alice@rab.gov.rw',
    phone_number: '+250788444555',
    role: 'extension',
    language: 'en',
    is_active: true,
  },
  {
    id: 'u4',
    full_name: 'Admin Kwizera',
    email: 'admin@smartmurima.rw',
    phone_number: '+250788000111',
    role: 'admin',
    language: 'en',
    is_active: true,
  },
];

export const mockCrops: Crop[] = [
  { id: 'c1', name: 'Maize', base_temp: 10, season: 'A' },
  { id: 'c2', name: 'Beans', base_temp: 8, season: 'B' },
  { id: 'c3', name: 'Cassava', base_temp: 12, season: 'A' },
  { id: 'c4', name: 'Rice', base_temp: 13, season: 'A' },
  { id: 'c5', name: 'Soybean', base_temp: 10, season: 'B' },
];

export const mockFarms: Farm[] = [
  {
    id: 'f1',
    name: 'Rweru Lakeside',
    sector: 'Rweru',
    latitude: -2.3667,
    longitude: 30.3,
    area_hectares: 4.5,
    field_count: 3,
    node_count: 4,
    location: 's-rweru',
    location_name: 'Rweru',
    created_at: '2025-02-01T08:00:00Z',
  },
  {
    id: 'f2',
    name: 'Nyamata Uplands',
    sector: 'Nyamata',
    latitude: -2.15,
    longitude: 30.1,
    area_hectares: 2.8,
    field_count: 2,
    node_count: 2,
    created_at: '2025-03-10T08:00:00Z',
  },
  {
    id: 'f3',
    name: 'Gashora Wetland Plot',
    sector: 'Gashora',
    latitude: -2.28,
    longitude: 30.22,
    area_hectares: 1.6,
    field_count: 1,
    node_count: 1,
    created_at: '2025-04-05T08:00:00Z',
  },
];

export const mockFields: Field[] = [
  {
    id: 'fld1',
    farm: 'f1',
    farm_name: 'Rweru Lakeside',
    name: 'North maize block',
    crop: 'c1',
    crop_name: 'Maize',
    planting_date: '2026-03-01',
    growth_stage: 'vegetative',
    area_hectares: 1.8,
  },
  {
    id: 'fld2',
    farm: 'f1',
    farm_name: 'Rweru Lakeside',
    name: 'Riverside beans',
    crop: 'c2',
    crop_name: 'Beans',
    planting_date: '2026-03-15',
    growth_stage: 'flowering',
    area_hectares: 1.2,
  },
  {
    id: 'fld3',
    farm: 'f1',
    farm_name: 'Rweru Lakeside',
    name: 'East cassava',
    crop: 'c3',
    crop_name: 'Cassava',
    planting_date: '2025-11-01',
    growth_stage: 'maturity',
    area_hectares: 1.5,
  },
  {
    id: 'fld4',
    farm: 'f2',
    farm_name: 'Nyamata Uplands',
    name: 'Terrace rice',
    crop: 'c4',
    crop_name: 'Rice',
    planting_date: '2026-02-20',
    growth_stage: 'maturity',
    area_hectares: 1.5,
  },
  {
    id: 'fld5',
    farm: 'f2',
    farm_name: 'Nyamata Uplands',
    name: 'Soybean strip',
    crop: 'c5',
    crop_name: 'Soybean',
    planting_date: '2026-04-01',
    growth_stage: 'germination',
    area_hectares: 1.3,
  },
  {
    id: 'fld6',
    farm: 'f3',
    farm_name: 'Gashora Wetland Plot',
    name: 'Wetland maize',
    crop: 'c1',
    crop_name: 'Maize',
    planting_date: '2026-03-05',
    growth_stage: 'vegetative',
    area_hectares: 1.6,
  },
];

export const mockNodes: SensorNode[] = [
  {
    id: 'n1',
    field: 'fld1',
    field_name: 'North maize block',
    device_id: 'node-bugesera-01',
    status: 'active',
    battery: 82,
    last_seen: new Date(Date.now() - 4 * 60000).toISOString(),
  },
  {
    id: 'n2',
    field: 'fld2',
    field_name: 'Riverside beans',
    device_id: 'node-bugesera-02',
    status: 'active',
    battery: 64,
    last_seen: new Date(Date.now() - 11 * 60000).toISOString(),
  },
  {
    id: 'n3',
    field: 'fld3',
    field_name: 'East cassava',
    device_id: 'node-bugesera-03',
    status: 'inactive',
    battery: 12,
    last_seen: new Date(Date.now() - 26 * 60 * 60000).toISOString(),
  },
  {
    id: 'n4',
    field: 'fld4',
    field_name: 'Terrace rice',
    device_id: 'ESP32-D2E8',
    status: 'maintenance',
    battery: 48,
    last_seen: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
  },
];

export const mockRecommendations: Recommendation[] = [
  {
    id: 'r1',
    field: 'fld1',
    field_name: 'North maize block',
    type: 'irrigation',
    decision: 'Irrigate tomorrow morning',
    value: 12,
    unit: 'mm',
    confidence: 0.88,
    details:
      'Soil moisture has dropped to 28% against a 35% target for the vegetative stage, and no rain is forecast for 48 hours. A light 12 mm pass restores the root zone without waterlogging.',
    created_at: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
  },
  {
    id: 'r2',
    field: 'fld2',
    field_name: 'Riverside beans',
    type: 'fertilizer',
    decision: 'Apply NPK 17-17-17 top dressing',
    value: 45,
    unit: 'kg/ha',
    confidence: 0.79,
    details:
      'Beans at flowering respond well to a balanced top dressing. Nitrogen uptake curve and current leaf color suggest 45 kg/ha maximizes pod set.',
    created_at: new Date(Date.now() - 20 * 60 * 60000).toISOString(),
  },
  {
    id: 'r3',
    field: 'fld4',
    field_name: 'Terrace rice',
    type: 'yield',
    decision: 'Projected harvest above district average',
    value: 5.4,
    unit: 't/ha',
    confidence: 0.72,
    details:
      'Accumulated growing degree days and consistent moisture put this field on track for 5.4 t/ha, roughly 14% above the Nyamata sector average.',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(),
  },
  {
    id: 'r4',
    field: 'fld1',
    field_name: 'North maize block',
    type: 'fertilizer',
    decision: 'Hold fertilizer for one week',
    value: 0,
    unit: 'kg/ha',
    confidence: 0.83,
    details:
      'Recent readings show adequate nitrogen. Applying now risks leaching with the incoming humidity. Reassess after the next dry window.',
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60000).toISOString(),
  },
];

export const mockDiseaseReports: DiseaseReport[] = [
  {
    id: 'd1',
    field: 'fld1',
    field_name: 'North maize block',
    disease: 'Maize leaf blight',
    confidence: 0.91,
    is_healthy: false,
    treatment:
      'Remove and burn affected leaves. Apply a mancozeb-based fungicide at 2.5 g/L, repeating after 10 days. Improve spacing to reduce leaf wetness.',
    image_url:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%2314532d"/><text x="50%25" y="50%25" fill="%23d1fadf" font-family="sans-serif" font-size="20" text-anchor="middle">Maize leaf</text></svg>',
    created_at: new Date(Date.now() - 6 * 60 * 60000).toISOString(),
  },
  {
    id: 'd2',
    field: 'fld2',
    field_name: 'Riverside beans',
    disease: 'Healthy',
    confidence: 0.96,
    is_healthy: true,
    treatment: 'No action needed. Continue current watering and monitoring.',
    image_url:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%2316a34a"/><text x="50%25" y="50%25" fill="%23ecfdf3" font-family="sans-serif" font-size="20" text-anchor="middle">Bean leaf</text></svg>',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(),
  },
  {
    id: 'd3',
    field: 'fld3',
    field_name: 'East cassava',
    disease: 'Cassava mosaic disease',
    confidence: 0.84,
    is_healthy: false,
    treatment:
      'Uproot and destroy severely infected plants. Use clean, certified cuttings next season and control whitefly vectors.',
    image_url:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23166534"/><text x="50%25" y="50%25" fill="%23a6f4c5" font-family="sans-serif" font-size="20" text-anchor="middle">Cassava leaf</text></svg>',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60000).toISOString(),
  },
];

export const mockAlerts: Alert[] = [
  {
    id: 'a1',
    type: 'low_moisture',
    message:
      'Soil moisture on North maize block dropped to 28%, below the 35% target for this stage. Consider irrigating.',
    severity: 'warning',
    is_read: false,
    context: { field_id: 'fld1', soil_moisture: 28 },
    created_at: new Date(Date.now() - 90 * 60000).toISOString(),
  },
  {
    id: 'a2',
    type: 'disease_risk',
    message:
      'Warm, humid conditions over the next 3 days raise leaf blight risk on maize. Scout your leaves.',
    severity: 'warning',
    is_read: false,
    context: { field_id: 'fld1' },
    created_at: new Date(Date.now() - 5 * 60 * 60000).toISOString(),
  },
  {
    id: 'a3',
    type: 'weather',
    message: '18 mm of rain forecast for Rweru sector. You may delay planned irrigation.',
    severity: 'info',
    is_read: false,
    context: {},
    created_at: new Date(Date.now() - 8 * 60 * 60000).toISOString(),
  },
  {
    id: 'a4',
    type: 'system',
    message:
      'Sensor node node-bugesera-03 on East cassava has been offline for 26 hours. Battery may be depleted.',
    severity: 'info',
    is_read: true,
    context: { field_id: 'fld3' },
    created_at: new Date(Date.now() - 26 * 60 * 60000).toISOString(),
  },
];

export const mockSessions: ChatSession[] = [
  { id: 's1', title: 'Irrigating beans', created_at: new Date(Date.now() - 86400000).toISOString() },
  {
    id: 's2',
    title: 'Maize blight treatment',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export const mockMessages: Record<string, ChatMessage[]> = {
  s1: [
    {
      id: 'm1',
      role: 'user',
      content: 'When should I irrigate my beans at flowering?',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'm2',
      role: 'assistant',
      content:
        'At flowering, beans are most sensitive to water stress. Irrigate when soil moisture in the top 20 cm falls below about 35%. Early morning is best to limit evaporation. Right now your Riverside beans field reads 41%, so you can wait one to two days and recheck.',
      sources: [
        {
          title: 'Bean water management — RAB guide',
          ref: 'rab-beans-2023',
          snippet: 'Flowering and pod-fill are the critical periods for irrigation in common bean.',
        },
        {
          title: 'Irrigation scheduling basics',
          ref: 'fao-irrig-04',
          snippet: 'Maintain soil moisture between 60–80% of field capacity during flowering.',
        },
      ],
      created_at: new Date(Date.now() - 86400000 + 5000).toISOString(),
    },
  ],
  s2: [],
};

export const mockDocuments: KnowledgeDoc[] = [
  {
    id: 'doc1',
    title: 'RAB Maize Production Handbook',
    category: 'Crops',
    language: 'en',
    chunks: 142,
    embedded: true,
    updated_at: '2025-06-01T08:00:00Z',
  },
  {
    id: 'doc2',
    title: 'Kuhira mu Buryo bwiza (Irrigation guide)',
    category: 'Water',
    language: 'rw',
    chunks: 88,
    embedded: true,
    updated_at: '2025-05-14T08:00:00Z',
  },
  {
    id: 'doc3',
    title: 'Common bean pests and diseases',
    category: 'Pests',
    language: 'en',
    chunks: 61,
    embedded: false,
    updated_at: '2025-07-02T08:00:00Z',
  },
];

/** Deterministic pseudo-random generator so charts are stable across renders. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateReadings(field: string, points: number, stepMs: number) {
  const rand = seeded(field.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const now = Date.now();
  const out = [];
  for (let i = points - 1; i >= 0; i--) {
    const t = now - i * stepMs;
    const dayCycle = Math.sin((t / (24 * 60 * 60000)) * Math.PI * 2);
    out.push({
      recorded_at: new Date(t).toISOString(),
      soil_moisture: Math.round((34 + dayCycle * 6 + (rand() - 0.5) * 4) * 10) / 10,
      temperature: Math.round((23 + dayCycle * 5 + (rand() - 0.5) * 2) * 10) / 10,
      humidity: Math.round((62 - dayCycle * 10 + (rand() - 0.5) * 6) * 10) / 10,
      rainfall: Math.max(0, Math.round((rand() > 0.85 ? rand() * 8 : 0) * 10) / 10),
    });
  }
  return out;
}
