import { Router } from 'express';
import { listVehicles } from '../controllers/vehicleController.js';
export const vehicleRoutes = Router();
vehicleRoutes.get('/', listVehicles);
