import { app } from './backend/app.js';

const port = Number(process.env.PORT || 5000);
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`RKR TOUR running on port ${port}`));
}

export default app;
