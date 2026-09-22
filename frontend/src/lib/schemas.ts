import { z } from 'zod';

/* ---------- shared ----------
 * The backend is the source of truth. Two Django REST Framework rendering
 * quirks drive the coercions below:
 *   - Integer primary keys and FK ids serialize as JSON numbers. The frontend
 *     treats ids as strings (routing, query params, map keys), so we coerce.
 *   - DecimalField renders as a string (COERCE_DECIMAL_TO_STRING defaults on),
 *     e.g. "2.50", so numeric decimals are coerced back to numbers.
 */
export const idSchema = z.coerce.string();
export const decimalSchema = z.coerce.number();

export const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    count: z.number(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  });

export const apiError = z.object({
  detail: z.string().optional(),
  code: z.string().optional(),
  errors: z.record(z.array(z.string())).optional(),
});
export type ApiError = z.infer<typeof apiError>;

/* ---------- auth ---------- */
export const roleSchema = z.enum(['farmer', 'coop_admin', 'extension', 'admin']);
export type Role = z.infer<typeof roleSchema>;

export const languageSchema = z.enum(['rw', 'en']);

export const userSchema = z.object({
  id: idSchema,
  username: z.string().optional(),
  full_name: z.string(),
  // Registration allows a blank email (phone-only accounts), so do not require
  // a valid email format here.
  email: z.string(),
  phone_number: z.string(),
  role: roleSchema,
  language: languageSchema,
  is_active: z.boolean(),
  // Optional sector Location the account is anchored to. `location` is the id;
  // `location_path` is a display string like "Province / District / Sector".
  // Both are coded defensively (nullable/optional) in case an older backend
  // build omits them.
  location: idSchema.nullable().optional(),
  location_path: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export type User = z.infer<typeof userSchema>;

export const tokenPairSchema = z.object({
  access: z.string(),
  refresh: z.string(),
});
export type TokenPair = z.infer<typeof tokenPairSchema>;

// Login and register both return { user, tokens: { access, refresh } }.
export const authResultSchema = z.object({
  user: userSchema,
  tokens: tokenPairSchema,
});
export type AuthResult = z.infer<typeof authResultSchema>;

// `POST /auth/password/reset/request` returns a reset "challenge":
// { identifier, purpose, expires_at, detail?, dev_code? }. In development
// (console SMS gateway) the backend also returns `dev_code` so the reset can
// be completed without a real SMS.
export const resetChallengeSchema = z.object({
  identifier: z.string().optional(),
  purpose: z.string().optional(),
  expires_at: z.string().optional(),
  detail: z.string().optional(),
  dev_code: z.string().optional(),
});
export type ResetChallenge = z.infer<typeof resetChallengeSchema>;

// Self-registration is always a farmer account; the backend forces the role, so
// the client never sends one. `roleSchema`/`Role` remain for the user model and
// nav-item gating. `POST /auth/register` is single-step: it returns the same
// { user, tokens } shape as login, so the client is signed in straight away.
// At least one of email/phone must be provided; both are otherwise optional.
export const registerInput = z
  .object({
    full_name: z.string().min(2),
    // Empty string is allowed (the field was left blank); a non-empty value must
    // be a valid email. The refine below enforces "at least one contact".
    email: z.union([z.string().email(), z.literal('')]).optional(),
    phone_number: z.union([z.string().min(7), z.literal('')]).optional(),
    password: z.string().min(8),
    language: languageSchema.optional(),
    // Optional sector Location id chosen from the cascading location picker.
    location: z.string().optional(),
  })
  .refine((v) => Boolean(v.email) || Boolean(v.phone_number), {
    message: 'Enter an email or a phone number',
    path: ['phone_number'],
  });
export type RegisterInput = z.infer<typeof registerInput>;

export const changePasswordInput = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordInput>;

export const loginInput = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInput>;

export const passwordResetConfirmInput = z.object({
  identifier: z.string(),
  code: z.string().length(6),
  new_password: z.string().min(8),
});
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmInput>;

/* ---------- locations (public read) ----------
 * Cascading administrative units: province -> district -> sector. The list
 * endpoint returns a plain array (not paginated). `parent`/`parent_name` are
 * null for the top level (provinces).
 */
export const locationLevelSchema = z.enum(['province', 'district', 'sector']);
export type LocationLevel = z.infer<typeof locationLevelSchema>;

export const locationSchema = z.object({
  id: idSchema,
  name: z.string(),
  level: locationLevelSchema,
  parent: idSchema.nullable(),
  parent_name: z.string().nullable().optional(),
});
export type Location = z.infer<typeof locationSchema>;

export const locationListSchema = z.array(locationSchema);

/* ---------- farms / fields / crops / nodes ---------- */
export const farmSchema = z.object({
  id: idSchema,
  name: z.string(),
  sector: z.string(),
  latitude: decimalSchema,
  longitude: decimalSchema,
  area_hectares: decimalSchema,
  field_count: z.number().optional(),
  node_count: z.number().optional(),
  // Optional sector Location: `location` is the id, `location_name` its label.
  location: idSchema.nullable().optional(),
  location_name: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export type Farm = z.infer<typeof farmSchema>;

export const farmInput = z.object({
  name: z.string().min(2),
  area_hectares: z.number().positive(),
  // Sector/location come from the cascading picker (province -> district -> sector).
  location: z.string().optional(),
});
export type FarmInput = z.infer<typeof farmInput>;

// Matches apps.farms.models.GrowthStage.
export const growthStageSchema = z.enum([
  'germination',
  'vegetative',
  'flowering',
  'maturity',
  'harvest',
]);

export const fieldSchema = z.object({
  id: idSchema,
  farm: idSchema,
  farm_name: z.string().optional(),
  name: z.string(),
  // crop is a nullable FK (SET_NULL).
  crop: idSchema.nullable(),
  crop_name: z.string().nullable().optional(),
  planting_date: z.string().nullable(),
  growth_stage: growthStageSchema,
  area_hectares: decimalSchema,
});
export type Field = z.infer<typeof fieldSchema>;

export const fieldInput = z.object({
  farm: z.string(),
  name: z.string().min(2),
  // Farmers type the crop name freely (crops are open-ended); backend get-or-creates it.
  crop_name: z.string().min(2),
  planting_date: z.string(),
  growth_stage: growthStageSchema,
  area_hectares: z.number().positive(),
});
export type FieldInput = z.infer<typeof fieldInput>;

export const cropSchema = z.object({
  id: idSchema,
  name: z.string(),
  base_temp: decimalSchema,
  season: z.string(),
});
export type Crop = z.infer<typeof cropSchema>;

// Matches apps.farms.models.NodeStatus.
export const nodeStatusSchema = z.enum(['active', 'inactive', 'maintenance']);
export type NodeStatus = z.infer<typeof nodeStatusSchema>;

export const sensorNodeInput = z.object({
  field: z.string().min(1),
  device_id: z.string().min(2),
  status: nodeStatusSchema.optional(),
  battery: z.number().optional(),
});
export type SensorNodeInput = z.infer<typeof sensorNodeInput>;

export const pumpModeSchema = z.enum(['auto', 'manual']);
export type PumpMode = z.infer<typeof pumpModeSchema>;

// A field device. `field` is null while the board has announced itself but
// nobody has claimed it yet -- that is the discovery state the Devices tab
// lists first.
export const sensorNodeSchema = z.object({
  id: idSchema,
  field: idSchema.nullable(),
  field_name: z.string().nullable().optional(),
  farm_name: z.string().nullable().optional(),
  device_id: z.string(),
  hardware_id: z.string().nullable().optional(),
  name: z.string().optional(),
  status: nodeStatusSchema,
  battery: z.number(),
  last_seen: z.string().nullable(),
  is_claimed: z.boolean(),
  is_online: z.boolean(),
  pump_mode: pumpModeSchema,
  pump_on: z.boolean().nullable(),
  pump_state: z.boolean(),
  dry_level: z.number(),
  wet_level: z.number(),
});
export type SensorNode = z.infer<typeof sensorNodeSchema>;

/* ---------- sensor readings ---------- */
// Every channel except soil moisture is nullable: a given probe may not have
// that sensor, and aggregate buckets come back null when nothing reported.
export const sensorReadingSchema = z.object({
  soil_moisture: z.number(),
  temperature: z.number().nullable(),
  humidity: z.number().nullable(),
  rainfall: z.number().nullable(),
  ph: z.number().nullable().optional(),
  ec: z.number().nullable().optional(),
  nitrogen: z.number().nullable().optional(),
  phosphorus: z.number().nullable().optional(),
  potassium: z.number().nullable().optional(),
  device_id: z.string().optional(),
  recorded_at: z.string(),
});
export type SensorReading = z.infer<typeof sensorReadingSchema>;

// GET /sensor-readings/latest returns the latest reading, or `null` when the
// field has no telemetry yet.
export const latestReadingSchema = sensorReadingSchema.nullable();
export type LatestReading = z.infer<typeof latestReadingSchema>;

/* ---------- recommendations ---------- */
export const recommendationTypeSchema = z.enum(['irrigation', 'fertilizer', 'yield']);
export type RecommendationType = z.infer<typeof recommendationTypeSchema>;

export const recommendationSchema = z.object({
  id: idSchema,
  field: idSchema,
  field_name: z.string().optional(),
  type: recommendationTypeSchema,
  decision: z.string(),
  value: z.number().nullable(),
  unit: z.string(),
  confidence: z.number(),
  // `details` is a JSON object on the backend (model uses JSONField); a plain
  // string is also accepted for backward/mock compatibility.
  details: z.union([z.string(), z.record(z.unknown())]).nullable().optional(),
  created_at: z.string(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

// GET /recommendations/latest?field=<id> returns the freshest auto-generated
// bundle for a field: one item per advice type. Items are lighter than the
// history `Recommendation` (no id/created_at). Coded defensively so a partial
// or empty bundle (field with no advice yet) still parses.
export const adviceItemSchema = z.object({
  type: recommendationTypeSchema,
  decision: z.string(),
  value: z.number().nullable().optional(),
  unit: z.string().optional(),
  confidence: z.number(),
  details: z.union([z.string(), z.record(z.unknown())]).nullable().optional(),
});
export type AdviceItem = z.infer<typeof adviceItemSchema>;

export const latestRecommendationsSchema = z.object({
  field: idSchema.optional(),
  generated_at: z.string().nullable().optional(),
  items: z.array(adviceItemSchema).optional(),
});
export type LatestRecommendations = z.infer<typeof latestRecommendationsSchema>;

/* ---------- diseases ---------- */
export const diseaseReportSchema = z.object({
  id: idSchema,
  field: idSchema,
  field_name: z.string().optional(),
  disease: z.string(),
  confidence: z.number(),
  is_healthy: z.boolean(),
  treatment: z.string(),
  image_url: z.string().nullable(),
  created_at: z.string(),
});
export type DiseaseReport = z.infer<typeof diseaseReportSchema>;

/* ---------- assistant ---------- */
export const sourceSchema = z.object({
  title: z.string(),
  ref: z.string(),
  snippet: z.string(),
});
export type Source = z.infer<typeof sourceSchema>;

export const chatRoleSchema = z.enum(['user', 'assistant']);

export const chatMessageSchema = z.object({
  id: idSchema,
  role: chatRoleSchema,
  content: z.string(),
  sources: z.array(sourceSchema).optional(),
  created_at: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatSessionSchema = z.object({
  id: idSchema,
  title: z.string(),
  created_at: z.string(),
});
export type ChatSession = z.infer<typeof chatSessionSchema>;

export const chatResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(sourceSchema),
  session: idSchema,
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

/* ---------- alerts ---------- */
export const alertTypeSchema = z.enum(['low_moisture', 'disease_risk', 'weather', 'system']);
export type AlertType = z.infer<typeof alertTypeSchema>;

export const severitySchema = z.enum(['info', 'warning', 'critical']);
export type Severity = z.infer<typeof severitySchema>;

export const alertSchema = z.object({
  id: idSchema,
  type: alertTypeSchema,
  message: z.string(),
  severity: severitySchema.optional(),
  is_read: z.boolean(),
  // Arbitrary JSON payload (e.g. { field_id, soil_moisture }).
  context: z.record(z.unknown()).optional(),
  created_at: z.string(),
});
export type Alert = z.infer<typeof alertSchema>;

/* ---------- reports ----------
 * Mirrors ReportService.summary(). Every aggregate is nullable: a farm with no
 * telemetry in the range is a normal, renderable state, not an error.
 */
const nullableNumber = z.number().nullable();

export const reportSeriesPointSchema = z.object({
  date: z.string(),
  soil_moisture: nullableNumber,
  temperature: nullableNumber,
  humidity: nullableNumber,
  rainfall: nullableNumber,
  reading_count: z.number(),
});
export type ReportSeriesPoint = z.infer<typeof reportSeriesPointSchema>;

// Generic {label,count} slice, used by the moisture-band and crop-health pies.
export const reportSliceSchema = z.object({
  label: z.string(),
  count: z.number(),
});
export type ReportSlice = z.infer<typeof reportSliceSchema>;

export const reportPerFieldSchema = z.object({
  field: idSchema,
  name: z.string(),
  crop: z.string().nullable(),
  avg_soil_moisture: nullableNumber,
  avg_temperature: nullableNumber,
  reading_count: z.number(),
});
export type ReportPerField = z.infer<typeof reportPerFieldSchema>;

export const reportSummarySchema = z.object({
  farm: idSchema.nullable(),
  field_count: z.number(),
  recommendation_count: z.number(),
  recommendations_by_type: z.record(z.number()),
  readings: z.object({
    avg_soil_moisture: nullableNumber,
    avg_temperature: nullableNumber,
    avg_humidity: nullableNumber,
    min_soil_moisture: nullableNumber,
    max_soil_moisture: nullableNumber,
    reading_count: z.number(),
  }),
  disease_reports: z.object({
    total: z.number(),
    unhealthy: z.number(),
  }),
  yield: z
    .object({
      decision: z.string(),
      value: nullableNumber,
      unit: z.string(),
      confidence: nullableNumber,
      created_at: z.string(),
    })
    .nullable(),
  series: z.array(reportSeriesPointSchema),
  moisture_distribution: z.array(reportSliceSchema),
  advice_breakdown: z.array(z.object({ type: z.string(), count: z.number() })),
  health_breakdown: z.array(reportSliceSchema),
  per_field: z.array(reportPerFieldSchema),
  empty: z.boolean(),
  generated_at: z.string(),
});
export type ReportSummary = z.infer<typeof reportSummarySchema>;

/* ---------- weather ---------- */
export const weatherDaySchema = z.object({
  date: z.string(),
  temp_min: z.number().nullable(),
  temp_max: z.number().nullable(),
  humidity: z.number().nullable(),
  rainfall_mm: z.number().nullable(),
  summary: z.string(),
});
export type WeatherDay = z.infer<typeof weatherDaySchema>;
export const weatherForecastSchema = z.object({
  farm: idSchema,
  days: z.array(weatherDaySchema),
  // Where the forecast came from: a live provider call, a cached/last-known
  // record, or the neutral offline estimate. `stale` drives the "estimated"
  // badge so an offline outlook is never shown as a real forecast.
  source: z.enum(['live', 'cache', 'last_known', 'neutral']).optional(),
  stale: z.boolean().optional(),
});
export type WeatherForecast = z.infer<typeof weatherForecastSchema>;

/* ---------- admin ---------- */
export const knowledgeDocSchema = z.object({
  id: idSchema,
  title: z.string(),
  category: z.string(),
  language: languageSchema,
  chunks: z.number(),
  embedded: z.boolean(),
  updated_at: z.string(),
});
export type KnowledgeDoc = z.infer<typeof knowledgeDocSchema>;
