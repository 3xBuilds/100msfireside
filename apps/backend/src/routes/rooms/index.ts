import { Elysia } from 'elysia';
import { roomManagementRoutes } from './room-management';
import { participantRoutes } from './participants';
import { chatRoutes } from './chat';
import { integrationRoutes } from './integrations';
import { tippingRoutes } from './tipping';
import { summaryRoutes } from './summary';
import { xmtpRoutes } from './xmtp';

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
 * - XMTP: Decentralized messaging group management
 */
export const roomRoutes = new Elysia({ prefix: '/rooms' })
  .use(roomManagementRoutes)
  .use(participantRoutes)
  .use(chatRoutes)
  .use(integrationRoutes)
  .use(tippingRoutes)
  .use(summaryRoutes)
  .use(xmtpRoutes);
