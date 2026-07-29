import { http, HttpResponse } from 'msw';
import {
  generateReadings,
  mockAlerts,
  mockCrops,
  mockDiseaseReports,
  mockDocuments,
  mockFarms,
  mockFields,
  mockMessages,
  mockNodes,
  mockRecommendations,
  mockSessions,
  mockUser,
  mockUsers,
} from './data';
import type {
  Alert,
  ChatMessage,
  DiseaseReport,
  Farm,
  Field,
  Recommendation,
} from '@/lib/schemas';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
const u = (p: string) => `${BASE}${p}`;

// mutable in-memory copies
const farms = [...mockFarms];
const fields = [...mockFields];
const alerts: Alert[] = [...mockAlerts];
const recommendations = [...mockRecommendations];
const diseaseReports = [...mockDiseaseReports];

const uid = () => Math.random().toString(36).slice(2, 10);
const ACCESS = 'mock-access-token';
const REFRESH = 'mock-refresh-token';
const DEV_CODE = '123456';

function page<T>(items: T[]) {
  return { count: items.length, next: null, previous: null, results: items };
}

export const handlers = [
  /* ---------- auth ---------- */
  // Mirrors the real backend: register/resend/reset return an OTP "challenge"
  // (with a dev_code in dev), and verify/login return { user, tokens }.
  http.post(u('/auth/register'), async () =>
    HttpResponse.json(
      { detail: 'OTP sent', identifier: mockUser.phone_number, purpose: 'register', dev_code: DEV_CODE },
      { status: 201 },
    ),
  ),
  http.post(u('/auth/otp/verify'), async () =>
    HttpResponse.json({ user: mockUser, tokens: { access: ACCESS, refresh: REFRESH } }),
  ),
  http.post(u('/auth/otp/resend'), async () =>
    HttpResponse.json({ detail: 'OTP resent', dev_code: DEV_CODE }),
  ),
  http.post(u('/auth/login'), async () =>
    HttpResponse.json({ user: mockUser, tokens: { access: ACCESS, refresh: REFRESH } }),
  ),
  http.post(u('/auth/token/refresh'), async () =>
    HttpResponse.json({ access: ACCESS, refresh: REFRESH }),
  ),
  http.post(u('/auth/password/reset/request'), async () =>
    HttpResponse.json({ detail: 'Reset code sent', identifier: mockUser.email, dev_code: DEV_CODE }),
  ),
  http.post(u('/auth/password/reset/confirm'), async () =>
    HttpResponse.json({ detail: 'Password updated' }),
  ),
  http.get(u('/auth/me'), () => HttpResponse.json(mockUser)),
  http.patch(u('/auth/me'), async ({ request }) => {
    const patch = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockUser, ...patch });
  }),

  /* ---------- farms ---------- */
  http.get(u('/farms'), () => HttpResponse.json(page(farms))),
  http.post(u('/farms'), async ({ request }) => {
    const body = (await request.json()) as Omit<Farm, 'id'>;
    const farm: Farm = { id: uid(), field_count: 0, node_count: 0, ...body };
    farms.unshift(farm);
    return HttpResponse.json(farm, { status: 201 });
  }),
  http.get(u('/farms/:id'), ({ params }) => {
    const farm = farms.find((f) => f.id === params.id);
    return farm ? HttpResponse.json(farm) : new HttpResponse(null, { status: 404 });
  }),
  http.patch(u('/farms/:id'), async ({ params, request }) => {
    const patch = (await request.json()) as Partial<Farm>;
    const idx = farms.findIndex((f) => f.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    farms[idx] = { ...farms[idx]!, ...patch };
    return HttpResponse.json(farms[idx]);
  }),
  http.delete(u('/farms/:id'), ({ params }) => {
    const idx = farms.findIndex((f) => f.id === params.id);
    if (idx !== -1) farms.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  /* ---------- fields ---------- */
  http.get(u('/fields'), ({ request }) => {
    const farm = new URL(request.url).searchParams.get('farm');
    const list = farm ? fields.filter((f) => f.farm === farm) : fields;
    return HttpResponse.json(page(list));
  }),
  http.post(u('/fields'), async ({ request }) => {
    const body = (await request.json()) as Omit<Field, 'id'>;
    const crop = mockCrops.find((c) => c.id === body.crop);
    const farm = farms.find((f) => f.id === body.farm);
    const field: Field = {
      id: uid(),
      crop_name: crop?.name,
      farm_name: farm?.name,
      ...body,
    };
    fields.unshift(field);
    return HttpResponse.json(field, { status: 201 });
  }),
  http.get(u('/fields/:id'), ({ params }) => {
    const field = fields.find((f) => f.id === params.id);
    return field ? HttpResponse.json(field) : new HttpResponse(null, { status: 404 });
  }),

  /* ---------- crops ---------- */
  http.get(u('/crops'), () => HttpResponse.json(page(mockCrops))),

  /* ---------- sensor nodes ---------- */
  http.get(u('/sensor-nodes'), ({ request }) => {
    const field = new URL(request.url).searchParams.get('field');
    const list = field ? mockNodes.filter((n) => n.field === field) : mockNodes;
    return HttpResponse.json(page(list));
  }),

  /* ---------- sensor readings ---------- */
  http.get(u('/sensor-readings'), ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const field = sp.get('field') ?? 'fld1';
    const agg = sp.get('agg') ?? 'hourly';
    const points = agg === 'daily' ? 30 : 24;
    const step = agg === 'daily' ? 24 * 60 * 60000 : 60 * 60000;
    return HttpResponse.json(page(generateReadings(field, points, step)));
  }),
  http.get(u('/sensor-readings/latest'), ({ request }) => {
    const field = new URL(request.url).searchParams.get('field') ?? 'fld1';
    const latest = generateReadings(field, 1, 60 * 60000)[0]!;
    return HttpResponse.json({ field, ...latest });
  }),

  /* ---------- recommendations ---------- */
  http.get(u('/recommendations'), ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const field = sp.get('field');
    const type = sp.get('type');
    let list = recommendations;
    if (field) list = list.filter((r) => r.field === field);
    if (type) list = list.filter((r) => r.type === type);
    return HttpResponse.json(page(list));
  }),
  ...(['irrigation', 'fertilizer', 'yield'] as const).map((type) =>
    http.post(u(`/recommendations/${type}`), async ({ request }) => {
      const { field } = (await request.json()) as { field: string };
      const fieldObj = fields.find((f) => f.id === field);
      const rec: Recommendation = {
        id: uid(),
        field,
        field_name: fieldObj?.name,
        type,
        decision:
          type === 'irrigation'
            ? 'Irrigate this evening'
            : type === 'fertilizer'
              ? 'Apply NPK top dressing'
              : 'Projected yield on target',
        value: type === 'irrigation' ? 10 : type === 'fertilizer' ? 40 : 5.1,
        unit: type === 'irrigation' ? 'mm' : type === 'fertilizer' ? 'kg/ha' : 't/ha',
        confidence: 0.7 + Math.random() * 0.25,
        details:
          'Generated from the latest sensor readings, crop growth stage, and 48-hour weather outlook for this field.',
        created_at: new Date().toISOString(),
      };
      recommendations.unshift(rec);
      return HttpResponse.json(rec, { status: 201 });
    }),
  ),

  /* ---------- diseases ---------- */
  http.post(u('/diseases/detect'), async ({ request }) => {
    const form = await request.formData();
    const field = String(form.get('field') ?? 'fld1');
    const fieldObj = fields.find((f) => f.id === field);
    const healthy = Math.random() > 0.55;
    const report: DiseaseReport = {
      id: uid(),
      field,
      field_name: fieldObj?.name,
      disease: healthy ? 'Healthy' : 'Maize leaf blight',
      confidence: healthy ? 0.94 : 0.89,
      is_healthy: healthy,
      treatment: healthy
        ? 'No action needed. Keep monitoring and maintain current watering.'
        : 'Remove affected leaves and apply a mancozeb-based fungicide at 2.5 g/L, repeating after 10 days.',
      image_url:
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%2315803d"/><text x="50%25" y="50%25" fill="%23ecfdf3" font-family="sans-serif" font-size="18" text-anchor="middle">Scanned leaf</text></svg>',
      created_at: new Date().toISOString(),
    };
    diseaseReports.unshift(report);
    return HttpResponse.json(report, { status: 201 });
  }),
  http.get(u('/diseases/reports'), ({ request }) => {
    const field = new URL(request.url).searchParams.get('field');
    const list = field ? diseaseReports.filter((d) => d.field === field) : diseaseReports;
    return HttpResponse.json(page(list));
  }),

  /* ---------- assistant ---------- */
  http.get(u('/assistant/sessions'), () => HttpResponse.json(page(mockSessions))),
  http.post(u('/assistant/sessions'), async () => {
    const session = { id: uid(), title: 'New chat', created_at: new Date().toISOString() };
    mockSessions.unshift(session);
    mockMessages[session.id] = [];
    return HttpResponse.json(session, { status: 201 });
  }),
  http.get(u('/assistant/sessions/:id/messages'), ({ params }) =>
    HttpResponse.json(page(mockMessages[String(params.id)] ?? [])),
  ),
  http.post(u('/assistant/chat'), async ({ request }) => {
    const { question, session } = (await request.json()) as {
      question: string;
      session?: string;
    };
    const sid = session ?? uid();
    const answer = buildAnswer(question);
    const msgs = mockMessages[sid] ?? [];
    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    };
    const botMsg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: answer.answer,
      sources: answer.sources,
      created_at: new Date().toISOString(),
    };
    mockMessages[sid] = [...msgs, userMsg, botMsg];
    return HttpResponse.json({ ...answer, session: sid });
  }),
  http.get(u('/assistant/documents'), () => HttpResponse.json(page(mockDocuments))),
  http.post(u('/assistant/documents'), async ({ request }) => {
    const body = (await request.json()) as { title: string; category?: string };
    const doc = {
      id: uid(),
      title: body.title,
      category: body.category ?? 'General',
      language: 'en' as const,
      chunks: 0,
      embedded: false,
      updated_at: new Date().toISOString(),
    };
    mockDocuments.unshift(doc);
    return HttpResponse.json(doc, { status: 201 });
  }),

  /* ---------- alerts ---------- */
  http.get(u('/alerts'), ({ request }) => {
    const unread = new URL(request.url).searchParams.get('unread');
    const list = unread === 'true' ? alerts.filter((a) => !a.is_read) : alerts;
    return HttpResponse.json(page(list));
  }),
  http.post(u('/alerts/:id/read'), ({ params }) => {
    const alert = alerts.find((a) => a.id === params.id);
    if (alert) alert.is_read = true;
    return HttpResponse.json(alert ?? {});
  }),

  /* ---------- reports ---------- */
  http.get(u('/reports/summary'), ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const farm = sp.get('farm') ?? 'f1';
    const farmObj = farms.find((f) => f.id === farm);
    const daily = generateReadings(farm, 30, 24 * 60 * 60000);
    const series = daily.map((d) => ({
      date: d.recorded_at.slice(0, 10),
      soil_moisture: d.soil_moisture,
      temperature: d.temperature,
      rainfall: d.rainfall,
    }));
    const avg = (k: 'soil_moisture' | 'temperature' | 'humidity') =>
      Math.round((daily.reduce((s, d) => s + d[k], 0) / daily.length) * 10) / 10;
    return HttpResponse.json({
      farm,
      farm_name: farmObj?.name,
      from: series[0]?.date ?? '',
      to: series[series.length - 1]?.date ?? '',
      avg_soil_moisture: avg('soil_moisture'),
      avg_temperature: avg('temperature'),
      avg_humidity: avg('humidity'),
      total_rainfall: Math.round(daily.reduce((s, d) => s + d.rainfall, 0) * 10) / 10,
      recommendations_count: recommendations.length,
      disease_scans: diseaseReports.length,
      alerts_count: alerts.length,
      yield_estimate: 5.2,
      series,
    });
  }),
  http.get(u('/reports/export'), ({ request }) => {
    const format = new URL(request.url).searchParams.get('format') ?? 'csv';
    if (format === 'csv') {
      return new HttpResponse('date,soil_moisture,temperature,rainfall\n', {
        headers: { 'Content-Type': 'text/csv' },
      });
    }
    return new HttpResponse('%PDF-1.4 mock', { headers: { 'Content-Type': 'application/pdf' } });
  }),

  /* ---------- weather ---------- */
  http.get(u('/weather/forecast'), ({ request }) => {
    const farm = new URL(request.url).searchParams.get('farm') ?? 'f1';
    const days = Array.from({ length: 5 }).map((_, i) => {
      const date = new Date(Date.now() + i * 86400000);
      return {
        date: date.toISOString().slice(0, 10),
        temp_min: 16 + (i % 3),
        temp_max: 26 + (i % 4),
        humidity: 60 + i * 2,
        rainfall_mm: i === 3 ? 18 : i === 1 ? 4 : 0,
        summary: i === 3 ? 'Rain' : i % 2 === 0 ? 'Partly cloudy' : 'Sunny',
      };
    });
    return HttpResponse.json({ farm, days });
  }),

  /* ---------- admin ---------- */
  http.get(u('/admin-api/users'), () => HttpResponse.json(page(mockUsers))),
  http.get(u('/admin-api/sensor-nodes'), () => HttpResponse.json(page(mockNodes))),
  http.get(u('/admin-api/documents'), () => HttpResponse.json(page(mockDocuments))),
];

