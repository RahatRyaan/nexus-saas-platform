import { Router } from 'express';
import { KnowledgeController } from './knowledge.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { upload } from '../../utils/fileUpload';
import { planGate } from '../../middleware/planGate';

export const knowledgeRouter = Router();

knowledgeRouter.use(authenticate);

knowledgeRouter.post('/upload', upload.single('file'), asyncHandler(KnowledgeController.upload));
knowledgeRouter.get('/', asyncHandler(KnowledgeController.list));
knowledgeRouter.get('/search', planGate('pro'), asyncHandler(KnowledgeController.search));
knowledgeRouter.get('/:id', asyncHandler(KnowledgeController.getById));
knowledgeRouter.delete('/:id', asyncHandler(KnowledgeController.delete));
