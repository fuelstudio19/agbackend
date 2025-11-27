import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from '../config/swagger';

const router = Router();

// Serve swagger docs
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'API Documentation',
}));

// Endpoint to get the swagger.json file
router.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

export default router; 