function buildAnswer(question: string): {
  answer: string;
  sources: { title: string; ref: string; snippet: string }[];
} {
  const q = question.toLowerCase();
  if (q.includes('irrigat') || q.includes('kuhira') || q.includes('water')) {
    return {
      answer:
        'For most crops in Bugesera, irrigate early in the morning when soil moisture in the top 20 cm falls below about 35%. Your fields report between 28% and 41% right now, so North maize block is the priority — a light 10–12 mm pass tomorrow morning is enough. Avoid midday watering to reduce evaporation.',
      sources: [
        {
          title: 'Irrigation scheduling basics',
          ref: 'fao-irrig-04',
          snippet: 'Water early morning; target 60–80% of field capacity in the root zone.',
        },
        {
          title: 'Bugesera water management notes',
          ref: 'rab-bug-11',
          snippet: 'Light frequent passes suit the sandy loam soils near Rweru.',
        },
      ],
    };
  }
  if (q.includes('blight') || q.includes('disease') || q.includes('indwara') || q.includes('pest')) {
    return {
      answer:
        'Maize leaf blight shows as long grey-green lesions on lower leaves. Remove and burn affected leaves, then apply a mancozeb-based fungicide at 2.5 g/L and repeat after 10 days. Wider spacing and morning watering keep leaves drier and slow the spread.',
      sources: [
        {
          title: 'Maize disease field guide',
          ref: 'rab-maize-07',
          snippet: 'Northern leaf blight is managed with resistant varieties and timely fungicide.',
        },
      ],
    };
  }
  if (q.includes('fertiliz') || q.includes('ifumbire') || q.includes('npk')) {
    return {
      answer:
        'At the vegetative stage, a balanced NPK 17-17-17 top dressing of around 40–45 kg/ha supports leaf and stem growth. Split the application and water lightly afterward so nutrients reach the roots without leaching.',
      sources: [
        {
          title: 'Fertilizer recommendations by growth stage',
          ref: 'rab-fert-02',
          snippet: 'Top-dress nitrogen during vegetative growth for maize and beans.',
        },
      ],
    };
  }
  return {
    answer:
      'Here is what I can help with: irrigation timing, fertilizer rates, disease identification and treatment, and reading your sensor data. Ask about a specific field or crop and I will use your latest readings and the knowledge base to answer.',
    sources: [
      {
        title: 'SmartMurima assistant overview',
        ref: 'sm-help-01',
        snippet: 'The assistant combines your live sensor data with an agronomy knowledge base.',
      },
    ],
  };
}
