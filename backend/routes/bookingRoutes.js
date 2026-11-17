import { Router } from 'express';
import { createBooking,getBooking,listBookings,updateBooking } from '../controllers/bookingController.js';
import { bookingSchema,statusSchema,validateRequest } from '../middleware/validateRequest.js';
import { adminAuth } from '../middleware/adminAuth.js';
export const bookingRoutes = Router();
bookingRoutes.post('/', validateRequest(bookingSchema), createBooking);
bookingRoutes.get('/', adminAuth, listBookings);
bookingRoutes.get('/:id', adminAuth, getBooking);
bookingRoutes.patch('/:id/status', adminAuth, validateRequest(statusSchema), updateBooking);
