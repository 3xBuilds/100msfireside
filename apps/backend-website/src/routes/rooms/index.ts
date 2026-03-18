import { Elysia } from 'elysia';
import { roomManagementRoutes } from './room-management';
import { participantRoutes } from './participants';
import { chatRoutes } from './chat';
import { integrationRoutes } from './integrations';
import { tippingRoutes } from './tipping';
import { summaryRoutes } from './summary';
import { eventRoutes } from './events';

/**
 * Main room routes aggregator
 * 
 * This file combines all room-related route modules:
 * - Room Management: CRUD operations for rooms
 * - Participants: Participant management and role handling
 * - Chat: Message handling and chat history
 * - Integrations: HMS API and external service interactions
 * - Tipping: Tip tracking and statistics
 * - Summary: Aggregated room statistics and summary
 */
export const roomRoutes = new Elysia({ prefix: '/rooms' })
  .use(roomManagementRoutes)
  .use(participantRoutes)
  .use(chatRoutes)
  .use(integrationRoutes)
  .use(tippingRoutes)
  .use(summaryRoutes)
  .use(eventRoutes);
