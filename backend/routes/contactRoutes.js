import { Router } from 'express';
import { createContact } from '../controllers/contactController.js';
import { contactSchema,validateRequest } from '../middleware/validateRequest.js';
export const contactRoutes = Router();
contactRoutes.post('/', validateRequest(contactSchema), createContact);
