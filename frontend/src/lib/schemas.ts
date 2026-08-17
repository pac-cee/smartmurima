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

// Login and OTP-verify both return { user, tokens: { access, refresh } }.
export const authResultSchema = z.object({
  user: userSchema,
  tokens: tokenPairSchema,
});
export type AuthResult = z.infer<typeof authResultSchema>;

// register / otp-resend / password-reset-request all return an OTP "challenge":
// { identifier, purpose, expires_at, detail?, dev_code? }. In development
// (console SMS gateway) the backend also returns `dev_code`.
export const otpChallengeSchema = z.object({
  identifier: z.string().optional(),
  purpose: z.string().optional(),
  expires_at: z.string().optional(),
  detail: z.string().optional(),
  dev_code: z.string().optional(),
});
export type OtpChallenge = z.infer<typeof otpChallengeSchema>;

// Self-registration is always a farmer account; the backend forces the role, so
// the client never sends one. `roleSchema`/`Role` remain for the user model and
// nav-item gating. `POST /auth/register` returns an OTP challenge (see
// `otpChallengeSchema`), not tokens. At least one of email/phone must be
// provided; both are otherwise optional.
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

export const otpVerifyInput = z.object({
  identifier: z.string(),
  code: z.string().length(6),
});
export type OtpVerifyInput = z.infer<typeof otpVerifyInput>;

export const otpPurpose = z.enum(['register', 'login', 'reset']);

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

export const sensorNodeSchema = z.object({
  id: idSchema,
  field: idSchema,
  field_name: z.string().optional(),
  device_id: z.string(),
  status: nodeStatusSchema,
  battery: z.number(),
  last_seen: z.string().nullable(),
});
export type SensorNode = z.infer<typeof sensorNodeSchema>;

/* ---------- sensor readings ---------- */
export const sensorReadingSchema = z.object({
  soil_moisture: z.number(),
  // Optional sensors: temperature/humidity/rainfall are nullable on the model,
  // and aggregate buckets can also come back null.
  temperature: z.number().nullable(),
  humidity: z.number().nullable(),
  rainfall: z.number().nullable(),
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

/* ---------- reports ---------- */
export const reportSummarySchema = z.object({
  farm: idSchema,
  farm_name: z.string().optional(),
  from: z.string(),
  to: z.string(),
  avg_soil_moisture: z.number(),
  avg_temperature: z.number(),
  avg_humidity: z.number(),
  total_rainfall: z.number(),
  recommendations_count: z.number(),
  disease_scans: z.number(),
  alerts_count: z.number(),
  yield_estimate: z.number(),
  series: z.array(
    z.object({
      date: z.string(),
      soil_moisture: z.number(),
      temperature: z.number(),
      rainfall: z.number(),
    }),
  ),
});
export type ReportSummary = z.infer<typeof reportSummarySchema>;

/* ---------- weather ---------- */
export const weatherDaySchema = z.object({
  date: z.string(),
  temp_min: z.number(),
  temp_max: z.number(),
  humidity: z.number(),
  rainfall_mm: z.number(),
  summary: z.string(),
});
export const weatherForecastSchema = z.object({
  farm: idSchema,
  days: z.array(weatherDaySchema),
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
