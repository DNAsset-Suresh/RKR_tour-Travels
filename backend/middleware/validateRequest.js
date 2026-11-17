import { z } from 'zod';
const text = (min, max) => z.string().trim().min(min).max(max);
const optionalText = max => z.string().trim().max(max).optional().default('');
const phone = text(7, 25).refine(v => /^\+?[\d ()-]+$/.test(v) && /^\d{7,15}$/.test(v.replace(/\D/g, '')), 'Enter a valid mobile number with 7–15 digits.');
const email = z.union([z.email().max(254), z.literal('')]).optional().default('');
export const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v && v >= todayIST();
}, 'Choose a valid date today or later (India time).');
export const bookingSchema = z.object({
  customer_name: text(2, 100), mobile_number: phone, email,
  pickup_location: text(2, 200), destination: text(2, 200), journey_date: date,
  pickup_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid pickup time.'),
  vehicle_id: z.number().int().positive(), passenger_count: z.number().int().min(1).max(500),
  trip_type: z.enum(['one_way', 'round_trip', 'local', 'outstation', 'airport']),
  additional_requirements: optionalText(2000), quote_id: z.uuid().optional()
}).strict().refine(v => new Date(`${v.journey_date}T${v.pickup_time}:00+05:30`) > new Date(), { path: ['pickup_time'], message: 'Choose a pickup time in the future (India time).' });
export const contactSchema = z.object({ customer_name: text(2,100), mobile_number: phone, email, subject: text(3,150), message: text(10,3000) }).strict();
export const statusSchema = z.object({ booking_status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']) }).strict();
export function validateRequest(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return res.status(422).json({ error: { message: 'Please check the highlighted details.', fields: Object.fromEntries(result.error.issues.map(i => [i.path.join('.'), i.message])) } });
    req.body = result.data; next();
  };
}
